# 00 — Baseline

Database Stabilization & Contract Freeze — phase baseline and reproducible tooling.

## Verified baseline

| Field | Value |
| --- | --- |
| Repository | `mohamedmasoud3030-tech/lenabeauty-` |
| Baseline commit | `3efa8d09ec7ca0ec28f0f509b13e7f7eaaf0b814` |
| Baseline title | `Unblock demo migrations and mobile POS regressions` |
| `origin/main` verification | ✅ `git rev-parse origin/main` → `3efa8d09ec7ca0ec28f0f509b13e7f7eaaf0b814` (fetched from remote before work began) |
| Stale baseline | `ae9b68d` is **not present** in this checkout and was **not** used |

The work is carried on the Arena session branch (`arena/019ffa56-lenabeauty`), checked out
at exactly the verified baseline SHA. No other branch was created or pushed.

## Scope freeze (mandatory — this phase only)

This phase produces **audit tooling, contract evidence, and reproducible checks**. It is
not a product change. The following were **not** performed:

- ❌ No product features added, no unrelated UI changes.
- ❌ No Supabase migrations created or edited; no RLS policies, RPCs, triggers, tables,
      views, or remote data created/edited.
- ❌ Nothing applied to Demo, Staging, or Production; no data deleted/reset/reseeded.
- ❌ No secrets exposed or requested (the provided project credentials were **not** used
      and are not stored anywhere in this repository).
- ❌ No generated Supabase types committed (there are none to commit — see `03`).

✅ PGlite (`@electric-sql/pglite`) is **added as a dev dependency** because it is required
for the deterministic local PostgreSQL-compatible replay.

## Canonical migration discovery

`scripts/audit/lib/sql.mjs` discovers migrations by lexical filename order under
`supabase/migrations/`. The canonical set is **29 files**:

| # | Migration | Role |
| --- | --- | --- |
| 1 | `20260623000001_initial_schema.sql` | Core schema |
| 2 | `20260623000002_enable_rls_and_policies.sql` | RLS + policies |
| 3 | `20260628000001_enable_rls.sql` | RLS + storage + app_private |
| 4 | `20260628000002_admin_bootstrap.sql` | **Manual operator bootstrap (excluded from replay)** |
| 5 | `20260628000003_checkout_rpc.sql` | Checkout RPC |
| 6 | `20260628000004_vat_support.sql` | VAT |
| 7 | `20260628000005_tier_discount.sql` | Loyalty tier discount |
| 8 | `20260628000006_public_booking.sql` | Public booking |
| 9 | `20260628000007_gift_cards.sql` | Gift cards |
| 10 | `20260628000008_packages_bundles.sql` | Packages/bundles |
| 11 | `20260628000009_no_show_protection.sql` | No-show protection |
| 12 | `20260628000010_notifications_payment_gateway.sql` | Notifications + payments |
| 13 | `20260628000011_client_portal.sql` | Client portal |
| 14 | `20260628000012_customer_experience_forecasting_accounting_advanced.sql` | CX / forecasting / accounting |
| 15 | `20260628000013_booking_reschedule_cancel.sql` | Booking reschedule/cancel |
| 16 | `20260628000014_client_portal_lockout.sql` | Portal lockout |
| 17 | `20260628000015_attendance_advances_payroll.sql` | Attendance / advances / payroll |
| 18 | `20260628000016_validation_constraints.sql` | Validation constraints |
| 19 | `20260809000001_delivery_security_hardening.sql` | Delivery/security hardening |
| 20 | `20260810000001_fix_invoice_items_packages.sql` | Invoice-items/packages fix |
| 21 | `20260810000002_operational_data_integrity.sql` | Operational data integrity |
| 22 | `20260810000003_appointment_overlap_integrity.sql` | Appointment overlap (EXCLUDE) |
| 23 | `20260810000004_btree_gist_extension_schema.sql` | btree_gist schema repair |
| 24 | `20260810000005_security_hardening_auth.sql` | Security hardening (auth) |
| 25 | `20260810000006_security_grant_repair.sql` | Grant repair |
| 26 | `20260811004000_financial_entitlements.sql` | Financial entitlements |
| 27 | `20260811004100_checkout_overload_repair.sql` | Checkout overload repair |
| 28 | `20260811004200_gift_card_redemption_units_repair.sql` | Gift-card redemption units |
| 29 | `20260811004300_refund_status_repair.sql` | Refund status repair |

`20260628000002_admin_bootstrap.sql` is a **documented manual operator bootstrap**
requiring an intentionally supplied admin UUID (it updates `auth.users` and inserts the
operator's `profiles` / `center_memberships` rows). It is excluded from replay.

## Migration-replay reporting rule

Replay is always reported **exactly** as:

> **“full canonical migration discovery; 28 automated migrations replayed; 1 documented manual bootstrap excluded.”**

It is never described as an unqualified “full migration replay”.

## Reproducible audit commands

```bash
npm run audit:replay   # PGlite replay + idempotency + fingerprint + catalog inventory
npm run audit:scan     # frontend .from/.rpc/.select/storage scanner
npm run audit:matrix   # cross-reference schema vs frontend → findings
npm run audit:all      # all of the above in order
npm run audit:gate     # CI gate: re-run audit + fail on contract violations
```

Machine-readable outputs are written to `docs/database-contract/artifacts/` (deterministic,
timestamp-free so they can be diffed for staleness):

- `replay-report.json` — per-migration replay + idempotency + translations + fingerprints
- `schema-inventory.json` — replayed catalog (tables/columns/enums/constraints/FKs/indexes/
  triggers/functions incl. `search_path`/`security_definer`/ACL, policies, grants resolved to
  role names, RLS)
- `frontend-usage.json` — frontend tables/RPCs/embeds/storage + manual-review bucket
- `contract-matrix.json` — resolution results + RLS operation matrix + RPC grant matrix
- `audit-findings.json` — stable-ID findings with severity and remediation

## Deterministic replay engine

`scripts/audit/replay-schema.mjs` replays the 28 automated migrations against **PGlite**
(PostgreSQL 18.3, WASM), after installing a **compatibility preamble** that stubs only the
Supabase-hosted surfaces the canonical SQL references (`auth.users`, `auth.uid()`, `anon`/
`authenticated` roles, `storage.buckets`, `storage.objects`). Replay is **per-file atomic**
(each migration runs in a transaction and rolls back on failure). Two **documented, logged
translations** are applied where PGlite differs from the Supabase host:

1. `CREATE EXTENSION` for `pgcrypto` and `btree_gist` is skipped — `gen_random_uuid()` is
   PostgreSQL-core (PG13+), and `btree_gist` is not bundled in PGlite.
2. The `appointments_no_scheduled_staff_overlap` `EXCLUDE USING gist` constraint (requires
   btree_gist's gist `=` operator class) is replaced with a `RAISE NOTICE` surrogate inside
   its enclosing `DO` block; its canonical DDL is preserved verbatim in
   `schema-inventory.json` → `canonical_only`.

Every translation is recorded in `replay-report.json` → `translations`. No translation is silent.

## Fingerprint + idempotency evidence

After the first full replay a deterministic SHA-256 **catalog fingerprint** is computed
(timestamps excluded). The automated chain is then **re-applied with per-file rollback** and
the fingerprint is computed again. The structural diff between the two is recorded in
`replay-report.json` → `fingerprints.diff`.

> Result: the two known non-idempotent migrations roll back their `SET search_path`
> hardening on re-application, so 7 SECURITY DEFINER functions revert to an unpinned/loose
> `search_path` (see finding DB-003). This is reported, not hidden — idempotency is **not**
> claimed solely from counting thrown errors.

## Repository reality vs. live reality

Three distinct schema realities are explicitly distinguished:

1. **Canonical repository schema** — derived from `supabase/migrations/**` (28 automated
   migrations applied once, in order).
2. **Generated PGlite audit schema** — the deterministic local replay of (1) under PGlite.
3. **Hosted Supabase schema (Demo/Staging/Production)** — **not inspected in this phase**.

Because no remote Supabase inspection occurred, the final status is:

> **Repository contract audited; live Demo schema drift remains unverified.**

A future **read-only acceptance gate** (compare the hosted Demo catalog against the canonical
inventory) must run before any migration apply. See `04_ROOT_CAUSE_REMEDIATION_PLAN.md`.
