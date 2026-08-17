import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Fingerprint, Plus, Pencil, Clock } from "lucide-react";
import { Modal } from "../shared/components/Modal";
import { AttendanceRecord, AttendanceStatus, AttendanceMethod, Employee } from "../domain/entities";
import { computeAttendanceWorkHours, isCheckoutAfterCheckin } from "../domain/attendance";

const STATUS_LABEL_KEYS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
};

const METHOD_LABEL_KEYS: Record<AttendanceMethod, string> = {
  MANUAL: "Manual",
  BIOMETRIC: "Biometric",
  MOBILE: "Mobile",
};

const statusBadge: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-yellow-100 text-yellow-700",
  ABSENT: "bg-red-100 text-red-700",
  HALF_DAY: "bg-blue-100 text-blue-700",
};

export default function AttendancePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Add / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState("09:00");
  const [checkOut, setCheckOut] = useState("17:00");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [method, setMethod] = useState<AttendanceMethod>("MANUAL");
  const [notes, setNotes] = useState("");

  const employeeName = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) || id;
  }, [employees]);

  async function load() {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);
      const [recs, emps] = await Promise.all([
        unwrap(useCases.attendance.list({ fromISO: from.toISOString(), toISO: to.toISOString() })),
        unwrap(useCases.employees.list()),
      ]);
      setRecords(recs);
      setEmployees(emps);
    } catch (e) {
      console.error(e);
      showToast("error", t("Error"), (e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedMonth]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const empOk = selectedEmployee === "all" || r.employeeId === selectedEmployee;
      const monthOk = new Date(r.date).toISOString().slice(0, 7) === selectedMonth;
      return empOk && monthOk;
    });
  }, [records, selectedEmployee, selectedMonth]);

  const summary = useMemo(() => {
    const present = filtered.filter((r) => r.status === "PRESENT").length;
    const late = filtered.filter((r) => r.status === "LATE").length;
    const absent = filtered.filter((r) => r.status === "ABSENT").length;
    const half = filtered.filter((r) => r.status === "HALF_DAY").length;
    const totalHours = filtered.reduce((s, r) => s + (r.workHours || 0), 0);
    const days = filtered.length || 1;
    const pct = Math.round(((present + late * 0.5 + half * 0.5) / days) * 100);
    return { present, late, absent, half, totalHours, pct };
  }, [filtered]);

  function openAdd() {
    setEditingId(null);
    setEmpId(employees[0]?.id || "");
    setDate(new Date().toISOString().slice(0, 10));
    setCheckIn("09:00");
    setCheckOut("17:00");
    setStatus("PRESENT");
    setMethod("MANUAL");
    setNotes("");
    setShowModal(true);
  }

  function openEdit(rec: AttendanceRecord) {
    setEditingId(rec.id);
    setEmpId(rec.employeeId);
    setDate(new Date(rec.date).toISOString().slice(0, 10));
    setCheckIn(rec.checkInTime || "09:00");
    setCheckOut(rec.checkOutTime || "17:00");
    setStatus(rec.status);
    setMethod(rec.method);
    setNotes(rec.notes || "");
    setShowModal(true);
  }

  async function handleSave() {
    if (!empId) {
      showToast("error", t("Error"), t("Please select an employee"));
      return;
    }
    if (status !== "ABSENT" && checkIn && checkOut && !isCheckoutAfterCheckin(checkIn, checkOut)) {
      showToast("error", t("Error"), t("validation.checkout_after_checkin"));
      return;
    }
    const duplicate = records.some((record) => (
      record.id !== editingId
      && record.employeeId === empId
      && new Date(record.date).toISOString().slice(0, 10) === date
    ));
    if (duplicate) {
      showToast("error", t("Error"), t("Attendance already exists for this employee and date"));
      return;
    }
    const workHours = computeAttendanceWorkHours(checkIn, checkOut, status);
    try {
      if (editingId) {
        await unwrap(useCases.attendance.update(editingId, {
          employeeId: empId,
          date: new Date(date),
          checkInTime: checkIn || undefined,
          checkOutTime: checkOut || undefined,
          status,
          method,
          workHours,
          notes: notes || undefined,
        }));
        showToast("success", t("Success"), t("Attendance record updated"));
      } else {
        await unwrap(useCases.attendance.create({
          employeeId: empId,
          date: new Date(date),
          checkInTime: checkIn || undefined,
          checkOutTime: checkOut || undefined,
          status,
          method,
          workHours,
          notes: notes || undefined,
        }));
        showToast("success", t("Success"), t("Attendance recorded"));
      }
      setShowModal(false);
      load();
    } catch (e) {
      showToast("error", t("Error"), (e as Error).message || String(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Fingerprint className="w-8 h-8 text-blue-600" />
          {t("Attendance")}
        </h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
        >
          <Plus className="w-4 h-4" />
          {t("Record Attendance")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">{t("Attendance Rate")}</p>
          <p className="text-3xl font-bold text-green-600">{summary.pct}%</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">{t("Present Days")}</p>
          <p className="text-3xl font-bold text-blue-600">{summary.present}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">{t("Late Days")}</p>
          <p className="text-3xl font-bold text-yellow-600">{summary.late}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">{t("Absent Days")}</p>
          <p className="text-3xl font-bold text-red-600">{summary.absent}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">{t("Total Work Hours")}</p>
          <p className="text-3xl font-bold text-purple-600">{summary.totalHours.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="all">{t("All Employees")}</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input
          type="month"
          aria-label={t("Month")}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Employee")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Date")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Check-in")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Check-out")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Hours")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Method")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">{t("Status")}</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-bold text-gray-800">{employeeName(rec.employeeId)}</td>
                  <td className="px-6 py-4 text-gray-600">{new Date(rec.date).toLocaleDateString("ar-SA")}</td>
                  <td className="px-6 py-4 text-gray-600">{rec.checkInTime || "-"}</td>
                  <td className="px-6 py-4 text-gray-600">{rec.checkOutTime || "-"}</td>
                  <td className="px-6 py-4 font-bold text-blue-600">{rec.workHours.toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-600">{t(METHOD_LABEL_KEYS[rec.method])}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusBadge[rec.status]}`}>
                      {t(STATUS_LABEL_KEYS[rec.status])}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(rec)}
                        className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                        title={t("Edit")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400">
                    {t("No attendance records for this period")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="sm"
        title={editingId ? t("Edit Attendance Record") : t("Record Attendance")}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
            >
              {editingId ? t("Save Changes") : t("Record")}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-2">{t("Date")}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t("Status")}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  >
                    <option value="PRESENT">{t("Present")}</option>
                    <option value="LATE">{t("Late")}</option>
                    <option value="ABSENT">{t("Absent")}</option>
                    <option value="HALF_DAY">{t("Half Day")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-2">{t("Check-in Time")}</label>
                  <input
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t("Check-out Time")}</label>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">{t("Recording Method")}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as AttendanceMethod)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  <option value="MANUAL">{t("Manual")}</option>
                  <option value="BIOMETRIC">{t("Biometric")}</option>
                  <option value="MOBILE">{t("Mobile")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">{t("Notes")}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                {t("Calculated work hours")}: <span className="font-bold text-blue-600">{computeAttendanceWorkHours(checkIn, checkOut, status).toFixed(2)} {t("hours")}</span>
              </div>

        </div>
      </Modal>
    </div>
  );
}
