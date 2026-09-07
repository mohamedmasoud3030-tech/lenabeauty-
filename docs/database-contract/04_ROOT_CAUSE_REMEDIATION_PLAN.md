# 04 — Root-Cause Remediation Status

The blocking findings from the database-contract audit are remediated. This file records the
current ownership model rather than historical implementation debt.

| Area | Current resolution | Verification |
| --- | --- | --- |
| Migration idempotency / fingerprint drift | Repeat replay is deterministic | `npm run audit:replay` / `npm run audit:gate` |
| Payroll role governance | Sensitive workforce/payroll writes are server-governed and ADMIN-only | canonical replay + migration tests |
| Public booking / client portal | Removed from the live frontend TypeScript contract; historical DB functions remain deny-by-default | frontend scan + migration/grant tests |
| Tenant reference integrity | Center-scoped foreign keys are canonical and PostgREST relationships resolve | contract matrix |
| Internal function grants | Trigger-only/internal routines are not client executable | contract matrix + migration tests |
| Database TypeScript contract | Generated `Database` types are committed and the Supabase client is typed | `npm run db:types:check` + typecheck |
| CI wiring | Contract, migration/RPC, tests, typecheck, lint, build and audit checks run in GitHub Actions | `.github/workflows/demo-supabase-migrations.yml` |

## Live deployment acceptance

Repository verification and live deployment verification are separate. Production acceptance
still requires the hosted Supabase project to have the canonical migrations applied and the
committed live QA/security checks to pass. Repository cleanup must not rewrite migration
history to remove dormant database objects.
