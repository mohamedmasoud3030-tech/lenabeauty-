# SHARED_COMPONENT_ARCHITECTURE

Inventory and canonical plan for the shared UI system. Classification: **KEEP / IMPROVE / MERGE / SPLIT / REPLACE / REMOVE AFTER MIGRATION**. Principle: smallest justified system — only what the product actually uses; no giant universal components; no wrappers that hide behavior without adding consistency.

## Layout & shell (frozen — locked by IA + mobile tests)
| Current | Class | Canonical role | Notes |
|---|---|---|---|
| `ui/layout/Layout.tsx` | **KEEP** | AppShell: sidebar (desktop), chrome (center switcher, GlobalSearch, theme/lang), `<main id="main-content">`, skip link, dock/sheet/assistant mounts, RTL-safe. | Do not restyle. Shell contract is test-locked (`information-architecture`, `mobile-portrait-ux`). |
| `Sidebar.tsx` | **KEEP** | Desktop navigation from `NAV_DESTINATIONS` grouped by operator job; visibility-only filtering. | Authorization lives in `RequireAdmin`, never in nav. |
| `MobileActionDock.tsx` + `MobileNavigationSheet.tsx` | **KEEP** | Phone nav: menu/search/assistant dock + all-destinations sheet; thumb-zone. | `MOBILE_PRIMARY_PATHS` intentionally empty; sheet lists every shipped destination. |
| `CenterSwitcher.tsx` | **KEEP** | Multi-branch center context (single-mode aware). | — |

## Canonical shared components
| Current | Class | Canonical role | Responsibility / states / rules | Migration priority |
|---|---|---|---|---|
| `PageHeader.tsx` | **IMPROVE (adoption)** | THE page header: icon tile + `h1` title (responsive scale) + optional subtitle + actions area; `stickyActions` option. | One per routed page (except auth + dashboard welcome + POS/Appointments chrome-title pages). RTL: logical properties. Long titles truncate. | **P1 — this milestone:** migrate 6 hand-rolled headers (expenses, employees, inventory, gift-cards, packages, attendance) preserving icon/subtitle/actions and accessible names. |
| `ListState.tsx` | **KEEP (name the no-results rule)** | The one loading/error/empty owner for lists (block + table-row variants). | Rule: searchable lists pass conditional `emptyDescription` — search-targeted copy when a query filters everything out, onboarding CTA when truly empty. Already followed by 5 pages; documented as canonical; no API fork. | P2 (docs + consistency checks). |
| `ScreenState.tsx` | **KEEP** | Full-screen-state surfaces (loading/error/empty/permission-style) behind ListState and page-level fallbacks. | — | — |
| `Modal.tsx` + `ConfirmDialog.tsx` | **KEEP** | All dialogs; ConfirmDialog for destructive/confirmable actions. | Focus trap, `confirmCloseMessage` for dirty forms, portal overlay contract (test-locked). | — |
| `Toast.tsx` | **KEEP** | Transient feedback (success/failure). | Never the only copy for a destructive outcome. | — |
| `PageLoader.tsx` / `Spinner.tsx` | **KEEP** | Route-level Suspense fallback + inline busy. | No shimmer skeleton system (spinner states are consistent app-wide). | — |
| `StatusPill.tsx` | **KEEP** | Status indicator where used. | Do not force-replace local badge tones this round. | — |
| `StatCard` (in `dashboard/widgets.tsx`) | **KEEP** | Tile stat for dashboard-type summaries. | Labels ≥10px (`text-[10px] sm:text-xs` already applied). | — |
| `LazyChart.tsx` | **IMPROVE (nit)** | Lazy recharts wrapper for the two justified charts. | Fix physical `right-2` → logical `end-2` (RTL watermark). | P3 — included this milestone. |
| `GlobalSearch.tsx` | **KEEP** | ⌘K/dock command palette over `NAV_DESTINATIONS` + role filtering. | — | — |
| `NavigationNotice.tsx` | **KEEP** | Explains admin-only + not-found redirects (no bare redirects). | — | — |
| `NetworkStatus.tsx` | **KEEP** | Offline banner (`role=alert`, safe-area aware). | — | — |
| `PwaUpdatePrompt.tsx` | **KEEP** | PWA update flow. | — | — |
| `ErrorBoundary.tsx` | **KEEP** | App-level crash containment. | — | — |
| `ReceiptPreviewModal.tsx` / `InvoicePrintLayout.tsx` | **KEEP** | Print/receipt pipeline (physical text-align inside print layout is deliberate, language-aware). | — | — |
| `GettingStartedCard.tsx` | **KEEP** | First-use onboarding on dashboard (real-data absence detection). | — | — |
| `AdminAssistantPanel.tsx` | **KEEP** | Admin-only Gemini assistant; mounted only for admins. | — | — |
| `EnvironmentBadge.tsx` | **KEEP** | Non-prod environment disclosure. | — | — |
| `LazyImage.tsx` | **KEEP** | Media used by growth modules. | — | — |

## Form primitives (standard defined in FORM_COMPONENT_STANDARD.md)
| Current | Class | Canonical role | Notes |
|---|---|---|---|
| Native inputs + label-wrapped pattern (`<label className="block space-y-1.5">`) | **KEEP (as pattern)** | FormField convention: visible label wraps control; inline error; `min-h-11` controls; focus ring tokens; `inputMode` per data type; `dir="ltr"` on phone/email/code. | No form library introduced. Dialog-form a11y locked per page (employees/inventory/services/expenses/attendance/advances/customers). |
| Submit handling (`disabled={saving...}`) | **KEEP** | Duplicate-submit prevention while in-flight. | Present on all 13 submit sites. |

## MERGE / SPLIT / REPLACE / REMOVE
- **MERGE:** none required — no duplicated shared components found (each concern has exactly one owner).
- **SPLIT:** none — no giant universal component exists.
- **REPLACE:** none — no component is architecturally wrong.
- **REMOVE AFTER MIGRATION:** none — no dead shared component found (all exports consumed; prior rounds already ran unreachable-code cleanup).

## PageHeader adoption map (the actionable migration)
| Page | Current header | Target | Preserves |
|---|---|---|---|
| `ExpensesPage` | Hand-rolled `h1 text-2xl sm:text-3xl` + solid-primary icon tile + `h-14` CTA | `PageHeader` (Receipt icon, subtitle, Add Expense action, CTA normalized to `min-h-11 px-4`) | Accessible name "Add Expense" (test-locked) |
| `EmployeesPage` | Hand-rolled `h1 text-lg sm:text-xl` small tile | `PageHeader` (Users icon, subtitle, admin-gated Add Employee) | `isAdmin` gating |
| `InventoryPage` | Hand-rolled `h1 text-lg sm:text-xl` | `PageHeader` (Boxes icon, subtitle, search + add action) | Search input behavior |
| `GiftCardsPage` | Bare `h1 text-2xl`, no icon | `PageHeader` (Gift icon, honest subtitle) | Form + ledger content |
| `PackagesPage` | Bare `h1 text-2xl`, no icon | `PageHeader` (Package icon, subtitle) | Form + cards content |
| `AttendancePage` | Hand-rolled `text-2xl sm:text-3xl` with inline icon | `PageHeader` (Fingerprint icon, Record Attendance action) | Accessible name "Record Attendance" |

Deliberate non-adopters (documented): `LoginPage`/`ResetPasswordPage` (auth template), `DashboardPage` (welcome composition), `SettingsPage` (side-nav layout), `PosInvoicesPage`/`AppointmentsPage` (chrome-title operational layouts).

**Adoption status 2026-09-09: COMPLETE for every standalone operational page.** M1 migrated expenses, employees, inventory, gift-cards, packages, attendance; M2 completed the roster with advances, payroll, staff-analytics. Every remaining route is either a deliberate non-adopter (above) or already used PageHeader.

## Deprecation plan
None required this round — no component is deprecated. The `SHARED_COMPONENT_IMPROVEMENTS.md` table from the prior round is superseded by this file; issues it listed (8px stat labels, `h-9` toggles, missing gift-card labels, settings chevron RTL, POS prompt) are verified fixed in code and closed here.
