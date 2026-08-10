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
| Dashboard/Sales/Reports | paid invoices and their original persisted lines; never fabricated UI data |

Authenticated clients can read invoices, lines, and payments but cannot write financial records directly. All checkout effects—invoice, lines, stock, gift card, payment, and customer aggregates—commit together or roll back together.

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
