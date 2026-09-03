import { useState } from "react";
import { FileText, Flame, ShoppingBag, Target, Wallet } from "lucide-react";
import type { EntitlementSummary, SalesReportRow } from "../../application/dto";
import { ScreenState } from "../../shared/components/ScreenState";
import { formatOMRAmount } from "../../shared/money";
import { KPICard, InsightRow } from "./cards";

interface SalesReportSectionProps {
  data: SalesReportRow[];
  error: string | null;
  entitlementSummary: EntitlementSummary | null;
  onRetry: () => void;
  onNewInvoice: () => void;
  onSelectSale: (sale: SalesReportRow) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
  formatDay: (value: string) => string;
}

export function SalesReportSection({ data, error, entitlementSummary, onRetry, onNewInvoice, onSelectSale, t, formatDay }: SalesReportSectionProps) {
  const [visibleCount, setVisibleCount] = useState(20);

  if (error) {
    return <ScreenState state="error" title={error === "BACKEND_METHOD_UNSUPPORTED" ? t("Sales report requires backend") : t("Failed to load sales report")} description={error === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : t("Something went wrong while loading. Try again.")} actionLabel={t("Retry")} onAction={onRetry} errorDetail={error === "BACKEND_METHOD_UNSUPPORTED" ? undefined : error} />;
  }
  if (data.length === 0) {
    return <ScreenState state="empty" icon={<ShoppingBag className="h-6 w-6" />} title={t("No Sales Data")} description={t("Start selling to see detailed analytics")} actionLabel={t("New Invoice")} onAction={onNewInvoice} />;
  }

  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    const date = row.date.split("T")[0];
    acc[date] = (acc[date] || 0) + row.totalAmount;
    return acc;
  }, {});
  const daily = Object.keys(grouped).sort().map((date) => ({ date, amount: grouped[date] }));
  const totalSales = data.reduce((sum, row) => sum + (Number.isFinite(row.totalAmount) ? row.totalAmount : 0), 0);
  const averageTicket = totalSales / data.length;
  const bestDay = daily.length ? [...daily].sort((a, b) => b.amount - a.amount)[0] : undefined;
  const allItems = data.flatMap((row) => row.items || []);
  const itemSales = new Map<string, number>();
  for (const item of allItems) itemSales.set(item.name, (itemSales.get(item.name) || 0) + (Number(item.qty) || 0));
  const topItem = [...itemSales.entries()].sort((a, b) => b[1] - a[1])[0];
  const earnedRevenue = data.reduce((sum, row) => sum + (Number(row.earnedRevenue) || 0), 0);
  const prepaid = data.reduce((sum, row) => sum + (Number(row.prepaidAmount) || 0), 0);
  const redeemed = data.reduce((sum, row) => sum + (Number(row.redeemedAmount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard title={t("Total Revenue")} value={formatOMRAmount(totalSales)} currency="OMR" icon={<Wallet className="h-5 w-5" />} color="emerald" />
        <KPICard title={t("Average Ticket")} value={formatOMRAmount(averageTicket)} currency="OMR" icon={<ShoppingBag className="h-5 w-5" />} color="blue" />
        <KPICard title={t("Peak Day")} value={bestDay ? formatOMRAmount(bestDay.amount) : "0.000"} currency="OMR" icon={<Flame className="h-5 w-5" />} color="rose" />
        <KPICard title={t("Total Transactions")} value={String(data.length)} icon={<FileText className="h-5 w-5" />} color="purple" />
      </div>

      <section className="rounded-3xl border border-border bg-card/50 p-4 sm:p-6 shadow-xl">
        <h3 className="font-bold text-foreground">{t("Financial Facts")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("Cash collected, earned revenue and prepaid obligations are reported separately")}</p>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            [t("Cash Collected"), totalSales],
            [t("Earned Service Revenue"), earnedRevenue],
            [t("Prepaid Sales (Period)"), prepaid],
            [t("Entitlement Redemptions"), redeemed],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border bg-card p-4"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p><p className="mt-1 text-xl font-bold">{formatOMRAmount(Number(value))} {t("OMR")}</p></div>)}
        </div>
        {entitlementSummary && <p className="mt-3 text-xs text-muted-foreground">{t("Outstanding prepaid liability (all-time, ledger-derived)")}: <span className="font-bold">{formatOMRAmount(entitlementSummary.deferredLiability)} {t("OMR")}</span></p>}
      </section>

      <section className="rounded-3xl border border-border bg-card/50 p-4 sm:p-6 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 mb-5"><FileText className="h-5 w-5 text-primary" /><div><h4 className="font-bold">{t("Sales Transactions")}</h4><p className="text-xs text-muted-foreground">{data.length} {t("transactions")}</p></div></div>
        <div className="space-y-2">
          {data.slice(0, visibleCount).map((sale) => (
            <div key={sale.id} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl border border-border p-3">
              <div className="min-w-0"><p className="text-sm font-bold truncate">{sale.customer ?? t("Walk-in")}</p><p className="text-[10px] text-muted-foreground">{formatDay(sale.date.split("T")[0])} · {sale.items.length} {t("Items")} · {formatOMRAmount(sale.totalAmount)} OMR</p></div>
              <button type="button" onClick={() => onSelectSale(sale)} className="min-h-11 px-3 rounded-lg text-xs font-bold text-primary hover:bg-primary/10">{t("Details")}</button>
            </div>
          ))}
        </div>
        {data.length > visibleCount && <div className="mt-5 flex flex-col items-center gap-2"><p className="text-xs text-muted-foreground">{t("Showing {{visible}} of {{total}}", { visible: visibleCount, total: data.length })}</p><button type="button" onClick={() => setVisibleCount((count) => Math.min(count + 20, data.length))} className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold text-primary">{t("Load more")}</button></div>}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-border bg-card/50 p-5 shadow-xl"><h4 className="flex items-center gap-2 font-bold"><Target className="h-4 w-4 text-primary" />{t("Performance Metrics")}</h4><div className="mt-4 space-y-3"><InsightRow label={t("Avg Daily Revenue")} value={`${formatOMRAmount(totalSales / Math.max(daily.length, 1))} OMR`} /><InsightRow label={t("Best Performing Day")} value={bestDay ? `${formatOMRAmount(bestDay.amount)} OMR · ${formatDay(bestDay.date)}` : "—"} /></div></div>
        <div className="rounded-3xl border border-border bg-card/50 p-5 shadow-xl"><h4 className="font-bold">{t("Top Insights")}</h4><div className="mt-4 space-y-3"><InsightRow label={t("Total Transactions")} value={String(data.length)} /><InsightRow label={t("Top Selling Item")} value={topItem ? `${topItem[0]} (${topItem[1]})` : "—"} /></div></div>
      </section>
    </div>
  );
}
