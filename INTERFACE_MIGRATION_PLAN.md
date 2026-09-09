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
Same PageHeader migration for the remaining three admin pages. **Status:** NOT STARTED.
**Acceptance:** same as M1; workforce i18n/navigation tests stay green.

## Milestone 3 — Canonical no-results wording audit
Verify every searchable list applies the conditional no-results copy (customers, expenses, inventory, services, POS catalog done; audit remaining search surfaces: gift cards, packages, employees if searchable, GlobalSearch N/A). Standardize via ListState docs; add tests only where a gap is found. **Status:** NOT STARTED.

## Milestone 4 — Representative journey re-verification pass (live, authenticated)
**Status:** VERIFIED COMPLETE — 2026-09-09, with owner-provided Demo credentials (not stored in the repository; `.env` is git-ignored and holds only the demo opt-in flag).
**Method:** real Chromium (Playwright headless) against the dev server with live Demo Supabase data.
**Executed matrix:**
- Desktop 1440×900 (RTL/Arabic): login → dashboard, then all 15 shipped admin/operational routes + Add Expense dialog — 17 captures, **0 console errors, 0 page errors**.
- Tablet 768×1024: dashboard, expenses, inventory — clean.
- Mobile 390×844 (touch): dashboard + 8 key routes + mobile navigation sheet — clean; dock/sheet/dock-thumb checkout confirmed.
- Migrated M1 pages re-verified **live** against their acceptance criteria: canonical PageHeader + normalized CTA on expenses/employees/inventory/gift-cards/packages/attendance; expenses stat density + table-header density confirmed with data; RTL logical layout visually confirmed throughout.
**Accepted observations (documented, non-blocking):** native date input renders month in browser locale on `attendance` (M5 polish candidate); everything else matched `PAGE_CONTENT_ARCHITECTURE.md`.
**Evidence:** 27 captures in the workspace `verify-shots/` (not committed — binary hygiene).

## Milestone 5 — Remaining low-impact polish (post-M2 sweep)
- Appointments/POS chrome-title pages: evaluate whether an in-page PageHeader adds value without double-titling (currently chrome title suffices — keep unless owner wants page-level subtitles).
- `text-[9px]` microcopy sweep (dashboard badge, POS order count) → `text-[10px]` floor where it is read-content rather than decorative eyebrow.
**Status:** NOT STARTED.

## Frozen by decision (do not do)
- No shell restyle (Layout/Sidebar/Dock/Sheet) — test-locked and correct.
- No new design system, no component-library introduction, no state-management change, no framework swap.
- No route removals or merges beyond the verified content-level merges already shipped.
- No schema/RPC/permission changes in interface milestones.

## Verification gates applied to every milestone
1. `npm run typecheck` 2. targeted page/dialog tests 3. full `npm test` (880 baseline) 4. `npm run build` 5. dev-server rendered inspection 6. Git diff review (no unrelated changes) 7. update this file's status labels.
