import { Result, DomainError, CustomerExperienceRepository, ForecastRepository, AccountingRepository, AdvancedRepository } from "../../../domain/ports/repositories";
import { createUnsupportedWriteError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { mapCustomerReview, mapServiceFile, mapAccountingJournalEntry, mapAiBookingLead } from ".././mappers";
import { requiredText, nonNegativeNumber, phoneField, numberField } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor } from "./shared";

export class SupabaseCustomerExperienceAdapter implements CustomerExperienceRepository {
  async listReviews(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.listReviews");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().from('customer_reviews').select('*').eq('center_id', centerRes.data).order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("CustomerExperience.listReviews", error.message) };
      return { ok: true, data: (data || []).map(mapCustomerReview) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.listReviews", (e as Error).message) };
    }
  }

  async createReview(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.createReview");
    if (!centerRes.ok) return centerRes as any;

    const customerR = requiredText(input.customerId);
    const ratingR = numberField(input.rating, { min: 1, max: 5, integer: true, allowZero: false });
    const boundary = validatePayload([
      { field: "customer", result: customerR },
      { field: "rating", result: ratingR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const { data, error } = await getSupabaseClient().rpc('create_customer_review_v1', {
        p_center_id: centerRes.data,
        p_customer_id: okValue(customerR),
        p_appointment_id: input.appointmentId || null,
        p_rating: okValue(ratingR),
        p_comment: input.comment || null,
        p_is_published: Boolean(input.isPublished),
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("CustomerExperience.createReview") };
        return { ok: false, error: createQueryError("CustomerExperience.createReview", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.review) return { ok:false, error:createQueryError("CustomerExperience.createReview","Invalid response") };
      return { ok:true, data: mapCustomerReview(row.review) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.createReview", (e as Error).message) };
    }
  }

  async listServiceFiles(customerId?: string): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.listServiceFiles");
    if (!centerRes.ok) return centerRes as any;
    try {
      let query = getSupabaseClient().from('service_files').select('*, images:service_file_images(*)').eq('center_id', centerRes.data).order('created_at', { ascending: false });
      if (customerId) query = query.eq('customer_id', customerId);
      const { data, error } = await query;
      if (error) return { ok: false, error: createQueryError("CustomerExperience.listServiceFiles", error.message) };
      return { ok: true, data: (data || []).map(mapServiceFile) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.listServiceFiles", (e as Error).message) };
    }
  }

  async createServiceFile(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.createServiceFile");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_service_file_v1', {
        p_center_id: centerRes.data,
        p_customer_id: input.customerId,
        p_appointment_id: input.appointmentId || null,
        p_service_id: input.serviceId || null,
        p_title: input.title,
        p_note: input.note || null,
        p_before_images: input.beforeImages || [],
        p_after_images: input.afterImages || [],
        p_reference_images: input.referenceImages || [],
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("CustomerExperience.createServiceFile") };
        return { ok: false, error: createQueryError("CustomerExperience.createServiceFile", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.service_file) return { ok:false, error:createQueryError("CustomerExperience.createServiceFile","Invalid response") };
      return { ok:true, data: mapServiceFile({ ...row.service_file, images: [] }) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.createServiceFile", (e as Error).message) };
    }
  }
}

export class SupabaseForecastAdapter implements ForecastRepository {
  async getInventoryForecast(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("Forecast.getInventoryForecast");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [productsRes, itemsRes] = await Promise.all([
        client.from('products').select('*').eq('center_id', centerRes.data),
        // `invoice_items` carries no center_id of its own; it inherits tenancy
        // from its parent invoice. RLS already restricts the rows, but the
        // filter is stated explicitly through the invoice relationship so the
        // forecast stays correct if this user is ever a member of more than one
        // center (multi-branch mode), where an unscoped read would blend another
        // branch's product usage into this branch's reorder alerts.
        client.from('invoice_items')
          .select('product_id, quantity, created_at, invoices!inner(center_id)')
          .eq('invoices.center_id', centerRes.data)
          .not('product_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
      ]);
      if (productsRes.error) return { ok:false, error:createQueryError("Forecast.getInventoryForecast", productsRes.error.message)};
      if (itemsRes.error) return { ok:false, error:createQueryError("Forecast.getInventoryForecast", itemsRes.error.message)};
      const usage = new Map();
      for (const item of (itemsRes.data||[])) usage.set(item.product_id, (usage.get(item.product_id)||0)+Number(item.quantity||0));
      return { ok:true, data:(productsRes.data||[]).map((p:any)=>{ const sold=Number(usage.get(p.id)||0); const avg=sold/30; const stock=Number(p.stock_quantity)||0; const days=avg>0?stock/avg:999; return { productId:String(p.id), productName:String(p.name||''), stockQuantity:stock, averageDailyUnits:Number(avg.toFixed(2)), daysRemaining:Number(days.toFixed(1)), reorderAlert:days <= 14 || stock <= 5 }; }) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Forecast.getInventoryForecast", (e as Error).message) };
    }
  }

  async getFinancialForecast(): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Forecast.getFinancialForecast");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const since = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const [invoicesRes, expensesRes] = await Promise.all([
        client.from('invoices').select('total_amount, tax, created_at').eq('center_id', centerRes.data).eq('status', 'PAID').gte('created_at', since),
        client.from('expenses').select('amount, created_at').eq('center_id', centerRes.data).gte('created_at', since),
      ]);
      if (invoicesRes.error) return { ok:false, error:createQueryError("Forecast.getFinancialForecast", invoicesRes.error.message)};
      if (expensesRes.error) return { ok:false, error:createQueryError("Forecast.getFinancialForecast", expensesRes.error.message)};
      const revenue=(invoicesRes.data||[]).reduce((s:any,r:any)=>s+Number(r.total_amount||0),0);
      const expenses=(expensesRes.data||[]).reduce((s:any,r:any)=>s+Number(r.amount||0),0);
      const daily=revenue/30;
      return { ok:true, data:{ projectedMonthlyRevenue:Number(revenue.toFixed(2)), projectedMonthlyExpenses:Number(expenses.toFixed(2)), projectedMonthlyProfit:Number((revenue-expenses).toFixed(2)), revenueRunRateDaily:Number(daily.toFixed(2)) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Forecast.getFinancialForecast", (e as Error).message) };
    }
  }
}

export class SupabaseAccountingAdapter implements AccountingRepository {
  async listJournalEntries(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("Accounting.listJournalEntries");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().from('accounting_journal_entries').select('*').eq('center_id', centerRes.data).order('entry_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) return { ok:false, error:createQueryError("Accounting.listJournalEntries", error.message) };
      return { ok:true, data:(data||[]).map(mapAccountingJournalEntry) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Accounting.listJournalEntries", (e as Error).message) };
    }
  }
  async createJournalEntry(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Accounting.createJournalEntry");
    if (!centerRes.ok) return centerRes as any;

    const descR = requiredText(input.description);
    const amountR = nonNegativeNumber(input.amount);
    const boundary = validatePayload([
      { field: "description", result: descR },
      { field: "amount", result: amountR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const { data, error } = await getSupabaseClient().rpc('create_accounting_journal_entry_v1', {
        p_center_id: centerRes.data,
        p_entry_date: input.entryDateISO || null,
        p_entry_type: input.entryType,
        p_reference_type: input.referenceType || null,
        p_reference_id: input.referenceId || null,
        p_description: okValue(descR),
        p_debit_account: input.debitAccount,
        p_credit_account: input.creditAccount,
        p_amount: okValue(amountR),
        p_currency: input.currency || 'OMR',
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("Accounting.createJournalEntry") };
        return { ok: false, error: createQueryError("Accounting.createJournalEntry", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.entry) return { ok:false, error:createQueryError("Accounting.createJournalEntry","Invalid response") };
      return { ok:true, data: mapAccountingJournalEntry(row.entry) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Accounting.createJournalEntry", (e as Error).message) };
    }
  }
}

export class SupabaseAdvancedAdapter implements AdvancedRepository {
  async listAiBookingLeads(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("Advanced.listAiBookingLeads");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().from('ai_booking_leads').select('*').eq('center_id', centerRes.data).order('created_at', { ascending: false });
      if (error) return { ok:false, error:createQueryError("Advanced.listAiBookingLeads", error.message) };
      return { ok:true, data:(data||[]).map(mapAiBookingLead) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advanced.listAiBookingLeads", (e as Error).message) };
    }
  }
  async createAiBookingLead(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Advanced.createAiBookingLead");
    if (!centerRes.ok) return centerRes as any;

    const nameR = requiredText(input.customerName);
    const phoneR = phoneField(input.customerPhone);
    const boundary = validatePayload([
      { field: "customerName", result: nameR },
      { field: "customerPhone", result: phoneR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const { data, error } = await getSupabaseClient().rpc('create_ai_booking_lead_v1', {
        p_center_id: centerRes.data,
        p_customer_name: okValue(nameR),
        p_customer_phone: okValue(phoneR) || null,
        p_preferred_service_id: input.preferredServiceId || null,
        p_preferred_date: input.preferredDateISO || null,
        p_source_channel: input.sourceChannel || 'WEB',
        p_summary: input.summary || null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("Advanced.createAiBookingLead") };
        return { ok: false, error: createQueryError("Advanced.createAiBookingLead", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.lead) return { ok:false, error:createQueryError("Advanced.createAiBookingLead","Invalid response") };
      return { ok:true, data: mapAiBookingLead(row.lead) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advanced.createAiBookingLead", (e as Error).message) };
    }
  }
}
