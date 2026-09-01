# LENA Beauty — One Salon Operating System: Vertical-Slice Plan

Status: **Slice A foundation implemented** (this session); B–F planned below.

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

## Slice A — Visit Foundation ✅ (foundation merged this session)

The operational visit lifecycle layered on top of scheduling.

**Domain** (`src/domain/`):
- `entities/index.ts`: additive `VisitStage` enum
  (`BOOKED, CONFIRMED, ARRIVED, IN_SERVICE, READY_FOR_CHECKOUT`); `Appointment.visitStage/startedAt/completedAt`; `Invoice.appointmentId`; `ServiceRecipe`, `ServiceRecipeItem`, `InventoryConsumption`.
- `visit.ts`: pure state machine — `effectiveVisitStage`, `allowedVisitStages`,
  `canTransitionVisit`, `primaryVisitAction`, `buildVisitContext`.
- `commerce.ts` (unchanged): checkout math remains the single pricing authority.

**Migration** (`supabase/migrations/20260901000001_visit_lifecycle_recipes.sql`):
- `visit_stage` enum + `appointments.visit_stage/started_at/completed_at`;
  `invoices.appointment_id`.
- `service_recipes`, `service_recipe_items`, `inventory_consumptions` (+ RLS).
- `transition_visit_v1` (server-enforced stage transitions).
- `save_service_recipe_v1` (atomic recipe upsert).
- `app_private.consume_invoice_recipes_v1` (idempotent consumption, keyed by
  `(invoice_id, service_id, product_id)`).
- `process_checkout_idempotent_v1` gains `p_appointment_id`: when set, checkout
  stamps `invoices.appointment_id`, closes the visit (`SCHEDULED → COMPLETED`),
  and consumes recipes — atomically, idempotently, once.

**Ports/adapters/useCases**: `AppointmentRepository.transitionVisit`,
`CheckoutPayload.appointmentId`, `useCases.appointments.transitionVisit`,
`useCases.invoices.checkout` now threads `p_appointment_id`.

**UI**: `AppointmentsPage` shows the live visit stage and offers the
stage-driven primary action (`Check in → Start service → Finish service`),
powered by the server RPC.

**Remaining for Slice A** (next increment, not merged):
- `PosInvoicesPage` accepts `?appointment=<id>`, pre-fills the cart from the
  visit, and passes `appointmentId` into `checkout` (checkout→payment→closure).
- Terminal "Complete Appointment" button retirement once the POS handoff lands
  (guarded by the `appointments-ux` test update).

---

## Slice B — Beauty Passport

Permanent, composed salon memory of a customer — no new customer database.

- **Domain**: `passport.ts` already ships `composeBeautyPassport`,
  `composeVisitTimeline`, `composePassportSummary` (appointments + paid invoices
  + service files → timeline + operational summary). Unit-tested.
- **Migration**: additive (no schema change required) — a `customer_passport_v1`
  RPC that returns the composed history in one server round-trip (appointments,
  paid invoices, service files, next appointment, lifetime spend) scoped by
  `app_private.is_center_member`.
- **Ports**: extend `CustomerRepository` (or a new `PassportRepository`) with
  `getPassport(customerId)`; adapter calls the RPC; DTO added in
  `src/application/dto/index.ts`.
- **Pages**: `CustomersPage` becomes the passport host (customer profile →
  timeline, service history, media, wallet summary, retention status).
  `CustomerExperiencePage` (deferred) contributes reviews/service files once
  un-deferred or folded into the passport.

---

## Slice C — LENA Wallet

Unified projection over existing value instruments; **never a merged balance**.

- **Domain**: `wallet.ts` already ships `buildCustomerWallet`,
  `walletAvailableForCheckout`, `hasDuplicateRedemption`,
  `packageUnitsForService` (gift cards, package sessions, rewards, deposit kept
  distinct). Unit-tested.
- **Migration**: no new financial tables; wallet is a projection. Add a
  `customer_wallet_v1` RPC returning the customer's usable entitlements +
  points + deposit (server-authoritative remaining values/units).
- **Ports**: `EntitlementRepository.listForCustomer` already exists; add
  `CustomerRepository.getWallet` (or reuse listForCustomer + loyalty fields).
- **Pages**: `PosInvoicesPage` shows available wallet benefits per cart service
  (`walletAvailableForCheckout`); `GiftCardsPage`/`PackagesPage` become the
  wallet issuance/ledger surface rather than separate modules.

---

## Slice D — Service Recipes

From product inventory to what a *service* consumes while delivered.

- **Domain**: `recipe.ts` already ships `planRecipeConsumption`,
  `estimateServiceContribution`, `visitMayHaveConsumed`,
  `forecastBookingDemand`. Unit-tested.
- **Migration**: done in Slice A (`service_recipes`, `service_recipe_items`,
  `inventory_consumptions`, `save_service_recipe_v1`,
  `consume_invoice_recipes_v1`).
- **Ports**: new `RecipeRepository` (`list`, `getForService`, `save`); adapter
  reads the new tables + calls `save_service_recipe_v1`; DTO for the recipe
  payload.
- **Pages**: `InventoryPage` becomes Service Consumption — recipe editor per
  service (product, quantity, unit, estimated cost) + consumption ledger +
  "what do the next N days' bookings consume" (`forecastBookingDemand`).

---

## Slice E — Retention Engine

Deterministic rebooking signals from real visit history; no probabilities.

- **Domain**: `retention.ts` already ships `getRetentionStatus`,
  `getSuggestedRebookingWindow`, `getNextBestCustomerAction`,
  `getCustomerVisitPattern`. Unit-tested. Tier model (`loyalty.ts`) stays
  recognition/status — no financial regression.
- **Migration**: `customer_retention_v1` RPC returning the retention status +
  rebooking window for a customer (optionally per service), computed server-side
  from `appointments` + paid `invoices`.
- **Ports**: extend `CustomerRepository` (or `RetentionRepository`).
- **Pages**: passport header chip + `CustomersPage` "Next best action"
  (`REBOOK`/`CONTACT`/`BOOK_NEXT`/`NONE`), never a fabricated recommendation.

---

## Slice F — Embedded Intelligence

Forecasting/Automation/CE absorbed into the operating system instead of being
separate Growth modules.

- **Domain**: `recipe.ts.forecastBookingDemand` (deterministic inventory demand
  from booked services) + `retention.ts` signals feed an "Action Center".
- **Migration**: additive — expose existing forecast/insight data through
  `is_center_member`-gated RPCs (no new raw analytics tables until a need is
  proven).
- **Pages**: the Dashboard "Needs Attention" seed (late appointments + low
  stock, already implemented) becomes the Action Center. Deferred
  `ForecastingPage`/`AdvancedAutomationPage` contribute their real data sources
  or are removed from the registry (`src/app/navigation.ts` `deferred` flags).

---

## Quality gates (run before any PR)

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
```

**Known pre-existing baseline failures** (present on `main` before this work;
not introduced here, tracked separately):

- `npm test`: 25/780 tests across 7 files —
  `first-impression`, `first-impression-readout`, `i18n.no-language-leak`,
  `pages-smoke`, `payment-gateway-scope`, `settings-consolidation`,
  `vat-settings` (login-page content drift, untranslated `NotificationSystem`
  strings, settings error-recovery assertions).
- `npm run lint`: `src/shared/components/NotificationSystem.tsx:93` — button
  touch target below 44px.

These are independent of the six transformations and should be triaged as a
dedicated hygiene PR rather than folded into a slice.
