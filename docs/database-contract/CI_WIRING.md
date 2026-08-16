# CI Wiring for the Database Contract

The executable checks are available locally:

- `npm run audit:gate`
- `npm run db:types:check`
- `npm run ci:migrations`
- `npm run ci:rpc-check`
- `npm run typecheck`
- `npm test`
- `npm run build`

## GitHub Actions access limitation

The repository's current GitHub App token cannot create or modify workflow files (`workflows` permission is missing). A push containing `.github/workflows/ci.yml` was rejected by GitHub on 2026-08-16. Therefore the new PR gate could not be activated from this session.

The owner should add a pull-request workflow with Node 22, `npm ci`, `npm audit --audit-level=high`, the four contract commands above, typecheck/lint/tests, and the production build. The existing Demo migration workflow should run `audit:gate` and `db:types:check` before `supabase db push`.

Until those changes are made with a workflow-authorized credential, the existing Demo workflow still runs migration/RPC checks, tests, typecheck, lint, and build, but the new deterministic audit and generated-type checks are manual release gates.
