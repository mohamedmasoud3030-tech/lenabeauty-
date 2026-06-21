# Supabase Setup Guide: Checkout Readiness

This guide explains how to manually configure your Supabase instance to support the Phase 5B checkout implementation.

## Pre-requisites

The application relies on the following environment variables (found in `src/config/env.ts`):
- `VITE_DATA_BACKEND=supabase`
- `VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY`
- `VITE_CENTER_ID=YOUR_CENTER_UUID`

## Applying the Checkout Schema

The application does **NOT** apply database schemas or migrations automatically. To unlock POS checkout, follow these steps:

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Apply `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` first if the project does not already have the Phase 10A base schema.
3. Apply `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql`.
4. Review the activation SQL, including:
   - `invoices` table creation.
   - `invoice_items` table creation.
   - `process_checkout_v1` RPC function creation.
   - RLS policies that allow reads by center membership while denying direct invoice writes.
   - Inventory validation that refuses product checkout when stock is insufficient.
5. Copy and paste the SQL into the SQL Editor.
6. Click **Run**.

## RLS Verification Checklist

Ensure you have established RLS policies so that users only see data for their `center_id`.
By default, the `process_checkout_v1` is created as `SECURITY DEFINER`, allowing it to bypass RLS to ensure consistency during the transaction, provided the payload validates the `center_id`.
The function validates that the authenticated user is an active member of the submitted `center_id` before creating invoices or decrementing product stock.

## Manual Test Example

Run the following inside the Supabase SQL editor to test if your checkout RPC was successfully deployed:

```sql
SELECT process_checkout_v1(
  'YOUR-CENTER-UUID',
  'A-VALID-CUSTOMER-UUID',
  NULL,
  'cash',
  0,
  false,
  '[{"type": "service", "serviceId": "A-VALID-SERVICE-UUID", "qty": 1, "price": 50}]'::jsonb
);
```

Once this function works successfully inside Supabase, the AI Studio web UI will gracefully switch from "Backend Required" to processing authentic POS transactions.
