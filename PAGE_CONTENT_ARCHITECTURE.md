# PAGE_CONTENT_ARCHITECTURE

Matrix of what every route must display and why. Evidence: source @ `d110a3c` (2026-09-09), committed runtime captures, and the 880-test suite. "Primary Action" = the one outcome the page exists for. Destructive actions always route through `ConfirmDialog` or server-side guarded RPCs.

Conventions used below: **RA** = Required (above the fold / decision-critical), **SA** = Supporting (lower hierarchy), **PD** = progressively disclosed. Money = `formatOMRAmount` (3 dp OMR). Dates language-aware (`ar-OM` / `en-US`). All lists own loading/empty/no-results/error via `ListState`.

---

### `/login` — Authenticate
- **Page Goal:** Get a verified identity into the app, fail closed.
- **User Role:** Public.
- **Primary Question:** "How do I sign in (or recover access)?"
- **Required Content:** Brand identity; email + password fields (autocomplete, show/hide); sign-in submit; forgot-password path; language + theme switches; error surface for failed sign-in.
- **Supporting Content:** LENA Digital House endorsement; role capability tiles (marketing truthfulness locked by tests).
- **Primary Action:** Sign in.
- **Secondary Actions:** Forgot password; language; theme.
- **Destructive Actions:** None.
- **Required States:** Idle; submitting (disabled submit); error (translated, no credential leakage); loading; demo-credentials banner in non-prod opt-in only.
- **Data Source:** Supabase Auth.
- **Chosen Display Pattern:** Auth template — split brand/form desktop, stacked mobile.
- **Mobile Layout:** Single centered card; controls ≥44px; virtual keyboard must not cover submit.
- **Desktop Layout:** Two-pane brand + form.
- **Acceptance Criteria:** Autocomplete attrs present; error announced; production build never falls back to demo credentials.

### `/reset-password` — Complete recovery
- **Goal:** Turn a recovery link into a new password. **Role:** Public with token. **Question:** "How do I set a new password?"
- **Required:** New-password form, confirmation, success → login handoff. **Primary Action:** Save new password. **States:** Invalid/expired token error; success. **Pattern:** Auth template. **Acceptance:** Expired token shows recoverable error, no crash.

### `/dashboard` — Daily command
- **Goal:** Start the day: know what the center looks like now and what needs action first.
- **Role:** All authed (STAFF sees restricted money).
- **Primary Question:** "What is happening today, and what needs me first?"
- **Required (RA):** Greeting + today context; today's appointments list (time, client, service, status) with empty-state CTA "New appointment"; merged Needs-Attention exceptions (late appointments, low stock) capped ~6 with per-item jump actions; primary quick actions (Open today's book / New appointment).
- **SA:** 4 stat tiles (appointments today, customers, invoices today, low-stock count); revenue tile shows value only with `canViewRevenue`, else "Restricted"; 7-day revenue/P&L chart **only** when `canViewRevenue`.
- **PD:** First-run Getting Started only when center has no real data; degraded-mode notice when summary contract unavailable.
- **Primary Action:** Open today's schedule (or complete first-run setup).
- **Secondary Actions:** Refresh (semantic refresh icon); jump to POS; jump to Action Center.
- **Destructive:** None.
- **States:** Loading (skeleton/spinner), degraded (list-endpoint dashboard), error ScreenState with retry, empty (first-run), restricted (money tiles).
- **Data Source:** `dashboard.getSummary()` → fallback list endpoints.
- **Pattern:** Dashboard template — stats row + two-column lists; one justified chart.
- **Mobile:** Single column: welcome → tiles 2×2 → today → exceptions → chart (if permitted).
- **Desktop:** 3-col: tiles row; today (main) + exceptions (side); chart + activity.
- **Acceptance:** One exceptions surface (no duplicated low-stock panels); STAFF never sees revenue figures or chart; refresh does not look like an "energy" action; tile labels ≥10px.

### `/action-center` — Work the queue
- **Goal:** Clear operational exceptions that span customers, visits, and entitlements.
- **Role:** All authed. **Question:** "Who/what do I need to act on right now?"
- **Required:** Sectioned queues with per-row primary action: rebooking-due (call/book), arrivals today (open visit), awaiting checkout, stuck visits, demand signals, expiring entitlements. Each row: who, what, how long overdue/remaining, one action.
- **SA:** Section tone (warning/danger) by urgency; counts per section.
- **Primary Action:** Execute the row's action (book / open visit / checkout).
- **Secondary:** Jump to owning module.
- **Destructive:** None (queue is advisory; transitions happen in owning journeys).
- **States:** Loading/empty ("nothing needs attention" is a success state)/error per section.
- **Pattern:** Work-queue — sectioned card lists.
- **Mobile:** One column, sections stacked. **Desktop:** 2-col grid of sections.
- **Acceptance:** Every row action lands in the journey that can complete the task; no fabricated urgency.

### `/pos` — Sell and check out
- **Goal:** Record a completed sale without leaving the counter.
- **Role:** All authed. **Question:** "How do I check this client out?"
- **Required (RA):** Catalog with search + category chips (name, price, starting-from marker); cart lines with qty/price edit and remove; customer picker; specialist; tender pad with thumb-zone checkout; visit-context banner when arriving from an appointment.
- **SA:** Wallet/gift-card application; receipt preview/print; invoice reference.
- **PD:** Custom-price Modal (floor = starting-from price); gift-card balance lookup after selection.
- **Primary Action:** Complete checkout (server-authoritative RPC).
- **Secondary:** Clear cart (confirm); print/preview receipt; pick price tier.
- **Destructive:** Clear cart (confirm-guarded); void/return flows stay server-side.
- **States:** Catalog loading/empty/no-results; checkout in-flight (disabled, duplicate-submit-proof); checkout failure (cart preserved); offline banner; receipt success.
- **Pattern:** Operational two-pane (catalog cards + cart list); mobile = toggle + sticky checkout.
- **Mobile:** Catalog/cart segmented toggle; checkout bar in thumb zone; ≥44px targets.
- **Desktop:** Persistent 2-pane.
- **Acceptance:** `window.prompt` stays gone; fixed-price add unchanged; cart survives recoverable failure; keyboard shortcuts don't fire while typing.

### `/appointments` — Run the book
- **Goal:** See and manage who comes when; book without conflicts.
- **Role:** All authed. **Question:** "Who is coming, when, and where does the next client fit?"
- **Required (RA):** Day/week schedule grid (time is the meaning); date navigation; per-appointment status; booking dialog (service, customer, employee, date/time, notes).
- **SA:** Stats row (today counts) below the schedule in hierarchy; filters (employee/status).
- **Primary Action:** New appointment.
- **Secondary:** Switch day/week; filter; reschedule/cancel (confirm-guarded); hand off to POS on arrival.
- **Destructive:** Cancel / no-show (confirm; server transition).
- **States:** Loading per range; empty day ("nothing booked" + CTA); error; overlap rejected with clear message.
- **Pattern:** Timeline-schedule (not cards, not table).
- **Mobile:** Day view default; booking as bottom-sheet dialog. **Desktop:** Week grid.
- **Acceptance:** Booking respects overlap constraints; day default <1024px; handoff preserves appointmentId.

### `/customers` — Client records
- **Goal:** Find a client fast and act on her record (edit, history, passport, sell).
- **Role:** All authed. **Question:** "Where is this client and what do I know about her?"
- **Required (RA):** Search (name/phone) — one per breakpoint; results with identity (initials/name/phone), value (total spent), loyalty tier+points, row actions (passport, edit).
- **SA:** Client ID suffix; add/edit dialog fields per contract; history (visits/invoices) inside passport modal.
- **Primary Action:** Open client (passport) — or Add Customer when empty.
- **Secondary:** Edit; sell to customer via POS; history print.
- **Destructive:** None in list (no delete capability by design; deactivation not exposed).
- **States:** Loading; error+retry; empty (no customers → onboarding CTA); no-results (search copy); duplicate-search prohibited (breakpoint-exclusive inputs).
- **Pattern:** Desktop operational table / mobile card list + per-card menu.
- **Mobile:** Sticky search; cards with inline menu. **Desktop:** dense 5-col table.
- **Acceptance:** One visible search per breakpoint; row density operational (not `py-8`); passport opens from row.

### `/services` — Service menu
- **Goal:** Maintain what the center sells and how services are performed.
- **Role:** All authed. **Question:** "What do we offer, at what price/duration, and what is active?"
- **Required:** Search + category filter; name, category, price, duration, availability toggle, edit; recipe view (consumables) per service.
- **Primary Action:** Add service (or edit inline).
- **Secondary:** Toggle availability (44px target); view/edit recipe.
- **Destructive:** None exposed (availability toggle is the off-switch).
- **States:** ListState trio + no-results copy; toggle in-flight state.
- **Pattern:** Table (desktop, comparison) / 2-col cards (mobile, browse).
- **Acceptance:** Toggle hit area ≥44px; recipe writes RPC-only.

### `/inventory` — Stock & cost
- **Goal:** Know what is in stock, what is running out, what it costs.
- **Role:** All authed. **Question:** "What is low, what is used, what did it cost?"
- **Required (RA):** Low-stock condition surfaced (banner + count); product search; stock per product with edit.
- **SA:** Stats (total items, stock value, low-stock count); cost fields.
- **Primary Action:** Add/edit product.
- **Secondary:** Search; filter low stock.
- **Destructive:** None exposed.
- **States:** ListState trio; banner only when a real low-stock row exists.
- **Pattern:** Table / cards + stats.
- **Acceptance:** Header uses canonical PageHeader; banner never duplicates the low-stock stat into two competing panels.

### `/gift-cards` — Prepaid value
- **Goal:** Sell a gift card; see remaining value on sold cards.
- **Role:** All authed (nav visibility gated on module holding data). **Question:** "How do I sell a card, and what remains on sold ones?"
- **Required (RA):** Sell form with labeled fields (code, value OMR, expiry, recipient, optional note) and submit ≥44px; sold-card list with remaining balance + status.
- **SA:** Search over cards; redemption reflected in balance.
- **Primary Action:** Sell gift card (checkout issue path).
- **Destructive:** None.
- **States:** Form validation (min value); list trio; module-hidden when empty per `useOptionalModules`.
- **Pattern:** Form + card ledger.
- **Acceptance:** Every input has a visible label; sell disabled while in-flight.

### `/packages` — Service packages
- **Goal:** Define and sell grouped services at a package price; track customer entitlements.
- **Role:** All authed (same visibility rule). **Question:** "How do I package services, and what do customers own?"
- **Required:** Create form (name, services, price, description — all labeled); available packages cards; customer packages with remaining entitlements.
- **Primary Action:** Create package / sell to customer.
- **States:** ListState trio; form in-flight; empty per module.
- **Pattern:** Form + cards (same family as gift cards).
- **Acceptance:** No placeholder-as-label; package writes pass RPC boundary.

### `/employees` — Team records (ADMIN)
- **Goal:** Maintain who works at the center and their active status.
- **Role:** ADMIN. **Question:** "Who is on the team and are they active?"
- **Required:** Roster (name, role/contact, status), activate/deactivate toggle, add/edit modal.
- **Primary Action:** Add employee.
- **Secondary:** Toggle active (44px); edit.
- **Destructive:** Deactivation = soft off-switch (confirm; not deletion).
- **States:** ListState trio; admin-only route (guard + nav visibility).
- **Pattern:** Table / list.
- **Acceptance:** Canonical PageHeader; all money microcopy ≥10px (no `text-[8px]`).

### `/reports` — Period evidence (ADMIN)
- **Goal:** Answer "how did we perform?" with exportable, period-scoped evidence.
- **Required (RA):** Tab set (Sales / Appointments / Inventory); date range; per-tab: summary stats + chart where a trend informs + transaction table; drill-down dialog per transaction.
- **Primary Action:** Choose period (range) — everything else follows it.
- **Secondary:** Switch tab; open transaction detail; print.
- **States:** Loading per tab; empty period ("no sales in range" ≠ error); error+retry.
- **Pattern:** Tabs → chart + table (charts only where trend beats a number).
- **Acceptance:** Tab switch preserves range; charts lazy-loaded; tables remain the evidence of record.

### `/expenses` — Costs (ADMIN)
- **Goal:** Log a cost quickly and review spend by period/category.
- **Required (RA):** Add Expense action; period context (current month); list with amount/category/date/note and edit.
- **SA:** 3 stats (total, transactions, period) at operational density; category chips; month filter; search.
- **Primary Action:** Add Expense.
- **Secondary:** Filter by category/month; edit entry.
- **Destructive:** None exposed (entry edit only).
- **States:** ListState trio; form modal with preserved input on failure.
- **Pattern:** Table / cards.
- **Acceptance:** PageHeader canonical; stat cards operational density (not `rounded-[2.5rem] p-8`); header `py-4` not `py-8`; OMR 3 dp via `formatOMRAmount`; language-aware month locale.

### Workforce: `/attendance`, `/advances`, `/payroll`, `/staff-analytics` (ADMIN)
- **Goal:** Record time and money events per employee; settle periods; compare performance.
- **Required:** Period context; summary cards; per-employee rows; record/edit modals; payroll computes from real attendance/advances/salary (server RPC).
- **Primary Action:** Record attendance / advance / run payroll period.
- **Destructive:** Payroll settlement (server-authoritative; confirm).
- **States:** ListState trio; modal a11y (labels, focus trap) — locked by tests.
- **Pattern:** Table + modal (operational).
- **Acceptance:** `min-w` tables live inside overflow containers; i18n-complete copy (locked); canonical PageHeader.

### `/settings` — Configuration (ADMIN)
- **Goal:** Configure center identity, go-live, data export, branding, notifications, payments — once, safely.
- **Required:** Tab nav (URL-synced `?tab=`) separating: Center profile, Launch readiness, Data export, Branding, Notifications, Payment gateway. Each section: labeled form fields, save with in-flight state, success/failure toast.
- **Primary Action:** Save current section.
- **Secondary:** Export data (scoped, disclosed); test gateway.
- **Destructive:** None immediate (exports read-only; gateway changes validated).
- **States:** Per-section loading (lazy), validation, save in-flight, error; unknown `?tab` falls back to center.
- **Pattern:** Settings template — side nav (desktop) / chips (mobile), key-value forms.
- **Acceptance:** Chevron direction flips in RTL (locked); legacy `/branding|/notifications|/payment-gateway` redirects keep working; save buttons ≥44px.

### Growth: `/customer-experience`, `/forecasting`, `/accounting`, `/advanced-automation` (ADMIN)
- **Goal:** Focused admin modules (reputation, run-rate outlook, money overview, booking intake) — each shipped with real states.
- **Required:** Each: PageHeader, honest scope note (e.g., forecasting's "run-rate, not a promise"), real data lists/stats, ListState trio.
- **Primary Action:** Per module (add review / read outlook / review ledger / update lead status).
- **States:** Loading/empty/error each.
- **Acceptance:** Booking-request status changes go through the admin RPC only; forecasting never promises; uploads storage-hardened.

### Cross-route requirements
- **No-results ≠ empty:** searchable lists show search-targeted copy when `q` filters everything out, onboarding copy when truly empty (customers, expenses, inventory, services, POS catalog).
- **Permission:** admin routes never render for staff (guard + notice after redirect); money content respects `canViewRevenue`.
- **Session expiry:** any failure → login with return path.
- **Offline:** banner discloses; writes are online-only by contract (disclosed, not silently queued).
