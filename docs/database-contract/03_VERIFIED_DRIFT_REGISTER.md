# 03 — Verified Drift Register

Findings produced by the reproducible audit (`npm run audit:all`). Machine-readable source:
`artifacts/audit-findings.json`.

Each finding carries a **stable ID, severity, exact evidence, affected object, root-cause
category, remediation direction, and required change class**. Findings are reported only —
**nothing is fixed in this phase**. Uncertain cases are marked *manual review*.

Summary by severity: **4 high, 5 medium, 1 low, 3 info** (13 total).

---

## HIGH

### DB-003 — Re-application rolls back SECURITY DEFINER `search_path` hardening (fingerprint drift)

- **Category:** replay-fingerprint-drift · **Status:** confirmed
- **Evidence:** catalog fingerprints differ after first replay vs. re-application
  (`after_first` ≠ `after_repeat`); changed sections: `functions, function_acl, policies,
  grants`. 7 SECURITY DEFINER functions revert `search_path` from
  `pg_catalog, public, app_private` to `public`/`public, auth`/unpinned.
- **Affected:** `app_private.is_center_member`, `app_private.user_center_ids`,
  `app_private.tier_discount_percent`, `public.public_center_info_v1`,
  `public.public_list_services_v1`, `public.public_list_staff_v1`,
  `public.public_taken_slots_v1`.
- **Root cause:** the non-idempotent migration `20260810000005` (DB-002) rolls back its
  hardening statements when re-applied.
- **Remediation (safest):** make the non-idempotent migrations idempotent; then re-verify the
  fingerprint is stable.
- **Change class:** future-migration.

### DB-004 — No committed Supabase-generated TypeScript types; client is untyped

- **Category:** types-missing · **Status:** confirmed
- **Evidence:** `src/infrastructure/supabase/client.ts` builds `createClient(...)` without a
  `Database` generic; repository results read as `any`; no `.returns<T>()`/`.cast<T>()`;
  no committed `Database` type.
- **Affected:** all data access in `src/infrastructure/supabase/**`.
- **Root cause:** untyped `SupabaseClient` throughout the project.
- **Remediation (safest):** generate `supabase gen types` **against the canonical verified
  schema (not a possibly drifted hosted DB)**, commit it, thread the `Database` generic, and
  add typed DTO/mapper + runtime contract tests for non-table (`jsonb`/`record`) RPC returns
  — generated types do not fully guarantee those shapes.
- **Change class:** type-update.

### DB-005 — Sensitive payroll tables writable by any center member (no governed role)

- **Category:** rls-role-governance · **Status:** confirmed (unresolved security gap)
- **Evidence:** `attendance_records`, `employee_advances`, `payroll_runs`,
  `payroll_line_items` each have a single `FOR ALL TO public` policy
  (`attendance_tenant`, `advances_tenant`, `payroll_runs_tenant`, `payroll_lines_tenant`)
  with `USING/WITH CHECK app_private.is_center_member(center_id)` — center membership alone,
  no ADMIN/MANAGER role check.
- **Affected:** the four payroll tables above.
- **Root cause:** the tenant template `FOR ALL + is_center_member` was applied to financially
  sensitive tables without role governance.
- **Remediation (safest):** split into per-operation policies and gate writes on a governed
  role (`user_metadata.role IN (ADMIN, MANAGER)`).
- **Change class:** future-migration. **Not fixed in this PR.**

### DB-006 — Frontend-referenced RPCs with no client-role EXECUTE grant

- **Category:** rpc-grant-missing · **Status:** confirmed (unresolved)
- **Evidence:** `public_cancel_booking_v1`, `public_center_info_v1`,
  `public_client_portal_login_v1`, `public_client_portal_profile_v2`,
  `public_create_booking_v1`, `public_list_services_v1`, `public_list_staff_v1`,
  `public_reschedule_booking_v1`, `public_taken_slots_v1` have EXECUTE only for the owner
  (`postgres`); `20260810000006_security_grant_repair.sql` deliberately left the public
  booking/portal RPCs un-granted.
- **Affected:** the 9 RPCs above (referenced by booking/client-portal routes).
- **Root cause:** the public booking/portal surface is installed but not enabled; the
  frontend still references it (defensively).
- **Remediation (safest):** for each RPC, either grant EXECUTE to the intended client role
  (if the feature should be live) or mark the frontend call not-yet-enabled and remove it
  from the live surface.
- **Change class:** manual-review (feature intent) + future-migration.

---

## MEDIUM

### DB-001 / DB-002 — Non-idempotent migrations (missing `DROP POLICY IF EXISTS`)

- **Category:** migration-idempotency · **Status:** confirmed
- **Evidence:** `20260628000012…` re-run fails with
  `policy "customer_reviews_select_policy" for table "customer_reviews" already exists`;
  `20260810000005…` re-run fails with `policy "center_settings_insert" … already exists`.
- **Affected:** those two migrations.
- **Remediation (safest):** prepend `DROP POLICY IF EXISTS …` before each `CREATE POLICY`.
- **Change class:** future-migration.

### DB-008 / DB-009 — Foreign keys marked `NOT VALID`

- **Category:** fk-not-valid · **Status:** confirmed (intentional backfill pattern)
- **Evidence:** `payments.payments_invoice_center_fk` (`(invoice_id, center_id) → invoices`,
  `NOT VALID`); `services.services_category_fk` (`category_id → service_categories`, `NOT VALID`).
- **Remediation (safest):** query for orphaned/cross-center rows, then
  `VALIDATE CONSTRAINT`.
- **Change class:** future-migration.

### DB-010 — Overlapping foreign keys on `payments → invoices` (NOT redundant)

- **Category:** fk-duplicate · **Status:** confirmed
- **Evidence:** `payments` carries two FKs to `invoices`:
  1. composite `(invoice_id, center_id) → invoices(id, center_id)` `NOT VALID`
  2. simple `(invoice_id) → invoices(id)` `ON DELETE RESTRICT`
- **Root cause:** the composite FK was added on top of the pre-existing simple FK. **The
  composite FK is NOT redundant — it enforces tenant integrity** (a payment cannot reference
  an invoice belonging to another center).
- **Remediation (safest), in order:**
  1. query for orphaned/cross-center payment rows;
  2. validate `payments_invoice_center_fk`;
  3. inspect PostgREST relationship behaviour and every frontend embed;
  4. only then determine whether the simple `invoice_id` FK can be removed.
  **Do not prescribe either FK removal until API relationship behaviour is verified.**
- **Change class:** manual-review + future-migration.

---

## LOW

### DB-007 — Internal `app_private` routine retains PUBLIC EXECUTE

- **Category:** internal-routine-exposure · **Status:** confirmed
- **Evidence:** `app_private.maintain_entitlement_balance_v1()` keeps the default
  `PUBLIC` EXECUTE grant (created after the least-privilege repair; default privileges did
  not suppress it).
- **Affected:** `app_private.maintain_entitlement_balance_v1`.
- **Remediation (safest):** `REVOKE EXECUTE … FROM PUBLIC`; ensure default privileges suppress
  PUBLIC for the creating role.
- **Change class:** future-migration.

---

## INFO

- **DB-011** — scanner limitation: `dynamic-from` (documented non-Supabase `.from(element)`
  match in `printService.ts`). Manual review.
- **DB-012** — btree_gist EXCLUDE constraint is canonical-only (replay surrogate). No change.
- **DB-013** — RPC return shapes (`jsonb`/`record`) untyped at rest. Manual review / DTO tests.
