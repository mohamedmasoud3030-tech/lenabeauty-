-- Service recipes are read directly by the client, but all writes must flow
-- through save_service_recipe_v1 so center/service/product validation cannot be
-- bypassed with direct table mutations.

REVOKE ALL ON TABLE public.service_recipes FROM anon;
REVOKE ALL ON TABLE public.service_recipe_items FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.service_recipes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.service_recipe_items FROM authenticated;

GRANT SELECT ON TABLE public.service_recipes TO authenticated;
GRANT SELECT ON TABLE public.service_recipe_items TO authenticated;

DROP POLICY IF EXISTS service_recipes_tenant ON public.service_recipes;
CREATE POLICY service_recipes_member_select ON public.service_recipes
  FOR SELECT TO authenticated
  USING (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS service_recipe_items_tenant ON public.service_recipe_items;
CREATE POLICY service_recipe_items_member_select ON public.service_recipe_items
  FOR SELECT TO authenticated
  USING (center_id = ANY (app_private.user_center_ids()));
