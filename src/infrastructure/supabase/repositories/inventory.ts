import { ProductRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Product } from "../../../domain/entities";
import { createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { TablesInsert, TablesUpdate } from ".././database.types";
import { mapProduct } from ".././mappers";
import { requiredText, nonNegativeNumber, positiveNumber, nonNegativeInteger } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor } from "./shared";

export class SupabaseProductAdapter implements ProductRepository {
  async list(): Promise<Result<Product[], DomainError>> {
    const centerRes = getCenterIdFor("Product.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('products')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Product.list", error.message) };
      return { ok: true, data: data.map(mapProduct) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.list", (e as Error).message) };
    }
  }

  async listFull(): Promise<Result<Product[], DomainError>> {
    return this.list(); // Same mapped entity for now
  }

  async create(data: Partial<Product>): Promise<Result<Product, DomainError>> {
    const centerRes = getCenterIdFor("Product.create");
    if (!centerRes.ok) return centerRes as any;

    const nameR = requiredText(data.name);
    const priceR = positiveNumber(data.price);
    const costR = nonNegativeNumber(data.cost);
    const stockR = nonNegativeInteger(data.stockQuantity ?? 0);
    const reorderR = nonNegativeInteger(data.reorderLevel ?? 0);
    const boundary = validatePayload([
      { field: "name", result: nameR },
      { field: "price", result: priceR },
      { field: "cost", result: costR },
      { field: "stockQuantity", result: stockR },
      { field: "reorderLevel", result: reorderR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesInsert<"products"> = {
        center_id: centerRes.data,
        name: okValue(nameR),
        barcode: data.barcode,
        stock_quantity: okValue(stockR),
        reorder_level: okValue(reorderR),
        price: okValue(priceR),
        cost: okValue(costR),
        is_active: data.isActive !== undefined ? data.isActive : true,
        track_inventory: data.trackInventory !== undefined ? data.trackInventory : true
      };

      const { data: row, error } = await getSupabaseClient()
        .from('products')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Product.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Product.create", "No data returned") };
      return { ok: true, data: mapProduct(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Product>): Promise<Result<Product, DomainError>> {
    const centerRes = getCenterIdFor("Product.update");
    if (!centerRes.ok) return centerRes as any;

    const nameR = data.name !== undefined ? requiredText(data.name) : null;
    const priceR = data.price !== undefined ? positiveNumber(data.price) : null;
    const costR = data.cost !== undefined ? nonNegativeNumber(data.cost) : null;
    const stockR = data.stockQuantity !== undefined ? nonNegativeInteger(data.stockQuantity) : null;
    const reorderR = data.reorderLevel !== undefined ? nonNegativeInteger(data.reorderLevel) : null;
    const boundary = validatePayload([
      ...(nameR ? [{ field: "name", result: nameR }] : []),
      ...(priceR ? [{ field: "price", result: priceR }] : []),
      ...(costR ? [{ field: "cost", result: costR }] : []),
      ...(stockR ? [{ field: "stockQuantity", result: stockR }] : []),
      ...(reorderR ? [{ field: "reorderLevel", result: reorderR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesUpdate<"products"> = {};
      if (data.name !== undefined) payload.name = okValue(nameR);
      if (data.barcode !== undefined) payload.barcode = data.barcode;
      if (data.stockQuantity !== undefined) payload.stock_quantity = okValue(stockR);
      if (data.reorderLevel !== undefined) payload.reorder_level = okValue(reorderR);
      if (data.price !== undefined) payload.price = okValue(priceR);
      if (data.cost !== undefined) payload.cost = okValue(costR);
      if (data.isActive !== undefined) payload.is_active = data.isActive;
      if (data.trackInventory !== undefined) payload.track_inventory = data.trackInventory;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('products')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Product.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Product.update", "No data returned") };
      return { ok: true, data: mapProduct(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Product.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('products')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Product.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.delete", (e as Error).message) };
    }
  }
}
