# 02 — Contract Matrix

Cross-reference of frontend/application database usage against the replayed schema.
Machine-readable source: `artifacts/contract-matrix.json` + `artifacts/frontend-usage.json`.

## Frontend usage summary

Scanned 191 `src/**/*.{ts,tsx}` files:

| Surface | Count |
| --- | --- |
| Tables read/written via `.from()` | 27 |
| RPCs invoked via `.rpc()` | 20 |
| Storage buckets via `.storage.from()` | 1 (`center-assets`) |

## Table resolution

All 27 referenced tables exist in the replayed schema. No missing tables.

| Table | Status |
| --- | --- |
| `accounting_journal_entries`, `ai_booking_leads`, `appointments`, `attendance_records`, `center_memberships`, `center_settings`, `customer_entitlements`, `customer_reviews`, `customers`, `employee_advances`, `employees`, `entitlement_ledger`, `expenses`, `gift_card_transactions`, `gift_cards`, `invoice_items`, `invoices`, `notification_settings`, `payment_gateway_settings`, `payments`, `payroll_line_items`, `payroll_runs`, `products`, `service_categories`, `service_files`, `service_packages`, `services` | ✅ resolved |

## Nested embed FK resolvability (PostgREST)

Every nested embed the frontend requests resolves against a real foreign key.

| Parent → embed | Direction | Resolvable |
| --- | --- | --- |
| `appointments` → `customers` / `employees` / `services` | to-one | ✅ |
| `center_memberships` → `centers` | to-one | ✅ |
| `entitlement_ledger` → `employees` / `invoices` | to-one | ✅ |
| `invoice_items` → `services` / `products` / `service_packages` / `gift_cards` | to-one | ✅ |
| `invoices` → `employees` / `customers` | to-one | ✅ |
| `invoices` → `invoice_items` | to-many | ✅ |
| `services` → `service_categories` | to-one | ✅ |
| `service_files` → `service_file_images` | to-many | ✅ |
| `service_packages` → `service_package_items` | to-many | ✅ |

Two-level embeds (`invoices → invoice_items → {services, products, service_packages,
gift_cards}`) also resolve: `invoice_items` carries FKs to all four.

Notable syntax handled (and verified) by the scanner:
- star selects `'*'`
- `'*, relation(col)'`
- column-alias embed `'*, images:service_file_images(*)'`
- join hints `relation!inner(col)` (not currently used, but supported)
- `::cast` column suffixes

## RPC contract

All 20 RPCs invoked by the frontend have canonical `SECURITY DEFINER` definitions, and
every top-level argument the frontend passes matches a declared parameter name
(`p_*` convention). No missing or extra arguments were found.

| RPC | Args (frontend) | Declared | Result |
| --- | --- | --- | --- |
| `process_checkout_v1` | 9 (`p_center_id` … `p_entitlement_redemptions`) | 9 | ✅ |
| `upsert_payment_gateway_settings_v1` | 12 | 12 | ✅ |
| `upsert_notification_settings_v1` | 10 | 10 | ✅ |
| `create_service_file_v1` | 9 | 9 | ✅ |
| `create_accounting_journal_entry_v1` | 10 | 10 | ✅ |
| `create_ai_booking_lead_v1` | 7 | 7 | ✅ |
| `create_customer_review_v1` | 6 | 6 | ✅ |
| `create_service_package_v1` | 5 | 5 | ✅ |
| `mark_appointment_no_show_v1` | 4 | 4 | ✅ |
| `refund_entitlement_v1` | 4 | 4 | ✅ |
| `rotate_customer_portal_token_v1` | 2 | 2 | ✅ |
| `public_*` (7 portal RPCs) | 1–7 each | match | ✅ |

### RPC return-shape assumption (manual review)

Several RPCs return opaque `jsonb` or `record` and the frontend reads specific fields
(`row.invoice`, `row.total`, `row.earned`, `row.gift_card_redeemed`,
`row.entitlement_redeemed`, portal `record` shapes). These shapes are **not** captured by
any committed type. This is recorded as finding `DB-003` (untyped client), not as a
confirmed defect in any individual RPC — the shape can only be verified at runtime today.

## Storage contract

- Bucket `center-assets` — referenced by `Settings.uploadLogo`; exists in the canonical
  seed (`INSERT INTO storage.buckets`). ✅
- Storage RLS policies `center_assets_read/write/update` exist on `storage.objects`. ✅

## Data-layer typing

`src/infrastructure/supabase/client.ts` constructs the client **without** a `Database`
generic, and repository results are consumed as `any`. There are no `.returns<T>()`,
`.cast<T>()`, or committed generated types. See `03_VERIFIED_DRIFT_REGISTER.md` (`DB-003`).
