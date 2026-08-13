# 01 — Schema Inventory

Replayed local schema, extracted from the PGlite catalog after replaying the 28 automated
migrations. Machine-readable source: `artifacts/schema-inventory.json`.

## Totals

| Object | Count |
| --- | --- |
| Tables (base tables in `public` + `app_private`) | 33 |
| Columns | 357 |
| Enum types | 1 (`appointment_status`, 4 labels) |
| Constraints (PK / UNIQUE / CHECK / NOT NULL) | 373 |
| Foreign keys | 77 |
| Indexes | 95 |
| Triggers | 22 |
| Views | 0 |
| Functions (`public` + `app_private`) | 38 |
| RLS policies | 66 |
| Grants (expanded ACL entries) | 1094 |

> Constraint/check totals are high because `20260628000016_validation_constraints.sql` and
> `20260810000002_operational_data_integrity.sql` add a large number of `NOT VALID` CHECK
> constraints (a deliberate pattern — see `03_VERIFIED_DRIFT_REGISTER.md`).

## Tables (33)

All are in schema `public`:

`accounting_journal_entries`, `ai_booking_leads`, `appointments`, `attendance_records`,
`center_memberships`, `center_settings`, `centers`, `customer_entitlements`,
`customer_notification_timeline`, `customer_reviews`, `customers`, `employee_advances`,
`employees`, `entitlement_ledger`, `expenses`, `gift_card_transactions`, `gift_cards`,
`invoice_items`, `invoices`, `notification_settings`, `package_entitlement_units`,
`payment_gateway_settings`, `payments`, `payroll_line_items`, `payroll_runs`, `products`,
`profiles`, `service_categories`, `service_file_images`, `service_files`,
`service_package_items`, `service_packages`, `services`.

## Enum types

| Enum | Labels |
| --- | --- |
| `appointment_status` | `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |

(Other “status”-like fields are plain `TEXT` with `CHECK` constraints, e.g.
`invoices_status_valid`, `payments_status_valid`.)

## Functions (38)

RPC functions exposed on `public` (all `SECURITY DEFINER`):

| Function | Returns | Notes |
| --- | --- | --- |
| `process_checkout_v1` | jsonb | core checkout |
| `create_accounting_journal_entry_v1` | jsonb | |
| `create_ai_booking_lead_v1` | jsonb | |
| `create_customer_review_v1` | jsonb | |
| `create_service_file_v1` | jsonb | |
| `create_service_package_v1` | jsonb | |
| `expire_entitlement_v1` | jsonb | |
| `issue_gift_card_v1` | jsonb | |
| `mark_appointment_no_show_v1` | jsonb | |
| `public_cancel_booking_v1` | jsonb | |
| `public_center_info_v1` | **record** | shape not in a type |
| `public_client_portal_login_v1` | jsonb | |
| `public_client_portal_profile_v1` | jsonb | legacy; frontend uses `_v2` |
| `public_client_portal_profile_v2` | jsonb | |
| `public_create_booking_v1` | jsonb | |
| `public_list_services_v1` | **record** | shape not in a type |
| `public_list_staff_v1` | **record** | shape not in a type |
| `public_reschedule_booking_v1` | jsonb | |
| `public_taken_slots_v1` | **record** | shape not in a type |
| `refund_entitlement_v1` | jsonb | |
| `rotate_customer_portal_token_v1` | jsonb | |
| `upsert_notification_settings_v1` | jsonb | |
| `upsert_payment_gateway_settings_v1` | jsonb | |
| `void_entitlement_v1` | jsonb | |
| `add_customer_notification_event_v1` | jsonb | |

Private helpers in `app_private` (not callable over PostgREST):

`is_center_member`, `user_center_ids`, `tier_discount_percent`, `storage_path_center_id`,
and trigger functions `enforce_appointment_integrity_v1`/`_v2`,
`maintain_entitlement_balance_v1`, `set_gift_card_updated_at`,
`set_notification_settings_updated_at`, `set_payment_gateway_settings_updated_at`,
`set_service_package_updated_at` (plus `public.trigger_set_updated_at`,
`public.touch_updated_at_generic`).

> `public_*_v1` RPCs returning `record` (not `jsonb`) are a **contract risk**: the frontend
> reads them as untyped `any`, so their shape is enforced only at runtime (see finding
> `DB-003`).

## Views

None.

## Triggers (22, by table)

`accounting_journal_entries`, `ai_booking_leads`, `appointments` (2), `attendance_records`,
`center_settings`, `centers`, `customer_reviews`, `customers`, `employee_advances`,
`employees`, `entitlement_ledger`, `gift_cards`, `invoices`, `notification_settings`,
`payment_gateway_settings`, `payroll_line_items`, `payroll_runs`, `products`,
`service_files`, `service_packages`, `services`.

## Row-Level Security

`artifacts/schema-inventory.json` → `rls_enabled` records `relrowsecurity` /
`relforcerowsecurity` per table. Canonical migrations enable RLS on all multi-tenant
tables and attach 66 policies; storage policies (`center_assets_read/write/update`) are
declared on `storage.objects` (Supabase-managed, stubbed in replay).

## Canonical-only objects (not executable in PGlite)

| Object | Reason |
| --- | --- |
| Extension `pgcrypto` | only `gen_random_uuid()` used → PG-core |
| Extension `btree_gist` | Supabase-hosted; PGlite does not bundle it |
| Constraint `appointments_no_scheduled_staff_overlap` (EXCLUDE) | requires btree_gist gist `=` opclass |

These are preserved in `schema-inventory.json` → `canonical_only`, not lost by replay.

## Storage / data contracts referenced by the application

- Bucket `center-assets` (created by `20260623000001_initial_schema.sql`
  `INSERT INTO storage.buckets … ON CONFLICT DO NOTHING`); used by `Settings.uploadLogo`
  via `supabase.storage.from('center-assets')`.
- Policies `center_assets_read` / `center_assets_write` / `center_assets_update`
  (`FOR SELECT/INSERT/UPDATE TO authenticated`) in `20260628000001_enable_rls.sql` and
  re-declared in `20260810000005_security_hardening_auth.sql`.

See `02_CONTRACT_MATRIX.md` for how the frontend resolves against the above.
