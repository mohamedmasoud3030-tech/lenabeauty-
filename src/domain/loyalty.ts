/**
 * Loyalty tier model — single source of truth.
 *
 * Tiers are derived from the customer's *lifetime spend* (total_spent), which
 * is the industry-standard basis (Fresha/Zenoti/Phorest) rather than the
 * volatile redeemable points balance. Each tier carries a discount perk that
 * can be surfaced at checkout and a points-earn multiplier.
 *
 * Pure, framework-free, fully unit-tested.
 */

export type LoyaltyTierId = "bronze" | "silver" | "gold" | "platinum";

export interface LoyaltyTier {
  id: LoyaltyTierId;
  /** i18n key for the tier name. */
  labelKey: string;
  /** Minimum lifetime spend (in OMR) to reach this tier. */
  minSpend: number;
  /** Standing discount % this tier earns on services. */
  discountPercent: number;
  /** Points earned per 1 OMR of net spend (earn multiplier). */
  pointsMultiplier: number;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

/** Ordered ascending by minSpend. */
export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  {
    id: "bronze",
    labelKey: "tier.bronze",
    minSpend: 0,
    discountPercent: 0,
    pointsMultiplier: 1,
    icon: "🥉",
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    id: "silver",
    labelKey: "tier.silver",
    minSpend: 200,
    discountPercent: 5,
    pointsMultiplier: 1,
    icon: "🥈",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
  {
    id: "gold",
    labelKey: "tier.gold",
    minSpend: 500,
    discountPercent: 10,
    pointsMultiplier: 2,
    icon: "🥇",
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    id: "platinum",
    labelKey: "tier.platinum",
    minSpend: 1000,
    discountPercent: 15,
    pointsMultiplier: 2,
    icon: "💎",
    color: "text-purple-600",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
] as const;

/** Returns the tier for a given lifetime spend. */
export function getTierBySpend(totalSpent: number): LoyaltyTier {
  const spend = Number.isFinite(totalSpent) ? Math.max(0, totalSpent) : 0;
  let current = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (spend >= tier.minSpend) current = tier;
  }
  return current;
}

/** The next tier up, or null if already at the top. */
export function getNextTier(totalSpent: number): LoyaltyTier | null {
  const current = getTierBySpend(totalSpent);
  const idx = LOYALTY_TIERS.findIndex((t) => t.id === current.id);
  return idx >= 0 && idx < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[idx + 1] : null;
}

/** Remaining spend (OMR) to reach the next tier, or 0 if at the top. */
export function spendToNextTier(totalSpent: number): number {
  const next = getNextTier(totalSpent);
  if (!next) return 0;
  return Math.max(0, next.minSpend - Math.max(0, totalSpent));
}

/** Progress [0..1] toward the next tier (1 when at the top). */
export function tierProgress(totalSpent: number): number {
  const current = getTierBySpend(totalSpent);
  const next = getNextTier(totalSpent);
  if (!next) return 1;
  const span = next.minSpend - current.minSpend;
  if (span <= 0) return 1;
  const into = Math.max(0, totalSpent) - current.minSpend;
  return Math.min(1, Math.max(0, into / span));
}
