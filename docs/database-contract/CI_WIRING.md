# CI Wiring for the Contract Audit

The audit gate logic lives in `scripts/audit/ci-gate.mjs` and is exposed as
`npm run audit:gate` (and `npm run audit:all`). It is fully self-contained and can be run
locally or in any CI runner.

## GitHub Actions workflow (owner action required)

The Arena GitHub App that authored this PR does **not** have the `workflows` write
permission, so it cannot create `.github/workflows/*.yml`. To wire the gate into CI, the
repository owner should add the following file as `.github/workflows/audit.yml`:

```yaml
name: Database contract audit

on:
  pull_request:
    paths:
      - "supabase/migrations/**"
      - "src/**"
      - "scripts/audit/**"
      - "docs/database-contract/**"
      - "package.json"
      - "package-lock.json"
  workflow_dispatch:

concurrency:
  group: lena-db-contract-audit
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  audit:
    name: Replay + scan + contract gate
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run reproducible contract audit + gate
        run: node scripts/audit/ci-gate.mjs
      - name: Focused audit tests
        run: npx vitest run src/__tests__/audit.scanner.test.ts src/__tests__/audit.replay.test.ts
      - name: Typecheck
        run: npm run typecheck
```

## What the gate fails on

`scripts/audit/ci-gate.mjs` re-runs the audit (replay → scan → matrix) and fails the build
on:

- any migration replay failure (expected: 0);
- any idempotency failure **beyond** the two documented duplicate-policy gaps
  (`20260628000012…`, `20260810000005…`);
- unresolved frontend table/RPC existence or argument mismatches;
- missing client-role EXECUTE grants on frontend-referenced RPCs;
- unpinned SECURITY DEFINER `search_path`;
- unexpected broad sensitive-table write policies (payroll);
- stale generated audit artifacts (committed artifacts differ from freshly generated).

The two known idempotency gaps and their fingerprint drift are reported as a NOTE (not a
fatal gate failure), since they are documented exclusions. The gate is therefore expected to
be **red** on the current baseline (payroll governance + un-granted public RPCs are still
unresolved), correctly signalling **NOT FROZEN** until those findings are remediated.
