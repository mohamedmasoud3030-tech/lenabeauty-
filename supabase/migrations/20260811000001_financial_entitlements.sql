-- =============================================================================
-- LenaBeauty — Financial entitlements for gift cards and packages
-- -----------------------------------------------------------------------------
-- Turns gift cards and packages from "discount-like" retail lines into real
-- customer entitlements backed by an immutable, append-only ledger.
--
-- Accounting model (OMR, three decimals, no floats):
--   * Selling a gift card or package records the payment collection on an
--     invoice AND creates a deferred (unearned) obligation:
--       customer_entitlements.original_value = cash collected
--       entitlement_ledger  ISSUE   = original_value   (balance += amount)
--   * Redeeming at checkout consumes the obligation in the SAME transaction
--     as the invoice / payment / inventory effects:
--       entitlement_ledger  REDEEM  = covered value    (balance -= amount)
--       invoices.entitlement_redemption / gift_card_discount document it
--   * Refund / void / expiry are governed, audited ledger entries; breakage
--     is NOT auto-recognized anywhere (no product/legal policy exists yet —
--     see the reserved EXPIRY entry type below).
--
-- Every balance (customer_entitlements.remaining_value and the legacy
-- gift_cards.current_balance mirror) is derived from the ledger by a trigger.
-- There is no UI-mutable balance column anymore: direct writes to the
-- entitlement tables are impossible (RLS select-only + revoked grants), and
-- direct writes to gift_cards / gift_card_transactions are revoked too.
--
-- Legacy data:
--   * Existing gift cards are backfilled as legacy_flag=true entitlements
--     carrying ONLY their outstanding balance as the opening ledger balance.
--     The original sale and prior redemptions are NOT fabricated; they remain
--     readable in gift_card_transactions and the invoice history.
--   * Historical package sales stay exactly as originally booked (retail
--     lines on PAID invoices). No historical rows are rewritten.
--   * issue_gift_card_v1 is deprecated: it never recorded a payment, so it
--     now raises and directs operators to checkout, where the collection is
--     booked atomically with the obligation.
--
-- Idempotency / duplicate protection:
--   * one ISSUE entry per entitlement
--   * one REDEEM entry per (entitlement, invoice) — a retry cannot
--     double-consume an entitlement on the same invoice
--   * REDEEM/REFUND cannot exceed the ledger-derived remaining balance
--   * per-service unit caps on package entitlements
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Customer entitlements (purchase-specific instruments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_entitlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_id      UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  kind             TEXT NOT NULL,
  gift_card_id     UUID REFERENCES public.gift_cards(id) ON DELETE RESTRICT,
  package_id       UUID REFERENCES public.service_packages(id) ON DELETE RESTRICT,
  source_invoice_id UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
  original_value   NUMERIC(12,3) NOT NULL,
  remaining_value  NUMERIC(12,3) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at       TIMESTAMPTZ,
  legacy_flag      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_entitlements_kind_valid
    CHECK (kind IN ('GIFT_CARD', 'PACKAGE')),
  CONSTRAINT customer_entitlements_status_valid
    CHECK (status IN ('ACTIVE', 'PARTIALLY_REDEEMED', 'FULLY_REDEEMED',
                      'EXPIRED', 'REFUNDED', 'VOID')),
  CONSTRAINT customer_entitlements_single_instrument
    CHECK (num_nonnulls(gift_card_id, package_id) = 1),
  CONSTRAINT customer_entitlements_kind_instrument_match
    CHECK (
      (kind = 'GIFT_CARD' AND gift_card_id IS NOT NULL AND package_id IS NULL)
      OR
      (kind = 'PACKAGE' AND package_id IS NOT NULL AND gift_card_id IS NULL)
    ),
  CONSTRAINT customer_entitlements_value_valid
    CHECK (original_value >= 0 AND original_value <> 'NaN'::numeric
       AND remaining_value >= 0 AND remaining_value <> 'NaN'::numeric),
  -- Legacy walk-in cards have no known owner; every new instrument is owned.
  CONSTRAINT customer_entitlements_owner_valid
    CHECK (customer_id IS NOT NULL OR legacy_flag = true)
);

CREATE INDEX IF NOT EXISTS idx_customer_entitlements_center
  ON public.customer_entitlements(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_entitlements_customer
  ON public.customer_entitlements(customer_id, created_at DESC);
-- At most one entitlement per gift card (a package definition can be sold
-- many times, so package_id is intentionally NOT unique).
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_entitlements_gift_card
  ON public.customer_entitlements(gift_card_id) WHERE gift_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entitlements_package
  ON public.customer_entitlements(package_id);

ALTER TABLE public.customer_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_entitlements_member_select ON public.customer_entitlements;
CREATE POLICY customer_entitlements_member_select ON public.customer_entitlements
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

-- -----------------------------------------------------------------------------
-- 2. Package entitlement units (remaining sessions per included service)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_entitlement_units (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  entitlement_id UUID NOT NULL REFERENCES public.customer_entitlements(id) ON DELETE CASCADE,
  service_id     UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  total_units    INTEGER NOT NULL,
  used_units     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT package_entitlement_units_positive CHECK (total_units > 0),
  CONSTRAINT package_entitlement_units_used_bounds
    CHECK (used_units >= 0 AND used_units <= total_units)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_package_entitlement_units_unique
  ON public.package_entitlement_units(entitlement_id, service_id);
CREATE INDEX IF NOT EXISTS idx_package_entitlement_units_ent
  ON public.package_entitlement_units(entitlement_id);

ALTER TABLE public.package_entitlement_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_entitlement_units_member_select ON public.package_entitlement_units;
CREATE POLICY package_entitlement_units_member_select ON public.package_entitlement_units
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

-- -----------------------------------------------------------------------------
-- 3. Immutable append-only entitlement ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlement_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES public.centers(id) ON DELETE RESTRICT,
  entitlement_id UUID NOT NULL REFERENCES public.customer_entitlements(id) ON DELETE RESTRICT,
  entry_type     TEXT NOT NULL,
  amount         NUMERIC(12,3) NOT NULL,
  units          INTEGER,
  service_id     UUID REFERENCES public.services(id) ON DELETE RESTRICT,
  invoice_id     UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
  actor_id       UUID REFERENCES public.employees(id) ON DELETE RESTRICT,
  reason         TEXT,
  legacy_flag    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entitlement_ledger_entry_type_valid
    CHECK (entry_type IN ('ISSUE', 'FUND', 'REDEEM', 'REFUND', 'ADJUSTMENT',
                          'EXPIRY', 'VOID')),
  -- ISSUE/FUND/REDEEM/REFUND move money and must be non-zero positive;
  -- ADJUSTMENT is signed; VOID/EXPIRY are informational (breakage is NOT
  -- recognized: an expired instrument keeps its outstanding liability).
  CONSTRAINT entitlement_ledger_amount_sign
    CHECK (
      (entry_type IN ('ISSUE', 'FUND', 'REDEEM', 'REFUND') AND amount > 0)
      OR (entry_type IN ('VOID', 'EXPIRY') AND amount = 0)
      OR (entry_type = 'ADJUSTMENT' AND amount <> 0)
    ),
  CONSTRAINT entitlement_ledger_units_valid
    CHECK (units IS NULL OR (units > 0 AND units = trunc(units)))
);

CREATE INDEX IF NOT EXISTS idx_entitlement_ledger_ent
  ON public.entitlement_ledger(entitlement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlement_ledger_center
  ON public.entitlement_ledger(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlement_ledger_invoice
  ON public.entitlement_ledger(invoice_id);
-- Idempotency: one issuance per entitlement; one redemption per
-- (entitlement, invoice). A retried checkout cannot double-consume.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlement_ledger_one_issue
  ON public.entitlement_ledger(entitlement_id) WHERE entry_type = 'ISSUE';
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlement_ledger_one_redeem_per_invoice
  ON public.entitlement_ledger(entitlement_id, invoice_id) WHERE entry_type = 'REDEEM';

ALTER TABLE public.entitlement_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entitlement_ledger_member_select ON public.entitlement_ledger;
CREATE POLICY entitlement_ledger_member_select ON public.entitlement_ledger
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

-- -----------------------------------------------------------------------------
-- 4. Ledger-driven balance maintenance
-- -----------------------------------------------------------------------------
-- The ONLY writer of balances/status/units. Every ledger INSERT recomputes the
-- entitlement balance from the full ledger, enforces the invariants below,
-- and refreshes the legacy gift_cards.current_balance mirror.
CREATE OR REPLACE FUNCTION app_private.maintain_entitlement_balance_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_ent          public.customer_entitlements%ROWTYPE;
  v_balance      NUMERIC(12,3) := 0.000;
  v_redeem_total NUMERIC(12,3) := 0.000;
  v_refund_total NUMERIC(12,3) := 0.000;
  v_unit_row     public.package_entitlement_units%ROWTYPE;
  v_new_status   TEXT;
  v_has_redeem   BOOLEAN := false;
BEGIN
  SELECT * INTO v_ent
  FROM public.customer_entitlements ce
  WHERE ce.id = NEW.entitlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entitlement_not_found' USING ERRCODE = '23503';
  END IF;

  IF NEW.center_id IS DISTINCT FROM v_ent.center_id THEN
    RAISE EXCEPTION 'entitlement_center_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(CASE el.entry_type
                   WHEN 'ISSUE'      THEN  el.amount
                   WHEN 'FUND'       THEN  el.amount
                   WHEN 'ADJUSTMENT' THEN  el.amount
                   WHEN 'REDEEM'     THEN -el.amount
                   WHEN 'REFUND'     THEN -el.amount
                   ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN el.entry_type = 'REDEEM' THEN el.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN el.entry_type = 'REFUND' THEN el.amount ELSE 0 END), 0),
    EXISTS (SELECT 1 FROM public.entitlement_ledger el2
            WHERE el2.entitlement_id = NEW.entitlement_id
              AND el2.entry_type = 'REDEEM')
  INTO v_balance, v_redeem_total, v_refund_total, v_has_redeem
  FROM public.entitlement_ledger el
  WHERE el.entitlement_id = NEW.entitlement_id;

  v_balance := round(v_balance + CASE NEW.entry_type
                   WHEN 'ISSUE'      THEN  NEW.amount
                   WHEN 'FUND'       THEN  NEW.amount
                   WHEN 'ADJUSTMENT' THEN  NEW.amount
                   WHEN 'REDEEM'     THEN -NEW.amount
                   WHEN 'REFUND'     THEN -NEW.amount
                   ELSE 0 END, 3);

  IF v_balance < -0.0005 THEN
    RAISE EXCEPTION 'entitlement_insufficient_balance' USING ERRCODE = '23514';
  END IF;
  v_balance := GREATEST(0.000, v_balance);

  -- REDEEM with units consumes package sessions for exactly the service the
  -- entitlement was sold with, never beyond the remaining sessions.
  IF NEW.entry_type = 'REDEEM' AND NEW.units IS NOT NULL THEN
    SELECT * INTO v_unit_row
    FROM public.package_entitlement_units peu
    WHERE peu.entitlement_id = NEW.entitlement_id
      AND peu.service_id = NEW.service_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'package_service_not_included' USING ERRCODE = '23503';
    END IF;
    IF v_unit_row.used_units + NEW.units > v_unit_row.total_units THEN
      RAISE EXCEPTION 'package_insufficient_units' USING ERRCODE = '23514';
    END IF;
    UPDATE public.package_entitlement_units peu
    SET used_units = peu.used_units + NEW.units
    WHERE peu.id = v_unit_row.id;
  END IF;

  -- REFUND covers only unused remaining value.
  IF NEW.entry_type = 'REFUND' THEN
    IF NEW.amount > v_ent.remaining_value + 0.0005 THEN
      RAISE EXCEPTION 'entitlement_refund_exceeds_remaining' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- VOID is a governed correction for untouched instruments only.
  IF NEW.entry_type = 'VOID' THEN
    IF v_has_redeem OR v_ent.remaining_value <> v_ent.original_value THEN
      RAISE EXCEPTION 'entitlement_void_requires_no_redemptions' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- EXPIRY is the reserved, explicitly governed hook. It records the event
  -- with an actor and reason but does NOT recognize breakage: the balance
  -- stays on the books as an outstanding liability until a future governed
  -- breakage policy is enabled.
  IF NEW.entry_type = 'EXPIRY' THEN
    IF v_ent.expires_at IS NULL OR v_ent.expires_at > now() THEN
      RAISE EXCEPTION 'entitlement_not_yet_expired' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.entry_type = 'VOID' THEN
    v_new_status := 'VOID';
  ELSIF NEW.entry_type = 'EXPIRY' THEN
    v_new_status := 'EXPIRED';
  ELSIF v_balance <= 0.0005 AND v_refund_total > 0 THEN
    v_new_status := 'REFUNDED';
  ELSIF v_balance <= 0.0005 THEN
    v_new_status := 'FULLY_REDEEMED';
  ELSIF v_redeem_total > 0 THEN
    v_new_status := 'PARTIALLY_REDEEMED';
  ELSE
    v_new_status := 'ACTIVE';
  END IF;

  UPDATE public.customer_entitlements ce
  SET remaining_value = v_balance,
      status          = v_new_status,
      updated_at      = now()
  WHERE ce.id = NEW.entitlement_id;

  -- Legacy mirror so gift_cards.current_balance stays readable by old code
  -- while remaining derived from the ledger (never written by clients).
  IF v_ent.kind = 'GIFT_CARD' AND v_ent.gift_card_id IS NOT NULL THEN
    UPDATE public.gift_cards gc
    SET current_balance = v_balance,
        is_active       = (v_balance > 0),
        updated_at      = now()
    WHERE gc.id = v_ent.gift_card_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maintain_entitlement_balance_v1 ON public.entitlement_ledger;
CREATE TRIGGER maintain_entitlement_balance_v1
BEFORE INSERT ON public.entitlement_ledger
FOR EACH ROW EXECUTE FUNCTION app_private.maintain_entitlement_balance_v1();

-- -----------------------------------------------------------------------------
-- 5. Invoice breakdown: entitlement redemptions are NOT discounts
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS entitlement_redemption NUMERIC(12,3) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.invoices
    DROP CONSTRAINT IF EXISTS invoices_breakdown_non_negative;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_breakdown_non_negative CHECK (
    subtotal_amount >= 0 AND subtotal_amount <> 'NaN'::numeric AND
    manual_discount >= 0 AND manual_discount <> 'NaN'::numeric AND
    tier_discount >= 0 AND tier_discount <> 'NaN'::numeric AND
    loyalty_discount >= 0 AND loyalty_discount <> 'NaN'::numeric AND
    gift_card_discount >= 0 AND gift_card_discount <> 'NaN'::numeric AND
    entitlement_redemption >= 0 AND entitlement_redemption <> 'NaN'::numeric AND
    tax_rate BETWEEN 0 AND 100 AND tax_rate <> 'NaN'::numeric AND
    amount_paid >= 0 AND amount_paid <> 'NaN'::numeric
  ) NOT VALID;

-- gift_card_discount keeps its legacy meaning (gift cards redeemed by code);
-- entitlement_redemption carries package/entitlement redemptions. `discount`
-- remains the legacy aggregate of all reductions; reports classify redemption
-- separately so it is never mistaken for a price discount.
DO $$ BEGIN
  ALTER TABLE public.invoices
    DROP CONSTRAINT IF EXISTS invoices_paid_totals_consistent;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_paid_totals_consistent CHECK (
    status <> 'PAID' OR (
      discount = round(manual_discount + tier_discount + gift_card_discount
                       + entitlement_redemption, 3) AND
      tax = round(
        greatest(subtotal_amount - manual_discount - tier_discount
                 - loyalty_discount - gift_card_discount - entitlement_redemption, 0)
        * tax_rate / 100.0, 3
      ) AND
      total_amount = round(
        greatest(subtotal_amount - manual_discount - tier_discount
                 - loyalty_discount - gift_card_discount - entitlement_redemption, 0)
        + tax, 3
      ) AND
      amount_paid = total_amount
    )
  ) NOT VALID;

-- -----------------------------------------------------------------------------
-- 6. invoice_items: gift-card sale lines
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS gift_card_id UUID REFERENCES public.gift_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_gift_card ON public.invoice_items(gift_card_id);

DO $$ BEGIN
  ALTER TABLE public.invoice_items
    DROP CONSTRAINT IF EXISTS invoice_items_type_valid;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_type_valid
  CHECK (item_type IS NOT NULL AND item_type IN ('service', 'product', 'package', 'gift_card'))
  NOT VALID;

DO $$ BEGIN
  ALTER TABLE public.invoice_items
    DROP CONSTRAINT IF EXISTS invoice_items_one_catalog_reference;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_one_catalog_reference
  CHECK (num_nonnulls(service_id, product_id, package_id, gift_card_id) = 1)
  NOT VALID;

-- -----------------------------------------------------------------------------
-- 7. Close direct writes on legacy gift-card financial rows
-- -----------------------------------------------------------------------------
-- Balances and ledger rows are now written only by SECURITY DEFINER RPCs and
-- the balance trigger. Members keep read access for POS/reports.
DROP POLICY IF EXISTS gift_cards_insert_member ON public.gift_cards;
DROP POLICY IF EXISTS gift_cards_update_member ON public.gift_cards;
DROP POLICY IF EXISTS gift_cards_delete_member ON public.gift_cards;
DROP POLICY IF EXISTS gift_card_transactions_insert_member ON public.gift_card_transactions;

REVOKE INSERT, UPDATE, DELETE ON public.gift_cards FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gift_card_transactions FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.customer_entitlements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.package_entitlement_units FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.entitlement_ledger FROM anon, authenticated;
GRANT SELECT ON public.customer_entitlements, public.package_entitlement_units,
               public.entitlement_ledger TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Legacy backfill: outstanding gift-card balances become legacy
--    entitlements with an opening ledger balance. Nothing is fabricated:
--    original sale amounts and prior redemptions are NOT invented.
-- -----------------------------------------------------------------------------
INSERT INTO public.customer_entitlements (
  center_id, customer_id, kind, gift_card_id,
  original_value, remaining_value, status, expires_at, legacy_flag
)
SELECT gc.center_id,
       gc.customer_id,
       'GIFT_CARD',
       gc.id,
       gc.current_balance,
       gc.current_balance,
       CASE WHEN gc.current_balance > 0 THEN 'ACTIVE' ELSE 'FULLY_REDEEMED' END,
       gc.expires_at,
       true
FROM public.gift_cards gc
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_entitlements ce WHERE ce.gift_card_id = gc.id
);

INSERT INTO public.entitlement_ledger (
  center_id, entitlement_id, entry_type, amount, legacy_flag, reason
)
SELECT e.center_id,
       e.id,
       'ISSUE',
       e.remaining_value,
       true,
       'Legacy opening balance: outstanding value at entitlement migration; ' ||
       'original sale and prior redemptions were not recorded in this ledger.'
FROM public.customer_entitlements e
WHERE e.legacy_flag = true
  AND e.remaining_value > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.entitlement_ledger el WHERE el.entitlement_id = e.id
  );

-- -----------------------------------------------------------------------------
-- 9. Canonical atomic checkout (extended with entitlements)
-- -----------------------------------------------------------------------------
-- Same signature contract as the previous canonical version plus ONE new
-- defaulted parameter:
--   p_entitlement_redemptions JSONB DEFAULT NULL
--     [ { "entitlementId": uuid, "type": "value", "amount": numeric } ]   gift cards
--     [ { "entitlementId": uuid, "type": "units", "serviceId": uuid,
--         "units": integer } ]                                            package sessions
-- New p_items line type:
--   { "type": "gift_card", "code": "...", "price": value, "qty": 1 }      gift card sale
-- A package line additionally creates the customer package entitlement
-- (units per included service) in the same transaction.
DROP FUNCTION IF EXISTS public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.process_checkout_v1(
    p_center_id          UUID,
    p_customer_id        UUID,
    p_employee_id        UUID,
    p_payment_method     TEXT,
    p_discount_amount    NUMERIC,
    p_use_loyalty_points BOOLEAN,
    p_items              JSONB,
    p_gift_card_code     TEXT DEFAULT NULL,
    p_entitlement_redemptions JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
    v_invoice_id           UUID;
    v_payment_id           UUID;
    v_subtotal             NUMERIC(12,3) := 0.000;
    v_payable              NUMERIC(12,3) := 0.000;
    v_net                  NUMERIC(12,3) := 0.000;
    v_tax_rate             NUMERIC(5,2) := 0.000;
    v_tax_amount           NUMERIC(12,3) := 0.000;
    v_total                NUMERIC(12,3) := 0.000;
    v_manual_discount      NUMERIC(12,3) := 0.000;
    v_tier_percent         NUMERIC(5,2) := 0.000;
    v_tier_discount        NUMERIC(12,3) := 0.000;
    v_loyalty_discount     NUMERIC(12,3) := 0.000;
    v_gift_card_discount   NUMERIC(12,3) := 0.000;
    v_entitlement_redemption NUMERIC(12,3) := 0.000;
    v_earned_points        INTEGER := 0;
    v_item                 JSONB;
    v_line                 JSONB;
    v_lines                JSONB := '[]'::jsonb;
    v_redemption           JSONB;
    v_redemptions          JSONB := '[]'::jsonb;
    v_redemption_type      TEXT;
    v_item_type            TEXT;
    v_item_name            TEXT;
    v_item_qty             NUMERIC;
    v_item_price           NUMERIC(12,3);
    v_service_id           UUID;
    v_product_id           UUID;
    v_package_id           UUID;
    v_code                 TEXT;
    v_service              public.services%ROWTYPE;
    v_product              public.products%ROWTYPE;
    v_package              public.service_packages%ROWTYPE;
    v_customer             public.customers%ROWTYPE;
    v_gift_card            public.gift_cards%ROWTYPE;
    v_redeem_card_id       UUID;
    v_gift_code            TEXT := upper(NULLIF(btrim(COALESCE(p_gift_card_code, '')), ''));
    v_entitlement          public.customer_entitlements%ROWTYPE;
    v_ent_id               UUID;
    v_ent_amount           NUMERIC(12,3) := 0.000;
    v_ent_service_id       UUID;
    v_ent_units            INTEGER := 0;
    v_covered              NUMERIC(12,3) := 0.000;
    v_total_units_all      INTEGER := 0;
    v_remaining_units_all  INTEGER := 0;
    v_line_value           NUMERIC(12,3) := 0.000;
    v_line_qty             INTEGER := 0;
    v_avg_unit_price       NUMERIC(12,3) := 0.000;
    v_redeemed_ids         TEXT[] := '{}';
    v_issued_cards         JSONB := '[]'::jsonb;
    v_issued_card          JSONB;
    v_package_ents         JSONB := '[]'::jsonb;
    v_unit_row             public.service_package_items%ROWTYPE;
    v_updated_invoice      JSONB;
    v_package_entitlement  public.customer_entitlements%ROWTYPE;
BEGIN
    IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
      RAISE EXCEPTION 'unauthorized_checkout_center' USING ERRCODE = '42501';
    END IF;

    IF p_payment_method NOT IN ('cash', 'card', 'transfer') THEN
      RAISE EXCEPTION 'unsupported_payment_method' USING ERRCODE = '22023';
    END IF;

    IF p_discount_amount IS NOT NULL AND
       (p_discount_amount = 'NaN'::numeric OR p_discount_amount < 0) THEN
      RAISE EXCEPTION 'invalid_manual_discount' USING ERRCODE = '22023';
    END IF;
    v_manual_discount := round(COALESCE(p_discount_amount, 0), 3);

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'checkout_items_required' USING ERRCODE = '22023';
    END IF;

    IF p_entitlement_redemptions IS NOT NULL AND
       (jsonb_typeof(p_entitlement_redemptions) <> 'array') THEN
      RAISE EXCEPTION 'invalid_entitlement_redemptions' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_customer
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.center_id = p_center_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'checkout_customer_not_available' USING ERRCODE = '23503';
    END IF;

    IF p_employee_id IS NULL THEN
      RAISE EXCEPTION 'checkout_employee_required' USING ERRCODE = '23502';
    END IF;
    PERFORM 1 FROM public.employees e
    WHERE e.id = p_employee_id AND e.center_id = p_center_id AND e.is_active = true
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'checkout_employee_not_available' USING ERRCODE = '23503';
    END IF;

    -- Resolve each submitted reference to an immutable canonical line. Client
    -- prices are ignored except for STARTING_FROM services and gift-card
    -- sale values.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      BEGIN
        v_item_type := v_item->>'type';
        v_item_qty := NULLIF(v_item->>'qty', '')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'invalid_checkout_line' USING ERRCODE = '22023';
      END;

      IF v_item_type NOT IN ('service', 'product', 'package', 'gift_card') OR
         v_item_qty IS NULL OR v_item_qty = 'NaN'::numeric OR
         v_item_qty <= 0 OR v_item_qty <> trunc(v_item_qty) THEN
        RAISE EXCEPTION 'invalid_checkout_line' USING ERRCODE = '22023';
      END IF;

      v_service_id := NULL;
      v_product_id := NULL;
      v_package_id := NULL;
      v_item_name := NULL;
      v_item_price := NULL;
      v_code := NULL;

      IF v_item_type = 'service' THEN
        BEGIN
          v_service_id := NULLIF(v_item->>'serviceId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_service_reference' USING ERRCODE = '22023';
        END;
        SELECT * INTO v_service FROM public.services s
        WHERE s.id = v_service_id AND s.center_id = p_center_id AND s.is_active = true
        FOR SHARE;
        IF NOT FOUND OR v_service.price <= 0 THEN
          RAISE EXCEPTION 'service_not_available' USING ERRCODE = '23503';
        END IF;
        v_item_name := v_service.name;
        IF v_service.pricing_mode = 'STARTING_FROM' THEN
          BEGIN
            v_item_price := round(NULLIF(v_item->>'price', '')::numeric, 3);
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'final_service_price_required' USING ERRCODE = '22023';
          END;
          IF v_item_price IS NULL OR v_item_price = 'NaN'::numeric OR
             v_item_price <= 0 OR v_item_price < v_service.price THEN
            RAISE EXCEPTION 'final_service_price_below_minimum' USING ERRCODE = '22023';
          END IF;
        ELSE
          v_item_price := round(v_service.price, 3);
        END IF;

      ELSIF v_item_type = 'product' THEN
        BEGIN
          v_product_id := NULLIF(v_item->>'productId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_product_reference' USING ERRCODE = '22023';
        END;
        SELECT * INTO v_product FROM public.products p
        WHERE p.id = v_product_id AND p.center_id = p_center_id AND p.is_active = true
        FOR UPDATE;
        IF NOT FOUND OR v_product.price <= 0 THEN
          RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23503';
        END IF;
        v_item_name := v_product.name;
        v_item_price := round(v_product.price, 3);

      ELSIF v_item_type = 'package' THEN
        BEGIN
          v_package_id := NULLIF(v_item->>'packageId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_package_reference' USING ERRCODE = '22023';
        END;
        SELECT * INTO v_package FROM public.service_packages p
        WHERE p.id = v_package_id AND p.center_id = p_center_id AND p.is_active = true
        FOR SHARE;
        IF NOT FOUND OR v_package.package_price <= 0 THEN
          RAISE EXCEPTION 'package_not_available' USING ERRCODE = '23503';
        END IF;
        PERFORM 1 FROM public.service_package_items spi WHERE spi.package_id = v_package.id;
        IF NOT FOUND OR EXISTS (
          SELECT 1
          FROM public.service_package_items spi
          LEFT JOIN public.services s ON s.id = spi.service_id
          WHERE spi.package_id = v_package.id
            AND (s.id IS NULL OR s.center_id <> p_center_id OR s.is_active = false)
        ) THEN
          RAISE EXCEPTION 'package_contains_unavailable_service' USING ERRCODE = '23503';
        END IF;
        PERFORM s.id
        FROM public.service_package_items spi
        JOIN public.services s ON s.id = spi.service_id
        WHERE spi.package_id = v_package.id
        FOR SHARE OF s;
        v_item_name := v_package.name;
        v_item_price := round(v_package.package_price, 3);

      ELSE -- gift_card sale line
        v_code := upper(btrim(COALESCE(NULLIF(v_item->>'code', ''), '')));
        IF length(v_code) < 4 THEN
          RAISE EXCEPTION 'gift_card_code_required' USING ERRCODE = '22023';
        END IF;
        IF v_item_qty <> 1 THEN
          RAISE EXCEPTION 'gift_card_quantity_must_be_one' USING ERRCODE = '22023';
        END IF;
        BEGIN
          v_item_price := round(NULLIF(v_item->>'price', '')::numeric, 3);
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'gift_card_value_required' USING ERRCODE = '22023';
        END;
        IF v_item_price IS NULL OR v_item_price = 'NaN'::numeric OR v_item_price <= 0 THEN
          RAISE EXCEPTION 'gift_card_value_required' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_gift_card
        FROM public.gift_cards gc
        WHERE gc.center_id = p_center_id AND gc.code = v_code
        FOR UPDATE;
        IF FOUND THEN
          RAISE EXCEPTION 'gift_card_code_already_exists' USING ERRCODE = '23505';
        END IF;
        BEGIN
          SELECT NULLIF(v_item->>'expiresAtISO', '')::timestamptz INTO v_gift_card.expires_at;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_gift_card_expiry' USING ERRCODE = '22023';
        END;
        INSERT INTO public.gift_cards (
          center_id, code, initial_balance, current_balance,
          customer_id, note, expires_at, is_active
        ) VALUES (
          p_center_id, v_code, v_item_price, v_item_price,
          p_customer_id, NULLIF(btrim(COALESCE(v_item->>'note', '')), ''),
          v_gift_card.expires_at, true
        )
        RETURNING * INTO v_gift_card;
        v_item_name := 'Gift Card ' || v_code;
        v_issued_cards := v_issued_cards || jsonb_build_array(jsonb_build_object(
          'code', v_code, 'gift_card_id', v_gift_card.id, 'value', v_item_price
        ));
      END IF;

      IF v_item_price IS NULL OR v_item_price <= 0 OR length(btrim(COALESCE(v_item_name, ''))) = 0 THEN
        RAISE EXCEPTION 'invalid_canonical_checkout_line' USING ERRCODE = '23514';
      END IF;

      v_subtotal := round(v_subtotal + (v_item_price * v_item_qty), 3);
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'type', v_item_type,
        'name', v_item_name,
        'qty', v_item_qty,
        'price', v_item_price,
        'serviceId', v_service_id,
        'productId', v_product_id,
        'packageId', v_package_id,
        'code', v_code
      ));
    END LOOP;

    IF v_subtotal <= 0 THEN
      RAISE EXCEPTION 'checkout_subtotal_must_be_positive' USING ERRCODE = '23514';
    END IF;

    SELECT greatest(0, COALESCE(cs.tax_rate, 0)) INTO v_tax_rate
    FROM public.center_settings cs WHERE cs.center_id = p_center_id;
    v_tax_rate := COALESCE(v_tax_rate, 0);

    v_tier_percent := CASE
      WHEN COALESCE(v_customer.total_spent, 0) >= 1000 THEN 15
      WHEN COALESCE(v_customer.total_spent, 0) >= 500 THEN 10
      WHEN COALESCE(v_customer.total_spent, 0) >= 200 THEN 5
      ELSE 0
    END;
    v_tier_discount := round(v_subtotal * v_tier_percent / 100.0, 3);

    IF v_manual_discount + v_tier_discount > v_subtotal THEN
      RAISE EXCEPTION 'discount_exceeds_subtotal' USING ERRCODE = '22023';
    END IF;

    IF COALESCE(p_use_loyalty_points, false) THEN
      v_loyalty_discount := least(
        floor(greatest(v_subtotal - v_manual_discount - v_tier_discount, 0)),
        greatest(COALESCE(v_customer.loyalty_points, 0), 0)
      );
    END IF;

    v_payable := round(greatest(
      v_subtotal - v_manual_discount - v_tier_discount - v_loyalty_discount, 0
    ), 3);

    -- --- Gift card redemption by code (legacy bearer flow) -------------------
    IF v_gift_code IS NOT NULL THEN
      SELECT * INTO v_gift_card
      FROM public.gift_cards gc
      WHERE gc.center_id = p_center_id
        AND gc.code = v_gift_code
        AND gc.is_active = true
        AND (gc.expires_at IS NULL OR gc.expires_at >= now())
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'gift_card_not_available' USING ERRCODE = '23503';
      END IF;
      v_redeem_card_id := v_gift_card.id;

      SELECT * INTO v_entitlement
      FROM public.customer_entitlements ce
      WHERE ce.gift_card_id = v_gift_card.id
      FOR UPDATE;
      IF NOT FOUND THEN
        -- Defensive: a card that predates the entitlement migration. Book it
        -- as a legacy opening balance exactly equal to its current balance.
        INSERT INTO public.customer_entitlements (
          center_id, customer_id, kind, gift_card_id,
          original_value, remaining_value, status, expires_at, legacy_flag
        ) VALUES (
          p_center_id, NULL, 'GIFT_CARD', v_gift_card.id,
          v_gift_card.current_balance, v_gift_card.current_balance, 'ACTIVE',
          v_gift_card.expires_at, true
        )
        RETURNING * INTO v_entitlement;
        INSERT INTO public.entitlement_ledger (
          center_id, entitlement_id, entry_type, amount, legacy_flag, reason
        ) VALUES (
          p_center_id, v_entitlement.id, 'ISSUE', v_gift_card.current_balance,
          true, 'Defensive legacy opening balance for pre-migration gift card.'
        );
      END IF;

      IF v_entitlement.status IN ('FULLY_REDEEMED', 'REFUNDED', 'VOID', 'EXPIRED') THEN
        RAISE EXCEPTION 'gift_card_not_available' USING ERRCODE = '23503';
      END IF;
      IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < now() THEN
        RAISE EXCEPTION 'gift_card_expired' USING ERRCODE = '23514';
      END IF;

      v_gift_card_discount := round(least(
        v_payable,
        greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
      ), 3);

      IF v_gift_card_discount > 0 THEN
        v_redeemed_ids := array_append(v_redeemed_ids, v_entitlement.id::text);
      END IF;
    END IF;

    -- --- Entitlement redemptions (owned instruments) ------------------------
    IF p_entitlement_redemptions IS NOT NULL THEN
      FOR v_redemption IN SELECT value FROM jsonb_array_elements(p_entitlement_redemptions)
      LOOP
        IF jsonb_typeof(v_redemption) <> 'object' THEN
          RAISE EXCEPTION 'invalid_entitlement_redemption' USING ERRCODE = '22023';
        END IF;
        v_redemption_type := v_redemption->>'type';
        BEGIN
          v_ent_id := NULLIF(v_redemption->>'entitlementId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_entitlement_reference' USING ERRCODE = '22023';
        END;
        IF v_ent_id IS NULL THEN
          RAISE EXCEPTION 'invalid_entitlement_reference' USING ERRCODE = '22023';
        END IF;
        IF v_ent_id::text = ANY(v_redeemed_ids) THEN
          RAISE EXCEPTION 'entitlement_already_redeemed_on_invoice' USING ERRCODE = '23505';
        END IF;

        SELECT * INTO v_entitlement
        FROM public.customer_entitlements ce
        WHERE ce.id = v_ent_id AND ce.center_id = p_center_id
        FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'entitlement_not_available' USING ERRCODE = '23503';
        END IF;
        -- Ownership: a customer can only redeem their own entitlement.
        IF v_entitlement.customer_id IS DISTINCT FROM p_customer_id THEN
          RAISE EXCEPTION 'entitlement_customer_mismatch' USING ERRCODE = '42501';
        END IF;
        IF v_entitlement.status IN ('FULLY_REDEEMED', 'REFUNDED', 'VOID', 'EXPIRED') THEN
          RAISE EXCEPTION 'entitlement_not_redeemable' USING ERRCODE = '23514';
        END IF;
        IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < now() THEN
          RAISE EXCEPTION 'entitlement_expired' USING ERRCODE = '23514';
        END IF;
        -- A legacy gift card manually deactivated before the entitlement
        -- migration stays non-redeemable through every redemption path.
        IF v_entitlement.kind = 'GIFT_CARD' AND v_entitlement.gift_card_id IS NOT NULL THEN
          PERFORM 1 FROM public.gift_cards gc
          WHERE gc.id = v_entitlement.gift_card_id AND gc.is_active = true;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'gift_card_not_available' USING ERRCODE = '23503';
          END IF;
        END IF;

        v_ent_amount := 0.000;
        v_ent_service_id := NULL;
        v_ent_units := 0;

        IF v_redemption_type = 'value' THEN
          IF v_entitlement.kind <> 'GIFT_CARD' THEN
            RAISE EXCEPTION 'value_redemption_requires_gift_card' USING ERRCODE = '22023';
          END IF;
          BEGIN
            v_ent_amount := round(NULLIF(v_redemption->>'amount', '')::numeric, 3);
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'invalid_redemption_amount' USING ERRCODE = '22023';
          END;
          IF v_ent_amount IS NULL OR v_ent_amount = 'NaN'::numeric OR v_ent_amount <= 0 THEN
            RAISE EXCEPTION 'invalid_redemption_amount' USING ERRCODE = '22023';
          END IF;
          v_covered := round(least(
            greatest(v_payable - v_gift_card_discount - v_entitlement_redemption, 0),
            v_ent_amount,
            greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
          ), 3);

        ELSIF v_redemption_type = 'units' THEN
          IF v_entitlement.kind <> 'PACKAGE' THEN
            RAISE EXCEPTION 'units_redemption_requires_package' USING ERRCODE = '22023';
          END IF;
          BEGIN
            v_ent_service_id := NULLIF(v_redemption->>'serviceId', '')::uuid;
            v_ent_units := NULLIF(v_redemption->>'units', '')::integer;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'invalid_package_redemption' USING ERRCODE = '22023';
          END;
          IF v_ent_service_id IS NULL OR v_ent_units IS NULL OR
             v_ent_units <= 0 THEN
            RAISE EXCEPTION 'invalid_package_redemption' USING ERRCODE = '22023';
          END IF;

          -- The redeemed service must actually be on this invoice.
          SELECT COALESCE(SUM((l->>'price')::numeric * (l->>'qty')::numeric), 0),
                 COALESCE(SUM((l->>'qty')::integer), 0)
          INTO v_line_value, v_line_qty
          FROM jsonb_array_elements(v_lines) l
          WHERE l->>'type' = 'service' AND l->>'serviceId' = v_ent_service_id::text;
          IF v_line_qty <= 0 THEN
            RAISE EXCEPTION 'package_service_not_on_invoice' USING ERRCODE = '22023';
          END IF;
          IF v_ent_units > v_line_qty THEN
            RAISE EXCEPTION 'package_redemption_exceeds_invoice_quantity' USING ERRCODE = '22023';
          END IF;

          SELECT COALESCE(SUM(peu.total_units), 0), COALESCE(SUM(peu.total_units - peu.used_units), 0)
          INTO v_total_units_all, v_remaining_units_all
          FROM public.package_entitlement_units peu
          WHERE peu.entitlement_id = v_ent_id;
          IF v_ent_units > v_remaining_units_all THEN
            RAISE EXCEPTION 'package_insufficient_units' USING ERRCODE = '23514';
          END IF;

          -- Proportional unit value with last-unit absorption so a package
          -- whose sessions cost more than its price still redeems fully.
          v_avg_unit_price := round(v_line_value / v_line_qty, 3);
          v_covered := round(least(
            greatest(v_payable - v_gift_card_discount - v_entitlement_redemption, 0),
            round(v_avg_unit_price * v_ent_units, 3),
            greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
          ), 3);
          -- Absorb rounding when this redemption exhausts the package.
          IF v_ent_units >= v_remaining_units_all THEN
            v_covered := round(least(
              greatest(v_payable - v_gift_card_discount - v_entitlement_redemption, 0),
              greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
            ), 3);
          END IF;

        ELSE
          RAISE EXCEPTION 'invalid_entitlement_redemption_type' USING ERRCODE = '22023';
        END IF;

        IF v_covered <= 0 THEN
          RAISE EXCEPTION 'entitlement_insufficient_balance' USING ERRCODE = '23514';
        END IF;

        v_entitlement_redemption := round(v_entitlement_redemption + v_covered, 3);
        v_redeemed_ids := array_append(v_redeemed_ids, v_ent_id::text);
        v_redemptions := v_redemptions || jsonb_build_array(jsonb_build_object(
          'entitlement_id', v_ent_id,
          'type', v_redemption_type,
          'amount', v_covered,
          'service_id', v_ent_service_id,
          'units', v_ent_units
        ));
      END LOOP;
    END IF;

    v_net := round(greatest(
      v_payable - v_gift_card_discount - v_entitlement_redemption, 0
    ), 3);
    v_tax_amount := round(v_net * v_tax_rate / 100.0, 3);
    v_total := round(v_net + v_tax_amount, 3);
    v_earned_points := floor(v_net)::integer;

    INSERT INTO public.invoices (
      center_id, customer_id, employee_id, serial_number, payment_method,
      subtotal_amount, manual_discount, tier_discount, loyalty_discount,
      gift_card_discount, entitlement_redemption, discount, loyalty_points_used,
      tax_rate, tax, total_amount, amount_paid, status
    ) VALUES (
      p_center_id, p_customer_id, p_employee_id,
      'INV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      p_payment_method,
      v_subtotal, v_manual_discount, v_tier_discount, v_loyalty_discount,
      v_gift_card_discount, v_entitlement_redemption,
      round(v_manual_discount + v_tier_discount + v_gift_card_discount
            + v_entitlement_redemption, 3),
      v_loyalty_discount::integer, v_tax_rate, v_tax_amount,
      v_total, v_total, 'PAID'
    ) RETURNING id INTO v_invoice_id;

    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
    LOOP
      v_item_type := v_line->>'type';
      v_item_name := v_line->>'name';
      v_item_qty := (v_line->>'qty')::numeric;
      v_item_price := (v_line->>'price')::numeric;
      v_service_id := NULLIF(v_line->>'serviceId', '')::uuid;
      v_product_id := NULLIF(v_line->>'productId', '')::uuid;
      v_package_id := NULLIF(v_line->>'packageId', '')::uuid;
      v_code := NULLIF(v_line->>'code', '');
      v_gift_card.id := NULL;

      IF v_item_type = 'gift_card' AND v_code IS NOT NULL THEN
        SELECT gc.id INTO v_gift_card.id
        FROM public.gift_cards gc
        WHERE gc.center_id = p_center_id AND gc.code = v_code;
      END IF;

      INSERT INTO public.invoice_items (
        invoice_id, service_id, product_id, package_id, gift_card_id,
        item_type, item_name, price, quantity
      ) VALUES (
        v_invoice_id, v_service_id, v_product_id, v_package_id, v_gift_card.id,
        v_item_type, v_item_name, v_item_price, v_item_qty::integer
      );

      IF v_item_type = 'product' THEN
        UPDATE public.products p
        SET stock_quantity = p.stock_quantity - v_item_qty::integer
        WHERE p.id = v_product_id
          AND p.center_id = p_center_id
          AND p.is_active = true
          AND p.track_inventory = true
          AND p.stock_quantity >= v_item_qty::integer;
        IF NOT FOUND THEN
          PERFORM 1 FROM public.products p
          WHERE p.id = v_product_id
            AND p.center_id = p_center_id
            AND p.is_active = true
            AND p.track_inventory = false;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_or_unavailable_product_stock' USING ERRCODE = '23514';
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- --- Entitlement creation for sold gift cards ----------------------------
    FOR v_issued_card IN SELECT value FROM jsonb_array_elements(v_issued_cards)
    LOOP
      INSERT INTO public.customer_entitlements (
        center_id, customer_id, kind, gift_card_id, source_invoice_id,
        original_value, remaining_value, status, expires_at, legacy_flag
      ) VALUES (
        p_center_id, p_customer_id, 'GIFT_CARD',
        (v_issued_card->>'gift_card_id')::uuid, v_invoice_id,
        (v_issued_card->>'value')::numeric, (v_issued_card->>'value')::numeric,
        'ACTIVE',
        (SELECT expires_at FROM public.gift_cards gc WHERE gc.id = (v_issued_card->>'gift_card_id')::uuid),
        false
      )
      RETURNING * INTO v_entitlement;

      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, v_entitlement.id, 'ISSUE',
        (v_issued_card->>'value')::numeric, v_invoice_id, p_employee_id,
        'Gift card sold at checkout'
      );
    END LOOP;

    -- --- Entitlement creation for sold packages ------------------------------
    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
    LOOP
      IF v_line->>'type' <> 'package' THEN
        CONTINUE;
      END IF;
      v_package_id := NULLIF(v_line->>'packageId', '')::uuid;
      v_item_price := (v_line->>'price')::numeric;
      v_item_qty := (v_line->>'qty')::numeric;

      INSERT INTO public.customer_entitlements (
        center_id, customer_id, kind, package_id, source_invoice_id,
        original_value, remaining_value, status, legacy_flag
      ) VALUES (
        p_center_id, p_customer_id, 'PACKAGE', v_package_id, v_invoice_id,
        round(v_item_price * v_item_qty, 3), round(v_item_price * v_item_qty, 3),
        'ACTIVE', false
      )
      RETURNING * INTO v_package_entitlement;

      FOR v_unit_row IN
        SELECT * FROM public.service_package_items spi
        WHERE spi.package_id = v_package_id
      LOOP
        INSERT INTO public.package_entitlement_units (
          center_id, entitlement_id, service_id, total_units, used_units
        ) VALUES (
          p_center_id, v_package_entitlement.id, v_unit_row.service_id,
          v_unit_row.quantity * v_item_qty::integer, 0
        );
      END LOOP;

      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, v_package_entitlement.id, 'ISSUE',
        round(v_item_price * v_item_qty, 3), v_invoice_id, p_employee_id,
        'Package sold at checkout'
      );

      v_package_ents := v_package_ents || jsonb_build_array(v_package_entitlement.id);
    END LOOP;

    -- --- Payment --------------------------------------------------------------
    IF v_total > 0 THEN
      INSERT INTO public.payments (center_id, invoice_id, amount, method, status)
      VALUES (p_center_id, v_invoice_id, v_total, p_payment_method, 'SUCCEEDED')
      RETURNING id INTO v_payment_id;
    END IF;

    -- --- Ledger entries for redemptions (balance consumed atomically) --------
    IF v_gift_card_discount > 0 AND v_gift_code IS NOT NULL THEN
      SELECT id INTO v_ent_id
      FROM public.customer_entitlements ce
      WHERE ce.gift_card_id = v_redeem_card_id;
      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, v_ent_id, 'REDEEM', v_gift_card_discount, v_invoice_id,
        p_employee_id, 'Gift card redeemed at checkout'
      );
    END IF;

    FOR v_redemption IN SELECT value FROM jsonb_array_elements(v_redemptions)
    LOOP
      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, units, service_id,
        invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, (v_redemption->>'entitlement_id')::uuid, 'REDEEM',
        (v_redemption->>'amount')::numeric,
        NULLIF(v_redemption->>'units', '')::integer,
        NULLIF(v_redemption->>'service_id', '')::uuid,
        v_invoice_id, p_employee_id, 'Entitlement redeemed at checkout'
      );
    END LOOP;

    UPDATE public.customers c
    SET total_spent = COALESCE(c.total_spent, 0) + v_net,
        loyalty_points = greatest(0, COALESCE(c.loyalty_points, 0) - v_loyalty_discount::integer)
          + v_earned_points,
        last_visit = now(),
        updated_at = now()
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;

    SELECT to_jsonb(i) INTO v_updated_invoice
    FROM public.invoices i WHERE i.id = v_invoice_id;

    RETURN jsonb_build_object(
      'invoice', v_updated_invoice,
      'payment_id', v_payment_id,
      'subtotal', v_subtotal,
      'manual_discount', v_manual_discount,
      'tier_discount', v_tier_discount,
      'loyalty_discount', v_loyalty_discount,
      'gift_card_redeemed', v_gift_card_discount,
      'entitlement_redeemed', v_entitlement_redemption,
      'tax', v_tax_amount,
      'total', v_total,
      'earned', v_earned_points,
      'gift_cards_issued', v_issued_cards,
      'package_entitlements', v_package_ents
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Governed entitlement lifecycle RPCs (actor + reason, append-only)
-- -----------------------------------------------------------------------------
-- Refund: only unused remaining value can be refunded; the reversing ledger
-- entry carries the reason and actor. Cash returned to the customer is an
-- operator action; this RPC releases the outstanding obligation.
CREATE OR REPLACE FUNCTION public.refund_entitlement_v1(
  p_entitlement_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_actor_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_ent public.customer_entitlements%ROWTYPE;
  v_balance NUMERIC(12,3);
BEGIN
  IF p_entitlement_id IS NULL OR p_amount IS NULL OR
     p_amount = 'NaN'::numeric OR p_amount <= 0 OR p_amount <> round(p_amount, 3) THEN
    RAISE EXCEPTION 'invalid_refund_amount' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'refund_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ent
  FROM public.customer_entitlements ce
  WHERE ce.id = p_entitlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entitlement_not_found' USING ERRCODE = '23503';
  END IF;

  IF NOT app_private.is_center_member(v_ent.center_id) THEN
    RAISE EXCEPTION 'unauthorized_entitlement_center' USING ERRCODE = '42501';
  END IF;

  IF p_actor_employee_id IS NULL THEN
    RAISE EXCEPTION 'refund_actor_required' USING ERRCODE = '23502';
  END IF;
  PERFORM 1 FROM public.employees e
  WHERE e.id = p_actor_employee_id AND e.center_id = v_ent.center_id AND e.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_actor_not_available' USING ERRCODE = '23503';
  END IF;

  IF v_ent.status IN ('REFUNDED', 'VOID') THEN
    RAISE EXCEPTION 'entitlement_not_refundable' USING ERRCODE = '23514';
  END IF;
  IF v_ent.remaining_value <= 0 THEN
    RAISE EXCEPTION 'entitlement_not_refundable' USING ERRCODE = '23514';
  END IF;
  IF p_amount > v_ent.remaining_value + 0.0005 THEN
    RAISE EXCEPTION 'entitlement_refund_exceeds_remaining' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.entitlement_ledger (
    center_id, entitlement_id, entry_type, amount, actor_id, reason
  ) VALUES (
    v_ent.center_id, v_ent.id, 'REFUND', p_amount, p_actor_employee_id,
    'Refund: ' || btrim(p_reason)
  );

  SELECT remaining_value INTO v_balance
  FROM public.customer_entitlements ce WHERE ce.id = v_ent.id;

  RETURN jsonb_build_object(
    'entitlement_id', v_ent.id,
    'refunded', p_amount,
    'remaining_after', v_balance
  );
END;
$$;

-- Void: governed correction for untouched instruments (never redeemed).
CREATE OR REPLACE FUNCTION public.void_entitlement_v1(
  p_entitlement_id UUID,
  p_reason TEXT,
  p_actor_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_ent public.customer_entitlements%ROWTYPE;
  v_center_id UUID;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'void_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ent
  FROM public.customer_entitlements ce
  WHERE ce.id = p_entitlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entitlement_not_found' USING ERRCODE = '23503';
  END IF;
  v_center_id := v_ent.center_id;

  IF NOT app_private.is_center_member(v_center_id) THEN
    RAISE EXCEPTION 'unauthorized_entitlement_center' USING ERRCODE = '42501';
  END IF;

  IF p_actor_employee_id IS NULL THEN
    RAISE EXCEPTION 'void_actor_required' USING ERRCODE = '23502';
  END IF;
  PERFORM 1 FROM public.employees e
  WHERE e.id = p_actor_employee_id AND e.center_id = v_center_id AND e.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'void_actor_not_available' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.entitlement_ledger (
    center_id, entitlement_id, entry_type, amount, actor_id, reason
  ) VALUES (
    v_center_id, v_ent.id, 'VOID', 0, p_actor_employee_id,
    'Void: ' || btrim(p_reason)
  );

  RETURN jsonb_build_object('entitlement_id', v_ent.id, 'status', 'VOID');
END;
$$;

-- Expiry: governed, audited, and explicitly WITHOUT breakage recognition.
-- The outstanding balance remains a liability; a future controlled breakage
-- policy (product/legal decision) can recognize it through a signed
-- ADJUSTMENT or a dedicated governed RPC. Nothing runs automatically.
CREATE OR REPLACE FUNCTION public.expire_entitlement_v1(
  p_entitlement_id UUID,
  p_reason TEXT,
  p_actor_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_ent public.customer_entitlements%ROWTYPE;
  v_center_id UUID;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'expiry_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ent
  FROM public.customer_entitlements ce
  WHERE ce.id = p_entitlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entitlement_not_found' USING ERRCODE = '23503';
  END IF;
  v_center_id := v_ent.center_id;

  IF NOT app_private.is_center_member(v_center_id) THEN
    RAISE EXCEPTION 'unauthorized_entitlement_center' USING ERRCODE = '42501';
  END IF;

  IF p_actor_employee_id IS NULL THEN
    RAISE EXCEPTION 'expiry_actor_required' USING ERRCODE = '23502';
  END IF;
  PERFORM 1 FROM public.employees e
  WHERE e.id = p_actor_employee_id AND e.center_id = v_center_id AND e.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'expiry_actor_not_available' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.entitlement_ledger (
    center_id, entitlement_id, entry_type, amount, actor_id, reason
  ) VALUES (
    v_center_id, v_ent.id, 'EXPIRY', 0, p_actor_employee_id,
    'Expiry recorded (breakage NOT recognized): ' || btrim(p_reason)
  );

  RETURN jsonb_build_object('entitlement_id', v_ent.id, 'status', 'EXPIRED');
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Deprecate the unbooked gift-card issuance
-- -----------------------------------------------------------------------------
-- The old issuance created a card with NO payment collection, which hid cash
-- from the books. It now fails with a clear direction to checkout.
CREATE OR REPLACE FUNCTION public.issue_gift_card_v1(
  p_center_id UUID,
  p_code TEXT,
  p_initial_balance NUMERIC,
  p_customer_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
BEGIN
  RAISE EXCEPTION 'issue_gift_card_v1_deprecated' USING ERRCODE = '0A000',
    HINT = 'Sell the gift card through process_checkout_v1 with a gift_card line item so the payment and the deferred obligation are recorded atomically.';
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. Grants
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.void_entitlement_v1(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_entitlement_v1(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.void_entitlement_v1(UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.expire_entitlement_v1(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_entitlement_v1(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.expire_entitlement_v1(UUID, TEXT, UUID) TO authenticated;

COMMIT;
