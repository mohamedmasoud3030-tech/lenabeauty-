# Supabase Remediation Plan — LenaBeauty

Date: 2026-08-18

---

## Part 1 — Completed (safe, reversible, already in the branch)

All work below is committed to `arena/01a014db-lenabeauty`. Nothing was applied
to any live environment.

| # | Item | Severity | Verification |
|---|---|---|---|
| 1 | Explicit Data API grant contract migration | Critical | 77 executable assertions |
| 2 | Executable RLS/grant harness + regression suite | — | 27 fail without the fix |
| 3 | Backup export: check all 12 responses | High | 4 assertions |
| 4 | Backup export: page past the 1000-row cap | High | 2300-row paging test |
| 5 | Sales report: surface ledger errors | High | 1 assertion |
| 6 | Financial summary: surface all 4 source errors | High | 4 assertions |
| 7 | Inventory forecast: explicit tenant scope | Medium | Typecheck + audit gate |
| 8 | Audit matrix: resolve embedded-resource filters | Medium | Gate returns to PASS |
| 9 | Four system reports | — | This document set |

### Gate status

| Gate | Before | After |
|---|---|---|
| `npm test` | 575 passed | **665 passed** |
| `npm run audit:gate` | PASS | PASS |
| `npm run db:types:check` | PASS | PASS |
| `npm run ci:migrations` | PASS (36) | PASS (37) |
| `npm run ci:rpc-check` | PASS | PASS |
| `npm run typecheck` / `lint` | PASS | PASS |
| `npm run build` | PASS | PASS |

### Files changed

```
added    supabase/migrations/20260818000001_data_api_grant_contract.sql
added    supabase/rollbacks/20260818000001_data_api_grant_contract.md
added    scripts/audit/lib/rls-harness.mjs
added    scripts/audit/lib/rls-harness.d.mts
added    src/__tests__/supabase.data-api-grant-contract.test.ts
added    src/__tests__/supabase.error-surfacing.test.ts
modified src/infrastructure/supabase/repositories.ts
modified scripts/audit/build-matrix.mjs
modified src/__tests__/audit.replay.test.ts        (migration count 36 → 37)
modified src/__tests__/audit.scanner.test.ts       (migration count 36 → 37)
modified docs/database-contract/artifacts/*.json   (regenerated)
added    SUPABASE_SYSTEM_MAP.md, SUPABASE_HEALTH_REPORT.md,
         SUPABASE_DECISIONS.md, SUPABASE_REMEDIATION_PLAN.md
```

---

## Part 2 — Needs your approval (one decision)

### APPROVAL GATE — apply migration `20260818000001` to Demo/Staging

This is the only thing I cannot do for you, because it changes a live
environment.

**What it does.** Writes down, as explicit `GRANT` statements, the table
permissions the app is already using. Also stops future tables from being
auto-exposed.

**Impact on the running Demo app:** none. The project already has these
permissions implicitly; the migration makes them explicit. No screen changes
behaviour.

**What happens if we don't apply it:**

- On **30 October 2026** Supabase removes the implicit permissions and the app
  stops working entirely — including login.
- Right now, restoring into a new Supabase project produces a non-functional app,
  so disaster recovery is effectively broken.

**Data safety.** No row is inserted, updated or deleted. No policy, function,
trigger or RLS setting is modified. `anon` gains nothing.

**Backup before applying.** Not strictly required (no data is touched), but the
runbook captures the current privilege state first so it can be compared and
restored:

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, privilege_type;
```

**How it would be applied.** Through the existing approval-gated workflow —
`workflow_dispatch` on `Apply Demo Supabase migrations`, which already refuses
any project ref other than the canonical Demo one and runs the read-only
integrity preflight before touching anything.

**Verification after applying.**

```bash
npm run preflight:supabase   # live schema + center contract
```
Then re-run the privilege query above and confirm: no `anon` rows; `authenticated`
holds SELECT broadly, INSERT/UPDATE only on operational master tables, DELETE
nowhere.

**Rollback.** Documented in
`supabase/rollbacks/20260818000001_data_api_grant_contract.md`. Reversible with
two `ALTER DEFAULT PRIVILEGES` statements.

> ### ✅ APPROVED by the owner on 2026-08-18.

### Apply status: blocked on two owner-only prerequisites

I attempted the apply immediately after approval. It could not proceed, for two
independent reasons — **neither is a defect in the migration**, and no live
system was modified.

**Blocker 1 — the workflow cannot be dispatched by my token.**
`workflow_dispatch` returns `HTTP 403: Resource not accessible by integration`.
The live job is additionally gated on `github.event_name == 'workflow_dispatch'`
by design, so a PR run can never apply migrations. That guard is correct and was
deliberately left untouched.

**Blocker 2 — the Demo deployment secrets are not configured.**
The workflow's credential probe reported `available=false`. This matters more
than it first appears: a manual dispatch in this state would **skip the apply
step and still report success**, giving false confidence that the migration had
landed. All eight secrets must exist first:

```
SUPABASE_ACCESS_TOKEN     SUPABASE_PROJECT_REF        SUPABASE_DB_PASSWORD
DEMO_SUPABASE_PROJECT_REF DEMO_SUPABASE_URL           DEMO_SUPABASE_PUBLISHABLE_KEY
DEMO_CENTER_ID            DEMO_SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_PROJECT_REF` and `DEMO_SUPABASE_PROJECT_REF` must both equal
`tuzzvqsnbtzvkffmazyf`; the workflow refuses any other target.

### What I did instead

- Opened **PR #35**, where all static gates pass (665 tests, contract gate,
  type check, migration chain, RPC contracts, lint, build, `npm audit`).
- Added `supabase/tests/20260818000001_data_api_grant_contract.sql`, a
  rollback-safe live acceptance test the workflow runs after `db push`, so the
  apply verifies itself on the real database instead of assuming success.
  Confirmed it rejects a simulated legacy auto-exposure state.
- Fixed `scripts/supabase-live-preflight.mjs`, whose hardcoded migration list
  had drifted to 34 while the chain held 37 — meaning the three newest
  migrations, including this one, were never verified against the live project.

### Owner steps to complete the apply

1. Add the eight secrets under **Settings → Secrets and variables → Actions**.
   Do not paste them into chat, a file, or a PR comment.
2. **Actions → Apply Demo Supabase migrations → Run workflow**, branch
   `arena/01a014db-lenabeauty`.
3. The run verifies the target ref, takes a read-only attendance/Storage
   snapshot and aborts on any pre-existing integrity violation, pushes, confirms
   migration history alignment, runs `preflight:supabase`, then executes the SQL
   acceptance tests.

If the run reports `available=false` again, the secrets are still missing and
nothing was applied.

---

## Part 3 — Recommended next, in priority order

### P1 · Verify the live Demo project matches the declared contract
*After the approval above.* Compare actual grants against the contract and
remove any legacy extras the migration now supersedes. Also confirm remote
migration history matches the 37 local files (`supabase migration list --linked`).
**Not verifiable from this environment.**

### P2 · Exercise a real backup/restore drill
The export path is fixed and paged, but restore has never been rehearsed against
a realistic dataset. Restore into a scratch project and confirm counts match
per table. This also becomes the first real test that a fresh project works
under the new grant contract.

### P3 · Before any Production launch
1. Create a **separate** Production project. Never point production at the Demo
   project — `env.ts` already fails closed, so this is a provisioning step.
2. Set `VITE_ENVIRONMENT=production` with its own URL, anon key and center id.
3. Run the manual admin bootstrap for the real owner account.
4. Enable leaked-password protection (HIBP) — requires a paid plan; CI already
   notices its absence.
5. Confirm Point-in-Time Recovery / backup retention meets the business's real
   retention needs. **This is a business/legal decision and needs your input.**

### P4 · Add pagination where volume will eventually bite
`Customer.getHistory`, `Report.getSales` and `Report.getAppointments` are still
unpaged. They are date- or customer-scoped so the 1000-row cap is unlikely to be
hit soon, but a busy salon will reach it in reporting over long ranges. Lower
priority than the export path because the consequence is a visibly short report
rather than a corrupted backup.

### P5 · Before enabling public booking / client portal
The nine `public_*` RPCs are correctly dormant. Before granting `anon` EXECUTE,
re-audit: rate limiting, abuse controls, portal-token entropy and lockout, and
the fact that granting `anon` reintroduces an anonymous attack surface the
current release does not have.

---

## Part 4 — Monitoring

Nothing here is urgent, but these are the checks worth keeping:

- CI already blocks type drift, migration disorder, missing RPCs and contract
  regressions on every PR.
- The new authorization suite runs offline in CI, so a future migration that
  revokes a needed privilege — or accidentally widens one — fails the build.
- Watch the Supabase **Security Advisor** for tables flagged as missing explicit
  grants ahead of 2026-10-30.

---

## Summary

The system's security architecture is sound and I could not breach its tenant,
role, or financial boundaries. The critical risk was not a weak policy but an
**undeclared permission layer** resting on a platform default that expires on
2026-10-30 — which also meant disaster recovery would not have worked today.

That is fixed, along with four paths that were converting failures into
confident wrong answers. All of it is tested, reversible, and waiting on a single
yes/no from you to reach the live environment.
