import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Plus, Check, X, TrendingDown, RotateCcw } from "lucide-react";
import { Modal } from "../shared/components/Modal";
import { EmployeeAdvance, AdvanceStatus, Employee } from "../domain/entities";
import { formatOMRAmount } from "../shared/money";

const STATUS_LABEL_KEYS: Record<AdvanceStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DEDUCTED: "Deducted",
};

const statusBadge: Record<AdvanceStatus, string> = {
  PENDING: "border-warning/25 bg-warning/10 text-warning",
  APPROVED: "border-primary/25 bg-primary/10 text-primary",
  REJECTED: "border-destructive/25 bg-destructive/10 text-destructive",
  DEDUCTED: "border-success/25 bg-success/10 text-success",
};

const fieldClass = "w-full min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function AdvancesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | AdvanceStatus>("all");

  const [showModal, setShowModal] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [advDate, setAdvDate] = useState(new Date().toISOString().slice(0, 10));

  const employeeName = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) || id;
  }, [employees]);

  async function load() {
    setLoading(true);
    try {
      const [advs, emps] = await Promise.all([
        unwrap(useCases.advances.list()),
        unwrap(useCases.employees.list()),
      ]);
      setAdvances(advs);
      setEmployees(emps);
    } catch (e) {
      console.error(e);
      showToast("error", t("Error"), t("An unexpected error occurred. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return filterStatus === "all" ? advances : advances.filter((a) => a.status === filterStatus);
  }, [advances, filterStatus]);

  const summary = useMemo(() => {
    const pending = advances.filter((a) => a.status === "PENDING");
    const approved = advances.filter((a) => a.status === "APPROVED");
    const deducted = advances.filter((a) => a.status === "DEDUCTED");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, advance) => sum + advance.amount, 0),
      approvedAmount: approved.reduce((sum, advance) => sum + advance.amount, 0),
      deductedAmount: deducted.reduce((sum, advance) => sum + advance.amount, 0),
    };
  }, [advances]);

  function openAdd() {
    setEmpId(employees[0]?.id || "");
    setAmount("");
    setReason("");
    setAdvDate(new Date().toISOString().slice(0, 10));
    setShowModal(true);
  }

  async function handleAdd() {
    const amt = Number(amount);
    if (!empId) {
      showToast("error", t("Error"), t("Please select an employee"));
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("error", t("Error"), t("Enter a valid amount"));
      return;
    }
    try {
      await unwrap(useCases.advances.create({
        employeeId: empId,
        amount: amt,
        reason: reason || t("Advance"),
        advanceDate: new Date(advDate),
        status: "PENDING",
      }));
      showToast("success", t("Success"), t("Advance request recorded"));
      setShowModal(false);
      void load();
    } catch {
      showToast("error", t("Error"), t("An unexpected error occurred. Please try again."));
    }
  }

  async function setStatus(id: string, status: AdvanceStatus) {
    try {
      await unwrap(useCases.advances.update(id, { status }));
      showToast("success", t("Success"), status === "APPROVED" ? t("Approved successfully") : t("Rejected successfully"));
      void load();
    } catch {
      showToast("error", t("Error"), t("An unexpected error occurred. Please try again."));
    }
  }

  const summaryCards = [
    { label: t("Pending"), value: String(summary.pendingCount), detail: `${formatOMRAmount(summary.pendingAmount)} OMR`, tone: "text-warning" },
    { label: t("Approved"), value: formatOMRAmount(summary.approvedAmount), detail: "OMR", tone: "text-primary" },
    { label: t("Deducted from payroll"), value: formatOMRAmount(summary.deductedAmount), detail: "OMR", tone: "text-success" },
    { label: t("Total Requests"), value: String(advances.length), detail: "", tone: "text-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <TrendingDown className="h-7 w-7 text-primary" />
          {t("Employee Advances")}
        </h1>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("New Advance Request")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold sm:text-3xl ${card.tone}`}>{card.value}</p>
            {card.detail ? <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p> : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
        {(["all", "PENDING", "APPROVED", "DEDUCTED", "REJECTED"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilterStatus(item)}
            className={`min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              filterStatus === item
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item === "all" ? t("All") : t(STATUS_LABEL_KEYS[item])}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((advance) => (
          <div key={advance.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("Employee")}</p>
                <p className="mt-1 font-bold text-foreground">{employeeName(advance.employeeId)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("Amount")}</p>
                <p className="mt-1 text-lg font-bold text-primary">{formatOMRAmount(advance.amount)} OMR</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("Date")}</p>
                <p className="mt-1 font-semibold text-foreground">{new Date(advance.advanceDate).toLocaleDateString("ar-OM")}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("Reason")}</p>
                <p className="mt-1 font-semibold text-foreground">{advance.reason || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("Status")}</p>
                <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge[advance.status]}`}>
                  {t(STATUS_LABEL_KEYS[advance.status])}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                {advance.status === "PENDING" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStatus(advance.id, "APPROVED")}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-success/25 bg-success/10 text-success transition hover:bg-success/15"
                      title={t("Approve")}
                      aria-label={t("Approve")}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(advance.id, "REJECTED")}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive transition hover:bg-destructive/15"
                      title={t("Reject")}
                      aria-label={t("Reject")}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
                {advance.status === "DEDUCTED" ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-success">
                    <RotateCcw className="h-4 w-4" /> {t("Deducted in payroll")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
            {t("No advances with this status")}
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="sm"
        title={t("New Advance Request")}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="min-h-11 flex-1 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              {t("Submit Request")}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="min-h-11 flex-1 rounded-xl bg-muted px-4 py-2 font-bold text-foreground transition hover:bg-muted/80"
            >
              {t("Cancel")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Employee")}</label>
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={fieldClass}>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Amount (OMR)")}</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("Enter amount")}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Reason")}</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("e.g., Personal needs")}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Date")}</label>
            <input type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} className={fieldClass} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
