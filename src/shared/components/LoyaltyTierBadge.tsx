import { useTranslation } from "react-i18next";
import { getTierBySpend, getNextTier, spendToNextTier, tierProgress } from "../../domain/loyalty";

/**
 * Compact tier badge — shows the customer's current loyalty tier
 * (derived from lifetime spend) with its icon and color.
 */
export function LoyaltyTierBadge({ totalSpent, className = "" }: { totalSpent: number; className?: string }) {
  const { t } = useTranslation();
  const tier = getTierBySpend(totalSpent);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1 text-xs font-bold border shadow-sm ${tier.bg} ${tier.color} ${tier.border} ${className}`}
    >
      <span aria-hidden="true">{tier.icon}</span>
      <span>{t(tier.labelKey)}</span>
      {tier.discountPercent > 0 && (
        <span className="opacity-70">· {tier.discountPercent}%</span>
      )}
    </span>
  );
}

/**
 * Tier progress card — current tier + a progress bar toward the next tier.
 */
export function LoyaltyTierProgress({ totalSpent }: { totalSpent: number }) {
  const { t, i18n } = useTranslation();
  const tier = getTierBySpend(totalSpent);
  const next = getNextTier(totalSpent);
  const remaining = spendToNextTier(totalSpent);
  const progress = Math.round(tierProgress(totalSpent) * 100);
  const omr = (n: number) => `${n.toFixed(0)} ${i18n.language === "ar" ? "ر.ع" : "OMR"}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <LoyaltyTierBadge totalSpent={totalSpent} />
        {tier.discountPercent > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("Tier discount")}: {tier.discountPercent}%
          </span>
        )}
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {next
          ? `${t("Spend")} ${omr(remaining)} ${t("to reach")} ${t(next.labelKey)} ${next.icon}`
          : `${t("Top tier reached")} ${tier.icon}`}
      </p>
    </div>
  );
}

export default LoyaltyTierBadge;
