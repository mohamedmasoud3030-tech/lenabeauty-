import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-ignore — plain-JS launch tooling shipped without type declarations
import { renderMembershipBootstrap } from "../../scripts/launch/render-membership-bootstrap.mjs";
import {
  CANONICAL_CENTER_ID,
  NON_MEMBER_USER_ID,
  OWNER_A_USER_ID,
  OWNER_B_USER_ID,
  SECOND_CENTER_ID,
  TENANT_TABLES,
  asRole,
  createBoundaryDatabase,
  expectRefused,
  scalar,
  setActor,
} from "./helpers/pglite-tenant.mjs";

/**
 * TENANT ISOLATION — proven with two real centers, not asserted in prose.
 *
 * `20260628000001_enable_rls.sql` states its own rationale: "isolation is
 * enforced by center membership so the publishable (anon) key alone cannot read
 * or write another center's data." That is the single guarantee standing
 * between a shared database and a cross-customer data breach, and until now it
 * was never executed against two tenants.
 *
 * `scripts/verify-rls-isolation.ts` covers the same ground but needs two live
 * Auth users (`TEST_USER_A_EMAIL`, …) and is not wired into any gate, so it
 * cannot fail a build. This file needs nothing but the repository: it applies
 * the canonical chain to an empty database, provisions two centers through the
 * SHIPPED bootstrap, and then reads every tenant table as each party.
 *
 * The parties:
 *   A   — ADMIN member of the canonical center (the first customer)
 *   B   — ADMIN member of a second center (the next customer)
 *   X   — a real Auth user with no membership anywhere at all
 *   anon — the role the browser uses before anyone signs in
 *
 * Every assertion is made through `SET ROLE authenticated`, i.e. through the
 * policies, never around them.
 */

const SEED = {
  A: { customer: "Customer A", service: "Service A", product: "Product A", employee: "Employee A" },
  B: { customer: "Customer B", service: "Service B", product: "Product B", employee: "Employee B" },
};

describe("tenant isolation across two centers", () => {
  let db;
  let ids = {};

  /** Acts as a signed-in user under the authenticated role. */
  async function asUser(userId, run) {
    await setActor(db, userId);
    return asRole(db, "authenticated", run);
  }

  beforeAll(async () => {
    const created = await createBoundaryDatabase();
    db = created.db;
    expect(created.failures).toEqual([]);

    // ── The second tenant. No migration seeds it; a real launch creates it.
    await db.query("INSERT INTO public.centers (id, name) VALUES ($1, $2)", [
      SECOND_CENTER_ID,
      "Second Salon",
    ]);
    await db.query(
      "INSERT INTO public.center_settings (center_id, name, currency, phone, address) VALUES ($1, $2, 'OMR', $3, $4)",
      [SECOND_CENTER_ID, "Second Salon", "90000002", "Salalah"],
    );
    await db.query(
      "UPDATE public.center_settings SET name = $1, phone = $2, address = $3 WHERE center_id = $4",
      ["Canonical Salon", "90000001", "Muscat", CANONICAL_CENTER_ID],
    );

    // ── Three real Auth users, then the SHIPPED bootstrap for two of them.
    for (const userId of [OWNER_A_USER_ID, OWNER_B_USER_ID, NON_MEMBER_USER_ID]) {
      await db.query("INSERT INTO auth.users (id) VALUES ($1::uuid)", [userId]);
    }
    await db.exec(renderMembershipBootstrap({
      userId: OWNER_A_USER_ID,
      centerId: CANONICAL_CENTER_ID,
      role: "ADMIN",
      fullName: "Owner A",
    }));
    await db.exec(renderMembershipBootstrap({
      userId: OWNER_B_USER_ID,
      centerId: SECOND_CENTER_ID,
      role: "ADMIN",
      fullName: "Owner B",
    }));

    // ── One row of every tenant-scoped shape in EACH center, seeded by the
    //    database owner so that both rows certainly exist before we assert that
    //    one of them is invisible.
    const perCenter = [
      [CANONICAL_CENTER_ID, "A"],
      [SECOND_CENTER_ID, "B"],
    ];
    for (const [centerId, key] of perCenter) {
      const seed = SEED[key];
      const customer = await db.query(
        "INSERT INTO public.customers (center_id, name) VALUES ($1, $2) RETURNING id",
        [centerId, seed.customer],
      );
      // A service cannot exist without a category (services_category_required)
      // and its price must be positive (services_sell_price_positive).
      const category = await db.query(
        "INSERT INTO public.service_categories (center_id, name) VALUES ($1, $2) RETURNING id",
        [centerId, `${seed.service} Category`],
      );
      const service = await db.query(
        "INSERT INTO public.services (center_id, category_id, name, price, duration_minutes) VALUES ($1, $2, $3, 10, 30) RETURNING id",
        [centerId, category.rows[0].id, seed.service],
      );
      await db.query(
        "INSERT INTO public.products (center_id, name, price, stock_quantity) VALUES ($1, $2, 5, 20)",
        [centerId, seed.product],
      );
      const employee = await db.query(
        "INSERT INTO public.employees (center_id, name, role, salary, base_salary) VALUES ($1, $2, 'Staff', 100, 100) RETURNING id",
        [centerId, seed.employee],
      );
      // An appointment must name its customer, service, staff member and time
      // (appointment_customer_service_staff_time_required).
      await db.query(
        "INSERT INTO public.appointments (center_id, customer_id, employee_id, service_id, date_time, status) VALUES ($1, $2, $3, $4, now() + interval '1 day', 'SCHEDULED')",
        [centerId, customer.rows[0].id, employee.rows[0].id, service.rows[0].id],
      );
      // VOID keeps this row clear of invoices_paid_totals_consistent, which
      // governs PAID invoices only. Isolation does not depend on the value.
      await db.query(
        "INSERT INTO public.invoices (center_id, customer_id, total_amount, status) VALUES ($1, $2, 25, 'VOID')",
        [centerId, customer.rows[0].id],
      );
      ids[key] = { customer: customer.rows[0].id, category: category.rows[0].id };
    }
  }, 180_000);

  afterAll(async () => {
    await db?.close?.();
  });

  it("gives each owner exactly one center, and the outsider none", async () => {
    const own = async (userId) => {
      await setActor(db, userId);
      return scalar(db, "SELECT app_private.user_center_ids() AS ids");
    };

    expect(await own(OWNER_A_USER_ID)).toEqual([CANONICAL_CENTER_ID]);
    expect(await own(OWNER_B_USER_ID)).toEqual([SECOND_CENTER_ID]);
    expect(await own(NON_MEMBER_USER_ID)).toEqual([]);
  });

  it("proves the control: both rows exist when RLS is not in the way", async () => {
    // Without this, "A sees one row" could pass simply because the other row was
    // never written. As the database owner (RLS bypassed) both centers' rows are
    // there — so the single row A sees is the POLICY working, not missing data.
    await setActor(db, null);
    await db.exec("RESET ROLE");
    for (const table of TENANT_TABLES) {
      expect(
        await scalar(db, `SELECT count(*)::int FROM public.${table}`),
        `${table}: the fixture must contain two rows`,
      ).toBe(2);
    }
    expect(await scalar(db, "SELECT count(*)::int FROM public.centers")).toBe(2);
  });

  it("shows an owner their own tenant rows and only those", async () => {
    await asUser(OWNER_A_USER_ID, async () => {
      for (const table of TENANT_TABLES) {
        // The row that exists and belongs to A...
        expect(
          await scalar(db, `SELECT count(*)::int FROM public.${table} WHERE center_id = $1`, [CANONICAL_CENTER_ID]),
          `${table}: A must see its own row`,
        ).toBe(1);
        // ...is the ONLY row A can see at all: no leak through an unfiltered read.
        expect(
          await scalar(db, `SELECT count(*)::int FROM public.${table}`),
          `${table}: A must not see B's row`,
        ).toBe(1);
      }
    });
  });

  it("hides another center's rows even when their id is known", async () => {
    // Knowing a foreign key is not authorization: a stolen id must still read
    // as an empty result rather than an error (errors would confirm existence).
    await asUser(OWNER_A_USER_ID, async () => {
      expect(await scalar(db, "SELECT count(*)::int FROM public.customers WHERE id = $1", [ids.B.customer]))
        .toBe(0);
      expect(await scalar(db, "SELECT name FROM public.customers WHERE id = $1", [ids.B.customer]))
        .toBeUndefined();
      expect(await scalar(db, "SELECT count(*)::int FROM public.centers WHERE id = $1", [SECOND_CENTER_ID]))
        .toBe(0);
      expect(await scalar(db, "SELECT count(*)::int FROM public.center_settings WHERE center_id = $1", [SECOND_CENTER_ID]))
        .toBe(0);
    });
  });

  it("refuses to let an owner write into another center", async () => {
    await asUser(OWNER_A_USER_ID, async () => {
      // WITH CHECK on the tenant policy must reject this outright.
      const message = await expectRefused(
        db,
        "INSERT INTO public.customers (center_id, name) VALUES ($1, 'Intruder')",
        [SECOND_CENTER_ID],
      );
      expect(message).toMatch(/row-level security policy/i);

      // Valid in every other respect — it even points at A's own category — so
      // the tenant policy is the only thing that can refuse it.
      const serviceMessage = await expectRefused(
        db,
        "INSERT INTO public.services (center_id, category_id, name, price, duration_minutes) VALUES ($1, $2, 'Intruder Service', 10, 30)",
        [SECOND_CENTER_ID, ids.A.category],
      );
      expect(serviceMessage).toMatch(/row-level security policy/i);
    });

    // The write really did not land.
    expect(await scalar(db, "SELECT count(*)::int FROM public.customers WHERE name = 'Intruder'")).toBe(0);
    expect(await scalar(db, "SELECT count(*)::int FROM public.services WHERE name = 'Intruder Service'")).toBe(0);
  });

  it("cannot corrupt another center's row through an update", async () => {
    await asUser(OWNER_A_USER_ID, async () => {
      const updated = await db.query("UPDATE public.customers SET name = 'Hijacked' WHERE id = $1", [ids.B.customer]);
      expect(updated.affectedRows ?? 0).toBe(0);
      // A blanket update is equally contained: A's own row is the only one visible.
      await db.query("UPDATE public.customers SET name = name");
    });

    expect(await scalar(db, "SELECT name FROM public.customers WHERE id = $1", [ids.B.customer]))
      .toBe("Customer B");
  });

  it("honours the admin role inside the right center only", async () => {
    await setActor(db, OWNER_A_USER_ID);
    expect(await scalar(db, "SELECT app_private.has_center_role($1::uuid, ARRAY['ADMIN'])", [CANONICAL_CENTER_ID]))
      .toBe(true);
    // Same person, same role, someone else's center: denied.
    expect(await scalar(db, "SELECT app_private.has_center_role($1::uuid, ARRAY['ADMIN'])", [SECOND_CENTER_ID]))
      .toBe(false);
  });

  it("gives a user with no membership nothing at all", async () => {
    await asUser(NON_MEMBER_USER_ID, async () => {
      for (const table of TENANT_TABLES) {
        expect(await scalar(db, `SELECT count(*)::int FROM public.${table}`), `${table}`).toBe(0);
      }
      // Not even the catalog: a signed-in stranger cannot enumerate tenants.
      expect(await scalar(db, "SELECT count(*)::int FROM public.centers")).toBe(0);
      expect(await scalar(db, "SELECT count(*)::int FROM public.center_settings")).toBe(0);

      const message = await expectRefused(
        db,
        "INSERT INTO public.customers (center_id, name) VALUES ($1, 'Outsider')",
        [CANONICAL_CENTER_ID],
      );
      expect(message).toMatch(/row-level security policy/i);
    });
  });

  it("keeps the anon role out of every table", async () => {
    // The published app ships this key in the browser bundle. It must be able
    // to do nothing but call the explicitly released public functions.
    await setActor(db, null);
    await asRole(db, "anon", async () => {
      for (const table of TENANT_TABLES) {
        const message = await expectRefused(db, `SELECT count(*)::int FROM public.${table}`);
        expect(message, `${table}`).toMatch(/permission denied/i);
      }
      expect(await expectRefused(db, "SELECT count(*)::int FROM public.centers"))
        .toMatch(/permission denied/i);
      expect(await expectRefused(db, "SELECT count(*)::int FROM public.center_memberships"))
        .toMatch(/permission denied/i);
      // profiles holds the names of every user in every center.
      expect(await expectRefused(db, "SELECT count(*)::int FROM public.profiles"))
        .toMatch(/permission denied/i);
    });
  });
});
