import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Calendar, Package, RefreshCw, ShoppingBag } from "lucide-react";
import { clsx } from "clsx";
import { useCases } from "../app/composition/useCases";
import type { AppointmentReportRow, EntitlementSummary, InventoryReportRow, SalesReportRow } from "../application/dto";
import { PageHeader } from "../shared/components/PageHeader";
import { ScreenState } from "../shared/components/ScreenState";
import { formatLocalDateOnly } from "../shared/dateRange";
import { unwrap } from "../shared/hooks/useApplication";
import { AppointmentsReportSection } from "./reports/AppointmentsReportSection";
import { InventoryReportSection } from "./reports/InventoryReportSection";
import { SalesReportSection } from "./reports/SalesReportSection";
import { SalesTransactionDialog } from "./reports/SalesTransactionDialog";

type ReportTab = "sales" | "appointments" | "inventory";
type ReportRows = SalesReportRow[] | AppointmentReportRow[] | InventoryReportRow[];

function initialReportDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  return { from: formatLocalDateOnly(from), to: formatLocalDateOnly(today) };
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ReportTab>("sales");
  const [dateRange, setDateRange] = useState(initialReportDateRange);
  const [data, setData] = useState<ReportRows>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entitlementSummary, setEntitlementSummary] = useState<EntitlementSummary | null>(null);
  const [selectedSale, setSelectedSale] = useState<SalesReportRow | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      let result: ReportRows;
      if (tab === "sales") {
        result = await unwrap(useCases.reports.getSales(dateRange.from, dateRange.to));
        void useCases.entitlements.getSummary()
          .then((summary) => {
            if (seq === requestSeq.current) setEntitlementSummary(summary.ok ? summary.data : null);
          })
          .catch(() => {
            if (seq === requestSeq.current) setEntitlementSummary(null);
          });
      } else if (tab === "appointments") {
        result = await unwrap(useCases.reports.getAppointments(dateRange.from, dateRange.to));
      } else {
        result = await unwrap(useCases.reports.getInventory());
      }
      if (seq !== requestSeq.current) return;
      setData(result);
    } catch (loadError: any) {
      if (seq !== requestSeq.current) return;
      setError(loadError.code === "BACKEND_METHOD_UNSUPPORTED" ? "BACKEND_METHOD_UNSUPPORTED" : loadError.message || t("Failed to load data"));
      setData([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [tab, dateRange, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function formatDay(date: string) {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US", { day: "numeric", month: "short" });
  }

  function changeTab(next: ReportTab) {
    if (next === tab) return;
    setData([]);
    setError(null);
    setSelectedSale(null);
    setTab(next);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-12">
      <PageHeader
        icon={<BarChart3 className="h-7 w-7 sm:h-8 sm:w-8" />}
        title={t("Reports & Analytics")}
        subtitle={t("Deep insights into your business performance")}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input type="date" aria-label={t("From date")} className="bg-transparent text-xs font-bold text-foreground outline-none w-[110px] sm:w-auto" value={dateRange.from} max={dateRange.to} onChange={(event) => event.target.value && setDateRange((previous) => ({ ...previous, from: event.target.value }))} />
              <span className="text-xs font-bold text-muted-foreground">—</span>
              <input type="date" aria-label={t("To date")} className="bg-transparent text-xs font-bold text-foreground outline-none w-[110px] sm:w-auto" value={dateRange.to} min={dateRange.from} onChange={(event) => event.target.value && setDateRange((previous) => ({ ...previous, to: event.target.value }))} />
            </div>
            <button onClick={() => void load()} className="h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-lg touch-target" title={t("Refresh")}><RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} /></button>
          </>
        }
      />

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
          { id: "sales" as const, label: t("Sales"), icon: ShoppingBag },
          { id: "appointments" as const, label: t("Appointments"), icon: Calendar },
          { id: "inventory" as const, label: t("Inventory"), icon: Package },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => changeTab(id)} className={clsx("flex items-center gap-2 px-4 py-3 font-bold text-sm uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap", tab === id ? "text-primary border-b-primary" : "text-muted-foreground border-b-transparent hover:text-foreground")}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-3xl border border-border bg-card/50 shadow-xl"><ScreenState state="loading" title={t("Loading analytics...")} description={t("Please wait a moment")} /></motion.div>
        ) : tab === "sales" ? (
          <motion.div key="sales" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SalesReportSection data={data as SalesReportRow[]} error={error} entitlementSummary={entitlementSummary} onRetry={() => void load()} onNewInvoice={() => navigate("/pos")} onSelectSale={setSelectedSale} t={(key, values) => t(key, values as any)} formatDay={formatDay} />
          </motion.div>
        ) : tab === "appointments" ? (
          <motion.div key="appointments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AppointmentsReportSection data={data as AppointmentReportRow[]} error={error} onRetry={() => void load()} onBookAppointment={() => navigate("/appointments")} t={(key) => t(key)} />
          </motion.div>
        ) : (
          <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InventoryReportSection data={data as InventoryReportRow[]} error={error} onRetry={() => void load()} onOpenInventory={() => navigate("/inventory")} t={(key, values) => t(key, values as any)} />
          </motion.div>
        )}
      </AnimatePresence>

      <SalesTransactionDialog sale={selectedSale} onClose={() => setSelectedSale(null)} t={(key) => t(key)} formatDay={formatDay} />
    </motion.div>
  );
}
