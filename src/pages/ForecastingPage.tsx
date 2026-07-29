import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";

export default function ForecastingPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<any[]>([]);
  const [financial, setFinancial] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [inventoryRes, financialRes] = await Promise.all([
          unwrap(useCases.forecasts.getInventoryForecast()),
          unwrap(useCases.forecasts.getFinancialForecast()),
        ]);
        setInventory(inventoryRes);
        setFinancial(financialRes);
      } catch (err: any) {
        showToast("error", t("Error"), err?.message || String(err));
      }
    })();
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">{t("Forecasting")}</h1>
        <p className="text-sm text-muted-foreground">{t("Inventory and financial projections based on recent activity")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t("Projected Revenue")}</div><div className="mt-2 text-2xl font-bold">{financial?.projectedMonthlyRevenue?.toFixed?.(2) ?? "0.00"}</div></div>
        <div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t("Projected Expenses")}</div><div className="mt-2 text-2xl font-bold">{financial?.projectedMonthlyExpenses?.toFixed?.(2) ?? "0.00"}</div></div>
        <div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t("Projected Profit")}</div><div className="mt-2 text-2xl font-bold">{financial?.projectedMonthlyProfit?.toFixed?.(2) ?? "0.00"}</div></div>
        <div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t("Daily Run Rate")}</div><div className="mt-2 text-2xl font-bold">{financial?.revenueRunRateDaily?.toFixed?.(2) ?? "0.00"}</div></div>
      </div>
      <div className="rounded-2xl border bg-card p-4 overflow-auto">
        <h2 className="mb-3 font-bold">{t("Inventory Forecast")}</h2>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-2">{t("Product")}</th><th>{t("Stock")}</th><th>{t("Avg Daily Units")}</th><th>{t("Days Remaining")}</th><th>{t("Alert")}</th></tr></thead>
          <tbody>
            {inventory.map((row) => (
              <tr key={row.productId} className="border-t"><td className="py-2 font-medium">{row.productName}</td><td>{row.stockQuantity}</td><td>{row.averageDailyUnits}</td><td>{row.daysRemaining}</td><td>{row.reorderAlert ? t("Reorder soon") : t("Healthy")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
