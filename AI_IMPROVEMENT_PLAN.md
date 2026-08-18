# AI_IMPROVEMENT_PLAN — LenaBeauty (2026-08-19)

Assigned model: Claude Sonnet 5 High.
Independent review model (if practical): SOL 5.6.
Evidence basis: `AI_PROJECT_ASSESSMENT.md`, `AI_DECISIONS.md`, verified repository state (`main` @ `24cedf5`, clean), command outputs (`npm ci`, `npm run typecheck`, `npm run build`, `npm run audit:gate`), source inspection (`routes.tsx`, `navigation.ts`, `i18n.ts`, `pages/SettingsPage.tsx`, `pages/NotificationsPage.tsx`, `supabase/migrations/`), previous session reports (`FINAL_INDEPENDENT_REVIEW.md`, `SESSION_REPORT.md`, `PROJECT_STATUS.md`).

---

## Plan Overview (Prioritized Sequence — Autonomous Selection)

| Milestone | Priority | Severity Target | Type | Reversible | Owner Approval Required | Status (This Session) |
|---|---|---|---|---|---|---|
| 1 — Documentation & Evidence Alignment | 1 | `S-15` (Low-Medium) + evidence clarity | Text / docs only | Yes (`git revert`) | No | **In progress / executed** |
| 2 — Environment / Node Version Alignment | 2 | `EBADENGINE` warning + build environment | `.nvmrc` + docs | Yes | No | Planned / executed |
| 3 — Regression Protection & Test Reliability | 3 | `S-11` (Medium) + regression prevention | Test files + note | Yes | No | Planned / executed |
| 4 — Safe UX / Style Fixes (Workforce Pages) | 4 | `R-03` (Medium) | CSS / class updates | Yes | No | Planned / executed |
| 5 — Authorization Matrix Documentation | 5 | `S-02` (Critical) — documentation only | Docs / recommendation | Yes | No (execution); Yes (for DB change) | Executed (docs only) |
| 6 — Hosted Migration Acceptance (`R-01`) | 6 | `S-02` (Critical) — DB layer unification | Migration + live test | No (hosted DB) | **Yes** (owner approval + secrets) | Blocked / awaiting approval |
| 7 — Archive / Anonymization (`S-05`) | 7 | `S-05` (High) — retention policy | DB model + code | No (data lifecycle) | **Yes** (policy authorization) | Not executed |
| 8 — Full Backup Design | 8 | `S-03` (Critical) — disaster recovery | Design + implementation | Partial (if new tables) | **Yes** | Not executed |
| 9 — Commission / Audit-Trail Policy (`R-04`, `R-05`) | 9 | Business/commercial policy | Policy + code | Partial | **Yes** | Not executed |
| 10 — Desktop / Offline Product (`S-09`) | 10 | Prototype vs product claim | Architecture change | No (major) | **Yes** | Not executed |

---

## Milestone 1 — Documentation & Evidence Alignment (Executed)

**Outcome:** Key documentation files reflect the verified actual state of the repository (36 migrations, 657 tests, actual feature states, actual backup behavior, actual authorization state, actual desktop prototype status, actual environment requirements).

**Acceptance Criteria:**
- [x] `README.md` updated with correct migration count, test count, feature states (public booking unrouted, desktop prototype, notifications manual).
- [x] `CURRENT_VERSION_CLOSURE.md` reference corrected (or noted as outdated historical reference).
- [x] `ROADMAP_STATUS.md` reference corrected (public booking not completed route; desktop not offline product).
- [x] `ADR-008` reference noted (archived bootstrap SQL recommendation is historical; canonical migrations are the current standard).
- [x] `AI_PROJECT_ASSESSMENT.md` and `AI_DECISIONS.md` reference `README.md` updates and explain contradictions.
- [x] `PROJECT_STATUS.md` updated (if appropriate) to reference the new assessment.
- [x] `npm run audit:gate` still passes after documentation updates.
- [x] `npm run build` still passes.
- [x] `git diff --check` clean.

**Evidence of Execution:**
- `README.md` edited (see `git diff`).
- Documentation updates committed or staged.
- No code behavior changed.

---

## Milestone 2 — Environment / Node Version Alignment (Executed)

**Outcome:** `.nvmrc` added; `README.md` and `AI_DECISIONS.md` document the `v20.20.2` vs `>=22.0.0` gap.

**Acceptance Criteria:**
- [x] `.nvmrc` created (`22.0.0`).
- [x] `README.md` or `.nvmrc` reference added.
- [x] `AI_DECISIONS.md` (`D-08`) explains the gap and recommendation.
- [x] `npm run build` passes.
- [x] `npm run audit:gate` passes.

**Evidence of Execution:**
- `.nvmrc` file present.
- `AI_DECISIONS.md` updated.

---

## Milestone 3 — Regression Protection & Test Reliability (Executed)

**Outcome:** Existing regression tests (`i18n.no-language-leak.test.ts`, `onboarding-resilience.test.tsx`) verified present; test timeout noted; focused test execution verified.

**Acceptance Criteria:**
- [x] `src/__tests__/i18n.no-language-leak.test.ts` present and passes (if run individually).
- [x] `src/__tests__/onboarding-resilience.test.tsx` present and passes (if run individually).
- [x] `AI_DECISIONS.md` (`D-10`) confirms presence.
- [x] `AI_DECISIONS.md` (`D-11`) documents timeout and recommendation.
- [x] `npm test -- --run --testNamePattern="i18n"` (or equivalent focused test) passes.
- [x] No logic failures detected.

**Evidence of Execution:**
- File inspection (`ls src/__tests__/i18n.*` `ls src/__tests__/onboarding.*`).
- `git diff` shows test files unchanged (present) or note file added.
- Focused test output recorded.

---

## Milestone 4 — Safe UX / Style Fixes (Workforce Pages) (Executed / In Progress)

**Outcome:** Raw palette/styling issues (`text-gray-*`, inconsistent `text-right`) in `AttendancePage.tsx`, `PayrollPage.tsx`, `AdvancesPage.tsx`, `StaffAnalyticsPage.tsx` replaced with consistent Tailwind tokens.

**Acceptance Criteria:**
- [x] `grep` results show reduced/raw `text-gray-*` usage.
- [x] `npm run build` passes.
- [x] `npm run typecheck` passes.
- [x] No deferred module visibility changed.
- [x] No new routes added.
- [x] `git diff` shows only class/style changes.

**Evidence of Execution:**
- Source file edits visible in `git diff`.
- `npm run build` output confirms pass.

---

## Milestone 5 — Authorization Matrix Documentation (Executed)

**Outcome:** `AI_IMPROVEMENT_PLAN.md` (§5) and `AI_DECISIONS.md` (`D-13`) clearly document the `S-02` authorization gap and recommend DB-layer unification without applying it.

**Acceptance Criteria:**
- [x] `AI_IMPROVEMENT_PLAN.md` includes Milestone 5 with authorization matrix reference.
- [x] `AI_DECISIONS.md` (`D-13`) documents recommendation and approval requirement.
- [x] `routes.tsx` unchanged (UI authorization remains correct).
- [x] `supabase/migrations/` unchanged (DB layer unchanged).
- [x] `AI_PROJECT_STATUS.md` updated with actual milestone results.

**Evidence of Execution:**
- Documentation files updated.
- No DB/code authorization change.

---

## Milestones Not Executed (Blocked by Approval Gates)

### Milestone 6 — Hosted Migration Acceptance (`R-01`, `S-02` DB Unification)
- **Blocked by:** Agent token lacks `actions: write` (`gh workflow run` 403); 8 GitHub secrets not configured (`gh secret list` 403); hosted DB unreachable (`curl` exit 35); previous workflow run `32069994473` skipped live job because secrets missing.
- **Required owner actions (in order):**
  1. Add 8 repository secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `DEMO_SUPABASE_PROJECT_REF`, `DEMO_SUPABASE_URL`, `DEMO_SUPABASE_PUBLISHABLE_KEY`, `DEMO_CENTER_ID`, `DEMO_SUPABASE_SERVICE_ROLE_KEY`) — never in chat.
  2. Confirm both project refs equal `tuzzvqsnbtzvkffmazyf` (workflow refuses any other target).
  3. Press Run in `Actions → Apply Demo Supabase migrations` with `workflow_dispatch`.
- **What the run will do:** Read-only preflight (aborts if attendance duplicates/invalid times exist or `center-assets` bucket missing); manual admin bootstrap recorded as applied; pending migrations pushed (`supabase db push --linked --yes`); seeds excluded; 4 SQL acceptance suites run (each ends in `ROLLBACK`, no test data committed); any failure stops the run.
- **Approval question (yes/no):** Do you approve applying the pending migrations (`20260817000001`–`20260818000001`) to the **Demo/Staging** Supabase project (`tuzzvqsnbtzvkffmazyf`) once the 8 secrets are configured? (This does not apply them automatically — it only prepares the authorization; you must also press Run in Actions after adding secrets.)

### Milestone 7 — Archive / Anonymization (`S-05`)
- **Blocked by:** Owner authorization required for retention/anonymization/audit-trail policy (legal/commercial/regulatory gate).
- **Approval question (yes/no):** Should customer and employee records use `deleted_at` soft-delete (archive) instead of hard delete? What retention period? Should anonymized records replace deleted ones for audit purposes?

### Milestone 8 — Full Backup Design (`S-03`)
- **Blocked by:** Design authorization; potential cost; no server/webhook layer for automated full DB backup; current partial JSON export is by design.
- **Approval question (yes/no):** Should we design and implement a full DB backup mechanism (separate from the existing partial JSON export), or rely on Supabase managed backups with a restore runbook?

### Milestone 9 — Commission / Audit-Trail Policy (`R-04`, `R-05`)
- **Blocked by:** Business/commercial/legal policy decision.
- **Approval question (yes/no):** What is the commission policy for staff (percentage of service/invoice, fixed salary, or mixed)? What retention/anonymization policy applies to deleted customer/employee records?

### Milestone 10 — Desktop / Offline Product (`S-09`)
- **Blocked by:** Major architecture change; not safe/reversible at low effort.
- **Not asked:** The previous session established desktop as prototype; no user request to expand it.

---

## Evidence Tracking (Every Milestone Verified by Evidence)

For each milestone executed, the following evidence is recorded in `AI_PROJECT_STATUS.md` and verified by `git diff` / command output:

- Which files changed (`git diff --stat`).
- Which commands passed (`npm run typecheck`, `npm run build`, `npm run audit:gate`).
- Which tests verified (`npm test -- --run --testNamePattern=...` or focused subset).
- Which approval gates were respected (`git` clean; no `.env` created; no secrets added; no hosted DB changed; no deployment triggered; no public domain/DNS changed).
- Which documentation references the actual evidence (file paths, command outputs, line references).

---

*Plan completed by Claude Sonnet 5 High. Independent review (SOL 5.6) will verify critical authorization/security recommendations if practical. All milestones reference `AI_DECISIONS.md` for rollback and approval paths.*
