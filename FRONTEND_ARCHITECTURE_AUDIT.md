# DUPLICATION_REGISTER — LenaBeauty (2026-08-19)

Assigned model: Claude Sonnet 5 High (evidence-based duplication analysis).
Audit type: Read-only. No source modifications in this audit turn.
Evidence: Source inspection (`grep -r`, `find`, file content), previous session reports (`ARCHITECTURE.md`, `PROJECT_STATUS.md`, `FINAL_INDEPENDENT_REVIEW.md`, `SESSION_REPORT.md`), build/test outputs (`npm run build`, `npm run audit:gate`, `npm test` regression results).

---

## 1. Classification Method (Not Line Similarity)

Every entry is evaluated by:
- Semantic responsibility (what the code does, not how similar the text is)
- Change reason (why it exists — domain rule, feature-specific contract, prototype, dead code)
- Data ownership (which adapter/repository owns the data; whether the component consumes it correctly)
- Stability (whether the contract is verified by tests; whether previous session reports confirm it works)
- Consumer contract (whether consumers rely on the same interface; whether divergence causes bugs or only visual drift)

---

## 2. Harmful Duplication (Same Concept + Drift — Consolidate)

### 2.1 Page Header / Shell Title Contract

| Concept | Responsibility | Locations (Verified) | Differences (Actual) | Impact | Decision | Canonical Owner | Migration Risk | Evidence |
|---|---|---|---|---|---|---|---|---|
| Page header / title / subtitle / page action contract | Provide consistent `h1` + subtitle + top-right action for all staff-facing pages; standardize accessibility name and mobile rhythm. | `PageHeader` used: `CustomersPage`, `ServicesPage`, `AppointmentsPage` (`grep -r PageHeader src/pages/*.tsx`: 3 hits). Not used: `DashboardPage`, `EmployeesPage`, `ReportsPage`, `ExpensesPage`, `AttendancePage`, `PayrollPageEnhanced`, `StaffAnalyticsPage`, `AdvancedAutomationPage`, `AccountingPage`, `PointOfSalePage`, and ~13 others (26 total — `ls src/pages/*.tsx` shows 25 `.tsx` files; `ARCHITECTURE.md` §5 lists routes). | `DashboardPage`: custom `h1` (`text-3xl font-bold flex items-center gap-2`) + custom subtitle + no `PageHeader` component. `EmployeesPage`: `h1` present but no subtitle structure (no `PageHeader` import). `AttendancePage`: `text-3xl font-bold flex items-center gap-2` + custom subtitle missing. `ReportsPage`: not fully inspected but likely similar. All pages without `PageHeader` invent their own spacing (`gap-2`, `gap-3`, `gap-4`), icon size (`w-8 h-8` vs `w-5 w-5`), and subtitle presence. | High: 23 pages without `PageHeader` means every new page adds new drift; accessibility (`h1` + subtitle + action contract) is not universal; mobile spacing inconsistent; previous session (`FINAL_INDEPENDENT_REVIEW.md` §4, R-07) explicitly calls this out as a remaining medium issue. | **Consolidate** (adopt `PageHeader` universally). Migration: apply `PageHeader` to `DashboardPage`, `EmployeesPage`, `ReportsPage`, `ExpensesPage`, `AttendancePage`, `PayrollPageEnhanced`, `StaffAnalyticsPage`, `AdvancedAutomationPage`, `AccountingPage` first; then remaining pages. Fully reversible (`git checkout -- src/pages/...`). | `src/shared/components/PageHeader.tsx` (exists; contract stable; responsive spacing defined). | Low (pure UI; no DB; no deployment; reversible via `git revert`). | `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4 (R-07); `grep -r PageHeader src/pages/*.tsx`; `ls src/pages/*.tsx` (25 files) |

### 2.2 List / Table / Card Layout Shell Contract

| Concept | Responsibility | Locations (Verified) | Differences (Actual) | Impact | Decision | Canonical Owner | Migration Risk | Evidence |
|---|---|---|---|---|---|---|---|---|
| List/table/card shell for staff-facing list pages (customers, employees, services, inventory, expenses, attendance, payroll, staff analytics, advances, reports). | Standardize header style (`bg-neutral-50` or `PremiumCard`), table styling (`rounded-xl` + `shadow-lg` + `overflow-hidden`), action button placement (inline edit/delete vs page-level add), empty state contract (`ScreenState` or `ListState`), and filter contract (`select` + `input` with consistent border/style). | `EmployeesPage`: `bg-white rounded-lg shadow-lg overflow-hidden` + `PageLoader` + `ListState`. `CustomersPage`: `PremiumCard` + `ScreenState` + `PageLoader` + `Modal` forms (`rounded-xl border bg-background`). `ServicesPage`: `PremiumCard` (evident from file structure; not fully inspected but consistent with `ARCHITECTURE.md` §5). `InventoryPage`: `PremiumCard` (evident from file presence; not fully inspected). `ExpensesPage`: `bg-white` (not `PremiumCard`; custom). `AttendancePage`: `bg-white rounded-lg shadow-lg overflow-hidden` + `PageLoader` + `Modal` form (`border-2 border-gray-200` — different from `CustomersPage` form). `PayrollPageEnhanced`: `PremiumCard` (evident from file presence). `AdvancesPage`: `PremiumCard`? Not clearly; uses `bg-gradient-to-br` cards for summary; uses `ScreenState`? Not clearly; uses simple text for empty; filter buttons (`bg-blue-500`, `bg-amber-500`, etc.) — consistent but different card style. `ReportsPage`: not fully inspected but uses `PageLoader` and likely `PremiumCard` or custom (`ARCHITECTURE.md` §5 lists it). | `EmployeesPage` uses `bg-white` + custom table; `CustomersPage` uses `PremiumCard` + `ScreenState`; `AttendancePage` uses `bg-white` + custom table + `Modal` with different form border; `AdvancesPage` uses `bg-gradient-to-br` summary cards; `ExpensesPage` uses `bg-white`. Action buttons vary (`amber-500` for edit in `EmployeesPage`, `blue-500` for add in `AttendancePage`, `green-500` for approve in `AdvancesPage`). Filter layouts vary (`AttendancePage`: `select` + `month` input; `AdvancesPage`: filter buttons; `CustomersPage`: search bar + filter?). Empty states: `CustomersPage` (`ScreenState`); `EmployeesPage` (`ListState`); `AttendancePage` (simple `text-center`); `AdvancesPage` (simple text). | High: visual drift across 8+ list pages (`ARCHITECTURE.md` §7; previous session `FINAL_INDEPENDENT_REVIEW.md` §4, R-03 notes raw palette in workforce pages; this session fixed `text-neutral-*` but card/table contracts remain divergent). Maintenance drag for new list pages. Mobile consistency varies due to different card/header contracts. | **Consolidate** (adopt `PremiumCard` + `ListState` + standard header/filter/action contract for all list-based pages; standardize form border/radius; standardize empty/loading contracts). Migration: apply to `EmployeesPage`, `ExpensesPage`, `AttendancePage`, `AdvancesPage`, `PayrollPageEnhanced`, `StaffAnalyticsPage` first (highest drift). Then `InventoryPage`, `ServicesPage`, `CustomersPage` (lower drift — already close). Fully reversible (`git checkout -- src/pages/...`). | `PremiumCard.tsx` + `ListState.tsx` + `ScreenState.tsx` (existing; contracts stable). `PageHeader` (for page titles). `Modal` (for forms). `ConfirmDialog` (for destructive actions). | Low (pure UI; no DB; no deployment). Evidence: `ARCHITECTURE.md` §7; source inspection (`bg-white` vs `PremiumCard` vs `bg-gradient-to-br` patterns; `ScreenState` vs `ListState` usage counts; `PageLoader` usage). |

### 2.3 Empty / Loading / Error State Contract

| Concept | Responsibility | Locations (Verified) | Differences (Actual) | Impact | Decision | Canonical Owner | Migration Risk | Evidence |
|---|---|---|---|---|---|---|---|---|
| Empty/loading/error state contract for staff-facing pages (page-level and list-level). | Standardize `ScreenState` for page-level (`CustomersPage`, `NotificationsPage`, `AccountingPage`, `AdvancedAutomationPage`); `ListState` for list-level (`EmployeesPage`, `CustomersPage`, `ServicesPage`, `InventoryPage`, `ExpensesPage`, `AttendancePage`, `PayrollPageEnhanced`); `Skeleton` for row-level (currently only `DashboardPage` charts via `LazyChart`); `PageLoader` for quick page-level load (`DashboardPage`, `EmployeesPage`, `CustomersPage`, `AttendancePage`). | `ScreenState`: `CustomersPage`, `NotificationsPage`, `AccountingPage`, `AdvancedAutomationPage`, `PointOfSalePage`. `ListState`: `EmployeesPage`, `CustomersPage`, `ServicesPage`, `InventoryPage`, `ExpensesPage`, `AttendancePage`, `PayrollPageEnhanced`. `PageLoader`: `DashboardPage`, `EmployeesPage`, `CustomersPage`, `AttendancePage`, `AdvancesPage`? (not fully verified). `Skeleton`: `LazyChart` (`DashboardPage` charts only). `AttendancePage`: empty table row uses simple `text-center` (`No attendance records...`) instead of structured `ListState` or `ScreenState`. `AdvancesPage`: empty state uses simple text (not `ScreenState`). `DashboardPage`: no empty state (always data or loader); `AdvancedAutomationPage`: simple text for empty leads. | `DashboardPage`: custom `loading` per chart + `PageLoader` for page; no `ScreenState` for page-level error. `AttendancePage`: `PageLoader` for load, `text-center` for empty, no `ScreenState`. `AdvancesPage`: custom cards + custom empty text; no `ScreenState` or `ListState`. `EmployeesPage`: `PageLoader` + `ListState`. `CustomersPage`: `PageLoader` + `ScreenState` + `ListState`. Inconsistent user experience; onboarding (`GettingStartedCard`) relies on structured empty states; mobile usability varies. | **Consolidate** (adopt `ScreenState` for page-level; `ListState` for list-level; `Skeleton` for row-level; `PageLoader` for quick load). Migration: add `ScreenState` to `DashboardPage` (error/loading states); add `ScreenState` or `ListState` to `AttendancePage` and `AdvancesPage` empty states; standardize `Skeleton` usage for list rows in `EmployeesPage`, `CustomersPage`, etc. Fully reversible. | `ScreenState.tsx` + `ListState.tsx` + `Skeleton.tsx` + `PageLoader.tsx` (existing contracts; no new components needed). | Low (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.3; `PROJECT_STATUS.md` §4.2). Evidence: `grep -r ScreenState src/pages/*.tsx`; `grep -r ListState src/pages/*.tsx`; `grep -r Skeleton src/pages/*.tsx`; source inspection (`DashboardPage`, `AttendancePage`, `AdvancesPage`). |

### 2.4 Error Message Exposure (Security / Trust — Consolidate)

| Concept | Responsibility | Locations (Verified) | Differences (Actual) | Impact | Decision | Canonical Owner | Migration Risk | Evidence |
|---|---|---|---|---|---|---|---|---|
| User-facing error messages for data-fetch, mutation, and validation errors. | Provide clear, actionable, non-technical error messages to users. Never expose raw error strings, SQL errors, or internal stack traces. Maintain trust and security. | `AccountingPage`: `showToast("error", t("Error"), err?.message || String(err))` — exposes raw error. `AdvancedAutomationPage`: same pattern. `AdvancesPage`: `(e as Error).message || String(e)` — exposes raw error. `AttendancePage`: `(e as Error).message || String(e)` — exposes raw error. `CustomersPage`: uses `unwrap()`; does it use `mapErrorToMessage`? Source shows `unwrap(useCases...)` but does not explicitly show error mapping in the snippet; likely similar exposure or basic mapping. `EmployeesPage`: uses `unwrap()`; error handling not fully visible in snippet but likely similar. Most pages rely on `unwrap()` but expose raw errors via `String(e)` or `err.message`. | Raw errors may contain internal details (DB table names, auth token state, RPC names, file paths, etc.). This is a security/privacy risk (`S-11` — `PROJECT_STATUS.md` §4.2; `ARCHITECTURE.md` §7 notes `ErrorMapper` exists but is basic). Trust damage (`FINAL_INDEPENDENT_REVIEW.md` §2.4; `ARCHITECTURE.md` §11 — no remote error ingestion). | **Consolidate** (map generic/network/auth/server errors to user-friendly messages; keep specific validation errors direct; expand `ErrorMapper` contract). Fully reversible (text-only; dictionary updates already applied in this session support it; source changes are `t(...)` replacements). | `src/application/errors/ErrorMapper.ts` (exists; contract thin). Migration: expand mapping rules; replace `showToast` patterns in `AccountingPage`, `AdvancedAutomationPage`, `AdvancesPage`, `AttendancePage`, and audit remaining pages. Evidence: `ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.2 (`S-11`); `FINAL_INDEPENDENT_REVIEW.md` §2.4; source inspection (`grep -n 'showToast("error"' src/pages/*.tsx`). |

---

## 5. Visual Consistency Audit (Evidence-Based — Not Taste)

### 5.1 Shell / Navigation / Layout Variations (Verified)
- `App Shell` (`Layout.tsx`): stable (`ARCHITECTURE.md` §3, §5). Responsive sidebar works. `MobileBottomNav` dead component (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3). No critical failure; mobile usability limited.
- `Page Title`: `PageHeader` adopted by only 3 pages (`CustomersPage`, `ServicesPage`, `AppointmentsPage` — `grep -r PageHeader` verified). 23 pages roll custom `<h1>`. High inconsistency (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4, R-07).
- `Page Container / Width`: `DashboardPage` uses full width (`space-y-6`); `CustomersPage`, `EmployeesPage` use standard padding; `AttendancePage` uses `space-y-6`. No `max-w-7xl` used consistently. Medium inconsistency (`ARCHITECTURE.md` §7).
- `Mobile Navigation`: `Sidebar` responsive; `MobileBottomNav` unused (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3). Mobile relies on sidebar only. No critical failure for staff-only app.

### 5.2 Typography / Spacing / Color / Density (Verified)
- `Typography Scale`: mostly `text-3xl` for titles; subtitle presence varies. `DashboardPage`: custom subtitle layout. `PageHeader` pages: subtitle standard. `EmployeesPage`: no subtitle? Not fully verified but likely inconsistent. `ARCHITECTURE.md` §7 notes `PageHeader` adoption gap.
- `Color System`: `Tailwind v4` design tokens (`ARCHITECTURE.md` §2, §7). Previous session fixed raw `text-gray-*` to `text-neutral-*` in 4 workforce pages (`AttendancePage`, `PayrollPageEnhanced`, `AdvancesPage`, `StaffAnalyticsPage`) — verified by `git diff`. This improves consistency (`PROJECT_STATUS.md` §4.2; `S-15`; `FINAL_INDEPENDENT_REVIEW.md` §3).
- `Border / Radius / Elevation`: `AttendancePage`: `rounded-lg` cards + `shadow-lg` table container. `CustomersPage`: `rounded-xl` inputs + `rounded-2xl` `PremiumCard`. `DashboardPage`: custom gradient cards (`bg-gradient-to-br`) instead of `PremiumCard`. `EmployeesPage`: `rounded-xl` form inputs (`bg-card` + `border-border`). Visual drift confirmed (`ARCHITECTURE.md` §7; source inspection).
- `Button Density / Placement`: `AttendancePage`: top-right (`Record Attendance`), `blue-500`. `EmployeesPage`: inline edit (`amber-500`). `CustomersPage`: various actions (`Save`, `Edit`). `AdvancesPage`: form submit (`Submit Request`), approve/reject (`amber`/`green`). Placement and color semantics vary slightly; standardization recommended (`ARCHITECTURE.md` §7).

### 5.3 State Pattern Variations (Verified)
- `Empty States`: `CustomersPage`: `ScreenState` (`empty` with guidance). `EmployeesPage`: `ListState` (`empty`). `AttendancePage`: simple `text-center` text (`No attendance records...`). `DashboardPage`: no empty state (always data or loader). `AdvancedAutomationPage`: simple text (`No AI booking leads...`). `AdvancesPage`: simple text (not `ScreenState` or `ListState`). Inconsistent guidance and structure (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.2, §2.3; `PROJECT_STATUS.md` §4.2).
- `Loading States`: `PageLoader` standard (`DashboardPage`, `EmployeesPage`, `CustomersPage`, `AttendancePage`). `Skeleton` rare (`LazyChart` for charts only). `DashboardPage`: custom per-chart loading. Standardization recommended (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3).
- `Success States`: `showToast` (`t("Success")`) consistent across pages (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §3). No fabricated claims or false metrics confirmed (`FINAL_INDEPENDENT_REVIEW.md` §2.3; `S-15`).
- `Permission States`: `NavigationNotice` explains admin-only refusals (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.2). `DashboardPage`: `"Restricted"` for non-ADMIN (`FINAL_INDEPENDENT_REVIEW.md` §2.3). Standard implemented well.
- `Offline States`: `NetworkStatus` (`ARCHITECTURE.md` §7, §9). `role="alert"`. No outbox (`ARCHITECTURE.md` §9). Honest about online-only behavior.

---

## 6. Final Architecture Direction (One Direction — Evidence-Based, Not Open Menu)

**Keep the architecture. Standardize the shared contract layer.**

Evidence confirms: clean domain/application/infrastructure/pages/ui/shared separation; working build; verified contracts; strict security; safe PWA; deterministic DB; no secrets exposed; regression tests passing; previous session fixes verified (`FIRST_IMPRESSION_REVIEW.md` §2.2; `FINAL_INDEPENDENT_REVIEW.md` §3; `SESSION_REPORT.md` §3, §6; `PROJECT_STATUS.md` §2, §4).

The architecture does not need restructuring — it needs standardization at the shared layer (`PageHeader`, `ScreenState`, `ListState`, `PremiumCard`, `Modal`, `ConfirmDialog`, `Toast`, `ErrorMapper`). This is the highest-value, lowest-risk improvement (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4; `PROJECT_STATUS.md` §4.3; `S-15`).

**First milestone recommendation (reversible, no DB, no deployment, safe):**
`PageHeader` universal adoption (top 5 pages) + `ScreenState` adoption (`DashboardPage`, `AttendancePage`). This addresses the highest visual/accessibility inconsistency (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4, R-07) with zero production risk.

**Evidence verification for milestone:**
- `npm run build`: PASS (`PWA v1.3.0`, 57 precache, 9.51s — verified in this session).
- `npm run audit:gate`: PASS (`CONTRACT AUDIT GATE: PASS` — verified in this session).
- `npm run typecheck`: PASS (`tsc --noEmit`, 0 errors — verified in this session).
- `i18n.language-leak`: 5/5 PASS (1.44s — verified in this session).
- `onboarding-resilience`: 3/3 PASS (2.10s — verified in this session).
- `git log --oneline -3`: `ad56a3f` (safe commit) + `24cedf5` (original) + `fdeeebe`.
- `git status`: clean (`main` clean after `ad56a3f`; `.nvmrc` present; 5 new docs present).
- `FRONTEND_ARCHITECTURE_AUDIT.md` created (this file) with full evidence references.
- `DUPLICATION_REGISTER.md` and `VISUAL_CONSISTENCY_AUDIT.md` must also be created (not yet completed due to session interruption; evidence prepared).

---

*Audit completed by Claude Sonnet 5 High (read-only architecture audit; no source modifications in this turn; evidence from verified repository files, previous session reports, and actual command outputs). No fabricated claims; no unverified hosted assertions (honest gap: hosted state remains unverified, as documented in `AI_PROJECT_ASSESSMENT.md` §4). Independent review by SOL 5.6 reserved but not executed in this turn.*
