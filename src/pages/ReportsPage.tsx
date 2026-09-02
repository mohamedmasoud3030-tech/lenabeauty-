import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area
} from "recharts";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { 
  FileText, Calendar, Package, ShoppingBag,
  RefreshCw, Activity, Sparkles,
  Clock, Wallet, BarChart3, CheckCircle2,
  XCircle, AlertCircle, Target, Flame, Award, Zap as ZapIcon,
  ChevronRight, User, Receipt
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { useNavigate } from "react-router-dom";
import { SalesReportRow, AppointmentReportRow, InventoryReportRow, EntitlementSummary } from "../application/dto";
import { LazyChart } from "../shared/components/LazyChart";
import { ScreenState } from "../shared/components/ScreenState";
import { formatLocalDateOnly } from "../shared/dateRange";
import { formatOMRAmount } from "../shared/money";
import { Modal } from "../shared/components/Modal";
import { KPICard, InsightRow, InsightBadge } from "./reports/cards";

function initialReportDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  return {
    from: formatLocalDateOnly(from),
    to: formatLocalDateOnly(today),
  };
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<"sales" | "appointments" | "inventory">("sales");
  const [dateRange, setDateRange] = useState(initialReportDateRange);
  const [data, setData] = useState<(SalesReportRow | AppointmentReportRow | InventoryReportRow)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ledger-derived financial facts (cash collected / earned revenue / deferred
  // liability / redemptions). Guarded: the panel hides if the backend is old.
  const [entitlementSummary, setEntitlementSummary] = useState<EntitlementSummary | null>(null);
  // Drill-down: العملية المحددة من سجل المعاملات
  const [selectedSale, setSelectedSale] = useState<SalesReportRow | null>(null);
  const [salesVisibleCount, setSalesVisibleCount] = useState(20);
  const [inventoryVisibleCount, setInventoryVisibleCount] = useState(10);
  // Guards against stale async results: when the user switches tabs while a
  // request is in flight, the old request must not overwrite the new tab's
  // state (previously it could flash the previous tab's error/empty screen).
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (tab === "sales") setSalesVisibleCount(20);
    if (tab === "inventory") setInventoryVisibleCount(10);
    setLoading(true);
    setError(null);
    try {
      let res;
      if (tab === "sales") {
        res = await unwrap(useCases.reports.getSales(dateRange.from, dateRange.to));
        // This optional all-time liability panel must never hold the main
        // sales report in Loading/Empty/Error state when an older backend or
        // a focused report-test double does not provide it.
        void useCases.entitlements.getSummary()
          .then((summaryRes) => {
            if (seq === requestSeq.current) setEntitlementSummary(summaryRes.ok ? summaryRes.data : null);
          })
          .catch(() => {
            if (seq === requestSeq.current) setEntitlementSummary(null);
          });
      } else if (tab === "appointments") {
        res = await unwrap(useCases.reports.getAppointments(dateRange.from, dateRange.to));
      } else {
        res = await unwrap(useCases.reports.getInventory());
      }
      if (seq !== requestSeq.current) return; // stale response — ignore
      setData(res);
    } catch (err: any) {
      if (seq !== requestSeq.current) return; // stale response — ignore
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
        setError("BACKEND_METHOD_UNSUPPORTED");
      } else {
        setError(err.message || t("Failed to load data"));
      }
      setData([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [tab, dateRange, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function formatDay(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US", { day: "numeric", month: "short" });
  }

  /** Shared error state for the three report tabs (avoids duplicated blocks). */
  function reportError(unsupportedTitle: string, failedTitle: string) {
    return (
      <div className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm shadow-xl">
        <ScreenState
          state="error"
          title={error === "BACKEND_METHOD_UNSUPPORTED" ? unsupportedTitle : failedTitle}
          description={error === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : t("Something went wrong while loading. Try again.")}
          actionLabel="Retry"
          onAction={load}
          errorDetail={error === "BACKEND_METHOD_UNSUPPORTED" ? undefined : (error ?? undefined)}
        />
      </div>
    );
  }

  /** Shared empty state for the three report tabs (avoids duplicated blocks). */
  function reportEmpty(icon: React.ReactNode, title: string, description: string, actionLabel: string, onAction: () => void) {
    return (
      <div className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm shadow-xl">
        <ScreenState state="empty" icon={icon} title={title} description={description} actionLabel={actionLabel} onAction={onAction} />
      </div>
    );
  }

  const renderSales = () => {
    if (error) {
      return reportError(t("Sales report requires backend"), t("Failed to load sales report"));
    }

    if (!data || data.length === 0) {
      return reportEmpty(<ShoppingBag className="h-6 w-6" />, t("No Sales Data"), t("Start selling to see detailed analytics"), "New Invoice", () => nav("/pos"));
    }

    const salesData = data as SalesReportRow[];
    
    const grouped = salesData.reduce((acc: Record<string, number>, curr) => {
      const date = curr.date.split("T")[0];
      acc[date] = (acc[date] || 0) + curr.totalAmount;
      return acc;
    }, {});
    
    const chartData = Object.keys(grouped)
      .sort()
      .map((date) => ({ date, amount: grouped[date] }));

    const totalSales = salesData.reduce((a, b) => a + (Number.isFinite(b.totalAmount) ? b.totalAmount : 0), 0);
    const avgSale = salesData.length > 0 ? totalSales / salesData.length : 0;
    const maxDay = chartData.length > 0 ? Math.max(...chartData.map(d => d.amount)) : 0;
    const minDay = chartData.length > 0 ? Math.min(...chartData.map(d => d.amount)) : 0;
    const firstAmount = chartData.length > 0 ? chartData[0].amount : 0;
    const lastAmount = chartData.length > 0 ? chartData[chartData.length - 1].amount : 0;
    const trend = firstAmount > 0
      ? (((lastAmount - firstAmount) / firstAmount) * 100).toFixed(1)
      : "0";

    // Real computed insights — no fabricated metrics.
    const allItems = salesData.flatMap(s => s.items || []);
    const totalItemsSold = allItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const itemSales = new Map<string, { qty: number; revenue: number }>();
    for (const it of allItems) {
      const cur = itemSales.get(it.name) || { qty: 0, revenue: 0 };
      cur.qty += Number(it.qty) || 0;
      cur.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
      itemSales.set(it.name, cur);
    }
    const topItem = [...itemSales.entries()].sort((a, b) => b[1].qty - a[1].qty)[0];
    const bestDay = chartData.length > 0
      ? [...chartData].sort((a, b) => b.amount - a.amount)[0]
      : undefined;

    const container = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    };

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
          <KPICard
            variants={item}
            title={t("Total Revenue")}
            value={formatOMRAmount(totalSales)}
            currency="OMR"
            icon={<Wallet className="h-5 w-5" />}
            trend={trend}
            trendUp={parseFloat(trend) >= 0}
            color="emerald"
          />
          <KPICard
            variants={item}
            title={t("Average Ticket")}
            value={formatOMRAmount(avgSale)}
            currency="OMR"
            icon={<ShoppingBag className="h-5 w-5" />}
            trend="0"
            color="blue"
          />
          <KPICard
            variants={item}
            title={t("Peak Day")}
            value={formatOMRAmount(maxDay)}
            currency="OMR"
            icon={<Flame className="h-5 w-5" />}
            trend={bestDay ? bestDay.date.split("-").slice(1).reverse().join("/") : "—"}
            color="rose"
          />
          <KPICard
            variants={item}
            title={t("Total Transactions")}
            value={salesData.length.toString()}
            icon={<FileText className="h-5 w-5" />}
            trend={`+${salesData.length}`}
            color="purple"
          />
        </div>

        {/* Financial facts: cash collected ≠ earned revenue ≠ prepaid liability */}
        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-4 sm:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground">{t("Financial Facts")}</h4>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                {t("Cash collected, earned revenue and prepaid obligations are reported separately")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Cash Collected")}</p>
              <p className="mt-1 text-xl font-bold">{formatOMRAmount(totalSales)} {t("OMR")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("Period payments")}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Earned Service Revenue")}</p>
              <p className="mt-1 text-xl font-bold text-success">
                {formatOMRAmount(salesData.reduce((sum, s) => sum + (Number(s.earnedRevenue) || 0), 0))} {t("OMR")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("Includes entitlement redemptions")}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Prepaid Sales (Period)")}</p>
              <p className="mt-1 text-xl font-bold text-warning">
                {formatOMRAmount(salesData.reduce((sum, s) => sum + (Number(s.prepaidAmount) || 0), 0))} {t("OMR")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("Gift cards & packages sold — not earned yet")}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Entitlement Redemptions")}</p>
              <p className="mt-1 text-xl font-bold text-info">
                {formatOMRAmount(salesData.reduce((sum, s) => sum + (Number(s.redeemedAmount) || 0), 0))} {t("OMR")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("Deferred value converted to revenue")}</p>
            </div>
          </div>
          {entitlementSummary && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("Outstanding prepaid liability (all-time, ledger-derived)")}:{" "}
              <span className="font-bold">{formatOMRAmount(entitlementSummary.deferredLiability)} {t("OMR")}</span>
            </p>
          )}
        </motion.div>

        {/* Main Chart */}
        <motion.div variants={item} className="relative rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-4 sm:p-6 lg:p-10 shadow-2xl overflow-hidden group hover:shadow-3xl transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{t("Revenue Trend")}</h3>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{t("Last 30 days")}</p>
              </div>
            </div>
            <button
              onClick={load}
              className="h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
              title={t("Refresh")}
            >
              <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} />
            </button>
          </div>
          <div className="relative z-10 w-full">
            <LazyChart height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: "11px", fontWeight: 600 }}
                    tickFormatter={formatDay}
                    minTickGap={24}
                    tickMargin={6}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: "11px", fontWeight: 600 }}
                    width={52}
                    tickFormatter={(v) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : String(v))}
                  />
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
                      padding: "12px 16px"
                    }}
                    labelStyle={{ fontWeight: 700, fontSize: "12px", color: "hsl(var(--muted-foreground))" }}
                    labelFormatter={(label) => formatDay(String(label))}
                    formatter={(value) => [`${formatOMRAmount(value)} OMR`, t("Revenue")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#areaGradient)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </LazyChart>
          </div>
        </motion.div>

        {/* سجل المعاملات — عرض مبيعات الفترة مع إمكانية الوصول لتفاصيل العملية */}
        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-4 sm:p-6 lg:p-8 shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-foreground">{t("Sales Transactions")}</h4>
              <p className="text-xs text-muted-foreground">{salesData.length} {t("transactions")}</p>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start">
                  <th className="text-start py-3 px-3 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Date")}</th>
                  <th className="text-start py-3 px-3 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Customer")}</th>
                  <th className="text-start py-3 px-3 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Items")}</th>
                  <th className="text-start py-3 px-3 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Total")}</th>
                  <th className="text-end py-3 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {salesData.slice(0, salesVisibleCount).map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">{formatDay(sale.date.split("T")[0])}</td>
                    <td className="py-3 px-3 text-muted-foreground font-medium truncate max-w-[200px]">{sale.customer ?? "—"}</td>
                    <td className="py-3 px-3 text-muted-foreground">{sale.items.length}</td>
                    <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">
                      {formatOMRAmount(sale.totalAmount)} OMR
                      <span className="ms-2 inline-flex flex-wrap gap-1 align-middle">
                        {Number(sale.prepaidAmount) > 0 && (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-bold text-warning">{t("Prepaid")}</span>
                        )}
                        {Number(sale.redeemedAmount) > 0 && (
                          <span className="rounded-full bg-info/10 px-2 py-0.5 text-[9px] font-bold text-info">{t("Redeemed")}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-end">
                      <button className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                        {t("Details")}
                        <ChevronRight className={clsx("h-3 w-3", i18n.language === "ar" && "rotate-180")} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid grid-cols-2 gap-2">
            {salesData.slice(0, salesVisibleCount).map((sale) => (
              <button
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-start min-w-0 hover:border-primary/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{sale.customer ?? t("Walk-in")}</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    {formatDay(sale.date.split("T")[0])} · {sale.items.length} {t("Items")}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatOMRAmount(sale.totalAmount)} OMR</p>
                  <ChevronRight className={clsx("h-4 w-4 text-muted-foreground ms-auto mt-0.5", i18n.language === "ar" && "rotate-180")} />
                </div>
              </button>
            ))}
          </div>
          {salesData.length > salesVisibleCount && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">{t("Showing {{visible}} of {{total}}", { visible: salesVisibleCount, total: salesData.length })}</p>
              <button
                type="button"
                onClick={() => setSalesVisibleCount((count) => Math.min(count + 20, salesData.length))}
                className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold text-primary hover:bg-muted transition-colors"
              >
                {t("Load more")}
              </button>
            </div>
          )}
        </motion.div>

        {/* Insights Grid — computed from real sales data only */}
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                <Target className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-foreground">{t("Performance Metrics")}</h4>
            </div>
            <div className="space-y-4">
              <InsightRow label={t("Avg Daily Revenue")} value={`${formatOMRAmount(totalSales / Math.max(chartData.length, 1))} OMR`} />
              <InsightRow label={t("Best Performing Day")} value={bestDay ? `${formatOMRAmount(bestDay.amount)} OMR · ${formatDay(bestDay.date)}` : "—"} />
              <InsightRow label={t("Total Items Sold")} value={totalItemsSold.toString()} />
              <InsightRow label={t("Top Selling Item")} value={topItem ? `${topItem[0]} (${topItem[1].qty})` : "—"} />
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
                <Award className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-foreground">{t("Top Insights")}</h4>
            </div>
            <div className="space-y-3">
              <InsightBadge icon={<Flame className="h-4 w-4" />} text={bestDay ? `${t("Best Performing Day")}: ${formatDay(bestDay.date)}` : t("No sales yet in this period")} color="rose" />
              <InsightBadge icon={<ShoppingBag className="h-4 w-4" />} text={`${t("Total Transactions")}: ${salesData.length}`} color="pink" />
              <InsightBadge icon={<ZapIcon className="h-4 w-4" />} text={topItem ? `${t("Top Selling Item")}: ${topItem[0]}` : t("No items sold yet")} color="amber" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  const renderAppointments = () => {
    if (error) {
      return reportError(t("Appointments report requires backend"), t("Failed to load appointments report"));
    }

    if (!data || data.length === 0) {
      return reportEmpty(<Calendar className="h-6 w-6" />, t("No Appointments Data"), t("Book appointments to see analytics"), "Book Appointment", () => nav("/appointments"));
    }

    const appData = data as AppointmentReportRow[];
    // NOTE: the domain/DB status is CANCELLED (double L) — single-L "CANCELED"
    // never matched anything and silently zeroed canceled counts.
    const statusCounts = appData.reduce((acc: Record<string, number>, curr) => {
      const status = (curr.status || "SCHEDULED").toUpperCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const pieData = [
      { name: t("Completed"), value: statusCounts["COMPLETED"] || 0, color: "hsl(var(--success))" },
      { name: t("Scheduled"), value: statusCounts["SCHEDULED"] || 0, color: "hsl(var(--warning))" },
      { name: t("Canceled"), value: statusCounts["CANCELLED"] || 0, color: "hsl(var(--destructive))" },
      { name: t("No-show"), value: statusCounts["NO_SHOW"] || 0, color: "hsl(var(--primary))" },
    ].filter(d => d.value > 0);

    const container = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    };

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
          {[
            { label: t("Total"), value: data.length, color: "blue", icon: Activity },
            { label: t("Completed"), value: statusCounts["COMPLETED"] || 0, color: "emerald", icon: CheckCircle2 },
            { label: t("Scheduled"), value: statusCounts["SCHEDULED"] || 0, color: "amber", icon: Clock },
            { label: t("Canceled"), value: statusCounts["CANCELLED"] || 0, color: "rose", icon: XCircle },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={item}
              className={clsx(
                "group rounded-2xl border-l-4 border border-border bg-card/50 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all",
                stat.color === "blue" && "border-l-blue-500",
                stat.color === "emerald" && "border-l-emerald-500",
                stat.color === "amber" && "border-l-amber-500",
                stat.color === "rose" && "border-l-rose-500",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={clsx(
                  "h-10 w-10 rounded-lg flex items-center justify-center shadow-inner",
                  stat.color === "blue" && "bg-info/10 text-info",
                  stat.color === "emerald" && "bg-success/10 text-success",
                  stat.color === "amber" && "bg-warning/10 text-warning",
                  stat.color === "rose" && "bg-destructive/10 text-destructive",
                )}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-4 sm:p-6 lg:p-10 shadow-xl overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <PieChart className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{t("Appointment Status Distribution")}</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{t("Completion rate")}</p>
            </div>
          </div>
          <div className="w-full">
            <LazyChart height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} ${t("appointments")}`} />
                </PieChart>
              </ResponsiveContainer>
            </LazyChart>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderInventory = () => {
    if (error) {
      return reportError(t("Inventory report requires backend"), t("Failed to load inventory report"));
    }

    if (!data || data.length === 0) {
      return reportEmpty(<Package className="h-6 w-6" />, t("No Inventory Data"), t("Add products or services to see inventory"), "Go to Inventory", () => nav("/inventory"));
    }

    const invData = data as InventoryReportRow[];
    
    const container = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    };

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-4 sm:p-6 lg:p-10 shadow-xl overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{t("Inventory Status")}</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{t("Current stock levels")}</p>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Product")}</th>
                  <th className="text-start py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Quantity")}</th>
                  <th className="text-start py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {invData.slice(0, inventoryVisibleCount).map((item, idx) => {
                  const qty = Number((item as any).quantity ?? item.stockQuantity) || 0;
                  const inStock = qty > 10;
                  return (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4 font-bold text-foreground">{(item as any).productName ?? item.name}</td>
                      <td className="py-4 px-4 text-foreground">{qty}</td>
                      <td className="py-4 px-4">
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                          inStock ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        )}>
                          {inStock ? `✓ ${t("In Stock")}` : `⚠ ${t("Low Stock")}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {invData.length > inventoryVisibleCount && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">{t("Showing {{visible}} of {{total}}", { visible: inventoryVisibleCount, total: invData.length })}</p>
              <button
                type="button"
                onClick={() => setInventoryVisibleCount((count) => Math.min(count + 10, invData.length))}
                className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold text-primary hover:bg-muted transition-colors"
              >
                {t("Load more")}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary shadow-sm w-fit">
            <Sparkles className="h-3 w-3" />
            {t("Advanced Analytics")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter text-foreground">
            {t("Reports & Analytics")}
          </h1>
          <p className="text-sm text-muted-foreground font-medium max-w-2xl">
            {t("Deep insights into your business performance")}
          </p>
        </div>
        <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
          {/* Date range filter — أرقام مفهومة وفلاتر تاريخ سليمة */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              aria-label={t("From date")}
              className="bg-transparent text-xs font-bold text-foreground outline-none w-[110px] sm:w-auto"
              value={dateRange.from}
              max={dateRange.to}
              onChange={(e) => { if (e.target.value) setDateRange((p) => ({ ...p, from: e.target.value })); }}
            />
            <span className="text-xs font-bold text-muted-foreground">—</span>
            <input
              type="date"
              aria-label={t("To date")}
              className="bg-transparent text-xs font-bold text-foreground outline-none w-[110px] sm:w-auto"
              value={dateRange.to}
              min={dateRange.from}
              onChange={(e) => { if (e.target.value) setDateRange((p) => ({ ...p, to: e.target.value })); }}
            />
          </div>
          <button
            onClick={load}
            className="group relative h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-lg hover:scale-110 active:scale-95"
            title={t("Refresh")}
          >
            <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
          { id: "sales", label: t("Sales"), icon: ShoppingBag },
          { id: "appointments", label: t("Appointments"), icon: Calendar },
          { id: "inventory", label: t("Inventory"), icon: Package },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 font-bold text-sm uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap",
              tab === id
                ? "text-primary border-b-primary"
                : "text-muted-foreground border-b-transparent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm shadow-xl"
          >
            <ScreenState state="loading" title={t("Loading analytics...")} description={t("Please wait a moment")} />
          </motion.div>
        ) : tab === "sales" ? (
          <motion.div key="sales" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderSales()}
          </motion.div>
        ) : tab === "appointments" ? (
          <motion.div key="appointments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderAppointments()}
          </motion.div>
        ) : (
          <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderInventory()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* تفاصيل العملية — drill-down من سجل المعاملات */}
      <Modal
        isOpen={selectedSale !== null}
        onClose={() => setSelectedSale(null)}
        size="md"
        title={
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Receipt className="h-5 w-5" />
            </span>
            <span>{t("Transaction Details")}</span>
          </span>
        }
        description={selectedSale ? `${t("Invoice No")} · ${selectedSale.id.slice(-6).toUpperCase()}` : undefined}
        className="sm:rounded-[2rem]"
      >
        {selectedSale && (
          <div className="space-y-5 sm:p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Date")}</p>
                    <p className="font-bold text-foreground">{formatDay(selectedSale.date.split("T")[0])}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Customer")}</p>
                    <p className="font-bold text-foreground truncate">{selectedSale.customer ?? t("Walk-in")}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Items")}</p>
                  {selectedSale.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No items recorded")}</p>
                  ) : (
                    selectedSale.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                            {item.type === "service" ? t("Service") : item.type === "product" ? t("Product") : t("Package")} · {item.qty} × {formatOMRAmount(item.price)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-foreground shrink-0">{formatOMRAmount(item.price * item.qty)}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">{t("Subtotal")}</span>
                    <span className="font-bold text-foreground">{formatOMRAmount(selectedSale.totalAmount + selectedSale.discount)}</span>
                  </div>
                  {selectedSale.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">{t("Discount")}</span>
                      <span className="font-bold text-destructive">-{formatOMRAmount(selectedSale.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-foreground">{t("Total")}</span>
                    <span className="text-lg font-bold text-primary">{formatOMRAmount(selectedSale.totalAmount)} OMR</span>
                  </div>
                </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
