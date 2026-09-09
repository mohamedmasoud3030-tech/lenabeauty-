# PAGE_TEMPLATE_MAP

The small set of reusable page templates that covers every real route, and the route→template map. Templates describe content regions, hierarchy, and responsive transformation — not colors or decoration. Rule: **never force all pages into one dashboard/card template.**

## T1 — Overview / Dashboard template
- **Intended use:** one page whose job is "orient me and route me" at day start.
- **Regions:** welcome/context header → stat tile row → primary list (today's book) → exceptions side-list → one justified chart → quick actions.
- **Header/actions:** custom welcome composition (not PageHeader); refresh is semantic.
- **Width/density:** content `max-w` container; medium density; tiles compact.
- **States:** loading, degraded, error, first-run (GettingStartedCard), permission-restricted tiles.
- **Must not be used for:** work queues (that is T7), records, or settings.
- **Routes:** `/dashboard`.

## T2 — Index / List-Management template
- **Regions:** PageHeader (icon/title/subtitle + primary action + search/filter actions) → optional condition banner (e.g., low stock) → optional stats row (≤3, operational density) → primary dataset (pattern per `DATA_DISPLAY_DECISIONS.md`) → ListState-owned states.
- **Header/actions:** PageHeader is canonical; search sits in header actions (desktop) or sticky top (mobile).
- **Responsive:** desktop table → mobile cards (or contained scroll for comparison-critical); primary action full-width in thumb reach on mobile.
- **Routes:** `/customers`, `/services`, `/inventory`, `/gift-cards`, `/packages`, `/employees`, `/expenses`, `/attendance`, `/advances`, `/payroll`, `/staff-analytics`, `/advanced-automation`.

## T3 — Record-Detail template (modal-carried)
- **Intended use:** inspect one record with grouped key-values + history + contextual actions. The product carries record detail in modals (passport, transaction) rather than routed detail pages — correct for counter workflows (no dead-end navigation).
- **Regions:** identity header → key-value groups → history/timeline → contextual actions.
- **Routes:** Customer passport modal (from `/customers`), Sales transaction dialog (from `/reports`).

## T4 — Create / Edit Form template (modal-carried)
- **Regions:** modal with grouped fields per `FORM_COMPONENT_STANDARD.md` field order → footer primary action (+ secondary preview/print).
- **States:** validation inline, in-flight disabled, preserved input on failure, dirty-close confirm.
- **Routes:** booking dialog, customer form, service/product/employee/expense/attendance/advance/payroll modals, POS custom-price modal.

## T5 — Settings template
- **Regions:** section nav (desktop sticky side / mobile chips) → section form (key-value groups) → save action; URL-synced tab.
- **Routes:** `/settings` (+ legacy `/branding|/notifications|/payment-gateway` redirects).

## T6 — Authentication / Onboarding template
- **Regions:** brand identity + single task form; language/theme always reachable.
- **Routes:** `/login`, `/reset-password`.

## T7 — Operations / Work-queue template
- **Regions:** chrome title (PageHeader where standalone) → prioritized sectioned queues with per-row actions → jump links into owning journeys.
- **Routes:** `/action-center`, `/pos` (operational two-pane variant: catalog/cart + sticky checkout), `/appointments` (schedule variant: timeline grid + booking dialog).

## T8 — First-Use / Empty Experience
- **Owner:** `GettingStartedCard` (dashboard) + ListState empty CTAs ("Add your first customer…", "New appointment", "Add service").
- **Rule:** empty ≠ error; each empty state offers the one action that ends the emptiness.

## T9 — Evidence / Analytics template
- **Regions:** period/tab selector → summary stats → chart only where trend informs → transaction table (evidence of record) → drill-down detail.
- **Routes:** `/reports`, `/staff-analytics`, `/forecasting`, `/accounting` (ledger variant).

## Route → template map (complete)
| Route | Template | Pattern (dataset) | Notes |
|---|---|---|---|
| `/login` | T6 | — | |
| `/reset-password` | T6 | — | |
| `/dashboard` | T1 | STATS + LIST + CARD LIST + gated CHART | |
| `/action-center` | T7 | sectioned CARD LISTS | |
| `/pos` | T7 (POS variant) | CARDS catalog + LIST cart | custom layout is test-locked |
| `/appointments` | T7 (schedule variant) | TIMELINE-SCHEDULE | chrome title |
| `/customers` | T2 | TABLE/CARDS + T3 passport | |
| `/services` | T2 | TABLE/2-COL CARDS | |
| `/inventory` | T2 | TABLE/CARDS + banner + STATS | header → PageHeader (this milestone) |
| `/gift-cards` | T2 | FORM + CARD LEDGER | header → PageHeader (this milestone) |
| `/packages` | T2 | FORM + CARDS | header → PageHeader (this milestone) |
| `/employees` | T2 | TABLE/LIST | header → PageHeader (this milestone) |
| `/expenses` | T2 | TABLE/CARDS + STATS | header → PageHeader + density fix (this milestone) |
| `/attendance` | T2 | contained TABLE + summary | header → PageHeader (this milestone) |
| `/advances` | T2 | LIST/TABLE + modal | header alignment P2 |
| `/payroll` | T2 | TABLE + settlement modal | header alignment P2 |
| `/staff-analytics` | T9 | STATS + TABLE | header alignment P2 |
| `/reports` | T9 | TABS → STATS + CHART + TABLE | |
| `/settings` | T5 | KEY-VALUE FORMS | |
| `/customer-experience` | T2 | sections + uploads | |
| `/forecasting` | T9 | STATS + LIST | |
| `/accounting` | T9 | KEY-VALUE + LEDGER | |
| `/advanced-automation` | T2 | LIST + status actions | |

**Justified custom layouts** (not forced into templates): `/pos`, `/appointments`, `/dashboard`, `/settings` — each is locked by IA/mobile tests and matches its task exactly.
