# 01 — Schema Inventory

Replayed local schema, extracted from the PGlite catalog after the **first** application of
the 28 automated migrations (the canonical "migrations applied once" state). Machine-readable
source: `artifacts/schema-inventory.json`.

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
| Grants (expanded ACL entries, role names) | 1094 |

## Tables (33)

All in schema `public`:

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

Other "status"-like fields are plain `TEXT` with `CHECK` constraints (e.g.
`invoices_status_valid`, `payments_status_valid`).

## Functions (38) — with security posture

The inventory now records, per function: `security_definer`, `config` (`SET search_path`),
and `function_acl` (EXECUTE grants resolved to role names).

RPC functions on `public` (all `SECURITY DEFINER` with pinned
`search_path = pg_catalog, public, app_private` on first application):

`process_checkout_v1`, `create_accounting_journal_entry_v1`, `create_ai_booking_lead_v1`,
`create_customer_review_v1`, `create_service_file_v1`, `create_service_package_v1`,
`expire_entitlement_v1`, `issue_gift_card_v1`, `mark_appointment_no_show_v1`,
`public_cancel_booking_v1`, `public_center_info_v1`, `public_client_portal_login_v1`,
`public_client_portal_profile_v1`, `public_client_portal_profile_v2`,
`public_create_booking_v1`, `public_list_services_v1`, `public_list_staff_v1`,
`public_reschedule_booking_v1`, `public_taken_slots_v1`, `refund_entitlement_v1`,
`rotate_customer_portal_token_v1`, `upsert_notification_settings_v1`,
`upsert_payment_gateway_settings_v1`, `void_entitlement_v1`, `add_customer_notification_event_v1`.

Private helpers in `app_private`: `is_center_member`, `user_center_ids`,
`tier_discount_percent`, `storage_path_center_id`, and trigger functions
`enforce_appointment_integrity_v1`/`_v2`, `maintain_entitlement_balance_v1`,
`set_gift_card_updated_at`, `set_notification_settings_updated_at`,
`set_payment_gateway_settings_updated_at`, `set_service_package_updated_at` (plus
`public.trigger_set_updated_at`, `public.touch_updated_at_generic`).

### RPC return shapes

Several public RPCs return opaque `jsonb` or `record` (`public_center_info_v1`,
`public_list_services_v1`, `public_list_staff_v1`, `public_taken_slots_v1` return `record`).
These shapes are not captured by any committed type — see `03` (DB-004, DB-013).

### Function EXECUTE grants (role names)

- Staff-UI RPCs → `authenticated` (+ owner). ✅
- Public booking/portal RPCs (`public_*_v1`, `public_client_portal_*`) → **owner only**
  (no `anon`/`authenticated`), by design of `20260810000006_security_grant_repair.sql`. See
  DB-006.
- `app_private.maintain_entitlement_balance_v1` → retains default `PUBLIC` EXECUTE (DB-007).

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
`relforcerowsecurity` per table; `policies` records per-policy `roles`, `cmd`, `qual`
(USING) and `with_check`. See `02_CONTRACT_MATRIX.md` for the per-table operation matrix and
the payroll governance gap (DB-005).

## Canonical-only objects (not executable in PGlite)

| Object | Reason |
| --- | --- |
| Extension `pgcrypto` | only `gen_random_uuid()` used → PG-core |
| Extension `btree_gist` | Supabase-hosted; PGlite does not bundle it |
| Constraint `appointments_no_scheduled_staff_overlap` (EXCLUDE) | requires btree_gist gist `=` opclass |

Preserved in `schema-inventory.json` → `canonical_only`, not lost by replay.

## Storage / data contracts referenced by the application

- Bucket `center-assets` (created by `20260623000001_initial_schema.sql`
  `INSERT INTO storage.buckets … ON CONFLICT DO NOTHING`); used by `Settings.uploadLogo`
  via `supabase.storage.from('center-assets')`.
- Policies `center_assets_read` / `center_assets_write` / `center_assets_update`
  (`FOR SELECT/INSERT/UPDATE TO authenticated`) on `storage.objects`.
