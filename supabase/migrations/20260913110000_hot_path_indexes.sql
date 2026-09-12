-- =============================================================================
-- LenaBeauty — indexes for the query paths that actually scan.
--
-- Phase 7 of the audit asked for "indexes for appointments.date_time queries".
-- Measured, that index already exists: `idx_appointments_dt (center_id,
-- date_time)` was created in the initial schema, and with 20 000 appointments
-- the planner uses it for every appointment path the app and the RPCs run
-- (list range, taken slots, double-booking check, staff day). Nothing is added
-- here for appointments.
--
-- What the same measurement found, on a database seeded with 20 000 customers,
-- 20 000 invoices, 20 000 appointments and 2 000 products, is two paths that
-- still scan the whole table:
--
--   * `SELECT id FROM customers WHERE center_id = $1 AND phone = $2 LIMIT 1`
--     → Seq Scan. This is the lookup behind the public booking page
--     (20260628000006 line 146) and both portal-login paths
--     (20260628000011 lines 40 and 86). Every anonymous booking and every client
--     login walks the entire client list. `idx_customers_center` only covers the
--     first column.
--
--   * `SELECT * FROM products WHERE center_id = $1 ORDER BY name LIMIT 200`
--     → Seq Scan + Sort. This is the POS/inventory catalogue list
--     (inventory.ts, reports.ts, settings.ts). `idx_products_center` finds the
--     rows but cannot supply the order, so every catalogue load sorts.
--
-- The `ILIKE '%…%'` client search is deliberately NOT addressed here: a leading
-- wildcard cannot use a btree index. It needs a `pg_trgm` GIN index, which
-- requires enabling an extension and qualifying the operator class across the
-- PGlite harness, the migration chain and the live project. At salon scale the
-- scan is a few hundred rows and the real cost is elsewhere — the POS fires that
-- search twice per keystroke, which is fixed in the page, not in the database.
-- Recorded as a lean item with its evidence rather than half-shipped: the plans
-- are locked by `src/__tests__/query-plans.test.mjs`.
-- =============================================================================

BEGIN;

-- The equality lookup on the hottest anonymous path there is: a client typing
-- her phone number into #/book, or logging into the portal.
CREATE INDEX IF NOT EXISTS idx_customers_center_phone
  ON public.customers (center_id, phone);

-- Catalogue listing, ordered: lets the planner read the rows in name order
-- instead of scanning and sorting.
CREATE INDEX IF NOT EXISTS idx_products_center_name
  ON public.products (center_id, name);

COMMENT ON INDEX public.idx_customers_center_phone IS
  'Serves the center+phone equality lookups in public_create_booking_v1 and the portal-login functions.';

COMMENT ON INDEX public.idx_products_center_name IS
  'Serves the ordered catalogue list (POS, inventory, reports) instead of Seq Scan + Sort.';

COMMIT;
