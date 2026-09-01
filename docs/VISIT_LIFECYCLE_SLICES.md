# LENA Beauty — One Salon Operating System: Vertical-Slice Plan

Status: **Slices A–F implemented** — the Visit→POS→Checkout loop, Beauty
Passport, LENA Wallet, Service Recipes, Retention Engine and Action Center are
all shipped on `arena/01a05ac0-lenabeauty`. The canonical LENA Beauty Demo
schema has also received the visit/recipe migration and the feature-scoped
index hardening recorded below. This document records the slice plan and what
each slice actually shipped (which sometimes differs from the original plan:
where an existing repository read was sufficient, no new RPC was added).

This repository is being reshaped from six module-centric admin pages into one
salon operating system that follows the canonical journey:

```
Booking → Confirmation → Arrival → Service → Visit content → Complete →
Checkout → Payment → Reward/rebook → Retention
```

Each transformation ships as a **cohesive vertical slice** (domain → migration/RPC
→ repository port → adapter → page/mobile UI), never as a page-introducing PR.
Terminal appointment states (`COMPLETED`, `CANCELLED`, `NO_SHOW`) stay the only
terminal lifecycle; visit stages refine the *scheduled* segment only.

| Slice | Concept | Source modules today |
|---|---|---|
| A | Visit Foundation (Visit lifecycle) | `AppointmentsPage` |
| B | Beauty Passport | `CustomerExperiencePage` + `CustomersPage` |
| C | LENA Wallet | `GiftCardsPage` + `PackagesPage` + rewards + deposits |
| D | Service Recipes | `InventoryPage` (Product Inventory) |
| E | Retention Engine | Loyalty (tiers stay recognition-only) |
| F | Embedded Intelligence | `ForecastingPage` + `AdvancedAutomationPage` + `CustomerExperiencePage` |

---

## Cross-cutting rules (enforced, not aspirational)

- **Additive & reversible** migrations only; never rewrite historical financial rows.
- **Server-authoritative checkout**: `process_checkout_idempotent_v1` (SECURITY
  DEFINER) is the only writer of `invoices`, `payments`, `invoice_items`,
  `inventory_consumptions`, and the visit→`COMPLETED` transition.
- **OMR precision** stays `NUMERIC(12,3)`; negative-stock protection preserved.
- **Domain rules live in `src/domain/**`** (pure, unit-tested) **and in RPCs**,
  not only in React components.
- **No fake data/AI, no placeholders.** Every screen derives from real rows.
- **Mobile 375/390/430 px + desktop 1366×768/1440×900** for every touched surface.
- **No broken bookmarks**: navigation registry `src/app/navigation.ts` and route
  map `src/routes.tsx` stay consistent with any page rename/split.

---

## Slice A — Visit Foundation ✅

The operational visit lifecycle layered on top of scheduling.

**Domain** (`src/domain/`):
- `entities/index.ts`: additive `VisitStage` enum
  (`BOOKED, CONFIRMED, ARRIVED, IN_SERVICE, READY_FOR_CHECKOUT`); `Appointment.visitStage/startedAt/completedAt`; `Invoice.appointmentId`; `ServiceRecipe`, `ServiceRecipeItem`, `InventoryConsumption`.
- `visit.ts`: pure state machine — `effectiveVisitStage`, `allowedVisitStages`,
  `canTransitionVisit`, `primaryVisitAction`, `buildVisitContext`.
- `commerce.ts` (unchanged): checkout math remains the single pricing authority.

**Canonical migrations**:
- `supabase/migrations/20260901100838_visit_lifecycle_recipes.sql`
  - `visit_stage` enum + `appointments.visit_stage/started_at/completed_at`;
    `invoices.appointment_id`.
  - `service_recipes`, `service_recipe_items`, `inventory_consumptions` (+ RLS).
  - `transition_visit_v1` (server-enforced stage transitions).
  - `save_service_recipe_v1` (atomic recipe upsert with duplicate-product rejection).
  - `app_private.consume_invoice_recipes_v1` (idempotent consumption, keyed by
    `(invoice_id, service_id, product_id)`).
  - `process_checkout_idempotent_v1` gains `p_appointment_id`: when set, checkout
    stamps `invoices.appointment_id`, closes the visit (`SCHEDULED → COMPLETED`),
    and consumes recipes — atomically, idempotently, once.
- `supabase/migrations/20260901101133_visit_recipe_index_hardening.sql`
  - Adds the six feature-scoped foreign-key access-path indexes for service
    recipes, recipe items and inventory consumptions identified by the hosted
    performance advisor.

The migration versions above intentionally match the canonical LENA Beauty Demo
migration history. The database-contract replay discovers 39 migrations (38
automated + the explicitly excluded manual bootstrap), replays idempotently and
produces an identical schema fingerprint after repeat application.

**Ports/adapters/useCases**: `AppointmentRepository.transitionVisit`,
`CheckoutPayload.appointmentId`, `useCases.appointments.transitionVisit`,
`useCases.invoices.checkout` now threads `p_appointment_id`.

**UI**: `AppointmentsPage` shows the live visit stage and offers the
stage-driven primary action (`Check in → Start service → Finish service`),
powered by the server RPC.

**Closed in this branch** (Visit→POS→Checkout loop, A1–A5):
- `PosInvoicesPage` accepts `?appointment=<id>`, loads the authoritative visit,
  pre-fills customer/employee/service, passes `appointmentId` into `checkout`,
  and shows a compact visit-context banner; direct `/pos` walk-in is unchanged.
- `AppointmentsPage` hands off to `/pos?appointment=<id>` at
  `READY_FOR_CHECKOUT` via the router and no longer offers a direct "Complete
  Appointment" action for active visits (cancel/no-show remain).

---

## Slice B — Beauty Passport ✅

Permanent, composed salon memory of a customer — no new customer database.

- **Domain**: `passport.ts` (`composeBeautyPassport`, `composeVisitTimeline`,
  `composePassportSummary`), unit-tested.
- **Data**: reused existing reads — `customers.getHistory` (enriched select over
  appointments/invoices), `customers.getById`, `entitlements.listForCustomer`,
  `customerExperience.listServiceFiles`. No new RPC was needed.
- **Pages**: `CustomersPage` profile modal became the passport: header →
  relationship snapshot → next booking → retention → wallet → visit/service
  timeline with progressive disclosure.

---

## Slice C — LENA Wallet ✅

Unified projection over existing value instruments; **never a merged balance**.

- **Domain**: `wallet.ts` (`buildCustomerWallet`, `walletAvailableForCheckout`,
  `hasDuplicateRedemption`, `packageUnitsForService`), unit-tested.
- **Pages**: `PosInvoicesPage` checkout panel surfaces the wallet (gift cards,
  package sessions, rewards, deposit) and lets an operator apply a package
  session to a matching cart service via a unit redemption
  (`{ entitlementId, type: "units", serviceId, units: 1 }`). Server stays the
  accounting authority; entitlements are no longer filtered to `PACKAGE`.

---

## Slice D — Service Recipes ✅

From product inventory to what a *service* consumes while delivered.

- **Domain**: `recipe.ts` (`planRecipeConsumption`, `estimateServiceContribution`,
  `visitMayHaveConsumed`, `forecastBookingDemand`), unit-tested.
- **Ports/adapter**: new `ServiceRecipeRepository` (`getForService`,
  `saveForService`, `listConsumptions`); Supabase adapter reads
  `service_recipes`/`service_recipe_items`/`inventory_consumptions` and calls
  `save_service_recipe_v1` (real products only, quantity/unit validation,
  whole-unit stock decrement + fractional costing documented server-side).
- **Pages**: `ServicesPage` gained a per-service recipe editor (product,
  quantity, unit, estimated cost, live stock, recent consumption ledger).

---

## Slice E — Retention Engine ✅

Deterministic rebooking signals from real visit history; no probabilities.

- **Domain**: `retention.ts` (`getRetentionStatus`, `getSuggestedRebookingWindow`,
  `getNextBestCustomerAction`, `getCustomerVisitPattern`), unit-tested. Tier
  model (`loyalty.ts`) stays recognition/status — no financial regression.
- **Pages**: passport retention panel now shows the status badge, last visit,
  days since, usual cadence, rebooking window, future-booking presence, the
  next-best action (rebook/contact/book-next) and any legitimate wallet benefit.

---

## Slice F — Action Center ✅

Deterministic "what needs attention now?" view; not analytics.

- **Pages**: new `ActionCenterPage` at `/action-center` (registered in
  `src/app/navigation.ts` and `src/routes.tsx`, reachable on mobile via the
  More menu). Sections derive strictly from real data: customers due/overdue
  for rebooking (`retention.ts`), today's arrivals, visits ready for checkout,
  open visit states from previous days (exceptions), consumables at risk from
  recipes+bookings (`forecastBookingDemand`), and wallet/entitlement expiry
  within 30 days. Empty state is honest ("nothing needs attention").

- **No new RPCs were added in B–F**: each slice composed over existing
  repository reads, per the "reuse before parallel architecture" rule.

---

## Quality gates

The canonical closure sequence is:

```
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
npm run audit:gate      # replay + frontend scan + matrix + stale-artifact check
npm run db:types:check
npm run ci:rpc-check
npm run ci:migrations
npm audit --audit-level=low
```

The old 25-test / single-lint baseline was **not** accepted as debt inside this
slice. It was proven on the former `main`, repaired independently in PR #53,
and merged to `main` at `df15847459914d15ee4dc14a62118b77be65356e` before
PR #52 was rebased. No tests, lint rules or canonical gates were weakened.

The database-contract artifacts are regenerated from the final canonical
migration chain. The hosted LENA Beauty Demo (`tuzzvqsnbtzvkffmazyf`) has the
matching visit/recipe and index-hardening migration versions applied; RLS,
SECURITY DEFINER search paths, grants/revokes, function signatures, constraints
and the new indexes were inspected on the hosted schema.
