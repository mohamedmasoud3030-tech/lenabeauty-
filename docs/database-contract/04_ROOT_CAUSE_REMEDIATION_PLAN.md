# 04 — Root-Cause & Remediation Plan

Orders the remediation work for the findings in `03_VERIFIED_DRIFT_REGISTER.md`. Nothing here
is executed in this phase — it is a plan for the next phase.

## Root-cause categories

| Category | Findings | Pattern |
| --- | --- | --- |
| **replay-fingerprint-drift** | DB-003 | Non-idempotent migration rolls back `SET search_path` hardening on re-apply |
| **types-missing** | DB-004 | Untyped `SupabaseClient`; no committed generated types |
| **rls-role-governance** | DB-005 | Sensitive payroll tables use `FOR ALL + is_center_member` (no governed role) |
| **rpc-grant-missing** | DB-006 | Public booking/portal RPCs installed but un-granted; frontend still references them |
| **migration-idempotency** | DB-001, DB-002 | `CREATE POLICY` without `DROP POLICY IF EXISTS` |
| **fk-not-valid** | DB-008, DB-009 | Intentional `NOT VALID` integrity backfill left unvalidated |
| **fk-duplicate** | DB-010 | Composite tenant-integrity FK added beside the simple FK |
| **internal-routine-exposure** | DB-007 | `app_private` routine keeps default PUBLIC EXECUTE |

## Top release blockers

1. **DB-005 (HIGH) — payroll tables writable by any center member.** Unresolved security gap;
   must be gated on a governed role before freeze.
2. **DB-006 (HIGH) — 9 public booking/portal RPCs with no client grant.** Feature-intent
   decision required (enable vs. remove).
3. **DB-003 (HIGH) — search_path hardening rolls back on re-apply.** Caused by DB-001/DB-002;
   fix idempotency first.
4. **DB-004 (HIGH) — untyped client / no committed types.** Blocks build-time drift detection.
5. **DB-010 / DB-008 / DB-009 (MEDIUM) — money-path FK integrity.** Validate, do not drop.

## Remediation order (safest-first, each independently verifiable)

| Step | Action | Change class | Risk |
| --- | --- | --- | --- |
| 1 | Add `DROP POLICY IF EXISTS` before the two `CREATE POLICY` (DB-001/DB-002) | future-migration | none — also unblocks DB-003 |
| 2 | Re-verify replay fingerprint is stable after step 1 (DB-003) | audit re-run | none |
| 3 | Govern payroll writes by role (DB-005) | future-migration | none (tightens) |
| 4 | Decide + act on the 9 un-granted public RPCs (DB-006) | manual-review + migration | low |
| 5 | `REVOKE … FROM PUBLIC` on `maintain_entitlement_balance_v1` (DB-007) | future-migration | none |
| 6 | Query orphans → validate `payments_invoice_center_fk` + `services_category_fk` (DB-008/009) | future-migration | low |
| 7 | Inspect PostgREST behaviour before any `payments → invoices` FK removal (DB-010) | manual-review | low — do not drop yet |
| 8 | Generate + commit types from the canonical schema; add DTO/mapper/runtime contract tests (DB-004, DB-013) | type-update | none |

Steps 1, 3, 5, 6 each require a **new, additive migration** and **must not** be applied to any
environment in this phase.

## Live-state acceptance gate (future, read-only)

Before any migration apply, add a **read-only acceptance gate** that compares the hosted
**Demo** catalog against the canonical inventory (`docs/database-contract/artifacts/
schema-inventory.json`): tables, columns, enums, constraints, FKs, indexes, triggers,
functions, policies, and grants. This closes the gap documented in `00`:

> Repository contract audited; live Demo schema drift remains unverified.

## Explicit confirmations (this phase)

- ✅ No remote database, migration, RLS policy, RPC, trigger, table, view, or demo data was
  changed; nothing applied to Demo/Staging/Production; no data reset/reseed.
- ✅ No secrets exposed or persisted; the provided credentials were not used.
- ✅ No product features or unrelated UI changes; no generated types committed.
- ✅ Only additive files: `docs/database-contract/**`, `scripts/audit/**`, two test files,
  `.github/workflows/audit.yml`, and `package.json` (audit scripts + PGlite dev dependency).

## Final verdict

**NOT FROZEN** — pending review of the corrected audit and remediation of the HIGH findings
above.
