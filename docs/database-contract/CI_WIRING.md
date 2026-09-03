# CI Wiring for the Database Contract

The database contract is wired into the repository's GitHub Actions gate.

The static application/database job runs the canonical checks before any live Demo migration
step is allowed to proceed. The enforced command set includes:

- `npm run audit:gate`
- `npm run db:types:check`
- `npm run ci:migrations`
- `npm run ci:rpc-check`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- dependency audit and `git diff --check`

The live Demo migration/security job is conditional on the required deployment credentials.
If those secrets are unavailable, that live job is skipped; the static repository gates still
run and must pass.

Canonical workflow: `.github/workflows/demo-supabase-migrations.yml`.
