# 02 — Contract Matrix

Cross-reference of frontend/application database usage against the replayed schema, plus
the RLS operation matrix and the RPC privilege/grant matrix. Machine-readable source:
`artifacts/contract-matrix.json` + `artifacts/frontend-usage.json`.

## Frontend usage summary

Scanned 193 `src/**/*.{ts,tsx}` files:

| Surface | Count |
| --- | --- |
| Tables read/written via `.from()` | 27 |
| RPCs invoked via `.rpc()` | 22 (20 static + 2 dynamic-dispatch) |
| Storage buckets via `.storage.from()` | 1 (`center-assets`) |
| Manual-review items | 1 (documented non-Supabase `.from()` match) |

## Table resolution

All 27 referenced tables exist in the replayed schema. No missing tables or columns.

## Nested embed FK resolvability (PostgREST)

Every nested embed the frontend requests resolves against a real foreign key.

| Parent → embed | Direction | Resolvable |
| --- | --- | --- |
| `appointments` → `customers` / `employees` / `services` | to-one | ✅ |
| `center_memberships` → `centers` | to-one | ✅ |
| `customer_entitlements` → `customers` / `service_packages` / `gift_cards` / `invoices` / `package_entitlement_units` | to-one/to-many | ✅ |
| `entitlement_ledger` → `employees` / `invoices` | to-one | ✅ |
| `invoice_items` → `services` / `products` / `service_packages` / `gift_cards` | to-one | ✅ |
| `invoices` → `employees` / `customers` | to-one | ✅ |
| `invoices` → `invoice_items` | to-many | ✅ |
| `services` → `service_categories` | to-one | ✅ |
| `service_files` → `service_file_images` | to-many | ✅ |
| `service_packages` → `service_package_items` | to-many | ✅ |

Nested (depth-2) embeds — e.g. `customer_entitlements → package_entitlement_units →
services`, and `invoices → invoice_items → {services, products, service_packages,
gift_cards}` — are also parsed and resolve.

Notable syntax handled (and verified) by the scanner: `'*'`, `'*, relation(col)'`,
column-alias embed `'*, images:service_file_images(*)'`, join hints `relation!inner(col)`,
`::cast` suffixes, constant-backed selects (`ENTITLEMENT_SELECT`), and a TypeScript
string-literal-union dynamic RPC dispatcher (`runGovernedRpc` → `void_entitlement_v1` /
`expire_entitlement_v1`).

## RLS operation matrix (summary)

For every frontend-used table, `contract-matrix.json → rls` records `rls_enabled`,
`rls_forced`, per-operation policies (SELECT/INSERT/UPDATE/DELETE/ALL) with their `using`
and `with_check` expressions, `membership_only` classification, and `missing_operations`.

| Table | RLS | Policy model |
| --- | --- | --- |
| `appointments`, `customers`, `employees`, `services`, `products`, `expenses` | ✅ | single `FOR ALL TO public` + `is_center_member(center_id)` |
| `invoices`, `payments`, `gift_cards`, `service_packages` | ✅ | `FOR ... TO authenticated` per operation |
| `center_settings` | ✅ | SELECT `TO public` + INSERT/UPDATE `TO authenticated` + `ALL` |
| **`attendance_records`, `employee_advances`, `payroll_runs`, `payroll_line_items`** | ✅ | **single `FOR ALL` + `is_center_member` (any center member can mutate payroll — DB-005)** |

Key gap: most tenant policies authorize by **center membership only**
(`app_private.is_center_member(center_id)`) and do not require a **governed role**
(ADMIN/MANAGER). This is acceptable for ordinary business data but is an unresolved security
gap for the four sensitive payroll tables (DB-005).

## RPC grant matrix (role names)

All 22 frontend-referenced RPCs are `SECURITY DEFINER` with a pinned `search_path`. EXECUTE
grants are resolved to role names:

| Group | RPCs | EXECUTE roles | Verdict |
| --- | --- | --- | --- |
| Staff UI | `process_checkout_v1`, `upsert_*`, `create_*`, `mark_appointment_no_show_v1`, `issue_gift_card_v1`, `refund_entitlement_v1`, `void_entitlement_v1`, `expire_entitlement_v1`, `rotate_customer_portal_token_v1`, `create_accounting_journal_entry_v1`, `create_ai_booking_lead_v1` | `authenticated` | ✅ |
| Public booking/portal | `public_*_v1` (9 RPCs) | owner only (no `anon`/`authenticated`) | ⚠️ **no client grant (DB-006)** |

`process_checkout_v1` and the public/portal functions are checked **per overload**
(signature-level), matching the explicit grants in `20260810000006_security_grant_repair.sql`.

## Storage contract

- Bucket `center-assets` — referenced by `Settings.uploadLogo`; exists in the canonical
  seed (`INSERT INTO storage.buckets`). ✅
- Storage RLS policies `center_assets_read/write/update` exist on `storage.objects`. ✅
  (Storage **policy/bucket contracts** are only confirmed against the canonical SQL, not a
  live bucket — see scanner limitations below.)

## Data-layer typing

`src/infrastructure/supabase/client.ts` constructs the client **without** a `Database`
generic, and repository results are consumed as `any`. No committed generated types. See
`03` (DB-004).

## Scanner limitations (manual-review / unresolved bucket)

`frontend-usage.json → manual_review` lists constructs the scanner cannot prove, and these
surface as INFO findings in `03`. Confirmed limitations:

- **Dynamic table/RPC names** — `.from(<variable>)` / `.rpc(<variable>)` are not resolvable
  statically. (One non-Supabase `html2pdf .from(element)` match is recorded as a documented
  false positive; a genuine TS union dispatcher was resolved.)
- **Aliases / multiple clients** — the scanner follows `.from/.select/.rpc` chains and
  resolves `supabase.storage.from`; it does not distinguish multiple client *instances*.
- **PostgREST embedded relationships** — resolved via FK lookup (depth 1 and 2).
- **Exact RPC overloads** — matched by name + signature; the frontend calls by name, and the
  matrix reports each overload's grants.
- **Storage policies / bucket contracts** — only the bucket *name* is scanned; bucket
  policies are confirmed against canonical SQL, not a live bucket.
- **RPC return shapes** — `jsonb`/`record` returns are untyped at rest (DB-013).

The audit therefore **does not claim complete frontend coverage**; regex/tokenizer matching
is bounded by these documented limitations.
