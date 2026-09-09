# DATA_DISPLAY_DECISIONS

Chosen representation for every dataset, derived from the user's task (scan / browse / compare / inspect / chronology / decide). Verified against current implementations on 2026-09-09. Standing rule: **a desktop table is never shrunk into unusability** — the app's deliberate mobile strategy is **table→card transformation** (customers, services, inventory, expenses, employees), with comparison-critical tables (workforce) kept in horizontally contained scroll containers.

| Page / dataset | Chosen pattern | Why (task → pattern) | Density / sorting / filtering | Item & bulk actions | States | Mobile transformation |
|---|---|---|---|---|---|---|
| Dashboard stat tiles | **STATS** (4 tiles) | Today's headline counts answer "how is today shaped" at a glance; no trend implied. | Fixed set; revenue tile respects `canViewRevenue`. | Tile click → owning module. | Loading "…"; Restricted label. | 2×2 grid. |
| Dashboard today's appointments | **LIST** (time-ordered) | Sequential run-book for the day; order is the meaning. | Time order; capped 8 + link to full book. | Row → open appointment. | Empty → "New appointment" CTA. | Full-width rows. |
| Dashboard exceptions | **CARD LIST** (merged Needs Attention) | Actionable exceptions with one jump action each; merged from two former panels to one surface. | Urgency tone; cap 6. | Per-item jump. | Empty = "no exceptions" success copy. | Stacked. |
| Dashboard 7-day revenue | **AREA CHART** — only when `canViewRevenue` | Trend over 7 days informs staffing/supply decisions; a number could not show the shape. Permission-gated. | 7 fixed points; language-aware day labels. | None. | Hidden entirely for unauthorized roles. | Full-width, short height. |
| Action Center queues | **SECTIONED CARD LISTS** | Work queue: heterogeneous rows (rebooking, arrivals, checkout, stuck, demand, expiry) each with one action; sections carry urgency tone. | Sorted by overdue/days; caps per section. | Row action completes the task in the owning journey. | Per-section trio; empty = success. | Single column. |
| Appointments schedule | **TIMELINE-SCHEDULE GRID** (day/week) | Time and placement are the primary meaning — not a table, not cards. | Day default <1024px; week on desktop; date nav; filters. | Appointment → edit/reschedule/cancel (confirm); arrive → POS. | Loading per range; empty day + CTA; overlap error. | Day view + sheet dialog. |
| POS catalog | **CARDS** | Browse-and-add; each item independent with price identity. | Search + category chips. | Add (fixed price) / custom-price Modal with floor. | Trio + no-results. | Catalog/cart toggle. |
| POS cart | **LIST** (ordered lines) | Sequential lines the cashier edits top-down; totals accumulate. | Order of addition. | Line edit/remove; clear cart (confirm). | Empty cart; preserved on checkout failure. | Sticky thumb-zone checkout. |
| Customers | **TABLE** (desktop) / **CARD LIST** (mobile) | Desktop: compare spend/tier across clients in stable columns. Mobile: find-then-act browse. | Client-side search (name/phone); one search per breakpoint. | Row: passport, edit. No bulk (none in product). | Trio + conditional no-results copy. | Cards + per-card menu + sticky search. |
| Services | **TABLE** / **2-COL CARDS** | Compare price/duration/availability in columns; mobile browse by category. | Search + category filter. | Availability toggle (≥44px); edit; recipe modal. | Trio + no-results. | Cards. |
| Inventory products | **TABLE** / **CARDS** + low-stock banner + 3 STATS | Compare stock/cost columns; low-stock is a threshold → banner + count (not a chart). | Search; low-stock surfaced. | Edit product. | Trio; banner only when real rows exist. | Cards. |
| Gift cards ledger | **FORM + CARD LEDGER** | One sell action + scan of remaining balances (status per card, not column comparison). | Client-side search. | Card → remaining value/status. | Trio; module hidden when empty. | Stacked. |
| Packages | **FORM + CARDS** (available + customer-owned) | Instruments with service bundles; entitlements need remaining counts on the card. | Search. | Create/sell; view entitlements. | Trio; module hidden when empty. | Stacked. |
| Employees | **TABLE** / **LIST** | Roster comparison (role/status); mobile list is sufficient (few rows). | Search if needed. | Activate toggle (≥44px); edit. | Trio. | 1-col cards. |
| Reports (sales / appointments / inventory) | **TABS → STATS + CHART + TABLE** | Period comparison: trend chart where shape informs; the transaction **table is the evidence of record**; drill-down dialog per row. | Tab + date range drive everything. | Row → transaction detail dialog; print. | Loading per tab; empty period copy; error retry. | Tabs scroll horizontally; tables contained. |
| Expenses | **TABLE** / **CARDS** + 3 STATS | Compare amounts/category/date across rows; stats give period totals (numbers, not charts). | Category chips + month + search. | Edit entry. | Trio + no-results. | Cards. |
| Attendance | **TABLE** (min-w, contained) + SUMMARY CARDS | Time records compared across employees/dates; containment preserves columns. | Period scope. | Record/edit modal. | Trio. | Contained horizontal scroll; cards summary stays. |
| Advances | **LIST/TABLE + modal** | Few, money-critical rows. | Employee scope. | Record modal. | Trio. | Contained scroll. |
| Payroll | **TABLE + settlement modal** | Per-employee amounts in stable columns; settlement is server-authoritative. | Period scope. | Run/settle (confirm). | Trio; in-flight disabled. | Contained scroll. |
| Staff analytics | **STATS + TABLE** | Comparison across staff in stable columns; a leaderboard chart adds nothing over the ranked table. | Period scope. | Drill into employee. | Trio. | Contained scroll. |
| Settings sections | **KEY-VALUE FORMS** in sectioned tab layout | Inspect-and-edit one record (the center); grouping by concern. | Tab nav (URL-synced). | Save per section; export. | Lazy loading; validation; save states. | Chips nav. |
| Customer passport (modal) | **DETAIL / KEY-VALUE + HISTORY list** | Inspect one client: identity, spend, loyalty, then chronological visits. | — | Edit; sell to customer. | Loading/empty history. | Full-screen-ish modal. |
| Sales transaction dialog (reports) | **DETAIL key-value** | Inspect one transaction from evidence table. | — | Print receipt. | — | Sheet-like modal. |
| Forecasting | **4 STATS + AT-RISK LIST** | Run-rate projections are numbers (not charts); at-risk inventory is an actionable list. Disclosed method note. | — | None (advisory). | Trio. | Stacked. |
| Accounting | **KEY-VALUE + LEDGER TABLE** | Money overview: balances first, entries as evidence. | — | — | Trio. | Stacked. |
| Booking requests (advanced automation) | **LIST with status actions** | Intake queue: scan leads, move status via admin RPC. | Status ordering. | Status transition. | Trio. | Single column. |

## Selected pattern counts (sanity)
- TABLE+mobile-card hybrid: 8 datasets (customers, services, inventory, expenses, attendance, advances, payroll, staff analytics) — comparison tasks.
- CARDS: POS catalog, gift cards, packages, dashboard exceptions, action center — independent items with identity/status/actions.
- LIST: today's book, cart, booking requests — sequential/queue semantics.
- TIMELINE-SCHEDULE: appointments only — time placement is the meaning.
- DETAIL/KEY-VALUE: passport, transaction dialog, settings sections, accounting — single-record inspection.
- CHART: exactly two justified cases — dashboard 7-day revenue trend (permission-gated) and reports period trend. Everywhere else numbers/tables communicate better; no decorative charts.

## Standing interaction rules for all list datasets
- States: `ListState` owns loading / error / empty / no-results (conditional copy when a query filters everything out).
- Pagination: none — datasets are center-scoped and small; client-side search/filter on loaded rows (honest for v1 data volumes).
- Bulk actions: none exist in the product; none invented.
- Selection: none; row actions live on the row.
- Keyboard/AT: rows/buttons are real `button`/`link` elements with accessible names (locked by dialog-a11y tests); modals focus-trap.
- RTL: logical `start/end` properties throughout; money/phone/code keep `dir="ltr"` where required.
