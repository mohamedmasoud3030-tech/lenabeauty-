# Rollback — `20260810000002_operational_data_integrity.sql`

This migration is additive and deliberately does not rewrite production business rows. Do **not** drop its columns or `payments` table after any checkout has used the new contract: that would destroy the financial audit trail.

## Preferred rollback (safe, no data loss)

1. Stop POS writes / put the application in maintenance mode.
2. Re-deploy the application revision immediately before this migration.
3. Restore `public.process_checkout_v1` from the previous canonical migration, `20260810000001_fix_invoice_items_packages.sql`, in a staging transaction first.
4. Restore the previous `invoices_tenant` and `invoice_items_tenant` policies from `20260628000001_enable_rls.sql` **only if** the old application truly needs direct writes. Keeping the new read-only financial policies is safer.
5. Leave these additive objects in place: `payments`, `service_categories`, new invoice breakdown columns, catalog snapshot columns, product flags, and service pricing fields. Older code ignores them.
6. Remove `enforce_appointment_integrity_v1` only if the old appointment writer cannot satisfy the now-documented relationship/state contract:

   ```sql
   BEGIN;
   DROP TRIGGER IF EXISTS enforce_appointment_integrity_v1 ON public.appointments;
   -- Keep the function for audit/re-activation; it is inert without the trigger.
   COMMIT;
   ```

7. Re-run financial and appointment smoke checks before re-opening POS.

## Catalog seed rollback

The catalog seed is not a migration and is blocked outside `demo`/`staging`. If it must be withdrawn, **disable** its rows rather than deleting anything referenced by appointments or invoices:

```sql
UPDATE public.services
SET is_active = false, updated_at = now()
WHERE center_id = 'DEMO-CENTER-UUID'::uuid
  AND catalog_code IN (
    'HAIR-CUT','HAIR-BLOWDRY-SHORT','HAIR-BLOWDRY-MEDIUM','HAIR-BLOWDRY-LONG',
    'HAIR-STYLE','HAIR-ROOT-COLOR','HAIR-FULL-COLOR','HAIR-HIGHLIGHTS',
    'HAIR-KERATIN','HAIR-OIL-TREATMENT','NAIL-MANICURE','NAIL-PEDICURE',
    'NAIL-POLISH','NAIL-GEL-HANDS','NAIL-GEL-FEET','NAIL-GEL-REMOVAL',
    'FACE-CLEAN-BASIC','FACE-CLEAN-DEEP','FACE-BROWS-THREAD','FACE-UPPER-LIP',
    'FACE-FULL-THREAD','WAX-UNDERARMS','WAX-ARMS','WAX-LEGS','WAX-FULL-BODY',
    'MAKEUP-SOFT','MAKEUP-EVENING','MAKEUP-BRIDAL','HENNA-HANDS','HENNA-FEET',
    'HENNA-BRIDAL'
  );
```

## Destructive down migration

A destructive down migration is intentionally not supplied. Dropping payment or invoice-breakdown data is not an acceptable operational rollback. If a full physical reversal is legally required, restore a verified pre-migration database backup instead.
