-- Cover foreign-key access paths introduced by visit/service-recipe tables.
-- These are additive and intentionally scoped to Slice A/D tables only.

CREATE INDEX IF NOT EXISTS idx_service_recipes_service
  ON public.service_recipes(service_id);

CREATE INDEX IF NOT EXISTS idx_service_recipe_items_center
  ON public.service_recipe_items(center_id);

CREATE INDEX IF NOT EXISTS idx_service_recipe_items_product
  ON public.service_recipe_items(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_center
  ON public.inventory_consumptions(center_id);

CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_service
  ON public.inventory_consumptions(service_id);

CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_product
  ON public.inventory_consumptions(product_id);
