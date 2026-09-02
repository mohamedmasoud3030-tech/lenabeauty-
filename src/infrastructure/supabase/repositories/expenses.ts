import { ExpenseRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Expense } from "../../../domain/entities";
import { createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { TablesInsert, TablesUpdate } from ".././database.types";
import { mapExpense } from ".././mappers";
import { requiredText, positiveNumber } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor } from "./shared";

export class SupabaseExpenseAdapter implements ExpenseRepository {
  async list(): Promise<Result<Expense[], DomainError>> {
    const centerRes = getCenterIdFor("Expense.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('expenses')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('date', { ascending: false });

      if (error) return { ok: false, error: createQueryError("Expense.list", error.message) };
      return { ok: true, data: data.map(mapExpense) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Expense>): Promise<Result<Expense, DomainError>> {
    const centerRes = getCenterIdFor("Expense.create");
    if (!centerRes.ok) return centerRes as any;

    const amountR = positiveNumber(data.amount);
    const categoryR = requiredText(data.category);
    const boundary = validatePayload([
      { field: "amount", result: amountR },
      { field: "category", result: categoryR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesInsert<"expenses"> = {
        center_id: centerRes.data,
        amount: okValue(amountR),
        category: okValue(categoryR),
        description: data.description,
        date: data.date ? new Date(data.date).toISOString() : new Date().toISOString()
      };

      const { data: row, error } = await getSupabaseClient()
        .from('expenses')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Expense.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Expense.create", "No data returned") };
      return { ok: true, data: mapExpense(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Expense>): Promise<Result<Expense, DomainError>> {
    const centerRes = getCenterIdFor("Expense.update");
    if (!centerRes.ok) return centerRes as any;

    const amountR = data.amount !== undefined ? positiveNumber(data.amount) : null;
    const categoryR = data.category !== undefined ? requiredText(data.category) : null;
    const boundary = validatePayload([
      ...(amountR ? [{ field: "amount", result: amountR }] : []),
      ...(categoryR ? [{ field: "category", result: categoryR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesUpdate<"expenses"> = {};
      if (data.amount !== undefined) payload.amount = okValue(amountR);
      if (data.category !== undefined) payload.category = okValue(categoryR);
      if (data.description !== undefined) payload.description = data.description;
      if (data.date !== undefined) payload.date = data.date.toISOString();

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Expense.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Expense.update", "No data returned") };
      return { ok: true, data: mapExpense(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Expense.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Expense.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.delete", (e as Error).message) };
    }
  }
}
