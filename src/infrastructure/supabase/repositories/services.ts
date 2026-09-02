import { ServiceRepository, Result, DomainError, ServiceRecipeRepository, RecipeItemInput } from "../../../domain/ports/repositories";
import { Service, ServiceRecipe, InventoryConsumption } from "../../../domain/entities";
import { createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { Json, TablesInsert, TablesUpdate } from ".././database.types";
import { mapService, mapServiceRecipe, mapInventoryConsumption } from ".././mappers";
import { requiredText, positiveNumber, positiveInteger } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor, resolveServiceCategoryId, deleteById } from "./shared";

export class SupabaseServiceAdapter implements ServiceRepository {
  async list(): Promise<Result<Service[], DomainError>> {
    const centerRes = getCenterIdFor("Service.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('services')
        .select('*, service_categories(name)')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Service.list", error.message) };
      return { ok: true, data: data.map(mapService) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Service>): Promise<Result<Service, DomainError>> {
    const centerRes = getCenterIdFor("Service.create");
    if (!centerRes.ok) return centerRes as any;

    const nameR = requiredText(data.name);
    const categoryR = requiredText(data.categoryName ?? data.categoryId);
    const priceR = positiveNumber(data.price);
    const durationR = positiveInteger(data.durationMinutes ?? data.durationMins);
    const boundary = validatePayload([
      { field: "name", result: nameR },
      { field: "category", result: categoryR },
      { field: "price", result: priceR },
      { field: "duration", result: durationR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const categoryId = await resolveServiceCategoryId(centerRes.data, okValue(categoryR));
      const payload: TablesInsert<"services"> = {
        center_id: centerRes.data,
        name: okValue(nameR),
        category_id: categoryId,
        price: okValue(priceR),
        pricing_mode: data.pricingMode === "STARTING_FROM" ? "STARTING_FROM" : "FIXED",
        duration_minutes: okValue(durationR),
        is_active: data.isActive !== undefined ? data.isActive : true
      };

      const { data: row, error } = await getSupabaseClient()
        .from('services')
        .insert(payload)
        .select('*, service_categories(name)')
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Service.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Service.create", "No data returned after insert") };
      return { ok: true, data: mapService(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Service>): Promise<Result<Service, DomainError>> {
    const centerRes = getCenterIdFor("Service.update");
    if (!centerRes.ok) return centerRes as any;

    const nameR = data.name !== undefined ? requiredText(data.name) : null;
    const categoryInput = data.categoryName ?? data.categoryId;
    const categoryR = categoryInput !== undefined ? requiredText(categoryInput) : null;
    const priceR = data.price !== undefined ? positiveNumber(data.price) : null;
    const durationR = data.durationMinutes !== undefined ? positiveInteger(data.durationMinutes) : null;
    const boundary = validatePayload([
      ...(nameR ? [{ field: "name", result: nameR }] : []),
      ...(categoryR ? [{ field: "category", result: categoryR }] : []),
      ...(priceR ? [{ field: "price", result: priceR }] : []),
      ...(durationR ? [{ field: "duration", result: durationR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesUpdate<"services"> = {};
      if (data.name !== undefined) payload.name = okValue(nameR);
      if (categoryR) payload.category_id = await resolveServiceCategoryId(centerRes.data, okValue(categoryR));
      if (data.price !== undefined) payload.price = okValue(priceR);
      if (data.pricingMode !== undefined) payload.pricing_mode = data.pricingMode;
      if (data.durationMinutes !== undefined) payload.duration_minutes = okValue(durationR);
      if (data.isActive !== undefined) payload.is_active = data.isActive;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('services')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select('*, service_categories(name)')
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Service.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Service.update", "No data returned after update") };
      return { ok: true, data: mapService(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    return deleteById('services', 'Service.delete', id);
  }
}

export class SupabaseServiceRecipeAdapter implements ServiceRecipeRepository {
  async getForService(serviceId: string): Promise<Result<ServiceRecipe | null, DomainError>> {
    const centerRes = getCenterIdFor("ServiceRecipe.getForService");
    if (!centerRes.ok) return centerRes as any;
    if (!serviceId) return { ok: false, error: createQueryError("ServiceRecipe.getForService", "Service id is required") };
    try {
      const { data, error } = await getSupabaseClient()
        .from("service_recipes")
        .select("*, service_recipe_items(*)")
        .eq("service_id", serviceId)
        .eq("center_id", centerRes.data)
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("ServiceRecipe.getForService", error.message) };
      return { ok: true, data: data ? mapServiceRecipe(data) : null };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServiceRecipe.getForService", (e as Error).message) };
    }
  }

  async saveForService(serviceId: string, items: RecipeItemInput[]): Promise<Result<ServiceRecipe, DomainError>> {
    const centerRes = getCenterIdFor("ServiceRecipe.saveForService");
    if (!centerRes.ok) return centerRes as any;
    if (!serviceId) return { ok: false, error: createQueryError("ServiceRecipe.saveForService", "Service id is required") };
    try {
      const payloadItems = (items ?? []).map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unit: it.unit ?? null,
        estimatedCost: it.estimatedCost ?? 0,
      }));

      const { error } = await getSupabaseClient().rpc("save_service_recipe_v1", {
        p_center_id: centerRes.data,
        p_service_id: serviceId,
        p_items: payloadItems as unknown as Json,
      });

      if (error) return { ok: false, error: createQueryError("ServiceRecipe.saveForService", error.message) };

      // Re-read the saved recipe so the UI reflects the authoritative rows.
      return this.getForService(serviceId) as Promise<Result<ServiceRecipe, DomainError>>;
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServiceRecipe.saveForService", (e as Error).message) };
    }
  }

  async listConsumptions(input?: { limit?: number }): Promise<Result<InventoryConsumption[], DomainError>> {
    const centerRes = getCenterIdFor("ServiceRecipe.listConsumptions");
    if (!centerRes.ok) return centerRes as any;
    try {
      const limit = Math.min(50, Math.max(1, input?.limit ?? 10));
      const { data, error } = await getSupabaseClient()
        .from("inventory_consumptions")
        .select("*")
        .eq("center_id", centerRes.data)
        .order("consumed_at", { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: createQueryError("ServiceRecipe.listConsumptions", error.message) };
      return { ok: true, data: (data ?? []).map(mapInventoryConsumption) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServiceRecipe.listConsumptions", (e as Error).message) };
    }
  }
}
