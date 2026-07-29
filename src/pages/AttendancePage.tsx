import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { Fingerprint, Plus, Trash2, Pencil, Clock, XCircle } from "lucide-react";
import { AttendanceRecord, AttendanceStatus, AttendanceMethod, Employee } from "../domain/entities";

function computeWorkHours(checkIn?: string, checkOut?: string, status?: AttendanceStatus): number {
  if (!checkIn || !checkOut) return 0;
  if (status === "ABSENT") return 0;
  const [h1, m1] = checkIn.split(":").map(Number);
  const [h2, m2] = checkOut.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins <= 0) return 0;
  return Math.round((mins / 60) * 100) / 100;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "حاضر",
  LATE: "متأخر",
  ABSENT: "غائب",
  HALF_DAY: "نصف يوم",
};

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  MANUAL: "يدوي",
  BIOMETRIC: "بصمة",
  MOBILE: "هاتف",
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
  const { confirm } = useConfirm();

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
      const [recs, emps] = await Promise.all([
        unwrap(useCases.attendance.list()),
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

  useEffect(() => { load(); }, []);

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
      showToast("error", t("Error"), "يرجى اختيار موظف");
      return;
    }
    const workHours = computeWorkHours(checkIn, checkOut, status);
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
        showToast("success", t("Success"), "تم تحديث السجل");
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
        showToast("success", t("Success"), "تم تسجيل الحضور");
      }
      setShowModal(false);
      load();
    } catch (e) {
      showToast("error", t("Error"), (e as Error).message || String(e));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: "حذف سجل الحضور", message: "هل أنت متأكد؟", type: "danger" });
    if (!ok) return;
    try {
      await unwrap(useCases.attendance.delete(id));
      showToast("success", t("Success"), "تم الحذف");
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
          تسجيل حضور
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">نسبة الحضور</p>
          <p className="text-3xl font-bold text-green-600">{summary.pct}%</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">أيام الحضور</p>
          <p className="text-3xl font-bold text-blue-600">{summary.present}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">أيام التأخير</p>
          <p className="text-3xl font-bold text-yellow-600">{summary.late}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">أيام الغياب</p>
          <p className="text-3xl font-bold text-red-600">{summary.absent}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">إجمالي ساعات العمل</p>
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
          <option value="all">كل الموظفين</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input
          type="month"
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
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الموظف</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">التاريخ</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الدخول</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الخروج</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الساعات</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الطريقة</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الحالة</th>
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
                  <td className="px-6 py-4 text-gray-600">{METHOD_LABELS[rec.method]}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusBadge[rec.status]}`}>
                      {STATUS_LABELS[rec.status]}
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
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                        title={t("Delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400">
                    لا توجد سجلات حضور لهذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">{editingId ? "تعديل سجل" : "تسجيل حضور"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">الموظف</label>
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
                  <label className="block text-sm font-bold mb-2">التاريخ</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">الحالة</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  >
                    <option value="PRESENT">حاضر</option>
                    <option value="LATE">متأخر</option>
                    <option value="ABSENT">غائب</option>
                    <option value="HALF_DAY">نصف يوم</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-2">وقت الدخول</label>
                  <input
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">وقت الخروج</label>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">طريقة التسجيل</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as AttendanceMethod)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  <option value="MANUAL">يدوي</option>
                  <option value="BIOMETRIC">بصمة</option>
                  <option value="MOBILE">هاتف</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">ملاحظات</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                ساعات العمل المحسوبة: <span className="font-bold text-blue-600">{computeWorkHours(checkIn, checkOut, status).toFixed(2)} ساعة</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
                >
                  {editingId ? "حفظ التعديلات" : "تسجيل"}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
