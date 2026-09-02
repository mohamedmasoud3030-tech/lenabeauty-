import { ReportRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { createUnsupportedReadError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { SalesReportRow, AppointmentReportRow, InventoryReportRow } from "../../../application/dto";
import { mapSalesReportRows } from ".././salesReportMapper";
import { localDateRangeISO } from "../../../shared/dateRange";
import { getCenterIdFor, isMissingBackendFeature } from "./shared";

export class SupabaseReportAdapter implements ReportRepository {
  async getSales(fromStr: string, toStr: string): Promise<Result<SalesReportRow[], DomainError>> {
    const centerRes = getCenterIdFor("Report.getSales");
    if (!centerRes.ok) return centerRes as any;

    try {
      const range = localDateRangeISO(fromStr, toStr);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('invoices')
        .select(`
          *,
          customers (name),
          invoice_items (
            id,
            invoice_id,
            service_id,
            product_id,
            package_id,
            gift_card_id,
            item_name,
            price,
            quantity,
            created_at,
            services (name),
            products (name),
            service_packages (name),
            gift_cards (code)
          )
        `)
        .eq('center_id', centerRes.data)
        .eq('status', 'PAID')
        .gte('date', range.fromISO)
        .lt('date', range.toExclusiveISO)
        .order('date', { ascending: false });

      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Report.getSales") };
        return { ok: false, error: createQueryError("Report.getSales", error.message) };
      }

      // Ledger-derived redemption value per invoice (authoritative). Invoices
      // without ledger rows keep their legacy gift_card_discount classification.
      // The redemption lookup is keyed by the range's invoice ids, not by
      // ledger date, so a redemption posted after its invoice date still
      // classifies the invoice correctly.
      const redemptionByInvoice = new Map<string, number>();
      const invoiceIds = (data || [])
        .map((raw: any) => typeof raw?.id === "string" ? raw.id : undefined)
        .filter((id: string | undefined): id is string => Boolean(id));
      for (let i = 0; i < invoiceIds.length; i += 900) {
        const chunk = invoiceIds.slice(i, i + 900);
        const ledgerRes = await client
          .from('entitlement_ledger')
          .select('invoice_id, amount')
          .eq('center_id', centerRes.data)
          .eq('entry_type', 'REDEEM')
          .not('invoice_id', 'is', null)
          .in('invoice_id', chunk);
        // A failed redemption lookup must NOT be ignored. Skipping it silently
        // reclassifies prepaid redemptions as ordinary cash revenue, so the
        // Sales report would overstate real income with no visible warning.
        if (ledgerRes.error) {
          if (isMissingBackendFeature(ledgerRes.error)) return { ok: false, error: createUnsupportedReadError("Report.getSales") };
          return { ok: false, error: createQueryError("Report.getSales", `entitlement_ledger: ${ledgerRes.error.message}`) };
        }
        for (const entry of (ledgerRes.data || []) as any[]) {
          if (typeof entry.invoice_id !== "string") continue;
          const amount = Number(entry.amount) || 0;
          redemptionByInvoice.set(entry.invoice_id, (redemptionByInvoice.get(entry.invoice_id) || 0) + amount);
        }
      }

      // Defensive mapping: missing/invalid invoice or item rows are skipped
      // individually — the report must never crash on incomplete data.
      const rows: SalesReportRow[] = mapSalesReportRows(data || [], redemptionByInvoice);

      return { ok: true, data: rows };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Report.getSales", (e as Error).message) };
    }
  }
  async getAppointments(fromStr: string, toStr: string): Promise<Result<AppointmentReportRow[], DomainError>> {
    const centerRes = getCenterIdFor("Report.getAppointments");
    if (!centerRes.ok) return centerRes as any;

    try {
      const range = localDateRangeISO(fromStr, toStr);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('appointments')
        .select(`
          id, date_time, status,
          customer_id, employee_id, service_id,
          customers (name),
          employees (name),
          services (name)
        `)
        .eq('center_id', centerRes.data)
        .gte('date_time', range.fromISO)
        .lt('date_time', range.toExclusiveISO)
        .order('date_time', { ascending: false });

      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Report.getAppointments") };
        return { ok: false, error: createQueryError("Report.getAppointments", error.message) };
      }

      // Defensive: a malformed row is skipped rather than crashing the report.
      const rows: AppointmentReportRow[] = [];
      for (const raw of data || []) {
        const d = raw as any;
        if (!d || typeof d.id !== "string" || typeof d.date_time !== "string") continue;
        rows.push({
          id: d.id,
          dateTime: d.date_time,
          status: typeof d.status === "string" ? d.status : "SCHEDULED",
          customer: d.customers && typeof d.customers.name === "string" ? { name: d.customers.name } : undefined,
          employee: d.employees && typeof d.employees.name === "string" ? { name: d.employees.name } : undefined,
          service: d.services && typeof d.services.name === "string" ? { name: d.services.name } : undefined
        });
      }

      return { ok: true, data: rows };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Report.getAppointments", (e as Error).message) };
    }
  }
  async getInventory(): Promise<Result<InventoryReportRow[], DomainError>> {
    const centerRes = getCenterIdFor("Report.getInventory");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('products')
        .select('id, name, cost, price, stock_quantity')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Report.getInventory", error.message) };

      const rows: InventoryReportRow[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        cost: Number(d.cost) || 0,
        price: Number(d.price) || 0,
        stockQuantity: Number(d.stock_quantity) || 0
      }));

      return { ok: true, data: rows };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Report.getInventory", (e as Error).message) };
    }
  }
}
