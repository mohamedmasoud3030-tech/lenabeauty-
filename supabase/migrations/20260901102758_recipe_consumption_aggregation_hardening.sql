-- Aggregate repeated invoice lines for the same service before consuming its
-- recipe. inventory_consumptions is idempotent on
-- (invoice_id, service_id, product_id); iterating raw duplicate service lines
-- would otherwise consume only the first line and silently ignore the rest.

CREATE OR REPLACE FUNCTION app_private.consume_invoice_recipes_v1(
  p_center_id UUID,
  p_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_line     RECORD;
  v_item     RECORD;
  v_recipe   UUID;
  v_total    NUMERIC(12,3);
  v_consumed INTEGER := 0;
BEGIN
  FOR v_line IN
    SELECT ii.service_id, SUM(ii.quantity)::NUMERIC AS service_qty
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id AND ii.service_id IS NOT NULL
    GROUP BY ii.service_id
  LOOP
    SELECT sr.id INTO v_recipe
    FROM public.service_recipes sr
    WHERE sr.service_id = v_line.service_id
      AND sr.center_id = p_center_id
      AND sr.is_active = true
    ORDER BY sr.updated_at DESC
    LIMIT 1;

    CONTINUE WHEN v_recipe IS NULL;

    FOR v_item IN
      SELECT sri.product_id, sri.quantity AS qty, sri.unit, sri.estimated_cost
      FROM public.service_recipe_items sri
      WHERE sri.recipe_id = v_recipe
    LOOP
      v_total := round(v_item.qty * v_line.service_qty, 3);

      INSERT INTO public.inventory_consumptions
        (center_id, invoice_id, service_id, product_id, quantity, unit, unit_cost)
      VALUES
        (p_center_id, p_invoice_id, v_line.service_id, v_item.product_id,
         v_total, v_item.unit, COALESCE(v_item.estimated_cost, 0))
      ON CONFLICT (invoice_id, service_id, product_id) DO NOTHING;

      IF FOUND THEN
        IF v_total = floor(v_total) THEN
          UPDATE public.products p
          SET stock_quantity = p.stock_quantity - v_total::integer
          WHERE p.id = v_item.product_id
            AND p.center_id = p_center_id
            AND p.track_inventory = true
            AND p.stock_quantity >= v_total::integer;
          IF NOT FOUND THEN
            PERFORM 1 FROM public.products p
            WHERE p.id = v_item.product_id
              AND p.center_id = p_center_id
              AND p.track_inventory = false;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'insufficient_consumable_stock' USING ERRCODE = '23514';
            END IF;
          END IF;
        END IF;
        v_consumed := v_consumed + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('consumed_lines', v_consumed);
END;
$$;

REVOKE ALL ON FUNCTION app_private.consume_invoice_recipes_v1(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
