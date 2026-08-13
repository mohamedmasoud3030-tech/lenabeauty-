# 03 — Verified Drift Register

Findings produced by the reproducible audit (`npm run audit:all`). Machine-readable source:
`artifacts/audit-findings.json`.

Each finding carries a **stable ID, severity, exact evidence, affected object, root-cause
category, remediation direction, and required change class**. Findings are reported only —
**nothing is fixed in this phase**. Uncertain cases are marked *manual review*, never
*confirmed defect*.

Summary by severity: **1 high, 5 medium, 1 info** (7 total).

---

### DB-003 — HIGH — No committed Supabase-generated TypeScript types; client is untyped

- **Category:** types-missing
- **Status:** confirmed
- **Evidence:** `src/infrastructure/supabase/client.ts` calls `createClient(...)` without a
  `Database` generic; repository results are read as `any`; no `.returns<T>()` / `.cast<T>()`
  anywhere in `src/`; no `Database` type is committed.
- **Affected:** all data access in `src/infrastructure/supabase/**` (every route/service).
- **Root cause:** the project evolved with an untyped `SupabaseClient`; generated types were
  never introduced into the pipeline.
- **Remediation (safest):** generate (`supabase gen types`) and commit the `Database` type,
  then thread it through the client and repositories.
- **Change class:** type-update (no runtime/migration change).

---

### DB-001 — MEDIUM — Non-idempotent migration: `20260628000012_...`

- **Category:** migration-idempotency
- **Status:** confirmed
- **Evidence:** re-running the migration fails with
  `policy "customer_reviews_select_policy" for table "customer_reviews" already exists`.
- **Affected:** migration `20260628000012_customer_experience_forecasting_accounting_advanced.sql`
  (line 45, `CREATE POLICY customer_reviews_select_policy`).
- **Root cause:** `CREATE POLICY` without a preceding `DROP POLICY IF EXISTS` guard.
- **Remediation (safest):** add `DROP POLICY IF EXISTS customer_reviews_select_policy ON
  public.customer_reviews;` before the `CREATE POLICY`.
- **Change class:** future-migration (migration hygiene; does not affect already-applied
  environments, but breaks clean re-apply / replay idempotency).

---

### DB-002 — MEDIUM — Non-idempotent migration: `20260810000005_...`

- **Category:** migration-idempotency
- **Status:** confirmed
- **Evidence:** re-running fails with
  `policy "center_settings_insert" for table "center_settings" already exists`.
- **Affected:** migration `20260810000005_security_hardening_auth.sql` (line 606,
  `CREATE POLICY center_settings_insert`).
- **Root cause:** same missing `DROP POLICY IF EXISTS` guard.
- **Remediation (safest):** add the matching `DROP POLICY IF EXISTS` before the `CREATE POLICY`.
- **Change class:** future-migration.

---

### DB-004 — MEDIUM — Foreign key `payments.payments_invoice_center_fk` is `NOT VALID`

- **Category:** fk-not-valid
- **Status:** confirmed (intentional pattern — see note)
- **Evidence:** `FOREIGN KEY (invoice_id, center_id) REFERENCES invoices(id, center_id)
  ON DELETE RESTRICT NOT VALID` (created in `20260810000002_operational_data_integrity.sql`).
- **Affected:** `public.payments`.
- **Root cause:** integrity migrations deliberately use `NOT VALID` to tolerate legacy rows
  while protecting new writes (documented in the migration header).
- **Remediation (safest):** after confirming no orphaned rows, run
  `ALTER TABLE public.payments VALIDATE CONSTRAINT payments_invoice_center_fk;`
- **Change class:** future-migration (validation backfill) — manual review.

---

### DB-005 — MEDIUM — Foreign key `services.services_category_fk` is `NOT VALID`

- **Category:** fk-not-valid
- **Status:** confirmed (intentional pattern — see note)
- **Evidence:** `FOREIGN KEY (category_id) REFERENCES service_categories(id)
  ON DELETE RESTRICT NOT VALID`.
- **Affected:** `public.services`.
- **Root cause:** same intentional `NOT VALID` pattern as DB-004.
- **Remediation (safest):** validate after confirming no orphaned `category_id` rows.
- **Change class:** future-migration (validation backfill) — manual review.

---

### DB-006 — MEDIUM — Overlapping foreign keys: `payments → invoices`

- **Category:** fk-duplicate
- **Status:** confirmed
- **Evidence:** `payments` carries two FKs to `invoices`:
  1. `(invoice_id, center_id) → invoices(id, center_id)` `NOT VALID` (composite)
  2. `(invoice_id) → invoices(id)` `ON DELETE RESTRICT` (simple, from the table definition)
- **Affected:** `public.payments`.
- **Root cause:** the composite `NOT VALID` FK was added in
  `20260810000002_operational_data_integrity.sql` on top of the pre-existing simple FK.
  The composite FK is redundant (the simple FK already covers `invoice_id`).
- **Remediation (safest):** drop the redundant composite FK (and validate the simple one if
  needed); confirm the unique index `idx_invoices_id_center_unique` is not otherwise required.
- **Change class:** future-migration — manual review.

---

### DB-007 — INFO — btree_gist exclusion constraint is canonical-only (replay surrogate)

- **Category:** replay-compatibility
- **Status:** confirmed (not a defect)
- **Evidence:** `appointments_no_scheduled_staff_overlap` `EXCLUDE USING gist (...)` requires
  the btree_gist gist `=` operator class, which PGlite does not bundle.
- **Affected:** `public.appointments` (EXCLUDE constraint).
- **Root cause:** PGlite is a bare-PostgreSQL replay proxy; the constraint exists in the
  canonical migration and applies in Supabase.
- **Remediation (safest):** none.
- **Change class:** no-code-change.

---

## Manual-review queue (not defects, but unverified at rest)

- RPC return shapes for `jsonb` / `record` RPCs (`process_checkout_v1` fields,
  `public_*_v1` portal `record` shapes) — cannot be statically confirmed without committed
  types (see DB-003).
- Legacy `public_client_portal_profile_v1` still present alongside `_v2`; the frontend uses
  `_v2`. `enforce_appointment_integrity_v1` function remains after its trigger was dropped
  in favor of `_v2`. Both are dead/legacy code, not contract breaks.
