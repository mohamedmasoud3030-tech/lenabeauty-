import { CustomerEntitlement, PackageEntitlementUnit } from "./entities";
import { roundMoney } from "./commerce";

/**
 * LENA Wallet — a unified projection over the customer's existing value
 * instruments. This is NOT a merged financial balance: gift cards, packages,
 * rewards points and deposits keep their distinct semantics and are never
 * combined into one fake ledger figure. The wallet is the application model
 * that makes each instrument visible at the point of decision (profile and
 * checkout).
 */

export interface WalletPackageSession {
  entitlementId: string;
  packageName: string;
  serviceId: string;
  serviceName?: string;
  totalUnits: number;
  usedUnits: number;
  remainingUnits: number;
}

export interface WalletGiftCard {
  entitlementId: string;
  code?: string;
  remainingValue: number;
  expiresAt?: Date;
}

export interface CustomerWallet {
  giftCardBalance: number;
  giftCards: WalletGiftCard[];
  packages: WalletPackageSession[];
  rewardsPoints: number;
  /** Visit deposit held against the current appointment (not wallet spend). */
  depositAmount: number;
  /** True when any value instrument exists. */
  hasValue: boolean;
}

export interface WalletBuildInput {
  entitlements: CustomerEntitlement[];
  loyaltyPoints: number;
  depositAmount?: number;
}

function isUsableEntitlement(e: CustomerEntitlement, now: Date = new Date()): boolean {
  if (e.status === "EXPIRED" || e.status === "REFUNDED" || e.status === "VOID") return false;
  if (e.expiresAt && new Date(e.expiresAt).getTime() < now.getTime()) return false;
  return e.remainingValue > 0;
}

/**
 * Build the wallet projection. Keeps each instrument distinct and preserves
 * the server-authoritative remaining values/units (never re-derived).
 */
export function buildCustomerWallet(input: WalletBuildInput, now: Date = new Date()): CustomerWallet {
  const entitlements = input.entitlements ?? [];
  const giftCards: WalletGiftCard[] = [];
  let giftCardBalance = 0;
  const packages: WalletPackageSession[] = [];

  for (const e of entitlements) {
    if (!isUsableEntitlement(e, now)) continue;
    if (e.kind === "GIFT_CARD") {
      giftCardBalance = roundMoney(giftCardBalance + e.remainingValue);
      giftCards.push({
        entitlementId: e.id,
        code: e.giftCardCode,
        remainingValue: e.remainingValue,
        expiresAt: e.expiresAt,
      });
    } else if (e.kind === "PACKAGE") {
      for (const unit of e.units ?? []) {
        const remaining = Math.max(0, (unit.totalUnits ?? 0) - (unit.usedUnits ?? 0));
        if (remaining <= 0) continue;
        packages.push({
          entitlementId: e.id,
          packageName: e.instrumentName ?? "Package",
          serviceId: unit.serviceId,
          serviceName: unit.serviceName,
          totalUnits: unit.totalUnits ?? 0,
          usedUnits: unit.usedUnits ?? 0,
          remainingUnits: remaining,
        });
      }
    }
  }

  const depositAmount = roundMoney(Math.max(0, input.depositAmount ?? 0));
  const rewardsPoints = Math.max(0, Math.floor(input.loyaltyPoints ?? 0));

  return {
    giftCardBalance,
    giftCards,
    packages,
    rewardsPoints,
    depositAmount,
    hasValue:
      giftCardBalance > 0 ||
      packages.length > 0 ||
      rewardsPoints > 0 ||
      depositAmount > 0,
  };
}

export interface ApplicableBenefit {
  kind: "GIFT_CARD" | "PACKAGE" | "REWARDS" | "DEPOSIT";
  entitlementId?: string;
  serviceId?: string;
  packageSession?: WalletPackageSession;
  labelKey: string;
  /** Monetary value the instrument can cover on this checkout, if any. */
  value?: number;
}

/**
 * What the wallet makes available for a specific checkout cart. A package
 * session is only offered when the matching service is actually in the cart —
 * never silently consumed, and never offered against an unrelated service.
 */
export function walletAvailableForCheckout(
  wallet: CustomerWallet,
  cartServiceIds: string[],
): ApplicableBenefit[] {
  const benefits: ApplicableBenefit[] = [];
  if (wallet.giftCardBalance > 0) {
    benefits.push({ kind: "GIFT_CARD", labelKey: "wallet.giftCard", value: wallet.giftCardBalance });
  }
  for (const session of wallet.packages) {
    if (!cartServiceIds.includes(session.serviceId)) continue;
    benefits.push({
      kind: "PACKAGE",
      entitlementId: session.entitlementId,
      serviceId: session.serviceId,
      packageSession: session,
      labelKey: "wallet.packageSession",
    });
  }
  if (wallet.rewardsPoints > 0) {
    benefits.push({ kind: "REWARDS", labelKey: "wallet.rewards", value: wallet.rewardsPoints });
  }
  if (wallet.depositAmount > 0) {
    benefits.push({ kind: "DEPOSIT", labelKey: "wallet.deposit", value: wallet.depositAmount });
  }
  return benefits;
}

/**
 * Redemption sanity guard shared with the server contract: the same
 * entitlement may only be redeemed once per checkout.
 */
export function hasDuplicateRedemption(
  entitlementIds: string[],
  entitlementId: string,
): boolean {
  return entitlementIds.filter((id) => id === entitlementId).length > 1;
}

/** Units remaining for a specific service inside a package entitlement. */
export function packageUnitsForService(
  entitlement: CustomerEntitlement,
  serviceId: string,
): number {
  const unit: PackageEntitlementUnit | undefined = (entitlement.units ?? []).find(
    (u) => u.serviceId === serviceId,
  );
  if (!unit) return 0;
  return Math.max(0, (unit.totalUnits ?? 0) - (unit.usedUnits ?? 0));
}
