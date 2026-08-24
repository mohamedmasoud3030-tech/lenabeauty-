import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { Download, Printer, Trash2, FileText, Users, DollarSign, TrendingDown, CalendarClock } from "lucide-react";
import { PayrollRun, PayrollLineItem, Employee } from "../domain/entities";
import printService, { escapePrintText } from "../infrastructure/services/printService";
import { formatOMRAmount } from "../shared/money";

export default function PayrollPageEnhanced() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedRun, setSelectedRun] = useState<{ run: PayrollRun; lines: PayrollLineItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const employeeName = useMemo(() => {
    const map = new Map(employees.map((employee) => [employee.id, employee.name]));
    return (id: string) => map.get(id) || id;
  }, [employees]);

  async function loadRuns() {
    setLoading(true);
    try {
      const [runList, employeeList] = await Promise.all([
        unwrap(useCases.payroll.listRuns()),
        unwrap(useCases.employees.list()),
      ]);
      setRuns(runList);
      setEmployees(employeeList);
      const match = runList.find((run) => run.periodMonth === selectedMonth);
      if (match) {
        const detail = await unwrap(useCases.payroll.getRun(match.id));
        setSelectedRun(detail);
      } else {
        setSelectedRun(null);
      }
    } catch (error) {
      console.error(error);
      showToast("error", t("Error"), (error as Error).message || String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRuns(); }, []);

  useEffect(() => {
    const match = runs.find((run) => run.periodMonth === selectedMonth);
    if (match) {
      unwrap(useCases.payroll.getRun(match.id))
        .then(setSelectedRun)
        .catch((error) => showToast("error", t("Error"), (error as Error).message || String(error)));
    } else {
      setSelectedRun(null);
    }
  }, [selectedMonth, runs]);

  const totals = useMemo(() => {
    if (!selectedRun) return { base: 0, advances: 0, net: 0, count: 0 };
    const base = selectedRun.lines.reduce((sum, line) => sum + line.baseSalary, 0);
    const advances = selectedRun.lines.reduce((sum, line) => sum + line.advancesDeducted, 0);
    const net = selectedRun.lines.reduce((sum, line) => sum + line.netSalary, 0);
    return { base, advances, net, count: selectedRun.lines.length };
  }, [selectedRun]);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await unwrap(useCases.payroll.createRun({ periodMonth: selectedMonth }));
      showToast("success", t("Success"), t("Payroll run created"));
      setSelectedRun(result);
      void loadRuns();
    } catch (error) {
      showToast("error", t("Error"), (error as Error).message || String(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t("Delete payroll run"),
      message: t("Are you sure? Approved advances will become deductible again."),
      type: "danger",
    });
    if (!ok) return;
    try {
      await unwrap(useCases.payroll.deleteRun(id));
      showToast("success", t("Success"), t("Deleted successfully"));
      setSelectedRun(null);
      void loadRuns();
    } catch (error) {
      showToast("error", t("Error"), (error as Error).message || String(error));
    }
  }

  const generatePayrollHTML = (): string => {
    if (!selectedRun) return "";
    const lines = selectedRun.lines.map((line) => `
      <tr>
        <td>${escapePrintText(employeeName(line.employeeId))}</td>
        <td class="text-right">${line.baseSalary.toFixed(3)}</td>
        <td class="text-right">${line.advancesDeducted.toFixed(3)}</td>
        <td class="text-right font-bold">${line.netSalary.toFixed(3)}</td>
      </tr>`).join("");
    return `
      <div class="section">
        <h2 class="text-lg font-bold mb-3">${escapePrintText(t("Payroll Report"))}</h2>
        <p class="mb-3">${escapePrintText(t("Period"))}: ${escapePrintText(selectedRun.run.periodMonth)}</p>
        <table>
          <thead><tr>
            <th>${escapePrintText(t("Employee"))}</th>
            <th>${escapePrintText(t("Base"))}</th>
            <th>${escapePrintText(t("Advances"))}</th>
            <th>${escapePrintText(t("Net"))}</th>
          </tr></thead>
          <tbody>${lines}</tbody>
          <tfoot>
            <tr style="background-color: var(--primary-color); color: white;">
              <td class="font-bold">${escapePrintText(t("Total"))}</td>
              <td class="text-right">${totals.base.toFixed(3)}</td>
              <td class="text-right">${totals.advances.toFixed(3)}</td>
              <td class="text-right font-bold">${totals.net.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  };

  const summaryCards = selectedRun ? [
    { label: t("Employees"), value: String(totals.count), Icon: Users, tone: "text-primary" },
    { label: t("Base Salaries"), value: `${formatOMRAmount(totals.base)} OMR`, Icon: DollarSign, tone: "text-success" },
    { label: t("Advances Deducted"), value: `${formatOMRAmount(totals.advances)} OMR`, Icon: TrendingDown, tone: "text-warning" },
    { label: t("Net Salary"), value: `${formatOMRAmount(totals.net)} OMR`, Icon: FileText, tone: "text-secondary" },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("Payroll Management")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Net salary = base − advances deducted in the same month")}</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <label className="mb-2 block text-sm font-semibold text-muted-foreground">{t("Select Month")}</label>
            <input
              type="month"
              aria-label={t("Select Month")}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            <FileText className="h-5 w-5" />
            {creating ? t("Creating…") : t("Create Payroll Run")}
          </button>
        </div>
      </section>

      {selectedRun ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map(({ label, value, Icon, tone }) => (
            <article key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
                  <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-2.5">
                  <Icon className={`h-5 w-5 ${tone}`} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">{t("Payroll Details")} — {selectedMonth}</h2>
          {selectedRun ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => printService.printDocument(generatePayrollHTML(), { paperSize: "A4", filename: `Payroll-${selectedMonth}` })}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
              >
                <Printer className="h-4 w-4" /> {t("Print")}
              </button>
              <button
                type="button"
                onClick={() => printService.exportToPDF(generatePayrollHTML(), `Payroll-${selectedMonth}.pdf`, { paperSize: "A4" })}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-secondary/20 bg-secondary/10 px-3 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/15"
              >
                <Download className="h-4 w-4" /> PDF
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selectedRun.run.id)}
                aria-label={t("Delete payroll run")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive transition hover:bg-destructive/15"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
        ) : selectedRun ? (
          <div className="overflow-x-auto">
            <table className="min-w-[680px] w-full text-sm">
              <thead className="bg-muted/55">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-start text-xs font-bold text-muted-foreground">{t("Employee")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold text-muted-foreground">{t("Base")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold text-muted-foreground">{t("Advances")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold text-foreground">{t("Net")}</th>
                </tr>
              </thead>
              <tbody>
                {selectedRun.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/70 transition last:border-b-0 hover:bg-muted/35">
                    <td className="px-4 py-4 font-semibold text-foreground">{employeeName(line.employeeId)}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatOMRAmount(line.baseSalary)}</td>
                    <td className="px-4 py-4 font-medium text-warning">-{formatOMRAmount(line.advancesDeducted)}</td>
                    <td className="px-4 py-4 font-bold text-foreground">{formatOMRAmount(line.netSalary)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/35 font-bold">
                  <td className="px-4 py-4 text-foreground">{t("Total")}</td>
                  <td className="px-4 py-4 text-foreground">{formatOMRAmount(totals.base)}</td>
                  <td className="px-4 py-4 text-warning">-{formatOMRAmount(totals.advances)}</td>
                  <td className="px-4 py-4 text-primary">{formatOMRAmount(totals.net)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-14 text-center text-muted-foreground">
            <CalendarClock className="mx-auto mb-3 h-10 w-10 text-primary/55" />
            <p className="text-sm">{t("No payroll run for this month. Click Create Payroll Run.")}</p>
          </div>
        )}
      </section>

      {runs.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-lg font-bold text-foreground">{t("Previous Runs")}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => {
              const selected = run.periodMonth === selectedMonth;
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedMonth(run.periodMonth)}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-start transition ${
                    selected
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="font-bold">{run.periodMonth}</span>
                  <span className="text-xs text-muted-foreground">{new Date(run.runDate).toLocaleDateString(i18n.language)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
