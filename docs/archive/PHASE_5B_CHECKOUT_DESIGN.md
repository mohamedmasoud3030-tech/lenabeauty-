# Phase 5B Checkout Design

> Current source of truth: v1.0 supports only `VITE_DATA_BACKEND=supabase`. Any checkout work remains v1.1 scope unless explicitly moved by a later product decision.

## Environment Variables
The application strictly depends on the following environment variables (found in `src/config/env.ts`):
- `VITE_DATA_BACKEND`: Must be `supabase` for the released v1.0 PWA.
- `VITE_SUPABASE_URL`: Supabase URL for initialization.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon key.
- `VITE_CENTER_ID`: Strict UUID defining the single-branch tenant context.
- `VITE_BRANCH_MODE`: Indicates single-branch or multi-branch mode (currently hardcoded as "single").

## Current Domain Snapshot
### CheckoutPayload
The `CheckoutPayload` specifies:
```typescript
{
  customerId: string;
  employeeId?: string; // Optional
  discountAmount?: number;
  useLoyaltyPoints?: boolean;
  paymentMethod: "cash" | "card" | "transfer";
  items: Array<{
     type: "service" | "product";
     serviceId?: string;
     productId?: string;
     qty: number;
     price: number;
  }>
}
```

### Supported Entities
The app depends on a few mapped interfaces:
- `Invoice`: Maps to `invoices` with `totalAmount`, `discount`, `loyaltyPointsUsed`, `paymentMethod`, `customerId`.
- `InvoiceItem`: Maps to lines with `invoiceId`, `serviceId`, `productId`, `price`, `quantity`.

## Current Supabase Schema Audit
There are no defined SQL migrations or schema definitions located inside the project repository for Supabase (e.g., no `/supabase/migrations/*.sql` files).
The existing repository files (`src/infrastructure/supabase/repositories.ts`) query arbitrary tables: `services`, `customers`, `appointments`.
We can safely assume that we need backing tables for invoicing, however their exact definition in the live Supabase project is unknown.

### Specifically Missing / Uncertain:
- `invoices` table presence.
- `invoice_items` or `invoice_lines` presence.
- `payments` table (the entity only supports a `paymentMethod` string directly on the `Invoice` currently, implying maybe there is no separate payment ledger table).
- Safe transactional decrement logic for `stock_quantity` on a `products` table.

## Minimum Safe Checkout Transaction Design
If we are to implement `checkout` using the `supabase-js` client, doing it client-side involves 3-4 separate network calls, which breaks atomicity:
1. Insert `invoices` row.
2. Insert `invoice_items` rows.
3. Decrement `stock_quantity` iteratively via updates for product line items.

Because client-side transactions are impossible in PostgREST/Supabase RPC is strictly required to handle POS safely.

### Required RPC Structure
**Name:** `process_checkout_v1`
**Parameters:**
- `p_center_id` (uuid)
- `p_customer_id` (uuid)
- `p_employee_id` (uuid, optional)
- `p_payment_method` (text)
- `p_discount_amount` (numeric)
- `p_items` (jsonb array containing type, id, qty, price)

**Logic:**
1. Check `center_id` exists.
2. Calculate total based on passed `p_items` prices * quantities minus `p_discount_amount`.
3. Verify product stocks are sufficient for requested quantities (FAIL if out of stock).
4. Insert into `invoices` returning ID.
5. Insert into `invoice_items` mapping the parent invoice ID.
6. For each product item, execute `UPDATE products SET stock_quantity = stock_quantity - item.qty WHERE id = item.id`.
7. Return `{ invoice: resulting_invoice, total: number }`.

## Implementation Readiness
**Status:** BLOCKED

**Reason:** We do not have the ability to run database migrations, and a complex checkout cannot be done cleanly without an RPC. Even if we attempt client-side inserts into `invoices` and `invoice_items`, the absence of known schema definitions for `invoices` runs the risk of hard-crashing.

We will keep `Invoice.checkout` safely returning `BACKEND_METHOD_UNSUPPORTED` in `SupabaseInvoiceAdapter` until a Supabase admin applies the schema + RPC and unblocks the client hook.
