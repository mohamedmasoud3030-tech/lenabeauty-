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
- **PR #72 opened (NOT merged):** `arena/interface-architecture-m1` → `main` — merge is the product owner's explicit call.
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
