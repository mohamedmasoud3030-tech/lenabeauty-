# PAGE_IMPROVEMENT_ARCHITECTURE

Decisions below change only what operators actually struggle with. Deferred modules stay deferred.

## `/dashboard` — P1
- **Goal / question:** What needs me now, and can I start work?
- **Problem:** Low stock appears twice; 7-day revenue/P&L ignore `canViewRevenue`; refresh looks like “energy”; 8px labels.
- **Required:** Welcome, setup (first run), tiles, today’s appointments, one exceptions list, activity, shortcuts. Financial chart only if `canViewRevenue`.
- **Primary action:** Open today’s book (or add services on first run).
- **Improved pattern:** Keep dashboard. Merge alerts into one column. Gate money. Readable labels.
- **Acceptance:** One exceptions surface; STAFF never sees revenue chart; Restricted tile copy unchanged; refresh is a refresh icon.

## `/pos` — P0
- **Goal:** Record a completed sale without leaving the counter.
- **Problem:** Starting-from services use `window.prompt` (blocked/ugly/not RTL).
- **Required:** Catalog, cart, customer, specialist, tender, visit context, receipt.
- **Improved:** Same split layout. Branded Modal for custom price.
- **Acceptance:** Fixed-price add unchanged; starting-from opens Modal; validation kept; checkout tests pass.

## `/customers` — P1
- **Goal:** Find a client and open the passport.
- **Problem:** Two search boxes below `lg`; desktop rows `py-8`.
- **Improved:** Sticky search on small screens; denser table. Keep cards/passport/no-swipe.
- **Acceptance:** One search below `lg`; Add Customer dialog tests pass.

## `/expenses` — P1
- **Goal:** Log a cost quickly.
- **Problem:** Billboard density; OMR 2dp; month always `ar-OM`; `text-rose-500`.
- **Improved:** Keep table/cards. Compress. `formatOMRAmount`. Language locale. Semantic tokens.
- **Acceptance:** Add Expense dialog tests pass; 3 decimal OMR.

## `/gift-cards` — P1
- **Goal:** Sell a card, see remaining value.
- **Problem:** Inputs have placeholders only; 36px submit.
- **Improved:** Keep sell-form + list. Add labels, 44px, focus rings.
- **Acceptance:** Sell still goes through checkout issue path.

## `/services` `/inventory` `/employees` `/packages` `/settings` — P2
- 44px toggles; package field labels; settings chevron RTL.

## Keep as-is this round
Login, reports, appointments schedule (day/week already correct), action center structure, deferred routes, auth/RBAC.

## Global required states
Loading / empty / no results / error / success toast / unsaved confirm / permission redirect / offline banner. Do not invent charts for decoration.
