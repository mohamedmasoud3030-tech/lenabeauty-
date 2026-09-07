import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { PageHeader } from "../shared/components/PageHeader";
import { ListState } from "../shared/components/ListState";
import { formatOMRAmount } from "../shared/money";
import type { FinancialForecastSummary, InventoryForecastRow } from "../application/dto";

export default function ForecastingPage() {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState<InventoryForecastRow[]>([]);
  const [financial, setFinancial] = useState<FinancialForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [inventoryRes, financialRes] = await Promise.all([
        unwrap(useCases.forecasts.getInventoryForecast()),
        unwrap(useCases.forecasts.getFinancialForecast()),
      ]);
      setInventory(inventoryRes);
      setFinancial(financialRes);
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const atRisk = useMemo(() => inventory.filter((row) => row.reorderAlert), [inventory]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        icon={<TrendingUp className="h-7 w-7" />}
        title={t("Forecasting")}
        subtitle={t("Last 30 days")}
      />

      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t("Estimate from the last 30 days of paid sales and expenses. This is a run-rate, not a promise.")}
      </p>

      {loadError && inventory.length === 0 && !financial ? (
        <ListState loading={false} error={loadError} empty={false} onRetry={() => void load()} errorTitle={t("Failed to load forecast")} emptyTitle={t("No forecast yet")} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: t("Projected Revenue"), value: financial?.projectedMonthlyRevenue },
              { label: t("Projected Expenses"), value: financial?.projectedMonthlyExpenses },
              { label: t("Projected Profit"), value: financial?.projectedMonthlyProfit },
              { label: t("Daily Run Rate"), value: financial?.revenueRunRateDaily },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tile.label}</p>
                <p className="mt-2 text-2xl font-bold">{loading ? "…" : formatOMRAmount(tile.value)} <span className="text-xs text-muted-foreground">{t("OMR")}</span></p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-bold">{t("Inventory Forecast")}</h2>
              <p className="text-xs text-muted-foreground">{t("Products that may run out")}: {atRisk.length}</p>
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-start">
                    <th>{t("Product")}</th>
                    <th>{t("Stock")}</th>
                    <th>{t("Avg Daily Units")}</th>
                    <th>{t("Days Remaining")}</th>
                    <th>{t("Alert")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inventory.map((row) => (
                    <tr key={row.productId} className="[&>td]:px-5 [&>td]:py-3 [&>td]:text-start">
                      <td className="font-bold">{row.productName}</td>
                      <td>{row.stockQuantity}</td>
                      <td>{Number(row.averageDailyUnits).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>{row.daysRemaining >= 999 ? "—" : Math.round(row.daysRemaining)}</td>
                      <td className={row.reorderAlert ? "font-bold text-warning" : "text-muted-foreground"}>{row.reorderAlert ? t("Reorder soon") : t("Healthy")}</td>
                    </tr>
                  ))}
                  <ListState loading={loading && inventory.length === 0} error={null} empty={inventory.length === 0} onRetry={() => void load()} loadingTitle={t("Loading forecast...")} errorTitle={t("Failed to load forecast")} emptyTitle={t("No forecast yet")} emptyDescription={t("Sell products to estimate when stock will run out")} emptyIcon={<TrendingUp className="h-6 w-6" />} colSpan={5} compact />
                </tbody>
              </table>
            </div>
            <div className="lg:hidden p-4 space-y-3">
              {inventory.map((row) => (
                <div key={row.productId} className="rounded-xl border border-border p-3">
                  <p className="font-bold">{row.productName}</p>
                  <p className="text-xs text-muted-foreground">{t("Stock")}: {row.stockQuantity} · {row.reorderAlert ? t("Reorder soon") : t("Healthy")}</p>
                </div>
              ))}
              <ListState loading={loading && inventory.length === 0} error={null} empty={inventory.length === 0} onRetry={() => void load()} loadingTitle={t("Loading forecast...")} errorTitle={t("Failed to load forecast")} emptyTitle={t("No forecast yet")} emptyDescription={t("Sell products to estimate when stock will run out")} emptyIcon={<TrendingUp className="h-6 w-6" />} compact />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
