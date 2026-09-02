import { InvoiceRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Customer, Invoice } from "../../../domain/entities";
import { createUnsupportedWriteError, createUnsupportedReadError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { mapCustomer, mapCenterSettings, mapInvoice } from ".././mappers";
import { DomainValidationError } from "../../../domain/validation";
import { CheckoutPayload, InvoicePrintData } from "../../../application/dto";
import { mapInvoicePrintItems } from ".././salesReportMapper";
import { validateCheckoutContract } from "../../../domain/commerce";
import { getCenterIdFor, isMissingBackendFeature, createOperationId, toJson, resolveCenterAssetUrl } from "./shared";

export class SupabaseInvoiceAdapter implements InvoiceRepository {
  private pendingCheckout: { fingerprint: string; requestId: string } | null = null;

  async checkout(payload: CheckoutPayload): Promise<Result<{ invoice: Invoice, total: number, earned: number, giftCardRedeemed?: number, entitlementRedeemed?: number, giftCardsIssued?: { code: string; gift_card_id: string; value: number }[], packageEntitlements?: string[] }, DomainError>> {
    const contractErrors = validateCheckoutContract(payload);
    if (contractErrors.length > 0) {
      return {
        ok: false,
        error: new DomainValidationError(
          contractErrors.map((_, index) => ({ field: `checkout.${index}`, key: "validation.number_positive" })),
          contractErrors.join("; "),
        ),
      };
    }

    const centerRes = getCenterIdFor("Invoice.checkout");
    if (!centerRes.ok) return centerRes as any;

    const fingerprint = JSON.stringify(payload);
    if (!this.pendingCheckout || this.pendingCheckout.fingerprint !== fingerprint) {
      this.pendingCheckout = { fingerprint, requestId: createOperationId() };
    }

    try {
      const { data, error } = await getSupabaseClient().rpc('process_checkout_idempotent_v1', {
        p_request_id: this.pendingCheckout.requestId,
        p_center_id: centerRes.data,
        p_customer_id: payload.customerId,
        p_employee_id: payload.employeeId,
        p_payment_method: payload.paymentMethod,
        p_discount_amount: payload.discountAmount ?? 0,
        p_use_loyalty_points: payload.useLoyaltyPoints || false,
        p_items: toJson(payload.items),
        p_gift_card_code: payload.giftCardCode || null,
        p_entitlement_redemptions: payload.entitlementRedemptions?.length ? toJson(payload.entitlementRedemptions) : null,
        p_appointment_id: payload.appointmentId || null
      });
      
      if (error) {
        // Handle missing RPC function specifically.
        // PostgREST returns PGRST202 or Postgres returns 42883 if not found.
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
           return { ok: false, error: createUnsupportedWriteError("Invoice.checkout") };
        }
        return { ok: false, error: createQueryError("Invoice.checkout", error.message) };
      }
      
      if (!data || typeof data !== 'object') {
         return { ok: false, error: createQueryError("Invoice.checkout", "Invalid response from checkout RPC") };
      }

      const row = data as any;
      const result = {
        invoice: mapInvoice(row.invoice),
        total: Number(row.total) || 0,
        earned: Number(row.earned) || 0,
        giftCardRedeemed: Number(row.gift_card_redeemed) || 0,
        entitlementRedeemed: Number(row.entitlement_redeemed) || 0,
        giftCardsIssued: Array.isArray(row.gift_cards_issued) ? row.gift_cards_issued : [],
        packageEntitlements: Array.isArray(row.package_entitlements) ? row.package_entitlements : []
      };
      this.pendingCheckout = null;
      return { ok: true, data: result };

    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Invoice.checkout", (e as Error).message) };
    }
  }

  async getForPrint(id: string): Promise<Result<InvoicePrintData, DomainError>> {
    const centerRes = getCenterIdFor("Invoice.getForPrint");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      const [invoiceRes, itemRes, settingsRes] = await Promise.all([
        client
          .from('invoices')
          .select('*, employees(name)')
          .eq('id', id)
          .eq('center_id', centerRes.data)
          .eq('status', 'PAID')
          .maybeSingle(),
        client
          .from('invoice_items')
          .select(`
            *,
            services (name),
            products (name),
            service_packages (name),
            gift_cards (code)
          `)
          .eq('invoice_id', id)
          .order('created_at', { ascending: true }),
        client
          .from('center_settings')
          .select('*')
          .eq('center_id', centerRes.data)
          .maybeSingle()
      ]);

      if (invoiceRes.error) {
        if (isMissingBackendFeature(invoiceRes.error)) return { ok: false, error: createUnsupportedReadError("Invoice.getForPrint") };
        return { ok: false, error: createQueryError("Invoice.getForPrint", invoiceRes.error.message) };
      }
      if (itemRes.error) {
        if (isMissingBackendFeature(itemRes.error)) return { ok: false, error: createUnsupportedReadError("Invoice.getForPrint") };
        return { ok: false, error: createQueryError("Invoice.getForPrint", itemRes.error.message) };
      }
      if (settingsRes.error) return { ok: false, error: createQueryError("Invoice.getForPrint", settingsRes.error.message) };
      if (!invoiceRes.data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };

      const invoice = mapInvoice(invoiceRes.data);
      let customer: Customer | undefined;
      if (invoice.customerId) {
        const customerRes = await client
          .from('customers')
          .select('*')
          .eq('id', invoice.customerId)
          .eq('center_id', centerRes.data)
          .maybeSingle();
        if (customerRes.error) return { ok: false, error: createQueryError("Invoice.getForPrint", customerRes.error.message) };
        customer = customerRes.data ? mapCustomer(customerRes.data) : undefined;
      }

      // Defensive: a broken item row (missing join, legacy package row) is
      // skipped instead of failing the whole invoice print.
      const items = mapInvoicePrintItems(itemRes.data || []);
      const settings = settingsRes.data ? mapCenterSettings(settingsRes.data) : undefined;
      if (settings) settings.logoPath = await resolveCenterAssetUrl(settings.logoPath);

      return {
        ok: true,
        data: {
          invoice,
          items,
          customer,
          settings,
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Invoice.getForPrint", (e as Error).message) };
    }
  }
}
