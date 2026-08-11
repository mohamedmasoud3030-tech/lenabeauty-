import { CheckoutItem, CheckoutPayload, PaymentMethod, EntitlementRedemptionInput } from "../application/dto";

/**
 * Canonical client-side representation of the checkout contract.
 *
 * PostgreSQL's process_checkout_v1 is authoritative. These helpers exist so
 * the POS can reject malformed input before transport and preview the exact
 * three-decimal financial formula used by the RPC. Catalog prices are still
 * resolved and enforced by the server; callers must never treat a submitted
 * item price as authoritative.
 */
export const MONEY_SCALE = 3;
const MONEY_FACTOR = 10 ** MONEY_SCALE;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * MONEY_FACTOR) / MONEY_FACTOR;
}

export function isPositiveMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isNonNegativeMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "card" || value === "transfer";
}

export interface EntitlementPreviewLine {
  serviceId: string;
  price: number;
  qty: number;
}

/**
 * Client-side preview of the value a package-unit redemption covers. Mirrors
 * the server rule: covered = min(avg line price × units, remaining value),
 * where the last session absorbs any rounding. The server's ledger is
 * authoritative; this only drives the POS preview.
 */
export function estimatePackageRedemptionValue(
  redemption: EntitlementRedemptionInput,
  remainingValue: number,
  serviceLines: EntitlementPreviewLine[],
): number {
  if (redemption.type !== "units" || !redemption.serviceId) {
    return 0;
  }
  const matching = serviceLines.filter((line) => line.serviceId === redemption.serviceId);
  if (matching.length === 0) return 0;
  const lineQty = matching.reduce((sum, line) => sum + Math.max(1, Number(line.qty) || 1), 0);
  const lineValue = matching.reduce((sum, line) => sum + (Number(line.price) || 0) * Math.max(1, Number(line.qty) || 1), 0);
  if (lineQty <= 0) return 0;
  const avgPrice = lineValue / lineQty;
  const units = Math.min(Math.max(1, Number(redemption.units) || 1), lineQty);
  return roundMoney(Math.min(Math.max(0, avgPrice) * units, Math.max(0, remainingValue)));
}

function itemReferenceIsValid(item: CheckoutItem): boolean {
  if (item.type === "service") return typeof item.serviceId === "string" && item.serviceId.length > 0;
  if (item.type === "product") return typeof item.productId === "string" && item.productId.length > 0;
  if (item.type === "package") return typeof item.packageId === "string" && item.packageId.length > 0;
  if (item.type === "gift_card") return typeof item.code === "string" && item.code.trim().length >= 4;
  return false;
}

/** Stable English transport errors; UI localization happens at the boundary. */
export function validateCheckoutContract(payload: CheckoutPayload): string[] {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object") return ["Payload is required"];
  if (typeof payload.customerId !== "string" || payload.customerId.trim().length === 0) {
    errors.push("Customer details are missing");
  }
  if (typeof payload.employeeId !== "string" || payload.employeeId.trim().length === 0) {
    errors.push("Employee details are missing");
  }
  if (!isPaymentMethod(payload.paymentMethod)) errors.push("Unsupported payment method");
  if (!isNonNegativeMoney(payload.discountAmount ?? 0)) errors.push("Discount must be a non-negative finite amount");
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push("Cart must not be empty");
    return errors;
  }

  payload.items.forEach((item, index) => {
    const slot = index + 1;
    if (!item || !["service", "product", "package", "gift_card"].includes(item.type)) {
      errors.push(`Item at slot ${slot} has invalid type`);
      return;
    }
    if (!itemReferenceIsValid(item)) errors.push(`Item at slot ${slot} is missing its catalog reference`);
    if (item.type === "gift_card" && item.qty !== 1) errors.push(`Item at slot ${slot} gift card quantity must be 1`);
    if (!Number.isInteger(item.qty) || item.qty <= 0) errors.push(`Item at slot ${slot} must have a positive whole quantity`);
    if (!isPositiveMoney(item.price)) errors.push(`Item at slot ${slot} must have a positive finite price`);
  });

  if (payload.entitlementRedemptions !== undefined) {
    if (!Array.isArray(payload.entitlementRedemptions)) {
      errors.push("Entitlement redemptions must be an array");
    } else {
      const seen = new Set<string>();
      payload.entitlementRedemptions.forEach((redemption, index) => {
        const slot = index + 1;
        if (!redemption || typeof redemption.entitlementId !== "string" || redemption.entitlementId.trim().length === 0) {
          errors.push(`Entitlement redemption ${slot} is missing its entitlement id`);
          return;
        }
        if (seen.has(redemption.entitlementId)) {
          errors.push(`Entitlement redemption ${slot} duplicates entitlement ${redemption.entitlementId}`);
        }
        seen.add(redemption.entitlementId);
        if (redemption.type === "value") {
          if (!isPositiveMoney(redemption.amount ?? NaN)) errors.push(`Entitlement redemption ${slot} must have a positive finite amount`);
        } else if (redemption.type === "units") {
          if (typeof redemption.serviceId !== "string" || redemption.serviceId.length === 0) {
            errors.push(`Entitlement redemption ${slot} is missing its service reference`);
          }
          if (!Number.isInteger(redemption.units) || (redemption.units ?? 0) <= 0) {
            errors.push(`Entitlement redemption ${slot} must have a positive whole unit count`);
          }
        } else {
          errors.push(`Entitlement redemption ${slot} has invalid type`);
        }
      });
    }
  }

  return errors;
}

export interface CheckoutPreviewInput {
  items: Pick<CheckoutItem, "qty" | "price">[];
  manualDiscount: number;
  tierPercent: number;
  loyaltyPoints: number;
  useLoyaltyPoints: boolean;
  giftCardBalance: number;
  taxRate: number;
  /** Package/entitlement redemption value already applied (default 0). */
  entitlementRedemption?: number;
}

export interface CheckoutTotals {
  subtotal: number;
  manualDiscount: number;
  tierDiscount: number;
  loyaltyDiscount: number;
  giftCardDiscount: number;
  entitlementRedemption: number;
  net: number;
  tax: number;
  total: number;
}

/** Mirrors process_checkout_v1. Inputs must already satisfy the contract. */
export function calculateCheckoutTotals(input: CheckoutPreviewInput): CheckoutTotals {
  const subtotal = roundMoney(input.items.reduce((sum, item) => sum + item.price * item.qty, 0));
  const manualDiscount = roundMoney(Math.max(0, input.manualDiscount));
  const tierDiscount = roundMoney(subtotal * Math.max(0, input.tierPercent) / 100);
  const afterStandingDiscounts = Math.max(0, subtotal - manualDiscount - tierDiscount);
  // Loyalty points are whole units (1 point = 1 OMR); never consume a
  // fractional point when the remaining net contains baisa.
  const loyaltyDiscount = input.useLoyaltyPoints
    ? roundMoney(Math.min(Math.floor(afterStandingDiscounts), Math.max(0, Math.floor(input.loyaltyPoints))))
    : 0;
  const afterLoyalty = Math.max(0, afterStandingDiscounts - loyaltyDiscount);
  const giftCardDiscount = roundMoney(Math.min(afterLoyalty, Math.max(0, input.giftCardBalance)));
  const afterGiftCard = Math.max(0, afterLoyalty - giftCardDiscount);
  const entitlementRedemption = roundMoney(Math.min(afterGiftCard, Math.max(0, input.entitlementRedemption ?? 0)));
  const net = roundMoney(Math.max(0, afterGiftCard - entitlementRedemption));
  const tax = roundMoney(net * Math.max(0, input.taxRate) / 100);
  const total = roundMoney(net + tax);

  return {
    subtotal,
    manualDiscount,
    tierDiscount,
    loyaltyDiscount,
    giftCardDiscount,
    entitlementRedemption,
    net,
    tax,
    total,
  };
}
