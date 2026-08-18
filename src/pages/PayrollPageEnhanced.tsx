import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { Download, Printer, Trash2, FileText, Users, DollarSign, TrendingDown, CalendarClock } from "lucide-react";
import { PayrollRun, PayrollLineItem, Employee } from "../domain/entities";
import printService, { escapePrintText } from "../infrastructure/services/printService";

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
    const map = new Map(employees.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) || id;
  }, [employees]);

  async function loadRuns() {
    setLoading(true);
    try {
      const [runList, emps] = await Promise.all([
        unwrap(useCases.payroll.listRuns()),
        unwrap(useCases.employees.list()),
      ]);
      setRuns(runList);
      setEmployees(emps);
      const match = runList.find((r) => r.periodMonth === selectedMonth);
      if (match) {
        const detail = await unwrap(useCases.payroll.getRun(match.id));
        setSelectedRun(detail);
      } else {
        setSelectedRun(null);
      }
    } catch (e) {
      console.error(e);
      showToast("error", t("Error"), (e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRuns(); }, []);

  useEffect(() => {
    // When the selected month changes, pick an existing run if present.
    const match = runs.find((r) => r.periodMonth === selectedMonth);
    if (match) {
      unwrap(useCases.payroll.getRun(match.id))
        .then(setSelectedRun)
        .catch((e) => showToast("error", t("Error"), (e as Error).message || String(e)));
    } else {
      setSelectedRun(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, runs]);

  const totals = useMemo(() => {
    if (!selectedRun) return { base: 0, advances: 0, net: 0, count: 0 };
    const base = selectedRun.lines.reduce((s, l) => s + l.baseSalary, 0);
    const advances = selectedRun.lines.reduce((s, l) => s + l.advancesDeducted, 0);
    const net = selectedRun.lines.reduce((s, l) => s + l.netSalary, 0);
    return { base, advances, net, count: selectedRun.lines.length };
  }, [selectedRun]);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await unwrap(useCases.payroll.createRun({ periodMonth: selectedMonth }));
      showToast("success", t("Success"), t("Payroll run created"));
      setSelectedRun(result);
      loadRuns();
    } catch (e) {
      showToast("error", t("Error"), (e as Error).message || String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: t("Delete payroll run"), message: t("Are you sure? Approved advances will become deductible again."), type: "danger" });
    if (!ok) return;
    try {
      await unwrap(useCases.payroll.deleteRun(id));
      showToast("success", t("Success"), t("Deleted successfully"));
      setSelectedRun(null);
      loadRuns();
    } catch (e) {
      showToast("error", t("Error"), (e as Error).message || String(e));
    }
  }

  const generatePayrollHTML = (): string => {
    if (!selectedRun) return "";
    const lines = selectedRun.lines.map((l) => `
      <tr>
        <td>${escapePrintText(employeeName(l.employeeId))}</td>
        <td class="text-right">${l.baseSalary.toFixed(3)}</td>
        <td class="text-right">${l.advancesDeducted.toFixed(3)}</td>
        <td class="text-right font-bold">${l.netSalary.toFixed(3)}</td>
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

  return (
    <div className="min-h-full rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">
          {t("Payroll Management")}
        </h1>
        <p className="text-neutral-400 mb-6">
          {t("Net salary = base − advances deducted in the same month")}
        </p>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <label className="block text-sm text-gray-300 mb-2">{t("Select Month")}</label>
              <input
                type="month"
                aria-label={t("Select Month")}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              <FileText className="w-5 h-5" />
              {creating ? t("Creating…") : t("Create Payroll Run")}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {selectedRun && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-400 text-sm">{t("Employees")}</p>
                  <p className="text-2xl font-bold text-white">{totals.count}</p>
                </div>
                <Users className="w-10 h-10 text-purple-400 opacity-50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-400 text-sm">{t("Base Salaries")}</p>
                  <p className="text-2xl font-bold text-white">{totals.base.toFixed(2)}</p>
                </div>
                <DollarSign className="w-10 h-10 text-green-400 opacity-50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-400 text-sm">{t("Advances Deducted")}</p>
                  <p className="text-2xl font-bold text-white">{totals.advances.toFixed(2)}</p>
                </div>
                <TrendingDown className="w-10 h-10 text-orange-400 opacity-50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-400 text-sm">{t("Net Salary")}</p>
                  <p className="text-2xl font-bold text-white">{totals.net.toFixed(2)}</p>
                </div>
                <FileText className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </div>
          </div>
        )}

        {/* Payroll table for the selected month */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">
              {t("Payroll Details")} — {selectedMonth}
            </h2>
            {selectedRun && (
              <div className="flex gap-2">
                <button
                  onClick={() => printService.printDocument(generatePayrollHTML(), { paperSize: "A4", filename: `Payroll-${selectedMonth}` })}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  <Printer className="w-4 h-4" /> {t("Print")}
                </button>
                <button
                  onClick={() => printService.exportToPDF(generatePayrollHTML(), `Payroll-${selectedMonth}.pdf`, { paperSize: "A4" })}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedRun.run.id)}
                  aria-label={t("Delete payroll run")}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : selectedRun ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-right py-3 px-4 text-gray-300">{t("Employee")}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{t("Base")}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{t("Advances")}</th>
                  <th className="text-right py-3 px-4 text-white font-bold">{t("Net")}</th>
                </tr>
              </thead>
              <tbody>
                {selectedRun.lines.map((l) => (
                  <tr key={l.id} className="border-b border-white/10 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-white">{employeeName(l.employeeId)}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{l.baseSalary.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-orange-400">-{l.advancesDeducted.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-white font-bold">{l.netSalary.toFixed(3)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-white/30 font-bold">
                  <td className="py-3 px-4 text-white">{t("Total")}</td>
                  <td className="py-3 px-4 text-right text-white">{totals.base.toFixed(3)}</td>
                  <td className="py-3 px-4 text-right text-orange-400">-{totals.advances.toFixed(3)}</td>
                  <td className="py-3 px-4 text-right text-white">{totals.net.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16 text-neutral-400">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>{t("No payroll run for this month. Click Create Payroll Run.")}</p>
            </div>
          )}
        </div>

        {/* Runs history */}
        {runs.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mt-6">
            <h2 className="text-xl font-bold text-white mb-4">{t("Previous Runs")}</h2>
            <div className="space-y-2">
              {runs.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                    r.periodMonth === selectedMonth ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedMonth(r.periodMonth)}
                >
                  <span className="text-white font-bold">{r.periodMonth}</span>
                  <span className="text-gray-300 text-sm">{new Date(r.runDate).toLocaleDateString(i18n.language)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
