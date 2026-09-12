import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { discoverMigrations } from "../../scripts/audit/lib/sql.mjs";
import {
  CANONICAL_CENTER_ID,
  SECOND_CENTER_ID,
  asRole,
  columnNames,
  createBoundaryDatabase,
  expectRefused,
  rows,
  scalar,
  setActor,
} from "./helpers/pglite-tenant.mjs";

/**
 * THE ANONYMOUS PUBLIC SURFACE — what a stranger may reach, and what they may not.
 *
 * `#/book` and `#/portal` run as `anon`, the role whose key ships inside the
 * browser bundle. Everything they are allowed to do happens through nine
 * SECURITY DEFINER functions; everything else must be unreachable.
 *
 * This file also reproduces, locally, the exact failure that was live on
 * `larabeauty.vercel.app/#/book` — `permission denied for function
 * public_center_info_v1` — by revoking the grant and calling the function as
 * `anon`. It then applies `20260912110000_public_booking_release.sql` from disk,
 * which is the migration the operator still has to run on the live project, and
 * asserts the call works. The diagnosis and its fix are therefore both
 * executed here rather than described.
 */

const RELEASE_MIGRATION = "20260912110000_public_booking_release.sql";

/** Every function the public release intentionally opens to `anon`. */
const RELEASED_TO_ANON = [
  "public.public_list_services_v1(uuid)",
  "public.public_list_staff_v1(uuid)",
  "public.public_center_info_v1(uuid)",
  "public.public_taken_slots_v1(uuid,date)",
  "public.public_create_booking_v1(uuid,uuid,uuid,text,text,timestamptz,text)",
  "public.public_cancel_booking_v1(uuid,uuid,text,text,text)",
  "public.public_reschedule_booking_v1(uuid,uuid,text,text,timestamptz,uuid,text)",
  "public.public_client_portal_login_v1(uuid,text,text)",
  "public.public_client_portal_profile_v2(uuid,uuid,text,text)",
];

/** Capabilities that must stay closed to a stranger with the published key. */
const NEVER_ANON = [
  "public.rotate_customer_portal_token_v1(uuid,uuid)",
  "public.has_center_role(uuid,uuid[])", // if absent, the check below tolerates it
];

/** Plumbing that must never reach a public caller, whatever goes wrong. */
const PLUMBING = /relation "|public\.[a-z_]+\(|pg_catalog|SQLSTATE|permission denied for (table|function)|column .* does not exist|syntax error|violates (check|foreign key)/i;

/**
 * Every refusal on the public surface has to be showable to a client, so it is
 * either a snake_case action code the app maps to a translation, or a sentence
 * that exists in the dictionaries under its own text. A message that is neither
 * arrives in English on an Arabic screen.
 */
const AR_DICTIONARY = readFileSync(resolve(process.cwd(), "src/i18n/ar/booking.ts"), "utf8");
const isTranslatable = (message) =>
  /^[a-z0-9_]+$/.test(message) || AR_DICTIONARY.includes(`"${message}":`);

const BOOKING_DAY = "2026-10-01";
const DAY_APPOINTMENT = "2026-10-01T10:00:00+00:00";
const NEW_BOOKING_TIME = "2026-12-01T12:00:00+00:00";

describe("the anonymous public surface", () => {
  let db;
  let ids = {};

  beforeAll(async () => {
    const created = await createBoundaryDatabase();
    db = created.db;
    expect(created.failures).toEqual([]);

    // ── A second tenant, so "scoped to the requested center" is a real claim.
    await db.query("INSERT INTO public.centers (id, name) VALUES ($1, $2)", [SECOND_CENTER_ID, "Second Salon"]);
    await db.query(
      "INSERT INTO public.center_settings (center_id, name, currency, phone, address) VALUES ($1, $2, 'OMR', $3, $4)",
      [SECOND_CENTER_ID, "Second Salon", "90000002", "Salalah"],
    );
    await db.query(
      "UPDATE public.center_settings SET name = $1, phone = $2, address = $3 WHERE center_id = $4",
      ["Canonical Salon", "90000001", "Muscat", CANONICAL_CENTER_ID],
    );

    const categoryFor = async (centerId, name) => (await db.query(
      "INSERT INTO public.service_categories (center_id, name) VALUES ($1, $2) RETURNING id",
      [centerId, name],
    )).rows[0].id;

    const canonicalCategory = await categoryFor(CANONICAL_CENTER_ID, "Hair");
    const secondCategory = await categoryFor(SECOND_CENTER_ID, "Other Salon Hair");

    ids.service = (await db.query(
      "INSERT INTO public.services (center_id, category_id, name, price, duration_minutes, is_active) VALUES ($1,$2,'Classic Trim',10,30,true) RETURNING id",
      [CANONICAL_CENTER_ID, canonicalCategory],
    )).rows[0].id;
    // Must never appear: withdrawn from sale.
    await db.query(
      "INSERT INTO public.services (center_id, category_id, name, price, duration_minutes, is_active) VALUES ($1,$2,'Withdrawn Service',10,30,false)",
      [CANONICAL_CENTER_ID, canonicalCategory],
    );
    // Must never appear: another salon's catalogue.
    ids.foreignService = (await db.query(
      "INSERT INTO public.services (center_id, category_id, name, price, duration_minutes, is_active) VALUES ($1,$2,'Other Salon Trim',10,30,true) RETURNING id",
      [SECOND_CENTER_ID, secondCategory],
    )).rows[0].id;

    ids.staff = (await db.query(
      "INSERT INTO public.employees (center_id, name, role, salary, base_salary, is_active) VALUES ($1,'Active Staff','Staff',100,100,true) RETURNING id",
      [CANONICAL_CENTER_ID],
    )).rows[0].id;
    await db.query(
      "INSERT INTO public.employees (center_id, name, role, salary, base_salary, is_active) VALUES ($1,'Former Staff','Staff',100,100,false)",
      [CANONICAL_CENTER_ID],
    );

    ids.customer = (await db.query(
      "INSERT INTO public.customers (center_id, name, phone) VALUES ($1,'Portal Client','91111111') RETURNING id",
      [CANONICAL_CENTER_ID],
    )).rows[0].id;
    ids.portalCustomer = ids.customer;

    // A client who has been issued a portal code, and one who has not.
    await db.query(
      "UPDATE public.customers SET portal_access_enabled = TRUE, portal_access_token = 'PORTAL-CODE-1' WHERE id = $1",
      [ids.portalCustomer],
    );
    await db.query(
      "INSERT INTO public.customers (center_id, name, phone, portal_access_enabled) VALUES ($1,'No Portal Client','92222222', FALSE)",
      [CANONICAL_CENTER_ID],
    );

    // A scheduled visit, so the "taken slots" read has something to return.
    await db.query(
      "INSERT INTO public.appointments (center_id, customer_id, employee_id, service_id, date_time, status) VALUES ($1,$2,$3,$4,$5::timestamptz,'SCHEDULED')",
      [CANONICAL_CENTER_ID, ids.customer, ids.staff, ids.service, DAY_APPOINTMENT],
    );
  }, 180_000);

  afterAll(async () => {
    await db?.close?.();
  });

  /** Signs out completely and acts as the role the browser holds before login. */
  async function asAnon(run) {
    await setActor(db, null);
    return asRole(db, "anon", run);
  }

  it("reproduces the live #/book failure and shows the release migration is the fix", async () => {
    // This is exactly what the deployed site did: the grant had been withdrawn
    // (deliberately, at the time) so the page header request came back as
    // "permission denied for function public_center_info_v1".
    await db.exec("REVOKE EXECUTE ON FUNCTION public.public_center_info_v1(UUID) FROM anon, authenticated");
    const broken = await asAnon(async () => expectRefused(
      db, "SELECT public.public_center_info_v1($1::uuid)",
      [CANONICAL_CENTER_ID],
    ));
    expect(broken).toMatch(/permission denied for function/i);

    // Now apply the migration the operator runs on the live project.
    const release = discoverMigrations().find((migration) => migration.file === RELEASE_MIGRATION);
    expect(release, `${RELEASE_MIGRATION} must exist on disk`).toBeTruthy();
    await db.exec(release.content);
    // Idempotent: a second run must be just as safe as the first.
    await db.exec(release.content);

    const restored = await asAnon(async () => rows(
      db, "SELECT * FROM public.public_center_info_v1($1::uuid)",
      [CANONICAL_CENTER_ID],
    ));
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe("Canonical Salon");
  });

  it("grants the released functions to anon and keeps the admin capability away", async () => {
    for (const signature of RELEASED_TO_ANON) {
      expect(
        await scalar(db, "SELECT has_function_privilege('anon', $1, 'EXECUTE')", [signature]),
        `${signature} must be callable by anon`,
      ).toBe(true);
    }
    for (const signature of NEVER_ANON) {
      const exists = await scalar(db, "SELECT to_regprocedure($1) IS NOT NULL", [signature]);
      if (!exists) continue;
      expect(
        await scalar(db, "SELECT has_function_privilege('anon', $1, 'EXECUTE')", [signature]),
        `${signature} must NOT be callable by anon`,
      ).toBe(false);
    }
    // Issuing portal codes stays an admin action performed while signed in.
    expect(await scalar(db, "SELECT has_function_privilege('anon', 'public.rotate_customer_portal_token_v1(uuid,uuid)', 'EXECUTE')"))
      .toBe(false);
    expect(await scalar(db, "SELECT has_function_privilege('authenticated', 'public.rotate_customer_portal_token_v1(uuid,uuid)', 'EXECUTE')"))
      .toBe(true);
  });

  it("exposes only the columns each public read is meant to return", async () => {
    await asAnon(async () => {
      expect(await columnNames(db, "SELECT * FROM public.public_center_info_v1($1::uuid)", [CANONICAL_CENTER_ID]))
        .toEqual(["address", "currency", "name", "phone"]);
      expect(await columnNames(db, "SELECT * FROM public.public_list_services_v1($1::uuid)", [CANONICAL_CENTER_ID]))
        .toEqual(["duration_minutes", "id", "name", "price"]);
      // Staff are exposed by name only — no phone, no salary, no commission.
      expect(await columnNames(db, "SELECT * FROM public.public_list_staff_v1($1::uuid)", [CANONICAL_CENTER_ID]))
        .toEqual(["id", "name"]);
      // Taken slots carry no client identity: a time and a staff member.
      expect(await columnNames(db, "SELECT * FROM public.public_taken_slots_v1($1::uuid, $2::date)", [CANONICAL_CENTER_ID, BOOKING_DAY]))
        .toEqual(["date_time", "employee_id"]);
    });
  });

  it("scopes every public read to the center that was asked for", async () => {
    await asAnon(async () => {
      const services = await rows(db, "SELECT * FROM public.public_list_services_v1($1::uuid)", [CANONICAL_CENTER_ID]);
      expect(services.map((row) => row.name)).toEqual(["Classic Trim"]); // not the withdrawn or the foreign one

      const staff = await rows(db, "SELECT * FROM public.public_list_staff_v1($1::uuid)", [CANONICAL_CENTER_ID]);
      expect(staff.map((row) => row.name)).toEqual(["Active Staff"]);

      const slots = await rows(db, "SELECT * FROM public.public_taken_slots_v1($1::uuid, $2::date)", [CANONICAL_CENTER_ID, BOOKING_DAY]);
      expect(slots).toHaveLength(1);
      expect(new Date(slots[0].date_time).toISOString()).toBe(new Date(DAY_APPOINTMENT).toISOString());
      expect(slots[0].employee_id).toBe(ids.staff);

      // A center that does not exist returns nothing rather than an error.
      const unknown = "99999999-8888-7777-6666-555544443333";
      expect(await rows(db, "SELECT * FROM public.public_center_info_v1($1::uuid)", [unknown])).toHaveLength(0);
      expect(await rows(db, "SELECT * FROM public.public_list_services_v1($1::uuid)", [unknown])).toHaveLength(0);
    });
  });

  it("creates a booking for a walk-in visitor with no account", async () => {
    const result = await asAnon(async () => {
      const rowsResult = await rows(
        db,
        "SELECT public.public_create_booking_v1($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::timestamptz,$7) AS booking",
        [CANONICAL_CENTER_ID, ids.service, ids.staff, "Walk-in Client", "93333333", NEW_BOOKING_TIME, "First visit"],
      );
      return rowsResult[0].booking;
    });

    expect(result.status).toBe("SCHEDULED");
    expect(String(result.appointment_id)).toMatch(/^[0-9a-f-]{36}$/i);

    // The booking landed in the right tenant, tied to a customer created on the
    // spot — the same shape the Appointments calendar reads.
    const appointment = await rows(
      db,
      "SELECT a.status, a.center_id, c.name, c.phone FROM public.appointments a JOIN public.customers c ON c.id = a.customer_id WHERE a.id = $1",
      [result.appointment_id],
    );
    expect(appointment).toHaveLength(1);
    expect(appointment[0].center_id).toBe(CANONICAL_CENTER_ID);
    expect(appointment[0].name).toBe("Walk-in Client");
    expect(appointment[0].phone).toBe("93333333");

    // And it is now visible to the next visitor as a taken slot.
    const slots = await asAnon(async () => rows(
      db, "SELECT * FROM public.public_taken_slots_v1($1::uuid, $2::date)", [CANONICAL_CENTER_ID, "2026-12-01"],
    ));
    expect(slots).toHaveLength(1);
  });

  it("refuses the bookings it must refuse, in business language only", async () => {
    const attempt = (sql, params) => asAnon(async () => expectRefused(db, sql, params));

    const past = await attempt(
      "SELECT public.public_create_booking_v1($1::uuid,$2::uuid,$3::uuid,'Late Client','94444444','2020-01-01T10:00:00+00:00'::timestamptz,NULL)",
      [CANONICAL_CENTER_ID, ids.service, ids.staff],
    );
    expect(past).toMatch(/Cannot book a time in the past/);

    // A service id from another salon must not be usable here.
    const foreign = await attempt(
      "SELECT public.public_create_booking_v1($1::uuid,$2::uuid,$3::uuid,'Foreign Client','95555555','2026-12-02T10:00:00+00:00'::timestamptz,NULL)",
      [CANONICAL_CENTER_ID, ids.foreignService, ids.staff],
    );
    expect(foreign).toMatch(/Service is not available/);

    // Staff already booked at that exact time.
    const taken = await attempt(
      "SELECT public.public_create_booking_v1($1::uuid,$2::uuid,$3::uuid,'Second Client','96666666',$4::timestamptz,NULL)",
      [CANONICAL_CENTER_ID, ids.service, ids.staff, NEW_BOOKING_TIME],
    );
    expect(taken).toMatch(/time slot is no longer available/);

    for (const message of [past, foreign, taken]) {
      expect(message, `a public refusal leaked plumbing: ${message}`).not.toMatch(PLUMBING);
      expect(isTranslatable(message), `"${message}" has no dictionary entry`).toBe(true);
    }
  });

  it("answers cancellation attempts with action codes, never with plumbing", async () => {
    const message = await asAnon(async () => expectRefused(
      db,
      "SELECT public.public_cancel_booking_v1($1::uuid,$2::uuid,$3,$4,$5)",
      [CANONICAL_CENTER_ID, "99999999-8888-7777-6666-555544443333", "93333333", "NOT-A-CODE", null],
    ));
    // Deliberately a translatable code: the app maps it to Arabic/English text.
    expect(message).toMatch(/^appointment_not_found$/);
    expect(message).not.toMatch(PLUMBING);
    expect(isTranslatable(message)).toBe(true);
  });

  it("accepts a correct portal code and rejects a wrong one without becoming an oracle", async () => {
    await asAnon(async () => {
      // The function answers with the sentence the app has keys for — never with
      // the failed lookup, and never with a hint about which half was wrong.
      const wrong = await expectRefused(
        db,
        "SELECT public.public_client_portal_login_v1($1::uuid,$2,$3)",
        [CANONICAL_CENTER_ID, "91111111", "GUESS"],
      );
      expect(wrong).toBe("Invalid portal credentials");

      // The same answer for a phone that does not exist: a stranger cannot use
      // the error to learn which numbers are registered.
      const unknownPhone = await expectRefused(
        db,
        "SELECT public.public_client_portal_login_v1($1::uuid,$2,$3)",
        [CANONICAL_CENTER_ID, "90000000", "GUESS"],
      );
      expect(unknownPhone).toBe(wrong);
      expect(isTranslatable(unknownPhone), `"${unknownPhone}" has no dictionary entry`).toBe(true);
    });

    const profile = await asAnon(async () => rows(
      db,
      "SELECT public.public_client_portal_login_v1($1::uuid,$2,$3) AS session",
      [CANONICAL_CENTER_ID, "91111111", "PORTAL-CODE-1"],
    ));
    expect(profile[0].session).toBeTruthy();
    expect(Object.keys(profile[0].session)).toContain("customer");

    // A client without portal access cannot get in even by guessing correctly.
    const disabled = await asAnon(async () => expectRefused(
      db,
      "SELECT public.public_client_portal_login_v1($1::uuid,$2,$3)",
      [CANONICAL_CENTER_ID, "92222222", "PORTAL-CODE-1"],
    ));
    expect(disabled).toBe("Invalid portal credentials");
  });

  it("still cannot touch a single table after the release", async () => {
    // The release opens functions. It must not have opened data.
    await asAnon(async () => {
      for (const table of ["customers", "appointments", "invoices", "services", "employees", "center_settings"]) {
        const message = await expectRefused(db, `SELECT count(*)::int FROM public.${table}`);
        expect(message, `${table}`).toMatch(/permission denied/i);
      }
    });
  });
});
