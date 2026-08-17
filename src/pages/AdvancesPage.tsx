import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Plus, Check, X, TrendingDown, RotateCcw } from "lucide-react";
import { Modal } from "../shared/components/Modal";
import { EmployeeAdvance, AdvanceStatus, Employee } from "../domain/entities";

const STATUS_LABEL_KEYS: Record<AdvanceStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DEDUCTED: "Deducted",
};

const statusBadge: Record<AdvanceStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  DEDUCTED: "bg-green-100 text-green-700",
};

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
      showToast("error", t("Error"), (e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return filterStatus === "all" ? advances : advances.filter((a) => a.status === filterStatus);
  }, [advances, filterStatus]);

  const summary = useMemo(() => {
    const pending = advances.filter((a) => a.status === "PENDING");
    const approved = advances.filter((a) => a.status === "APPROVED");
    const deducted = advances.filter((a) => a.status === "DEDUCTED");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, a) => s + a.amount, 0),
      approvedAmount: approved.reduce((s, a) => s + a.amount, 0),
      deductedAmount: deducted.reduce((s, a) => s + a.amount, 0),
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
    if (isNaN(amt) || amt <= 0) {
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
      load();
    } catch (e) {
      showToast("error", t("Error"), (e as Error).message || String(e));
    }
  }

  async function setStatus(id: string, status: AdvanceStatus) {
    try {
      await unwrap(useCases.advances.update(id, { status }));
      showToast("success", t("Success"), status === "APPROVED" ? t("Approved successfully") : t("Rejected successfully"));
      load();
    } catch (e) {
      showToast("error", t("Error"), (e as Error).message || String(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingDown className="w-8 h-8 text-orange-600" />
          {t("Employee Advances")}
        </h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
        >
          <Plus className="w-4 h-4" />
          {t("New Advance Request")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">{t("Pending")}</p>
          <p className="text-3xl font-bold text-yellow-600">{summary.pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.pendingAmount.toFixed(2)} OMR</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">{t("Approved")}</p>
          <p className="text-3xl font-bold text-blue-600">{summary.approvedAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">OMR</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">{t("Deducted from payroll")}</p>
          <p className="text-3xl font-bold text-green-600">{summary.deductedAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">OMR</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">{t("Total Requests")}</p>
          <p className="text-3xl font-bold text-purple-600">{advances.length}</p>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "PENDING", "APPROVED", "DEDUCTED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              filterStatus === s ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            {s === "all" ? t("All") : t(STATUS_LABEL_KEYS[s])}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.map((adv) => (
          <div key={adv.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
              <div>
                <p className="text-sm text-gray-600">{t("Employee")}</p>
                <p className="font-bold text-gray-800">{employeeName(adv.employeeId)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t("Amount")}</p>
                <p className="font-bold text-lg text-orange-600">{adv.amount.toFixed(2)} OMR</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t("Date")}</p>
                <p className="font-bold text-gray-800">{new Date(adv.advanceDate).toLocaleDateString("ar-SA")}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t("Reason")}</p>
                <p className="font-bold text-gray-800">{adv.reason || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t("Status")}</p>
                <span className={`px-3 py-1 rounded-full text-sm font-bold inline-block ${statusBadge[adv.status]}`}>
                  {t(STATUS_LABEL_KEYS[adv.status])}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                {adv.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => setStatus(adv.id, "APPROVED")}
                      className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                      title={t("Approve")}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setStatus(adv.id, "REJECTED")}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                      title={t("Reject")}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                )}
                {adv.status === "DEDUCTED" && (
                  <span className="inline-flex items-center gap-1 text-green-600 text-sm font-bold">
                    <RotateCcw className="w-4 h-4" /> {t("Deducted in payroll")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow p-20 text-center text-gray-400">
            {t("No advances with this status")}
          </div>
        )}
      </div>

      {/* Add modal */}
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
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
            >
              {t("Submit Request")}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-bold"
            >
              {t("Cancel")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">{t("Employee")}</label>
                <select
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">{t("Amount (OMR)")}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t("Enter amount")}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">{t("Reason")}</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("e.g., Personal needs")}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">{t("Date")}</label>
                <input
                  type="date"
                  value={advDate}
                  onChange={(e) => setAdvDate(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                />
              </div>
        </div>
      </Modal>
    </div>
  );
}
