import { useTranslation } from "react-i18next";
import { getTierBySpend, getNextTier, spendToNextTier, tierProgress } from "../../domain/loyalty";
import { formatOMRAmount } from "../money";

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
        <span className="opacity-75">· {tier.discountPercent}%</span>
      )}
    </span>
  );
}

export function LoyaltyTierProgress({ totalSpent }: { totalSpent: number }) {
  const { t, i18n } = useTranslation();
  const tier = getTierBySpend(totalSpent);
  const next = getNextTier(totalSpent);
  const remaining = spendToNextTier(totalSpent);
  const progress = Math.round(tierProgress(totalSpent) * 100);
  const omr = (value: number) => `${formatOMRAmount(value)} ${i18n.language === "ar" ? "ر.ع" : "OMR"}`;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <LoyaltyTierBadge totalSpent={totalSpent} />
        {tier.discountPercent > 0 && (
          <span className="text-xs font-bold text-muted-foreground">
            {t("Tier discount")}: {tier.discountPercent}%
          </span>
        )}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
        {next
          ? `${t("Spend")} ${omr(remaining)} ${t("to reach")} ${t(next.labelKey)} ${next.icon}`
          : `${t("Top tier reached")} ${tier.icon}`}
      </p>
    </div>
  );
}

export default LoyaltyTierBadge;
