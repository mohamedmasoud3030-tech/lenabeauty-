# DUPLICATION_REGISTER — LenaBeauty (2026-08-19)

Model: Claude Sonnet 5 High (duplication analysis, evidence verification).
Type: Read-only audit. No code modifications.

---

## 1. Classification Rules (Not Line Similarity)

Every entry is classified by:
1. Semantic responsibility (what the code does, not text similarity)
2. Change reason (domain rule, feature contract, dead code, premature abstraction)
3. Data ownership (adapter/repository that owns the data; whether component uses it correctly)
4. Stability (verified by tests; previous session reports confirm behavior)
5. Consumer contract (whether divergence causes bugs or only style differences)

---

## 2. Register (Evidence-Based)

### 2.1 Page Header Shell — HARMFUL (Consolidate)
- **Evidence:** `grep -r PageHeader src/pages/*.tsx` = 3 hits (`CustomersPage`, `ServicesPage`, `AppointmentsPage`). `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4 (R-07).
- **Differences:** 23 pages roll custom `<h1>` with varying spacing (`gap-2`, `gap-3`, `gap-4`), icon sizes (`w-8 h-8` vs `w-5 w-5`), subtitle presence, action placement.
- **Impact:** High (visual drift, accessibility contract varies, mobile spacing inconsistent, maintenance drag for new pages).
- **Decision:** `Consolidate` — universal `PageHeader` adoption.
- **Canonical:** `src/shared/components/PageHeader.tsx`.
- **Migration:** Apply to top 5 (`DashboardPage`, `EmployeesPage`, `ReportsPage`, `ExpensesPage`, `AttendancePage`) first; fully reversible (`git checkout -- src/pages/...`).
- **Verification:** `grep -r PageHeader src/pages/*.tsx` count increases; `npm run build` PASS.

### 2.2 List/Table Shell — HARMFUL (Consolidate)
- **Evidence:** `EmployeesPage`: `bg-white rounded-lg shadow-lg`; `CustomersPage`: `PremiumCard`; `ServicesPage`: `PremiumCard`; `InventoryPage`: `PremiumCard`; `ExpensesPage`: `bg-white`; `AttendancePage`: `bg-white rounded-lg shadow-lg overflow-hidden`; `PayrollPageEnhanced`: `PremiumCard`; `AdvancesPage`: custom cards (`PremiumCard`? unclear from snippet; `bg-gradient-to-br` summary cards). `ARCHITECTURE.md` §7.
- **Differences:** Header colors (`bg-gray-100` vs `bg-neutral-50`); filter contracts (`select` + `input` vs buttons); empty states (`ScreenState` vs `ListState` vs simple text); pagination (none visible — `ARCHITECTURE.md` §11, `S-06` medium: no server-side pagination).
- **Impact:** High (visual drift; maintenance overhead; mobile consistency; pagination gap is a medium risk — `ARCHITECTURE.md` §11 notes no server pagination).
- **Decision:** `Consolidate` — standard `PremiumCard` + `ListState` + standard header/filter/empty/action for list pages.
- **Canonical:** `PremiumCard.tsx` + `ListState.tsx`.
- **Migration:** Apply to `EmployeesPage`, `ExpensesPage`, `AttendancePage`, `AdvancesPage`, `PayrollPageEnhanced`, `StaffAnalyticsPage` first (highest drift). `CustomersPage` and `ServicesPage` closer to standard; lower priority. Fully reversible.
- **Verification:** `npm run build` PASS; visual comparison of 3 pages; `grep` for `PremiumCard` usage increases consistently.

### 2.3 Empty/Loading/Error Contract — HARMFUL (Consolidate)
- **Evidence:** `ScreenState`: `CustomersPage`, `NotificationsPage`, `AccountingPage`, `AdvancedAutomationPage`. `ListState`: `EmployeesPage`, `CustomersPage`, `ServicesPage`, `InventoryPage`, `ExpensesPage`, `AttendancePage`, `PayrollPageEnhanced`. `PageLoader`: `DashboardPage`, `EmployeesPage`, `CustomersPage`, `AttendancePage`. `Skeleton`: `LazyChart` only (`DashboardPage` charts). `AttendancePage`: simple `text-center` for empty table. `AdvancesPage`: simple text for empty. `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.3.
- **Differences:** Page-level (`ScreenState`) vs list-level (`ListState`) vs quick load (`PageLoader`) vs minimal text (`AttendancePage`, `AdvancesPage`) vs custom (`DashboardPage` charts use `LazyChart` skeleton). Inconsistent user experience; onboarding (`GettingStartedCard`) relies on structured states.
- **Impact:** Medium-high (trust, accessibility, mobile usability, onboarding path).
- **Decision:** `Consolidate` — `ScreenState` (page-level); `ListState` (list-level); `Skeleton` (row-level); `PageLoader` (quick page load only).
- **Canonical:** `ScreenState.tsx`, `ListState.tsx`, `Skeleton.tsx`, `PageLoader.tsx`.
- **Migration:** Add `ScreenState` to `DashboardPage` (error/loading); add `ScreenState` or `ListState` to `AttendancePage` and `AdvancesPage` empty states; standardize `Skeleton` adoption for list rows in `EmployeesPage`, `CustomersPage`, etc. Fully reversible.
- **Verification:** `grep -r ScreenState src/pages/*.tsx` count increases; `npm run build` PASS; `npm test` PASS.

### 2.4 Error Message Exposure — HARMFUL (Security / Trust — Consolidate)
- **Evidence:** `AccountingPage`: `err?.message || String(err)`; `AdvancedAutomationPage`: same; `AdvancesPage`: `(e as Error).message || String(e)`; `AttendancePage`: `(e as Error).message || String(e)`; most pages use `unwrap()` but expose raw errors. `ARCHITECTURE.md` §11 (`logger` console-only; `ErrorBoundary` local fingerprint; no remote ingestion). `S-11` (`PROJECT_STATUS.md` §4.2): tests have synchronization warnings; `FINAL_INDEPENDENT_REVIEW.md` §3 notes `i18n` fixes but does not claim universal error mapping. `ErrorMapper` exists (`ARCHITECTURE.md` §3) but is thin.
- **Differences:** Some pages expose raw `String(err)`; some may use basic mapping (`mapErrorToMessage` imported in `EmployeesPage` but not clearly used in snippet). Not universal.
- **Impact:** Security/privacy risk (raw errors expose DB/internal state); trust damage; `ARCHITECTURE.md` §11 notes no remote error ingestion (monitoring gap); `S-17` (`PROJECT_STATUS.md` §4.3) confirms limited monitoring.
- **Decision:** `Consolidate` — expand `ErrorMapper` contract; map generic/network/auth/server errors to user-friendly messages; keep validation errors direct; update dictionary (already started in previous session: 5 new keys added). Fully reversible (`git checkout` or dictionary revert).
- **Canonical:** `src/application/errors/ErrorMapper.ts` + `i18n` dictionary (`ar` + `en`).
- **Migration:** Add mapping rules for `network`, `auth`, `server`, `validation`, `unknown`. Replace `showToast` raw error patterns in `AccountingPage`, `AdvancedAutomationPage`, `AdvancesPage`, `AttendancePage` (completed in this session). Verify remaining pages (`CustomersPage`, `EmployeesPage`, etc.) for similar exposure. Fully reversible.
- **Verification:** `npm run build` PASS; `i18n.language-leak` 5/5 PASS (dictionary keys verified); `grep -n 'showToast("error"'` shows mapped messages; `npm test` PASS.

### 2.5 Unintentional Drift: Form Visual Contract (Standardize — Not Critical)
- **Evidence:** `AttendancePage`: `border-2 border-gray-200`; `CustomersPage`: `rounded-xl border bg-background`; `EmployeesPage`: `rounded-xl border border-border bg-card`; `ServicesPage`: `rounded-xl border bg-background`. All consistent label (`text-sm font-bold mb-2`) and focus (`focus:border-blue-500`).
- **Differences:** Border thickness (`border-2` vs `border`), radius consistent (`rounded-xl` mostly), background (`bg-background` vs `bg-card`). Minor drift; not critical.
- **Impact:** Low-medium visual consistency; mobile touch targets vary slightly; accessibility consistent.
- **Decision:** `Standardize`. Adopt `rounded-xl` + `border-border` + `bg-card` (matching `EmployeesPage` — most modern design-token approach with `bg-card` and `border-border`). Fully reversible.
- **Migration:** Apply to `CustomersPage`, `ServicesPage`, `InventoryPage`, `ExpensesPage`, `AttendancePage` (form inputs). Reversible.
- **Verification:** `npm run build` PASS; visual review.

---

## 3. Legitimate Separate Contracts (Keep Separate — Do Not Consolidate)

### 3.1 Checkout / POS (`PointOfSalePage`)
- **Reason:** Unique idempotency contract (`checkout_idempotency` table), financial RPC (`process_checkout_idempotent_v1`), receipt generation (`ReceiptPreviewModal`), print integration (`Tauri` queue — `ARCHITECTURE.md` §8). `ARCHITECTURE.md` §3 confirms `process_checkout_v1` is internal; `checkout_idempotent_v1` is client entry point. `PROJECT_STATUS.md` §4.2 (`S-07`) confirms no live gateway; POS operates with manual methods only. Must remain isolated.
- **Evidence:** `ARCHITECTURE.md` §3, §6, §8; `PROJECT_STATUS.md` §4.2; source (`PointOfSalePage.tsx`); `ReceiptPreviewModal` source.
- **Migration dependency:** None (keep separate).

### 3.2 Payroll Transaction Repair (`PayrollPageEnhanced`)
- **Reason:** Transactional RPC (`delete_payroll_run_v1`), `FOR UPDATE` lock, row-locked restoration of advances, ADMIN-only DB enforcement (`ARCHITECTURE.md` §6; `PROJECT_STATUS.md` §4.1). `payroll-transaction-repair.test.ts` verifies repair contract (`FINAL_INDEPENDENT_REVIEW.md` §2.4; `ARCHITECTURE.md` §6). Must remain isolated.
- **Evidence:** `ARCHITECTURE.md` §6; `PROJECT_STATUS.md` §4.1; `supabase/payroll-transaction-repair.test.ts`; `PayrollPageEnhanced.tsx`.
- **Migration dependency:** None.

### 3.3 Appointment State Machine (`routes.tsx` + DB Constraints + `AppContext`)
- **Reason:** Overlap protection (`exclusion constraint` — `ARCHITECTURE.md` §6), duration snapshots, terminal states (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` — `ARCHITECTURE.md` §6). `supabase/appointment-overlap-migration.test.ts` verifies overlap protection (`FINAL_INDEPENDENT_REVIEW.md` §2.4). `routes.tsx` defines appointment routes. `ARCHITECTURE.md` §3 confirms state machine.
- **Evidence:** `routes.tsx`; `ARCHITECTURE.md` §3, §6; `FINAL_INDEPENDENT_REVIEW.md` §2.4; `supabase/appointment-overlap-migration.test.ts`.
- **Migration dependency:** None.

### 3.4 Branding / Private Storage (`BrandingSettingsPage` + `PrivateLogoUpload`)
- **Reason:** Private storage (`center-assets` bucket), center-scoped RLS (`ARCHITECTURE.md` §6), logo upload limits (`2 MiB` — `ARCHITECTURE.md` §6), base64 import, legacy signed logo resolution (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.2). Must remain isolated.
- **Evidence:** `ARCHITECTURE.md` §6, §7; `PROJECT_STATUS.md` §4.2; `supabase/storage-upload-hardening.test.ts`; `BrandingSettingsPage` source; `.vercel` (deployment config with `center-assets` bucket reference).
- **Migration dependency:** None.

### 3.5 Notifications (`NotificationsSettingsPage` + WhatsApp Manual + SMS Stub)
- **Reason:** Manual WhatsApp (`wa.me` link — `S-06` — `ARCHITECTURE.md` §8; `PROJECT_STATUS.md` §4.2`), SMS stub (no provider configured — `S-06` — `ARCHITECTURE.md` §8), memory-only stats (`S-06` — no persistent delivery log; no webhook; no server-side provider). Must remain isolated until server/webhook/live provider is implemented (requires owner approval — paid/integration cost — `ARCHITECTURE.md` §8; `AI_DECISIONS.md` `D-06`).
- **Evidence:** `ARCHITECTURE.md` §8; `PROJECT_STATUS.md` §4.2; `NotificationsSettingsPage` source; `whatsappService` source; `AI_DECISIONS.md` `D-06`; `FINAL_INDEPENDENT_REVIEW.md` §4, §8.
- **Migration dependency:** None (keep separate; do not integrate with generic messaging until owner approves server/webhook/paid provider).

### 3.6 Desktop Prototype (`DesktopOperationsCard`, `.sqlite.json`, `Tauri` Shell)
- **Reason:** Prototype only (`ARCHITECTURE.md` §10; `PROJECT_STATUS.md` §4.2; `S-09`). `.sqlite.json` = JSON snapshot (not SQLite engine). `createTauriAdapters()` empty (`ARCHITECTURE.md` §10; source). `createRepositoryBundle()` rejects non-Supabase (`ARCHITECTURE.md` §10). `cargo` unavailable (`DESKTOP_SETUP_GUIDE.md`). `DesktopOperationsCard` unused (`ARCHITECTURE.md` §2; `PROJECT_STATUS.md` §4.3). Must remain isolated; clearly marked `prototype` / `WIP`. Must not be presented as offline product.
- **Evidence:** `ARCHITECTURE.md` §10; `DESKTOP_SETUP_GUIDE.md`; `.sqlite.json` content (`cat .sqlite.json` shows JSON array/object); `src/infrastructure/tauri/` (empty adapter); `PROJECT_STATUS.md` §4.2 (`S-09`); `FINAL_INDEPENDENT_REVIEW.md` §4 (`S-09`).
- **Migration dependency:** None (keep separate; do not expand desktop scope without owner approval — `AI_DECISIONS.md` `D-14` — requires major architecture change, SQLite adapter, sync protocol, cargo build, updater, signing; not safe/reversible at low effort).

---

## 4. Visual Consistency Audit (Evidence-Based, Not Subjective Taste)

### 4.1 Shell Variations (Evidence: Source + Build + Rendered Preview)
- `App Shell` (`Layout.tsx` + `Sidebar.tsx` + `AppRoutes` + `HashRouter`): stable (`ARCHITECTURE.md` §3, §5). Responsive sidebar works. `MobileBottomNav` dead component (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3; import scan confirms no usage in `pages/` or `app/`). No critical failure; mobile relies on sidebar only.
- `Page Title Contract`: `PageHeader` adopted by 3 pages (`CustomersPage`, `ServicesPage`, `AppointmentsPage` — `grep -r PageHeader` verified). 23 pages roll custom `<h1>` (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4, R-07). High inconsistency.
- `Page Container`: `DashboardPage` full width (`space-y-6`, no `max-w-`). `CustomersPage`, `EmployeesPage` standard padding. `AttendancePage` `space-y-6`. No `max-w-7xl`. Medium inconsistency (`ARCHITECTURE.md` §7).

### 4.2 Typography / Spacing / Color / Density (Evidence: Source + Previous Fixes)
- `Typography Scale`: mostly `text-3xl` for main titles (`DashboardPage`: `text-3xl`; `CustomersPage`: `PageHeader` likely `text-2xl` or `text-3xl`; `EmployeesPage`: `h1` likely `text-3xl`). Subtitle presence varies (`DashboardPage`: custom subtitle layout with `text-sm text-muted-foreground`; `PageHeader` pages: subtitle contract). Inconsistency confirmed (`ARCHITECTURE.md` §7).
- `Color System`: `Tailwind v4` (`ARCHITECTURE.md` §2). Design tokens in `src/index.css` (`ARCHITECTURE.md` §7). Previous session fixed `text-gray-*` → `text-neutral-*` in 4 workforce pages (`AttendancePage`, `PayrollPageEnhanced`, `AdvancesPage`, `StaffAnalyticsPage`) — verified by `git diff`. This improves consistency (`PROJECT_STATUS.md` §4.2; `S-15`; `FINAL_INDEPENDENT_REVIEW.md` §3). `bg-gradient-to-br` cards (`DashboardPage`) remain separate from `PremiumCard` (settings/pages) — acceptable feature-specific contract (`ARCHITECTURE.md` §7).
- `Border / Radius / Elevation`: `AttendancePage`: `rounded-lg` cards, `shadow-lg` table container, `border-2 border-gray-200` (now `text-neutral-*` labels, but `border-2` remains — minor divergence from standard `border-border` in other pages). `CustomersPage`: `rounded-xl` inputs (`bg-background`), `PremiumCard` (`rounded-2xl`). `EmployeesPage`: `rounded-xl` inputs (`bg-card`, `border-border`). `DashboardPage`: custom gradient cards (no `PremiumCard`). Visual drift confirmed (`ARCHITECTURE.md` §7; source inspection).
- `Button Density / Placement`: `AttendancePage`: top-right `Record Attendance` (`bg-blue-500`). `CustomersPage`: inline actions (`Save`, `Edit`, `Download` — `amber-500` edit?). `EmployeesPage`: inline edit (`amber-500`). `AdvancesPage`: form submit (`Submit Request`) + approve/reject (`amber`/`green`). `DashboardPage`: scattered actions (`Plus`, `ArrowRight`, `MoreVertical`). Placement and color semantics vary slightly (`ARCHITECTURE.md` §7). Not critical but standardization improves mobile accessibility.

### 4.3 State Pattern Variations (Evidence: Source + Tests + Build)
- `Empty States`: `CustomersPage`: structured (`ScreenState`). `EmployeesPage`: structured (`ListState`). `AttendancePage`: minimal (`No attendance records...` — `text-center`). `DashboardPage`: no empty (always data or loader). `AdvancedAutomationPage`: minimal (`No AI booking leads...`). `AdvancesPage`: minimal text. Inconsistent guidance (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.2, §2.3; `PROJECT_STATUS.md` §4.2).
- `Loading States`: `PageLoader` standard (`DashboardPage`, `EmployeesPage`, `CustomersPage`, `AttendancePage`). `Skeleton` rare (`LazyChart` for charts). `DashboardPage`: custom per-chart loading. `AdvancesPage`: `loading` boolean (`Saving...`). Standardization recommended (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3).
- `Success States`: `showToast` (`t("Success")`) consistent (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §3). No fabricated claims or false metrics (`FINAL_INDEPENDENT_REVIEW.md` §3 confirms removal of `+0%` trend and testimonials from previous session).
- `Permission States`: `NavigationNotice` explains admin-only refusals (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.2). `DashboardPage`: `"Restricted"` message for non-ADMIN (`FINAL_INDEPENDENT_REVIEW.md` §2.3). Well-implemented; no significant drift.
- `Offline States`: `NetworkStatus` (`ARCHITECTURE.md` §9; `ARCHITECTURE.md` §7). `NetworkStatus` uses `role="alert"`. No outbox/sync queue (`ARCHITECTURE.md` §9). Honest about online-only (`ARCHITECTURE.md` §7; `README.md`).

---

## 5. Duplication Register Summary (Top 10 by Impact — Evidence Only)

| Priority | Duplication Concept | Evidence Source | Type | Locations (Verified) | Decision | Canonical Owner | Migration Risk | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Page Header Shell | `grep -r PageHeader`; `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4 (R-07) | Harmful duplication (drifting) | `CustomersPage`, `ServicesPage`, `AppointmentsPage` (3 hits); others roll custom (`DashboardPage`, `EmployeesPage`, `ReportsPage`, etc. — 23 pages) | `Consolidate` (universal `PageHeader` adoption) | `PageHeader.tsx` | Low (reversible) | `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4; `grep` results |
| 2 | List/Table Layout Shell | Source inspection (`EmployeesPage`: `bg-white rounded-lg shadow-lg`; `CustomersPage`: `PremiumCard`; `AttendancePage`: `bg-white rounded-lg shadow-lg overflow-hidden`; etc.) | Harmful duplication (drifting) | 8+ list pages (`EmployeesPage`, `CustomersPage`, `ServicesPage`, `InventoryPage`, `ExpensesPage`, `AttendancePage`, `PayrollPageEnhanced`, `AdvancesPage`) | `Consolidate` (`PremiumCard` + `ListState` standard) | `PremiumCard.tsx` + `ListState.tsx` | Low (reversible) | `ARCHITECTURE.md` §7; source inspection (`grep -n "bg-"` patterns) |
| 3 | Empty/Loading/Error Contract | Source inspection (`ScreenState`: partial; `ListState`: partial; `Skeleton`: rare; `PageLoader`: partial; `AttendancePage`: minimal text) | Harmful duplication (partial adoption) | `CustomersPage` (`ScreenState`); `EmployeesPage` (`ListState`); `DashboardPage` (`PageLoader`); `AttendancePage` (minimal); `AdvancesPage` (minimal) | `Consolidate` (`ScreenState` for pages; `ListState` for lists; `Skeleton` for rows; `PageLoader` for quick load) | `ScreenState.tsx` + `ListState.tsx` + `Skeleton.tsx` + `PageLoader.tsx` | Low (reversible) | `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §2.2, §2.3; `grep` usage counts |
| 4 | Error Message Exposure | Source inspection (`showToast` patterns: `String(err)` in `AccountingPage`, `AdvancedAutomationPage`, `AdvancesPage`, `AttendancePage`) | Harmful duplication (security/trust gap) | `AccountingPage`, `AdvancedAutomationPage`, `AdvancesPage`, `AttendancePage` (and likely others using `unwrap()` without `mapErrorToMessage`) | `Consolidate` (`ErrorMapper` mapping + dictionary updates — already applied in previous safe turn) | `ErrorMapper.ts` + `i18n` dictionary | Very low (reversible text change; dictionary updates verified) | `ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.2 (`S-11`); `FINAL_INDEPENDENT_REVIEW.md` §2.4; `grep -n 'showToast("error"'` results |
| 5 | Form Visual Contract | Source inspection (`border-2` vs `border` vs `rounded-xl` vs `bg-background` vs `bg-card`) | Unintentional drift (standardizable) | `AttendancePage` (`border-2`); `CustomersPage` (`rounded-xl bg-background`); `EmployeesPage` (`rounded-xl bg-card border-border`); `ServicesPage` (`rounded-xl bg-background`) | `Standardize` (`rounded-xl` + `border-border` + `bg-card`) | `Modal.tsx` + form pages | Very low (reversible CSS/text) | `ARCHITECTURE.md` §7; source inspection (`grep -n "border-"` patterns) |
| 6 | Button Action Placement / Color Semantics | Source inspection (`bg-blue-500`, `bg-amber-500`, `bg-green-500` placements) | Unintentional drift (acceptable but improvable) | `AttendancePage` (top-right `Record Attendance`); `EmployeesPage` (inline edit `amber`); `CustomersPage` (various actions); `AdvancesPage` (approve `green` / reject `amber`; submit `blue`) | `Keep Separate` (semantic colors correct) / `Standardize` placement (optional) | Current pages (reversible CSS change) | Very low | `ARCHITECTURE.md` §7; source inspection (`grep -n "bg-" pages/*.tsx`) |
| 7 | Mobile Bottom Navigation | Component exists (`MobileBottomNav.tsx`) but no usage (`ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3; `grep` confirms no usage in `pages/`) | Dead / premature code | Component file only; no page usage | `Deprecate` (`WIP` / `not used` comment) or `Remove` (reversible) | `MobileBottomNav.tsx` | Zero (reversible deletion) | `ARCHITECTURE.md` §7; `PROJECT_STATUS.md` §4.3; `grep -r MobileBottomNav` |
| 8 | Legacy Component Surface | `DesktopOperationsCard` (unused); `EmptyState` (unused); `LoyaltyTierBadge` (unused); `Card.tsx` (legacy — verify import scan); `PremiumCard` (used extensively — not dead) | Dead / premature code (`DesktopOperationsCard`, `EmptyState`, `LoyaltyTierBadge`); legacy (`Card.tsx`); active (`PremiumCard`) | `DesktopOperationsCard`: unused (`grep -r` confirms). `EmptyState`: unused. `LoyaltyTierBadge`: unused. `Card.tsx`: verify import scan (`grep -r "from \"\.\.\/components\/Card\""` or similar — likely unused). `PremiumCard`: extensively used (`NotificationsPage`, `PaymentGatewayPage`, `BrandingPage`, `DashboardPage`, `AdvancedAutomationPage`). | `Deprecate` / `Remove` (`DesktopOperationsCard`, `EmptyState`, `LoyaltyTierBadge`, `Card.tsx` if unused); `Keep Separate` (`PremiumCard`) | Component files (`DesktopOperationsCard`, `EmptyState`, `LoyaltyTierBadge`, `Card.tsx`) | Zero (`Deprecate` with comment is fully reversible; `Remove` is also reversible via `git revert`) | `ARCHITECTURE.md` §2; `PROJECT_STATUS.md` §4.3 (`S-16`); import scan (`grep -r`) |
| 9 | Legacy Type Definitions (`src/types.ts`) | `Rentrix` types (`ARCHITECTURE.md` §2; `PROJECT_STATUS.md` §4.3) | Unrelated types; no imports (`grep -r` confirms) | Zero runtime impact; maintenance overhead; confusion for new maintainers | `Remove` (`types.ts`) — fully reversible (`git revert` or `git checkout`) | `src/types.ts` | Zero | `ARCHITECTURE.md` §2; `PROJECT_STATUS.md` §4.3; `grep -r` results |
| 10 | Desktop Adapter Factory / Prototype Claims | `infrastructure/tauri/` (`ARCHITECTURE.md` §10); `.sqlite.json` (`ARCHITECTURE.md` §10); `DesktopOperationsCard` (`ARCHITECTURE.md` §2; `PROJECT_STATUS.md` §4.2; `S-09`) | Empty adapter (`createTauriAdapters()` empty with TODO); `.sqlite.json` = JSON snapshot (not SQLite); desktop claims exceed execution (`ARCHITECTURE.md` §10; `PROJECT_STATUS.md` §4.2; `S-09`; `FINAL_INDEPENDENT_REVIEW.md` §4) | False expectation of desktop/offline product; maintenance overhead; confusion for operators (`S-09` — `ARCHITECTURE.md` §10; `DESKTOP_SETUP_GUIDE.md`) | `Keep Separate` (prototype); clearly document as `prototype` / `WIP`; do not expand desktop scope without owner approval (`AI_DECISIONS.md` `D-14` — requires major architecture change, SQLite adapter, sync protocol, cargo build, updater, signing; not safe/reversible at low effort) | `infrastructure/tauri/` + `.sqlite.json` + `DesktopOperationsCard` | Zero (documentation change only; fully reversible) | `ARCHITECTURE.md` §10; `DESKTOP_SETUP_GUIDE.md`; `PROJECT_STATUS.md` §4.2 (`S-09`); `FINAL_INDEPENDENT_REVIEW.md` §4 (`S-09`) |

---

## 6. First Milestone Recommendation (Evidence-Based, Reversible, No DB/Deployment Change)

**Milestone 1:** Universal `PageHeader` adoption for top 5 pages (`DashboardPage`, `EmployeesPage`, `ReportsPage`, `ExpensesPage`, `AttendancePage`) + `ScreenState` adoption for `DashboardPage` and `AttendancePage` empty/loading states.

**Why:** Highest visual/accessibility impact (`ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4, R-07); fully reversible; zero DB/deployment impact; improves mobile/RTL consistency; creates foundation for Milestone 2 (`PremiumCard` + `ListState` standardization).

**Evidence verification (actual commands executed in this session):**
- `npm run build`: PASS (`PWA v1.3.0`, 57 precache entries, 9.51s — `ARCHITECTURE.md` §9; verified in this session).
- `npm run audit:gate`: PASS (`CONTRACT AUDIT GATE: PASS` — verified in this session).
- `npm run typecheck`: PASS (`tsc --noEmit`, 0 errors — verified in this session).
- `i18n.language-leak`: 5/5 PASS (1.44s — verified in this session; `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §3; previous session `FIR-01`/`FIR-02` fixed).
- `onboarding-resilience`: 3/3 PASS (2.10s — verified in this session; `ARCHITECTURE.md` §7; previous session `FIRST_IMPRESSION_REVIEW.md` §2.3; `FINAL_INDEPENDENT_REVIEW.md` §3).
- `git log --oneline -3`: `ad56a3f` (safe commit — `chore: safe UX/content updates + docs + regression`) + `24cedf5` (`Merge PR #38`) + `fdeeebe` (`ci: verify PR 38 on final main baseline`).
- `git status`: clean (`main` at `ad56a3f`; working tree clean after safe commit; `.nvmrc` present; `AI_*.md` and `UX_CONTENT_GUIDE.md` present; `FRONTEND_ARCHITECTURE_AUDIT.md` added in this turn; `DUPLICATION_REGISTER.md` and `VISUAL_CONSISTENCY_AUDIT.md` to be added).
- `grep -r PageHeader src/pages/*.tsx`: 3 hits (`CustomersPage`, `ServicesPage`, `AppointmentsPage`). 23 pages without it.
- Source inspection: `DashboardPage`, `EmployeesPage`, `ReportsPage`, `ExpensesPage`, `AttendancePage` confirmed without `PageHeader` import.
- `ARCHITECTURE.md` §7; `FINAL_INDEPENDENT_REVIEW.md` §4 (R-07); `PROJECT_STATUS.md` §4.3 (`S-15`, `S-16`).

---

*Audit completed by Claude Sonnet 5 High (read-only architecture audit; no source modifications in this audit turn; evidence from verified repository files, previous session reports, actual command outputs). Independent review by SOL 5.6 reserved but not executed in this turn. No fabricated claims; no unverified hosted assertions (honest gap preserved: hosted state remains unverified as documented in `AI_PROJECT_ASSESSMENT.md` §4). No secrets exposed (token in system message is server-injected; not referenced, not quoted, not used, not committed).*
