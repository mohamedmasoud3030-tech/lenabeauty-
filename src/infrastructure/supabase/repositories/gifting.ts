import { Result, DomainError, GiftCardRepository, ServicePackageRepository, EntitlementRepository } from "../../../domain/ports/repositories";
import { Customer, CustomerEntitlement, EntitlementLedgerEntry } from "../../../domain/entities";
import { createUnsupportedWriteError, createUnsupportedReadError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { mapGiftCard, mapGiftCardTransaction, mapServicePackage, mapCustomerEntitlement, mapEntitlementLedgerEntry } from ".././mappers";
import { requiredText, positiveNumber, positiveInteger, DomainValidationError } from "../../../domain/validation";
import { EntitlementSummary } from "../../../application/dto";
import { okValue, getCenterIdFor, isMissingBackendFeature, createOperationId, toJson, ENTITLEMENT_SELECT } from "./shared";

export class SupabaseGiftCardAdapter implements GiftCardRepository {
  private pendingIssue: { fingerprint: string; requestId: string } | null = null;
  async list(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("GiftCard.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('gift_cards')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("GiftCard.list", error.message) };
      return { ok: true, data: (data || []).map(mapGiftCard) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("GiftCard.list", (e as Error).message) };
    }
  }

  async issue(input: { code: string; initialBalance: number; customerId: string; employeeId: string; paymentMethod: "cash" | "card" | "transfer"; note?: string; expiresAtISO?: string }): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("GiftCard.issue");
    if (!centerRes.ok) return centerRes as any;

    // Client-side contract guard: a gift card sale needs an owner, an acting
    // employee, a payment method, and a positive value.
    if (!input.customerId || !input.employeeId || !["cash", "card", "transfer"].includes(input.paymentMethod)) {
      return { ok: false, error: createQueryError("GiftCard.issue", "Gift card sale requires a customer, an employee, and a payment method") };
    }
    const value = Number(input.initialBalance);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, error: createQueryError("GiftCard.issue", "Gift card value must be positive") };
    }

    const fingerprint = JSON.stringify(input);
    if (this.pendingIssue?.fingerprint !== fingerprint) {
      this.pendingIssue = { fingerprint, requestId: createOperationId() };
    }

    try {
      // Sell through the atomic checkout pipeline: the payment collection and
      // the deferred entitlement obligation are recorded in one transaction.
      const { data, error } = await getSupabaseClient().rpc('process_checkout_idempotent_v1', {
        p_request_id: this.pendingIssue.requestId,
        p_center_id: centerRes.data,
        p_customer_id: input.customerId,
        p_employee_id: input.employeeId,
        p_payment_method: input.paymentMethod,
        p_discount_amount: 0,
        p_use_loyalty_points: false,
        p_items: toJson([{
          type: "gift_card",
          code: input.code.trim().toUpperCase(),
          price: value,
          qty: 1,
          note: input.note || null,
          expiresAtISO: input.expiresAtISO || null,
        }]),
        p_gift_card_code: null,
        p_entitlement_redemptions: null,
        p_appointment_id: null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("GiftCard.issue") };
        }
        return { ok: false, error: createQueryError("GiftCard.issue", error.message) };
      }
      const row = (data || {}) as any;
      const issued = Array.isArray(row.gift_cards_issued) ? row.gift_cards_issued[0] : undefined;
      if (!issued?.gift_card_id) {
        return { ok: false, error: createQueryError("GiftCard.issue", "Invalid response from checkout RPC") };
      }
      const cardRes = await getSupabaseClient()
        .from('gift_cards')
        .select('*')
        .eq('id', issued.gift_card_id)
        .eq('center_id', centerRes.data)
        .maybeSingle();
      if (cardRes.error) return { ok: false, error: createQueryError("GiftCard.issue", cardRes.error.message) };
      if (!cardRes.data) return { ok: false, error: createQueryError("GiftCard.issue", "Issued card not found") };
      const card = mapGiftCard(cardRes.data);
      this.pendingIssue = null;
      return { ok: true, data: card };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("GiftCard.issue", (e as Error).message) };
    }
  }

  async getTransactions(giftCardId: string): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("GiftCard.getTransactions");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('gift_card_transactions')
        .select('*')
        .eq('center_id', centerRes.data)
        .eq('gift_card_id', giftCardId)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("GiftCard.getTransactions", error.message) };
      return { ok: true, data: (data || []).map(mapGiftCardTransaction) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("GiftCard.getTransactions", (e as Error).message) };
    }
  }
}

export class SupabaseEntitlementAdapter implements EntitlementRepository {
  async listForCustomer(customerId: string): Promise<Result<CustomerEntitlement[], DomainError>> {
    const centerRes = getCenterIdFor("Entitlement.listForCustomer");
    if (!centerRes.ok) return centerRes as any;
    if (!customerId) return { ok: false, error: createQueryError("Entitlement.listForCustomer", "Customer id is required") };
    try {
      const { data, error } = await getSupabaseClient()
        .from('customer_entitlements')
        .select(ENTITLEMENT_SELECT)
        .eq('center_id', centerRes.data)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Entitlement.listForCustomer") };
        return { ok: false, error: createQueryError("Entitlement.listForCustomer", error.message) };
      }
      return { ok: true, data: (data || []).map(mapCustomerEntitlement) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Entitlement.listForCustomer", (e as Error).message) };
    }
  }

  async list(query?: string): Promise<Result<CustomerEntitlement[], DomainError>> {
    const centerRes = getCenterIdFor("Entitlement.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const q = (query || "").trim().toLowerCase();
      const request = getSupabaseClient()
        .from('customer_entitlements')
        .select(ENTITLEMENT_SELECT)
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false })
        .limit(500);
      const { data, error } = await request;
      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Entitlement.list") };
        return { ok: false, error: createQueryError("Entitlement.list", error.message) };
      }
      const mapped = (data || []).map(mapCustomerEntitlement);
      const filtered = q
        ? mapped.filter((item) => [item.customerName, item.giftCardCode, item.instrumentName]
            .some((value) => value?.toLocaleLowerCase().includes(q)))
        : mapped;
      return { ok: true, data: filtered };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Entitlement.list", (e as Error).message) };
    }
  }

  async listLedger(entitlementId: string): Promise<Result<EntitlementLedgerEntry[], DomainError>> {
    const centerRes = getCenterIdFor("Entitlement.listLedger");
    if (!centerRes.ok) return centerRes as any;
    if (!entitlementId) return { ok: false, error: createQueryError("Entitlement.listLedger", "Entitlement id is required") };
    try {
      const { data, error } = await getSupabaseClient()
        .from('entitlement_ledger')
        .select(`
          *,
          employees (name),
          invoices (serial_number)
        `)
        .eq('center_id', centerRes.data)
        .eq('entitlement_id', entitlementId)
        .order('created_at', { ascending: false });
      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Entitlement.listLedger") };
        return { ok: false, error: createQueryError("Entitlement.listLedger", error.message) };
      }
      return { ok: true, data: (data || []).map(mapEntitlementLedgerEntry) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Entitlement.listLedger", (e as Error).message) };
    }
  }

  async refund(input: { entitlementId: string; amount: number; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; refunded: number; remainingAfter: number }, DomainError>> {
    const centerRes = getCenterIdFor("Entitlement.refund");
    if (!centerRes.ok) return centerRes as any;
    if (!input.entitlementId || !input.actorEmployeeId || !input.reason.trim()) {
      return { ok: false, error: createQueryError("Entitlement.refund", "Entitlement, acting employee, and reason are required") };
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: createQueryError("Entitlement.refund", "Refund amount must be positive") };
    }
    try {
      const { data, error } = await getSupabaseClient().rpc('refund_entitlement_v1', {
        p_entitlement_id: input.entitlementId,
        p_amount: input.amount,
        p_reason: input.reason,
        p_actor_employee_id: input.actorEmployeeId,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Entitlement.refund") };
        }
        return { ok: false, error: createQueryError("Entitlement.refund", error.message) };
      }
      const row = (data || {}) as any;
      return {
        ok: true,
        data: {
          entitlementId: row.entitlement_id,
          refunded: Number(row.refunded) || 0,
          remainingAfter: Number(row.remaining_after) || 0,
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Entitlement.refund", (e as Error).message) };
    }
  }

  async voidEntitlement(input: { entitlementId: string; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; status: string }, DomainError>> {
    return this.runGovernedRpc("void_entitlement_v1", { p_entitlement_id: input.entitlementId, p_reason: input.reason, p_actor_employee_id: input.actorEmployeeId }, "Entitlement.void");
  }

  async expire(input: { entitlementId: string; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; status: string }, DomainError>> {
    return this.runGovernedRpc("expire_entitlement_v1", { p_entitlement_id: input.entitlementId, p_reason: input.reason, p_actor_employee_id: input.actorEmployeeId }, "Entitlement.expire");
  }

  private async runGovernedRpc(
    rpcName: "void_entitlement_v1" | "expire_entitlement_v1",
    args: { p_entitlement_id: string; p_reason: string; p_actor_employee_id: string },
    label: string,
  ): Promise<Result<{ entitlementId: string; status: string }, DomainError>> {
    if (typeof args.p_entitlement_id !== "string" || !args.p_entitlement_id || typeof args.p_actor_employee_id !== "string" || !args.p_actor_employee_id || typeof args.p_reason !== "string" || !args.p_reason.trim()) {
      return { ok: false, error: createQueryError(label, "Entitlement, acting employee, and reason are required") };
    }
    try {
      const { data, error } = await getSupabaseClient().rpc(rpcName, args);
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError(label) };
        }
        return { ok: false, error: createQueryError(label, error.message) };
      }
      const row = (data || {}) as any;
      return { ok: true, data: { entitlementId: row.entitlement_id, status: row.status } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError(label, (e as Error).message) };
    }
  }

  async getSummary(): Promise<Result<EntitlementSummary, DomainError>> {
    const centerRes = getCenterIdFor("Entitlement.getSummary");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [paymentsRes, invoicesRes, ledgerRes, liabilityRes] = await Promise.all([
        client
          .from('payments')
          .select('amount')
          .eq('center_id', centerRes.data)
          .eq('status', 'SUCCEEDED'),
        client
          .from('invoices')
          .select('total_amount, tax, gift_card_discount, entitlement_redemption')
          .eq('center_id', centerRes.data)
          .eq('status', 'PAID'),
        client
          .from('entitlement_ledger')
          .select('entry_type, amount, legacy_flag')
          .eq('center_id', centerRes.data)
          .in('entry_type', ['REDEEM', 'ISSUE']),
        client
          .from('customer_entitlements')
          .select('remaining_value, status')
          .eq('center_id', centerRes.data)
          .not('status', 'in', '("REFUNDED","VOID")'),
      ]);

      // Each of these four feeds a headline financial figure. Ignoring an error
      // here renders a confident-looking but wrong number — for example a zero
      // deferred liability while real prepaid balances exist. Fail loudly
      // rather than report fiction.
      const financialSources: { label: string; error: { message: string } | null }[] = [
        { label: "payments", error: paymentsRes.error },
        { label: "invoices", error: invoicesRes.error },
        { label: "entitlement_ledger", error: ledgerRes.error },
        { label: "customer_entitlements", error: liabilityRes.error },
      ];
      for (const source of financialSources) {
        if (!source.error) continue;
        if (isMissingBackendFeature(source.error)) return { ok: false, error: createUnsupportedReadError("Entitlement.getSummary") };
        return { ok: false, error: createQueryError("Entitlement.getSummary", `${source.label}: ${source.error.message}`) };
      }

      const cashCollected = (paymentsRes.data || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      let earnedRevenue = 0;
      for (const row of (invoicesRes.data || []) as any[]) {
        earnedRevenue += (Number(row.total_amount) || 0)
          - (Number(row.tax) || 0)
          + (Number(row.gift_card_discount) || 0)
          + (Number(row.entitlement_redemption) || 0);
      }
      let redemptions = 0;
      let prepaidSales = 0;
      for (const entry of (ledgerRes.data || []) as any[]) {
        if (entry.entry_type === 'REDEEM') redemptions += Number(entry.amount) || 0;
        if (entry.entry_type === 'ISSUE' && !entry.legacy_flag) prepaidSales += Number(entry.amount) || 0;
      }
      const deferredLiability = (liabilityRes.data || []).reduce(
        (sum: number, r: any) => sum + (Number(r.remaining_value) || 0),
        0,
      );

      const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
      return {
        ok: true,
        data: {
          cashCollected: round3(cashCollected),
          earnedRevenue: round3(earnedRevenue),
          deferredLiability: round3(deferredLiability),
          redemptions: round3(redemptions),
          prepaidSales: round3(prepaidSales),
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Entitlement.getSummary", (e as Error).message) };
    }
  }
}

export class SupabaseServicePackageAdapter implements ServicePackageRepository {
  async list(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("ServicePackage.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('service_packages')
        .select(`
          *,
          service_package_items (*)
        `)
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("ServicePackage.list", error.message) };
      return { ok: true, data: (data || []).map(mapServicePackage) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServicePackage.list", (e as Error).message) };
    }
  }

  async create(input: { name: string; description?: string; packagePrice: number; items: { serviceId: string; quantity: number }[] }): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("ServicePackage.create");
    if (!centerRes.ok) return centerRes as any;

    const nameR = requiredText(input.name);
    const priceR = positiveNumber(input.packagePrice);
    const itemsOk = Array.isArray(input.items) && input.items.length > 0 &&
      input.items.every((it) => requiredText(it.serviceId).ok && positiveInteger(it.quantity).ok);
    if (!nameR.ok || !priceR.ok || !itemsOk) {
      const issues = [
        ...(nameR.ok ? [] : [{ field: "name", key: nameR.key }]),
        ...(priceR.ok ? [] : [{ field: "packagePrice", key: priceR.key }]),
        ...(!itemsOk ? [{ field: "items", key: "validation.required_select" as const }] : []),
      ];
      return { ok: false, error: new DomainValidationError(issues) };
    }

    try {
      const { data, error } = await getSupabaseClient().rpc('create_service_package_v1', {
        p_center_id: centerRes.data,
        p_name: okValue(nameR),
        p_description: input.description || null,
        p_package_price: okValue(priceR),
        p_items: toJson(input.items.map((item) => ({ serviceId: item.serviceId, quantity: okValue(positiveInteger(item.quantity)) }))),
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("ServicePackage.create") };
        }
        return { ok: false, error: createQueryError("ServicePackage.create", error.message) };
      }
      const row = (data || {}) as any;
      if (!row.service_package) return { ok: false, error: createQueryError("ServicePackage.create", "Invalid response from package RPC") };
      return { ok: true, data: mapServicePackage({ ...row.service_package, service_package_items: input.items.map((item, idx) => ({ id: `tmp-${idx}`, package_id: row.service_package.id, service_id: item.serviceId, quantity: item.quantity, created_at: new Date().toISOString() })) }) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServicePackage.create", (e as Error).message) };
    }
  }
}
