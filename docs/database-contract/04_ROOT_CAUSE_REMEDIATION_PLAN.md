# 04 — Root-Cause Remediation Status

The blocking findings from the 2026-08 database contract audit were remediated on 2026-08-16.

| Area | Resolution | Verification |
|---|---|---|
| Migration idempotency / fingerprint drift | Added missing policy drops; repeat replay is deterministic | `npm run audit:replay` |
| Payroll role governance | Added server-governed `center_memberships.role`, `has_center_role`, and ADMIN-only payroll RLS | canonical replay + targeted migration test |
| Dormant public RPC contract | Audit recognizes the explicit disabled surface and fails if a dormant RPC becomes client-executable | `npm run audit:gate` + grant tests |
| Tenant reference integrity | Added and validated center-scoped FKs; added the optional advance/run center trigger | canonical replay + targeted migration test |
| Ambiguous relationships | Removed equivalent simple FKs after validating composite replacements | contract matrix |
| Internal function grants | Revoked all client execution on trigger-only routines | contract matrix + targeted migration test |
| Database TypeScript contract | Generated types from deterministic replay, typed the client and payloads, added drift check | `npm run db:types:check` + `npm run typecheck` |
| CI wiring | Commands are complete, but GitHub rejected workflow-file changes because the App lacks `workflows` permission | owner must wire the commands documented in `CI_WIRING.md` |

## Live deployment acceptance

Repository verification cannot prove the hosted Supabase catalog has applied the latest migration. Before production release:

1. apply pending migrations to Demo/staging;
2. run the committed Supabase SQL acceptance tests;
3. run `npm run preflight:supabase` with temporary server-only credentials;
4. verify Supabase Auth leaked-password protection in the managed dashboard;
5. perform the browser checklist in `docs/SUPABASE_LIVE_QA_RUNBOOK.md`.

No remote database is modified by repository-local verification.
