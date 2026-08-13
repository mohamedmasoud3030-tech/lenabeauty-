# 04 — Root-Cause & Remediation Plan

This document orders the remediation work for the findings in `03_VERIFIED_DRIFT_REGISTER.md`.
Nothing here is executed in this phase — it is a plan for the next phase.

## Root-cause categories

| Category | Findings | Pattern |
| --- | --- | --- |
| **types-missing** | DB-003 | Untyped `SupabaseClient`; no committed generated types → all drift is runtime-only |
| **migration-idempotency** | DB-001, DB-002 | `CREATE POLICY` without `DROP POLICY IF EXISTS` guard |
| **fk-not-valid** | DB-004, DB-005 | Intentional `NOT VALID` integrity backfill left unvalidated |
| **fk-duplicate** | DB-006 | Legacy composite `NOT VALID` FK added on top of a simple FK |
| **replay-compatibility** | DB-007 | PGlite lacks a host extension (informational) |

## Top release blockers

1. **DB-003 (HIGH) — untyped client / no committed types.** This is the single highest-leverage
   gap: without a committed `Database` type, no contract drift is caught at build time, and
   the `record`/`jsonb` RPC shapes are enforced only at runtime. Blocks meaningful type-level
   drift detection.

2. **DB-006 (MEDIUM) — overlapping `payments → invoices` FKs.** A redundant composite
   `NOT VALID` FK sits beside the real simple FK; this is a genuine data-model smell on the
   money path and should be resolved before further schema work.

3. **DB-004 / DB-005 (MEDIUM) — `NOT VALID` FKs.** These are intentional backfills, but
   leaving them unvalidated means pre-existing rows can remain orphaned indefinitely.

4. **DB-001 / DB-002 (MEDIUM) — non-idempotent migrations.** Low runtime risk (only affects
   re-apply/replay), but must be fixed for a clean, re-runnable migration chain.

## Remediation order (safest-first, each independently verifiable)

| Step | Action | Change class | Risk |
| --- | --- | --- | --- |
| 1 | Generate + commit `supabase gen types`; thread `Database` generic through client/repos | type-update | none (compile-time) |
| 2 | `DROP POLICY IF EXISTS` before the two `CREATE POLICY` (DB-001, DB-002) | future-migration | none |
| 3 | Drop the redundant composite `payments` FK (DB-006); validate the simple FK | future-migration | low — verify `idx_invoices_id_center_unique` usage |
| 4 | `VALIDATE CONSTRAINT` for `services_category_fk` and `payments_invoice_center_fk` (DB-004/005) after orphan check | future-migration | low |
| 5 | (Optional) retire legacy `public_client_portal_profile_v1` and `enforce_appointment_integrity_v1` | future-migration | low |

Steps 2–5 each require a **new, additive migration** and **must not** be applied to any
environment in this phase.

## Explicit confirmations (this phase)

- ✅ No remote database, migration, RLS policy, RPC, trigger, table, view, or demo data was
  changed.
- ✅ Nothing was applied to Demo, Staging, or Production.
- ✅ No data deleted, reset, or reseeded.
- ✅ No secrets exposed or persisted; the provided credentials were not used.
- ✅ No product features or unrelated UI changes.
- ✅ No generated Supabase types committed over existing files (none existed to overwrite).
- ✅ Only additive files: `docs/database-contract/**`, `scripts/audit/**`, two test files,
  and `package.json` (new `audit:*` scripts + PGlite dev dependency).
