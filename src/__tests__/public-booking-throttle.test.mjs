import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CANONICAL_CENTER_ID,
  SECOND_CENTER_ID,
  asRole,
  createBoundaryDatabase,
  expectRefused,
  rows,
  scalar,
  setActor,
} from "./helpers/pglite-tenant.mjs";

/**
 * THE PUBLIC WRITE PATH, AND HOW MUCH OF IT CAN BE THROTTLED.
 *
 * `#/book` runs as `anon`: the key that calls it ships inside the browser
 * bundle, so every limit that matters has to be enforced by the database, not by
 * the form. `public_create_booking_v1` allocates a customer row and an
 * appointment row per accepted call, so an unprotected version is a
 * calendar-and-customer-list fill script.
 *
 * This file proves three separate claims:
 *
 *   1. the mechanism — a windowed counter that refuses past its limit and says
 *      only 'rate_limited';
 *   2. the protection — a stranger can book 5 times for one phone number and
 *      then is refused, while a different client is unaffected;
 *   3. a defect in ALREADY-SHIPPED code, found while building (1) and (2):
 *      a counter incremented on a path that then RAISE EXCEPTIONs does not
 *      survive, so the portal lockout in 20260628000014 has never been able to
 *      lock anybody out. Claim (3) is the reason the throttle in this migration
 *      covers the create path only.
 *
 * Transaction semantics are the crux, so the tests below never wrap a call they
 * intend to count: PGlite autocommits, exactly as PostgREST does per request,
 * and a refused call is rolled back by the server in both.
 */

const PHONE = "93333333";
const OTHER_PHONE = "94444444";
const BOOKING_LIMIT = 5; // per phone, per hour — must match the migration

let db;

/** A time in the future, distinct per call, so no two bookings collide. */
function futureSlot(minutesAhead) {
  return new Date(Date.now() + minutesAhead * 60_000).toISOString();
}

describe("public booking throttle", () => {
  beforeAll(async () => {
    const created = await createBoundaryDatabase();
    db = created.db;
    expect(created.failures).toEqual([]);

    await db.query("UPDATE public.center_settings SET name = $1 WHERE center_id = $2", [
      "Canonical Salon",
      CANONICAL_CENTER_ID,
    ]);

    const categoryId = (
      await db.query(
        "INSERT INTO public.service_categories (center_id, name) VALUES ($1, 'Hair') RETURNING id",
        [CANONICAL_CENTER_ID],
      )
    ).rows[0].id;

    // A bookable service, and a second one in another salon to prove the
    // counter is scoped rather than global.
    const serviceId = (
      await db.query(
        "INSERT INTO public.services (center_id, category_id, name, price, duration_minutes, is_active) VALUES ($1,$2,'Classic Trim',10,30,true) RETURNING id",
        [CANONICAL_CENTER_ID, categoryId],
      )
    ).rows[0].id;

    await db.exec("GRANT USAGE ON SCHEMA app_private TO authenticated");

    // A client with a portal code, so the credential path can be exercised.
    const customerId = (
      await db.query(
        "INSERT INTO public.customers (center_id, name, phone) VALUES ($1,'Portal Client',$2) RETURNING id",
        [CANONICAL_CENTER_ID, PHONE],
      )
    ).rows[0].id;
    await db.query(
      "UPDATE public.customers SET portal_access_enabled = TRUE, portal_access_token = 'PORTAL-CODE' WHERE id = $1",
      [customerId],
    );
    const employeeId = (
      await db.query(
        "INSERT INTO public.employees (center_id, name, role, salary, base_salary, is_active) VALUES ($1,'Active Staff','Staff',100,100,true) RETURNING id",
        [CANONICAL_CENTER_ID],
      )
    ).rows[0].id;
    const appointmentId = (
      await db.query(
        "INSERT INTO public.appointments (center_id, customer_id, employee_id, service_id, date_time, status) VALUES ($1,$2,$3,$4,$5::timestamptz,'SCHEDULED') RETURNING id",
        [CANONICAL_CENTER_ID, customerId, employeeId, serviceId, futureSlot(24 * 60)],
      )
    ).rows[0].id;

    db.__ids = { serviceId, customerId, appointmentId, employeeId };
  }, 180_000);

  afterAll(async () => {
    await db?.close?.();
  });

  async function asAnon(run) {
    await setActor(db, null);
    return asRole(db, "anon", run);
  }

  async function book(phone, minutesAhead) {
    return asAnon(() =>
      rows(db, "SELECT public.public_create_booking_v1($1::uuid, $2::uuid, $3::uuid, 'Walk-in Client', $4, $5::timestamptz, NULL) AS result", [
        CANONICAL_CENTER_ID,
        db.__ids.serviceId,
        db.__ids.employeeId,
        phone,
        futureSlot(minutesAhead),
      ]),
    );
  }

  it("is a table no anonymous caller can read or write", async () => {
    const asAnonSelect = await asAnon(() =>
      expectRefused(db, "SELECT count(*) FROM public.public_request_throttle"),
    );
    expect(asAnonSelect).toMatch(/permission denied|does not exist/i);

    // And nothing but the definer function may write it either.
    const asAnonInsert = await asAnon(() =>
      expectRefused(db, "INSERT INTO public.public_request_throttle (center_id, action, subject, window_start, hits) VALUES ($1,'spoof','x',now(),1)", [
        CANONICAL_CENTER_ID,
      ]),
    );
    expect(asAnonInsert).toMatch(/permission denied/i);

    const policies = await scalar(
      db,
      "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_request_throttle'",
    );
    expect(Number(policies)).toBe(0);
  });

  it("counts committed calls and refuses past the limit with a translatable code", async () => {
    // The mechanism itself, called directly so the window arithmetic is
    // observable without a booking in the way.
    const overLimit = async () => {
      for (let i = 0; i < 3; i += 1) {
        await db.query("SELECT app_private.throttle_public_action($1,'probe','subject',2,INTERVAL '1 hour')", [
          CANONICAL_CENTER_ID,
        ]);
      }
    };
    await expect(overLimit()).rejects.toThrow(/rate_limited/);

    const hits = await scalar(
      db,
      "SELECT hits FROM public.public_request_throttle WHERE center_id = $1 AND action = 'probe' AND subject = 'subject'",
      [CANONICAL_CENTER_ID],
    );
    // Two, not three: the refused call's own increment went down with the
    // transaction it aborted. This is the property that makes a counter on a
    // raising path useless, shown here on purpose — the shipped portal lockout
    // is the same pattern, and the test below proves what it costs.
    expect(Number(hits)).toBe(2);

    // Refusals must never leak plumbing: no table name, no SQLSTATE, no schema.
    const message = await db
      .query("SELECT app_private.throttle_public_action($1,'probe','subject',2,INTERVAL '1 hour')", [
        CANONICAL_CENTER_ID,
      ])
      .then(
        () => "did not refuse",
        (error) => String(error.message ?? error),
      );
    expect(message).toMatch(/rate_limited/);
    expect(message).not.toMatch(/public_request_throttle|app_private|SQLSTATE|public\./i);
  });

  it("lets a stranger book five times, then stops that phone number", async () => {
    for (let attempt = 1; attempt <= BOOKING_LIMIT; attempt += 1) {
      const result = await book(PHONE, attempt);
      expect(result[0].result.status).toBe("SCHEDULED");
    }

    const refused = await asAnon(() =>
      expectRefused(
        db,
        "SELECT public.public_create_booking_v1($1::uuid, $2::uuid, $3::uuid, 'Walk-in Client', $4, $5::timestamptz, NULL)",
        [CANONICAL_CENTER_ID, db.__ids.serviceId, db.__ids.employeeId, PHONE, futureSlot(99)],
      ),
    );
    expect(refused).toBe("rate_limited");

    // The limit is per phone, not per salon: another client is untouched.
    const unaffected = await book(OTHER_PHONE, 100);
    expect(unaffected[0].result.status).toBe("SCHEDULED");

    // And the caller learned nothing about the mechanism.
    const counters = await scalar(
      db,
      "SELECT count(*) FROM public.public_request_throttle WHERE action = 'booking'",
    );
    expect(Number(counters)).toBe(3); // this phone's bucket, the other's, the center's
  });

  it("keeps the promises the booking contract already made to the app", async () => {
    // A malformed call must still get its own message, not a throttle verdict:
    // validation runs before counting.
    const shortPhone = await asAnon(() =>
      expectRefused(
        db,
        "SELECT public.public_create_booking_v1($1::uuid, $2::uuid, $3::uuid, 'Client', '123', $4::timestamptz, NULL)",
        [CANONICAL_CENTER_ID, db.__ids.serviceId, db.__ids.employeeId, futureSlot(30)],
      ),
    );
    expect(shortPhone).toMatch(/Invalid phone number/i);

    const pastSlot = await asAnon(() =>
      expectRefused(
        db,
        "SELECT public.public_create_booking_v1($1::uuid, $2::uuid, $3::uuid, 'Client', '95555555', $4::timestamptz, NULL)",
        [CANONICAL_CENTER_ID, db.__ids.serviceId, db.__ids.employeeId, new Date(Date.now() - 60_000).toISOString()],
      ),
    );
    expect(pastSlot).toMatch(/Cannot book a time in the past/i);

    // A call with no specialist used to reach the visitor as the appointments
    // trigger's own name, `appointment_customer_service_staff_time_required`.
    // The trigger still requires one; the message is now the salon's.
    const noSpecialist = await asAnon(() =>
      expectRefused(
        db,
        "SELECT public.public_create_booking_v1($1::uuid, $2::uuid, NULL, 'Client', '96666666', $3::timestamptz, NULL)",
        [CANONICAL_CENTER_ID, db.__ids.serviceId, futureSlot(40)],
      ),
    );
    expect(noSpecialist).toMatch(/Selected staff is not available/i);
    expect(noSpecialist).not.toMatch(/appointment_customer_service_staff_time_required/);

    // Another salon's catalogue is still refused exactly as before — and the
    // refusal never names the throttle table, which a foreign key would have.
    const foreign = await asAnon(() =>
      expectRefused(
        db,
        "SELECT public.public_create_booking_v1($1::uuid, $2::uuid, $3::uuid, 'Client', '97777778', $4::timestamptz, NULL)",
        [SECOND_CENTER_ID, db.__ids.serviceId, db.__ids.employeeId, futureSlot(45)],
      ),
    );
    expect(foreign).toMatch(/Service is not available/i);
    expect(foreign).not.toMatch(/public_request_throttle|foreign key|constraint/i);

    // The booking the contract returns is unchanged, field for field.
    const shape = await book("98888888", 120);
    expect(Object.keys(shape[0].result).sort()).toEqual(["appointment_id", "customer_id", "status"]);
  });

  it("proves the shipped portal lockout can never trigger (found while building this)", async () => {
    // 20260628000014_client_portal_lockout.sql increments
    // customers.portal_failed_login_attempts and then raises
    // 'Invalid portal credentials' on the very next line. The raise aborts the
    // transaction, so PostgREST rolls the increment back. Five wrong guesses
    // should lock the account; the counter says otherwise.
    const login = async () =>
      asAnon(() =>
        expectRefused(
          db,
          "SELECT public.public_client_portal_login_v1($1::uuid, $2, 'WRONG-CODE')",
          [CANONICAL_CENTER_ID, PHONE],
        ),
      );

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const refused = await login();
      // Every attempt is refused with the credentials message — never with the
      // lockout message, which the migration raises at 5 failures.
      expect(refused).toMatch(/Invalid portal credentials/i);
      expect(refused).not.toMatch(/locked/i);
    }

    const attempts = await scalar(
      db,
      "SELECT portal_failed_login_attempts FROM public.customers WHERE phone = $1",
      [PHONE],
    );
    expect(Number(attempts)).toBe(0);

    // The generator the lockout relies on is not at fault: the same counter, on
    // a path that RETURNS, survives. This is what the throttle in this migration
    // relies on, and what a fix for the lockout would have to rely on too.
    await db.query("UPDATE public.customers SET portal_failed_login_attempts = portal_failed_login_attempts + 1 WHERE phone = $1", [
      PHONE,
    ]);
    const afterCommit = await scalar(
      db,
      "SELECT portal_failed_login_attempts FROM public.customers WHERE phone = $1",
      [PHONE],
    );
    expect(Number(afterCommit)).toBe(1);
  });
});
