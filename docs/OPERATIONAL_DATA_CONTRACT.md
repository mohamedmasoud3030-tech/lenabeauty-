# LenaBeauty operational data contract

## Source of truth

Supabase/PostgreSQL is authoritative. UI totals are previews only.

| Domain | Authoritative records / routine |
|---|---|
| Checkout | `public.process_checkout_v1` |
| Sale header | `invoices` where `status = 'PAID'` |
| Sold lines | `invoice_items` immutable catalog snapshots |
| Payment | `payments` where `status = 'SUCCEEDED'` (zero-payable invoices legitimately have no payment row) |
| Inventory | `products.stock_quantity`; decremented atomically by checkout only when `track_inventory = true` |
| Appointments | `appointments` plus `app_private.enforce_appointment_integrity_v1` |
| Customers | `customers`; spend/points/last visit updated in the same checkout transaction |
| Catalog | `service_categories`, `services`, `products`, `service_packages` and package items |
| Gift-card/package entitlement | `customer_entitlements` (purchase-specific, customer-owned, tenant-scoped) |
| Package sessions | `package_entitlement_units` (per included service, remaining = total − used) |
| Entitlement ledger | `entitlement_ledger` — immutable, append-only; every balance is derived from it |
| Governed lifecycle | `refund_entitlement_v1`, `void_entitlement_v1`, `expire_entitlement_v1` (actor + reason) |
| Dashboard/Sales/Reports | paid invoices and their original persisted lines; never fabricated UI data |

Authenticated clients can read invoices, lines, payments, and entitlements but cannot write financial records directly. All checkout effects—invoice, lines, stock, gift-card sale/redemption, entitlement ledger, payment, and customer aggregates—commit together or roll back together.

## Financial entitlements (gift cards and packages)

Accounting model (OMR, three decimals, no floats):

1. **Selling a gift card or package** records the payment collection normally
   (invoice + `payments` row) AND creates a deferred obligation:
   `customer_entitlements.original_value` = cash collected and a matching
   `ISSUE` ledger entry. It is **never** earned service revenue.
2. **Redeeming** at checkout consumes the obligation in the same transaction:
   a `REDEEM` ledger entry decreases the ledger-derived balance; the invoice
   records `gift_card_discount` (code-based gift cards) or
   `entitlement_redemption` (package sessions / entitlement-based redemptions)
   so the recognized service revenue is `total − tax + redemptions`.
3. **Refund / void / expiry** are governed, audited ledger entries
   (`REFUND`, `VOID`, `EXPIRY`) with an actor and reason. Only unused
   remaining value can be refunded. Expiry records the event but does
   **not** recognize breakage — no automatic policy exists; a future
   controlled policy hook can be added on top of the ledger.
4. **Every balance is ledger-derived.** `customer_entitlements.remaining_value`
   (and the legacy `gift_cards.current_balance` mirror) is rewritten only by
   the `app_private.maintain_entitlement_balance_v1` trigger on ledger INSERT.
   There is no UI-mutable balance: direct INSERT/UPDATE/DELETE on gift cards,
   gift-card transactions, entitlements, units, and the ledger is revoked.
5. **Idempotency:** one `ISSUE` per entitlement; one `REDEEM` per
   (entitlement, invoice); redemptions/refunds cannot exceed the remaining
   balance; package sessions are capped per service.

### Legacy data

Pre-migration gift cards are backfilled as `legacy_flag = true` entitlements
carrying **only their outstanding balance** as the opening ledger balance.
The original sale and prior redemptions are not fabricated; they remain
readable in `gift_card_transactions` and invoice history. Historical package
sales keep their original booking (retail lines on PAID invoices); they are
not rewritten. `issue_gift_card_v1` is deprecated (it never recorded a
payment) and now raises, directing operators to checkout.

### Report classification

- **Cash collected**: `payments` (`SUCCEEDED`) — also the sum of PAID invoice
  `total_amount`.
- **Earned service revenue**: invoice net before entitlement redemptions =
  `total_amount − tax + gift_card_discount + entitlement_redemption`
  (ledger-verified per invoice).
- **Deferred liability**: sum of `remaining_value` over entitlements not in
  (`REFUNDED`, `VOID`) — outstanding prepaid balance.
- **Redemptions**: `entitlement_ledger` `REDEEM` entries; invoices without
  ledger rows fall back to their legacy `gift_card_discount`.

## Financial formula

All money is OMR at three decimals:

1. Resolve fixed service/product/package prices from the database.
2. For a `STARTING_FROM` service, require a positive final price at least equal to its catalog minimum.
3. `subtotal = Σ(unit price × positive integer quantity)`.
4. Apply manual discount, automatic tier discount, whole loyalty points (1 point = 1 OMR), then gift-card redemption.
5. `tax = round(net × center tax rate / 100, 3)`.
6. `total = net + tax`; a successful payment equals total. If discounts make total zero, the paid invoice remains the transaction and no zero-value payment is written.

`invoices.discount` remains a compatibility aggregate of manual + tier + gift-card discounts. The detailed fields are canonical. Loyalty has its own field and `loyalty_points_used` compatibility value.

## Availability and lifecycle

- Disabled services cannot be booked or sold.
- Disabled products cannot be sold.
- Inventory-tracked products require sufficient stock and cannot go negative.
- Non-inventory products are sellable without stock decrement.
- Packages require a positive confirmed price, at least one component, and all included services active at sale time.
- New appointments start `SCHEDULED` and require a same-center customer, active service, active employee, and time.
- The service duration is snapshotted by the database when booked (and refreshed only when the appointment's service changes), so later catalog edits do not reinterpret old bookings.
- Half-open scheduled ranges `[start, start + duration)` for the same center/employee cannot overlap; the PostgreSQL exclusion constraint is safe under concurrent requests.
- Only `SCHEDULED → COMPLETED | CANCELLED | NO_SHOW` transitions are allowed.
- Completed, cancelled, and no-show appointments cannot be edited or deleted.

## Service catalog seed

`supabase/seeds/20260810_lena_service_catalog_demo.sql` contains the Arabic demo/staging catalog. It is intentionally excluded from migrations and requires explicit `demo`/`staging` session settings. It inserts no invented products, packages, customers, appointments, invoices, or payments. Prices must be reviewed with the operator before commercial activation.

## Deployment

No migration or seed in this change is applied remotely by the repository work. Apply the migration to staging, run the behavioral contract tests and live QA, obtain explicit production authorization, then apply it to production. See the paired rollback runbook under `supabase/rollbacks/`.
