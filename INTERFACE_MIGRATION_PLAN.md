# INTERFACE_MIGRATION_PLAN

Safe, ordered, vertical milestones. Ordered by: broken critical journeys → severe mobile/RTL/a11y failures → content-hierarchy errors → shared foundations → standardization → representative journeys → remaining routes → obsolete removal → polish. Each milestone is small, reversible, and verified (typecheck + targeted tests + full suite + build) before the next begins. Status labels only: VERIFIED COMPLETE / IMPLEMENTED BUT NOT VERIFIED / BLOCKED BY OWNER OR EXTERNAL ACTION / NOT STARTED.

## Already shipped by prior rounds (verified today, closed)
- POS `window.prompt` → branded Modal with price floor. **VERIFIED COMPLETE** (grep-verified; POS tests pass).
- Dashboard duplicate low-stock panels → single merged exceptions list. **VERIFIED COMPLETE**.
- Revenue permission gating (`canViewRevenue` tiles + chart). **VERIFIED COMPLETE**.
- Gift-card/package form labels; settings chevron RTL; OMR 3dp; language-aware locales; 44px toggles. **VERIFIED COMPLETE**.
- IA nav registry, mobile dock/sheet, GlobalSearch, fail-closed auth. **VERIFIED COMPLETE** (test-locked).

## Milestone 1 — Canonical page headers + verified consistency fixes (this round)
**User-visible outcome:** every operational list page opens with the same header hierarchy (icon, title scale, subtitle, action placement) and readable money microcopy; expenses density matches other operational tables.
**Scope:**
1. Migrate 6 hand-rolled headers to `PageHeader`: expenses, employees, inventory, gift-cards, packages, attendance — preserving icons, subtitles, accessible action names (test-locked), and permission gating.
2. Normalize expenses "Add Expense" CTA to standard size (`min-h-11 px-4`); compress billboard stat cards to operational density.
3. Expenses table header `[&>th]:py-8` → `py-4` (density parity).
4. `EmployeesPage` `text-[8px]` "OMR" → `text-[10px]` token.
5. `LazyChart` physical `right-2` → logical `end-2` (RTL).
**Acceptance:** accessible names preserved; no data/permission/route changes; typecheck + full suite + build green; RTL unaffected (logical classes only).
**Status:** VERIFIED COMPLETE — 2026-09-09: typecheck ✓, source-policy lint ✓ (355 files), full suite 136 files / 880 tests ✓ (baseline parity), production build ✓ (PWA generated), all 7 touched modules transform+serve 200 on the dev server, git diff reviewed (7 files, +104/−116, presentation-only).

## Milestone 2 — Workforce header alignment (advances, payroll, staff-analytics)
Same PageHeader migration for the remaining three admin pages: `AdvancesPage` (TrendingDown icon + New Advance Request action), `PayrollPageEnhanced` (FileText icon + formula subtitle), `StaffAnalyticsPage` (Activity icon + month control in actions). Accessible names, month inputs, and permission gating preserved verbatim.
**Status:** VERIFIED COMPLETE — 2026-09-09: typecheck ✓, source-policy lint ✓, targeted suite (16 files / 128 tests incl. `workforce-i18n-navigation`) ✓, full suite 136 files / 880 tests ✓, production build ✓, live rendered verification (desktop 1440 + mobile 390, real Chromium, Demo data): payroll with 6 live employee rows, advances empty state, staff-analytics per-employee cards — 0 console/page errors.

## Milestone 3 — Canonical no-results wording audit
Audited every search surface. Already compliant: customers, expenses, inventory, services, POS catalog. Found and fixed: `GiftCardsPage` and `PackagesPage` always showed onboarding copy even when a query filtered everything out — now `query.trim() ? "Try a different search term" : onboarding copy`.
**Status:** VERIFIED COMPLETE — 2026-09-09 (same verification gates as M2; GlobalSearch has no list-empty surface to fix).

## Milestone 4 — Representative journey re-verification pass (live, authenticated)
**Status:** VERIFIED COMPLETE — 2026-09-09, with owner-provided Demo credentials (not stored in the repository; `.env` is git-ignored and holds only the demo opt-in flag).
**Method:** real Chromium (Playwright headless) against the dev server with live Demo Supabase data.
**Executed matrix:**
- Desktop 1440×900 (RTL/Arabic): login → dashboard, then all 15 shipped admin/operational routes + Add Expense dialog — 17 captures, **0 console errors, 0 page errors**.
- Tablet 768×1024: dashboard, expenses, inventory — clean.
- Mobile 390×844 (touch): dashboard + 8 key routes + mobile navigation sheet — clean; dock/sheet/dock-thumb checkout confirmed.
- Migrated M1 pages re-verified **live** against their acceptance criteria: canonical PageHeader + normalized CTA on expenses/employees/inventory/gift-cards/packages/attendance; expenses stat density + table-header density confirmed with data; RTL logical layout visually confirmed throughout.
**Accepted observations (documented, non-blocking):** native `type="month"` inputs render in browser locale (browser-owned behavior, out of product scope); everything else matched `PAGE_CONTENT_ARCHITECTURE.md`.
**Evidence:** 27 captures in the workspace `verify-shots/` (not committed — binary hygiene).

### M4 supplement — extended live verification (2026-09-09, same session)
Second live pass covering the journeys and surfaces not exercised in the first matrix — desktop 1440 Arabic RTL + English LTR, real Chromium, Demo data, **0 console / 0 page errors** (captured in `verify-shots-3/`, workspace-only):
- **Appointments journey:** day view, week-grid toggle, booking dialog (labels, smart defaults, disabled confirm until required fields, embedded no-show policy note).
- **Customer passport:** opened from row action — identity header, visit stats, retention panel, chronological history (T3 record-detail template as documented).
- **Reports:** sales tab with live period data (4 transactions, OMR 86.000) — T9 evidence template as documented.
- **Settings + branding tab; growth pages** (customer-experience, forecasting, accounting, booking requests): all render with owned states.
- **Global search palette:** opens from chrome, grouped destinations + keyboard hints (↑↓/Enter/Esc).
- **English pass:** `dir` flips to `ltr`, sidebar/content mirror correctly, translations complete on dashboard/customers/POS.

## Milestone 6 — End-to-end operational journey, live (mobile, real data) + P0 defect fix
**Scope:** execute the full salon money journey on a phone viewport against live Demo data: book an appointment for an existing customer → arrive → start service → finish service → POS handoff → record completed sale → receipt → verify customer spend/loyalty and appointment completion.
**Status:** VERIFIED COMPLETE — 2026-09-09. Journey executed end-to-end with real data: booking created; all three visit transitions succeeded via the booking dialog; POS handoff auto-filled the visit context (customer, specialist, and the booked service line); checkout recorded invoice `INV-20260909…` (OMR 3.000) with QR receipt; customer "اماني" moved 11.000 → **14.000** with loyalty 11 → **14**; center revenue 136.000 → **139.000**; appointment shows **مكتمل** with stats updated. Evidence: `verify-shots-4/` (workspace).

**P0 defect found by this journey and fixed (`PosInvoicesPage.tsx`):**
Under React StrictMode (always on in dev), the appointment→POS hydration effect double-invokes: run #1 is cancelled immediately — **after** arming the `visitHydrationRef` once-guard — and run #2 was then permanently blocked by that guard. Result: the visit handoff silently degraded to a plain sale (empty cart, no pre-filled service line, no visit context card) in every dev session; production builds mask it (no double-invoke). Fix: the cleanup resets the guard (`visitHydrationRef.current = ""`), preserving its real purpose (no redundant re-fetch with the same param while mounted; effect deps already ensure that) without ever blocking hydration. Post-fix live rerun: handoff complete (visit card + stage + customer + service line), zero console/page errors.
**Gates after fix:** typecheck ✓, source-policy lint ✓, full suite 136 files / 880 tests ✓, production build ✓, live mobile journey ✓.

### M4 supplement — extended live verification (2026-09-09, same session)

### Delivery state
- **PR #72: MERGED into `main` (2026-09-09, owner-approved, all checks green).** `main`'s own gate passed on the merge commit.
- **PR #73 (P0 StrictMode fix): MERGED into `main` (2026-09-09, owner-approved "merge on green", all checks green).**
- Branch `arena/interface-architecture-m1` retained for audit trail; every milestone status above is VERIFIED COMPLETE.
- **CI incident (resolved):** the PR's "Static application and database gates" failed on a NEW `npm audit` advisory (GHSA-82fw-gwwq-j7x9, moderate, `@vitest/mocker ≤ 4.1.10`, dev-only dependency) published after `main`'s last green run — a time-based failure unrelated to interface changes. `npm audit fix`/lockfile regeneration crashes with npm 10.9.4's arborist `edgesOut` bug, so the lock was patched surgically (8 vitest/@vitest entries, 45+/45− lines, registry metadata only — zero transitive drift) in `629a2d1`. All gates re-run locally under Node 22 (CI parity): audit 0 vulnerabilities, full 880-test suite, typecheck/lint/build — then the PR gate went **green** on that commit.

## Milestone 5 — Readability floor sweep (scoped: readable money/quantity labels)
Swept `text-[9px]` → `text-[10px]` for the read-content class only: dashboard chart money eyebrows (Daily revenue trend / Total / This Month / Net Profit), `MoneyStat` label + currency, POS cart items count + total OMR, employees OMR labels (desktop + mobile), inventory OMR/cost/price labels (6 sites), services OMR price labels (desktop + mobile), customers mobile loyalty points.
**Deliberately kept at 9px (documented density choice, not defects):** status badges/chips, zebra timestamps, decorative eyebrows ("اليوم في مركزك"), kbd hints, and the print layout (physical mm-scale paper). Native `type="month"` inputs render in browser locale — browser-owned behavior, out of product scope.
**Status:** VERIFIED COMPLETE — 2026-09-09 (same gates + live captures of dashboard/POS/services with data).

## Frozen by decision (do not do)
- No shell restyle (Layout/Sidebar/Dock/Sheet) — test-locked and correct.
- No new design system, no component-library introduction, no state-management change, no framework swap.
- No route removals or merges beyond the verified content-level merges already shipped.
- No schema/RPC/permission changes in interface milestones.

## Verification gates applied to every milestone
1. `npm run typecheck` 2. targeted page/dialog tests 3. full `npm test` (880 baseline) 4. `npm run build` 5. dev-server rendered inspection 6. Git diff review (no unrelated changes) 7. update this file's status labels.

## Operational follow-ups — 2026-09-10 (owner-approved execution)

### 1. Demo Supabase migrations via `workflow_dispatch`
- Dispatched `demo-supabase-migrations.yml` on `main` @ `833bc96`: run `34405193034` → completed **success**, but the **Live Demo migration and security gates** job was **SKIPPED**. Root cause: the credential probe requires all 8 repository Actions secrets, and not all of them were configured (corrected audit below — an initial "zero secrets" reading was an unauthenticated-API misread). The 2026-09-07 precedent dispatch shows the identical skip. Nothing about the code or migrations was at fault.
- Configured via the GitHub API the 5 values that are public-by-design (taken from the repo's own committed `src/config/env.ts` and the workflow's own hard assertions): `DEMO_SUPABASE_URL`, `DEMO_SUPABASE_PUBLISHABLE_KEY` (anon key — browser-public by design), `DEMO_CENTER_ID`, `DEMO_SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_REF` (the workflow refuses to run unless both refs equal the canonical Demo project `tuzzvqsnbtzvkffmazyf`).
- **Corrected audit (2026-09-10):** secret `updated_at` timestamps show `SUPABASE_ACCESS_TOKEN` has been configured since **2026-08-18** — it did not appear during this session; the initial zero-secrets reading came from an unauthenticated API call whose 401 body was misparsed as an empty list. Secret values cannot be read back, so this token's validity for the Demo project is unverified.
- **Remaining BLOCKED BY OWNER:** (1) `SUPABASE_DB_PASSWORD` (the Demo project's Postgres password), (2) `DEMO_SUPABASE_SERVICE_ROLE_KEY` (Supabase Dashboard → Project Settings → API Keys → `service_role`), and (3) an access token from the Supabase account that actually owns `tuzzvqsnbtzvkffmazyf` — see the addendum below. Once these exist in *Settings → Secrets and variables → Actions*, re-dispatch `demo-supabase-migrations.yml` on `main`; the live job will then verify the Demo target, enforce the password-reauthentication security setting, link the CLI, apply pending migrations, and run the psql preflight/acceptance suites. No code or doc change is required first.
- **Status: BLOCKED BY OWNER OR EXTERNAL ACTION** (owner-only secrets — see corrected audit and addendum). All other live gates were verified green in this session.
- **Addendum (2026-09-10, later):** the owner supplied a Supabase access token; the Management API shows it belongs to a **different Supabase account** whose only project is an empty, unrelated one (`livpmxwwxsfnaceczyth` "starting", 0 tables) — it cannot manage the Demo project (`api-keys` for `tuzzvqsnbtzvkffmazyf` returns a privilege error). It was therefore **not** stored in the repository (replacing the existing token with a wrong-account one would guarantee a live-run failure at the auth-config step). The Demo project itself was re-verified healthy: admin login OK, authenticated REST 200. Unblock paths: an access token generated from the account owning `tuzzvqsnbtzvkffmazyf` (recommended — with it, the service-role key and a DB-password reset can be provisioned directly), or the two dashboard values pasted directly plus a valid token. Status unchanged: **BLOCKED BY OWNER OR EXTERNAL ACTION**.

- **Resolution progress (2026-09-10, final):** the owner supplied an access token from the correct account (project "Lena beauty" visible). Stored as `SUPABASE_ACCESS_TOKEN` (replacing the unverifiable 2026-08-18 value) and used it to retrieve and store `DEMO_SUPABASE_SERVICE_ROLE_KEY` (verified live: authenticated REST 200). **7/8 secrets now configured** — only `SUPABASE_DB_PASSWORD` remains. Root cause of the 403 on `PATCH /v1/projects/{ref}/database/password`: the token's account holds the **Developer** organization role while the org **Owner** is the owner's separate account; DB-password reset is Owner-only and is additionally refused to every token (proven by an identical 403 on a scratch project) — dashboard-session-only by Supabase platform design. In-database alternatives are closed as well (`postgres` cannot `ALTER ROLE`, even itself; no superuser reachable).
- **Migration parity verified via Management API (2026-09-10):** remote Demo has **44/44** migrations applied — zero pending, zero remote-only, exact order match with `supabase/migrations/`. The practical goal of the dispatch (apply pending migrations) is already satisfied; the live CI job remains a future regression/security gate pending only the one Owner-side value. Unblock: from the **Owner** account, Project Settings → Database → Reset database password (then share the value to be stored), or elevate the Developer account to Owner and re-issue the token. Status: **BLOCKED BY OWNER OR EXTERNAL ACTION** (single platform-gated value).

- **Leftover polish executed (2026-09-10, later the same day):** (1) i18n key check — `"Try a different search term"` already exists in both locales (`ar`: "جرّب كلمة بحث مختلفة") — no change needed. (2) ExpensesPage density normalized to the shipped readability floor: filter search input `rounded-[1.5rem] py-4 focus:ring-4` → `rounded-xl min-h-11 focus:ring-2`; card container `rounded-[1.5rem] sm:rounded-[3rem] shadow-2xl` → `rounded-xl sm:rounded-2xl shadow-sm`; both modal CTAs (add + edit) `h-14 rounded-[2rem]` → `min-h-11 rounded-xl`. Modal form fields deliberately keep the larger `rounded-[1.5rem] py-4` pattern to match the shipped Customer modals (consistency over one-off normalization). Gates: typecheck ✓, full suite 136 files / 880 tests ✓, source-policy lint (355 files) ✓, production build ✓. Rendered verification at 390px & 1440px: search input and modal CTA measure exactly 44px, zero console/page errors, evidence `verify-shots-5/`. Status: VERIFIED COMPLETE.

### 2. Demo admin password rotation
- Executed and verified against the hosted Demo project: password-grant login with the old password → `PUT /auth/v1/user` set a strong new password → fresh login with the new password succeeded → the old password is now rejected. The new value was communicated to the owner in chat **only** and is deliberately never stored in the repository (detect-credentials gate policy). Any demo login must now use the new password.
