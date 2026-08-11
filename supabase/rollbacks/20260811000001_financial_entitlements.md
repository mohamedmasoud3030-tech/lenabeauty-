# Rollback runbook — `20260811000001_financial_entitlements.sql`

Scope: financial entitlements for gift cards and packages (customer
entitlements, package units, append-only entitlement ledger, extended
checkout RPC, governed refund/void/expiry RPCs, legacy gift-card backfill,
closed direct writes on gift-card balances).

## Read first

- This migration is **additive**: it creates new tables, adds columns, and
  re-creates `NOT VALID` constraints. It does **not** rewrite or delete
  historical business rows.
- The entitlement backfill inserts opening-balance ledger entries for
  pre-existing gift cards (marked `legacy_flag = true`). It is idempotent:
  re-running it inserts nothing new.
- **Do not** drop the new tables while a production day is in progress: the
  checkout RPC (new signature) writes to them on every gift-card/package sale
  and every redemption.

## Rollback path

1. Restore a verified pre-migration database backup (the only supported full
   rollback for a deployed financial migration).
2. If a full restore is not possible, the safe *partial* rollback is to
   disable the new behavior, not to drop objects:
   - Stop selling gift cards / packages through checkout until the app is
     downgraded (old `issue_gift_card_v1` is intentionally deprecated and
     raises).
   - The old 8-argument `process_checkout_v1` no longer exists; downgrade the
     deployed frontend to a build from before this migration, or redeploy the
     previous migration state from backup.
3. If you must drop the new objects (off-hours, with a verified backup):

```sql
BEGIN;
DROP TRIGGER IF EXISTS maintain_entitlement_balance_v1 ON public.entitlement_ledger;
DROP FUNCTION IF EXISTS public.expire_entitlement_v1(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.void_entitlement_v1(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID);
DROP TABLE IF EXISTS public.entitlement_ledger;
DROP TABLE IF EXISTS public.package_entitlement_units;
DROP TABLE IF EXISTS public.customer_entitlements;
COMMIT;
```

   This leaves `invoices.entitlement_redemption` and
   `invoice_items.gift_card_id` as unused nullable columns (harmless), and
   the re-created `NOT VALID` invoice/invoice-item constraints still accept
   the pre-migration shapes. Restore the pre-migration `process_checkout_v1`
   from `20260810000002_operational_data_integrity.sql` **after** restoring
   gift-card write access policies if the downgraded app needs them.
