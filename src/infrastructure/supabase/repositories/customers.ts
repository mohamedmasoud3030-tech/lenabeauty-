import { CustomerRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Customer, Appointment, Invoice } from "../../../domain/entities";
import { createUnsupportedWriteError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { TablesInsert, TablesUpdate } from ".././database.types";
import { mapCustomer, mapAppointment, mapInvoice } from ".././mappers";
import { requiredText, phoneField, emailField } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor, deleteById } from "./shared";

export class SupabaseCustomerAdapter implements CustomerRepository {
  async list(query?: string): Promise<Result<Customer[], DomainError>> {
    const centerRes = getCenterIdFor("Customer.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const q = query?.trim();
      if (q) {
        // Use typed filters rather than interpolating user text into raw
        // PostgREST disjunction grammar. Merge duplicate matches by id.
        const [byName, byPhone] = await Promise.all([
          client.from('customers').select('*')
            .eq('center_id', centerRes.data)
            .ilike('name', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(50),
          client.from('customers').select('*')
            .eq('center_id', centerRes.data)
            .ilike('phone', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);
        if (byName.error) return { ok: false, error: createQueryError("Customer.list", byName.error.message) };
        if (byPhone.error) return { ok: false, error: createQueryError("Customer.list", byPhone.error.message) };
        const merged = new Map<string, any>();
        for (const row of [...(byName.data || []), ...(byPhone.data || [])]) merged.set(row.id, row);
        return {
          ok: true,
          data: [...merged.values()]
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .map(mapCustomer),
        };
      }

      const { data, error } = await client
        .from('customers')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("Customer.list", error.message) };
      return { ok: true, data: data.map(mapCustomer) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.list", (e as Error).message) };
    }
  }

  async getById(id: string): Promise<Result<Customer, DomainError>> {
    const centerRes = getCenterIdFor("Customer.getById");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Customer.getById", error.message) };
      if (!data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return { ok: true, data: mapCustomer(data) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.getById", (e as Error).message) };
    }
  }

  async create(data: Partial<Customer>): Promise<Result<Customer, DomainError>> {
    const centerRes = getCenterIdFor("Customer.create");
    if (!centerRes.ok) return centerRes as any;

    const nameR = requiredText(data.name);
    const phoneR = phoneField(data.phone);
    const emailR = emailField(data.email);
    const boundary = validatePayload([
      { field: "name", result: nameR },
      { field: "phone", result: phoneR },
      { field: "email", result: emailR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesInsert<"customers"> = {
        center_id: centerRes.data,
        name: okValue(nameR),
        category: data.category,
        phone: okValue(phoneR),
        email: okValue(emailR),
        notes: data.notes,
        total_spent: data.totalSpent,
        loyalty_points: data.loyaltyPoints,
      };

      const { data: row, error } = await getSupabaseClient()
        .from('customers')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Customer.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Customer.create", "No data returned after insert") };
      return { ok: true, data: mapCustomer(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Customer>): Promise<Result<Customer, DomainError>> {
    const centerRes = getCenterIdFor("Customer.update");
    if (!centerRes.ok) return centerRes as any;

    const nameR = data.name !== undefined ? requiredText(data.name) : null;
    const phoneR = data.phone !== undefined ? phoneField(data.phone) : null;
    const emailR = data.email !== undefined ? emailField(data.email) : null;
    const boundary = validatePayload([
      ...(nameR ? [{ field: "name", result: nameR }] : []),
      ...(phoneR ? [{ field: "phone", result: phoneR }] : []),
      ...(emailR ? [{ field: "email", result: emailR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesUpdate<"customers"> = {};
      if (data.name !== undefined) payload.name = okValue(nameR);
      if (data.category !== undefined) payload.category = data.category;
      if (data.phone !== undefined) payload.phone = okValue(phoneR);
      if (data.email !== undefined) payload.email = okValue(emailR);
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.totalSpent !== undefined) payload.total_spent = data.totalSpent;
      if (data.loyaltyPoints !== undefined) payload.loyalty_points = data.loyaltyPoints;
      
      // Explicitly delete center_id from payload if it exists to prevent tenant reassignment
      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('customers')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Customer.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Customer.update", "No data returned after update") };
      return { ok: true, data: mapCustomer(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.update", (e as Error).message) };
    }
  }

  async rotatePortalToken(id: string): Promise<Result<{ customerId: string; portalAccessToken: string }, DomainError>> {
    const centerRes = getCenterIdFor("Customer.rotatePortalToken");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('rotate_customer_portal_token_v1', {
        p_center_id: centerRes.data,
        p_customer_id: id,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Customer.rotatePortalToken") };
        }
        return { ok: false, error: createQueryError("Customer.rotatePortalToken", error.message) };
      }
      const row = (data || {}) as any;
      if (!row.customer_id || !row.portal_access_token) {
        return { ok: false, error: createQueryError("Customer.rotatePortalToken", "Invalid response from portal token RPC") };
      }
      return { ok: true, data: { customerId: String(row.customer_id), portalAccessToken: String(row.portal_access_token) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.rotatePortalToken", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    return deleteById('customers', 'Customer.delete', id);
  }

  async getHistory(id: string): Promise<Result<{ appointments: Appointment[], invoices: Invoice[] }, DomainError>> {
    const centerRes = getCenterIdFor("Customer.getHistory");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [apptsRes, invsRes] = await Promise.all([
        client.from('appointments').select(`
          *,
          customers (id, name, phone),
          employees (id, name),
          services (id, name, category_id, price, duration_minutes)
        `).eq('customer_id', id).eq('center_id', centerRes.data).order('date_time', { ascending: false }),
        client.from('invoices').select('*').eq('customer_id', id).eq('center_id', centerRes.data).eq('status', 'PAID').order('date', { ascending: false })
      ]);

      if (apptsRes.error) return { ok: false, error: createQueryError("Customer.getHistory", apptsRes.error.message) };
      if (invsRes.error) return { ok: false, error: createQueryError("Customer.getHistory", invsRes.error.message) };

      return {
        ok: true,
        data: {
          appointments: (apptsRes.data || []).map(mapAppointment),
          invoices: (invsRes.data || []).map(mapInvoice)
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.getHistory", (e as Error).message) };
    }
  }
}
