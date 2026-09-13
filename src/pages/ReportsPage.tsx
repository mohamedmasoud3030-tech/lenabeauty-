import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Calendar, Download, Package, Printer, RefreshCw, ShoppingBag } from "lucide-react";
import { clsx } from "clsx";
import { useCases } from "../app/composition/useCases";
import type { AppointmentReportRow, EntitlementSummary, InventoryReportRow, SalesReportRow } from "../application/dto";
import { Modal } from "../shared/components/Modal";
import { PageHeader } from "../shared/components/PageHeader";
import { ReportPrintSheet, type ReportSheetModel } from "../shared/components/ReportPrintSheet";
import { ScreenState } from "../shared/components/ScreenState";
import { formatLocalDateOnly } from "../shared/dateRange";
import { unwrap } from "../shared/hooks/useApplication";
import { AppointmentsReportSection } from "./reports/AppointmentsReportSection";
import { InventoryReportSection } from "./reports/InventoryReportSection";
import { SalesReportSection } from "./reports/SalesReportSection";
import { SalesTransactionDialog } from "./reports/SalesTransactionDialog";
import {
  buildAppointmentsPrintModel,
  buildInventoryPrintModel,
  buildReportCsv,
  buildSalesPrintModel,
} from "./reports/reportPrint";

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
  const [printOpen, setPrintOpen] = useState(false);
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
      setError(loadError.code === "BACKEND_METHOD_UNSUPPORTED" ? "BACKEND_METHOD_UNSUPPORTED" : loadError.message || String(t("Failed to load data")));
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

  const docNo = `${t("Period")}: ${formatDay(dateRange.from)} — ${formatDay(dateRange.to)} · ${t("Generated on")}: ${new Date().toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US", { day: "numeric", month: "short", year: "numeric" })}`;

  // The A4 print sheet mirrors the on-screen analytics for the active tab.
  const printModel: ReportSheetModel | null = useMemo(() => {
    if (data.length === 0) return null;
    if (tab === "sales") {
      return buildSalesPrintModel(data as SalesReportRow[], (key, values) => String(t(key, values as any)), formatDay, docNo);
    }
    if (tab === "appointments") {
      return buildAppointmentsPrintModel(data as AppointmentReportRow[], (key, values) => String(t(key, values as any)), formatDay, docNo);
    }
    return buildInventoryPrintModel(data as InventoryReportRow[], (key, values) => String(t(key, values as any)), docNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data, i18n.language, dateRange, entitlementSummary, t]);

  const handleCsvExport = () => {
    const csv = buildReportCsv(tab, data, (key, values) => String(t(key, values as any)));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${tab}_${dateRange.from}_${dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-12">
      <PageHeader
        icon={<BarChart3 className="h-7 w-7 sm:h-8 sm:w-8" />}
        title={t("Reports & Analytics")}
        subtitle={t("Deep insights into your business performance")}
        actions={
          <>
            <button
              onClick={handleCsvExport}
              disabled={data.length === 0 || loading || Boolean(error)}
              className="flex items-center gap-2 h-11 rounded-xl border border-border bg-card px-3 sm:px-4 text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-lg touch-target disabled:opacity-40 disabled:pointer-events-none"
              title={t("Export CSV")}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("Export CSV")}</span>
            </button>
            <button
              onClick={() => setPrintOpen(true)}
              disabled={printModel === null || loading || Boolean(error)}
              className="flex items-center gap-2 h-11 rounded-xl border border-border bg-card px-3 sm:px-4 text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-lg touch-target disabled:opacity-40 disabled:pointer-events-none"
              title={t("Print Report")}
            >
              <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("Print Report")}</span>
            </button>
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
            <SalesReportSection data={data as SalesReportRow[]} error={error} entitlementSummary={entitlementSummary} onRetry={() => void load()} onNewInvoice={() => navigate("/pos")} onSelectSale={setSelectedSale} t={(key, values) => String(t(key, values as any))} formatDay={formatDay} />
          </motion.div>
        ) : tab === "appointments" ? (
          <motion.div key="appointments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AppointmentsReportSection data={data as AppointmentReportRow[]} error={error} onRetry={() => void load()} onBookAppointment={() => navigate("/appointments")} t={(key) => String(t(key))} />
          </motion.div>
        ) : (
          <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InventoryReportSection data={data as InventoryReportRow[]} error={error} onRetry={() => void load()} onOpenInventory={() => navigate("/inventory")} t={(key, values) => String(t(key, values as any))} />
          </motion.div>
        )}
      </AnimatePresence>

      <SalesTransactionDialog sale={selectedSale} onClose={() => setSelectedSale(null)} t={(key) => String(t(key))} formatDay={formatDay} />

      {/* A4 print preview — the shared report sheet; Print hands the page to
          the browser (global print CSS isolates #print-area). */}
      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={t("Print preview")}
        size="xl"
        footer={
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleCsvExport}
              className="flex-1 min-w-0 h-11 px-2 sm:px-4 rounded-xl border border-border bg-card font-bold text-sm text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 touch-target"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("Export CSV")}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-w-0 h-11 px-2 sm:px-4 rounded-xl bg-primary font-bold text-sm text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 touch-target"
            >
              <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("Print")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintOpen(false)}
              className="flex-1 min-w-0 h-11 px-2 sm:px-4 rounded-xl border border-border bg-card font-bold text-sm text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 touch-target"
            >
              <span>{t("Close")}</span>
            </button>
          </div>
        }
      >
        {printModel && (
          <div className="overflow-auto rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_18%_8%,rgba(218,160,94,0.08),transparent_18rem),linear-gradient(160deg,#fbf9f6,#f7f3f9)] p-3 sm:p-5">
            <ReportPrintSheet model={printModel} />
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
