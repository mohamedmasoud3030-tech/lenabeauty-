import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Fingerprint, Plus, Pencil, Clock } from "lucide-react";
import { Modal } from "../shared/components/Modal";
import { AttendanceRecord, AttendanceStatus, AttendanceMethod, Employee } from "../domain/entities";
import { computeAttendanceWorkHours, isCheckoutAfterCheckin } from "../domain/attendance";
import { StatusPill, StatusTone } from "../shared/components/StatusPill";

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

const statusTone: Record<AttendanceStatus, StatusTone> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "destructive",
  HALF_DAY: "primary",
};

const fieldClass = "w-full min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function AttendancePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

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
    const map = new Map(employees.map((employee) => [employee.id, employee.name]));
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
    } catch (error) {
      console.error(error);
      showToast("error", t("Error"), t("An unexpected error occurred. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedMonth]);

  const filtered = useMemo(() => records.filter((record) => {
    const employeeMatches = selectedEmployee === "all" || record.employeeId === selectedEmployee;
    const monthMatches = new Date(record.date).toISOString().slice(0, 7) === selectedMonth;
    return employeeMatches && monthMatches;
  }), [records, selectedEmployee, selectedMonth]);

  const summary = useMemo(() => {
    const present = filtered.filter((record) => record.status === "PRESENT").length;
    const late = filtered.filter((record) => record.status === "LATE").length;
    const absent = filtered.filter((record) => record.status === "ABSENT").length;
    const half = filtered.filter((record) => record.status === "HALF_DAY").length;
    const totalHours = filtered.reduce((sum, record) => sum + (record.workHours || 0), 0);
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

  function openEdit(record: AttendanceRecord) {
    setEditingId(record.id);
    setEmpId(record.employeeId);
    setDate(new Date(record.date).toISOString().slice(0, 10));
    setCheckIn(record.checkInTime || "09:00");
    setCheckOut(record.checkOutTime || "17:00");
    setStatus(record.status);
    setMethod(record.method);
    setNotes(record.notes || "");
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
      const payload = {
        employeeId: empId,
        date: new Date(date),
        checkInTime: checkIn || undefined,
        checkOutTime: checkOut || undefined,
        status,
        method,
        workHours,
        notes: notes || undefined,
      };
      if (editingId) {
        await unwrap(useCases.attendance.update(editingId, payload));
        showToast("success", t("Success"), t("Attendance record updated"));
      } else {
        await unwrap(useCases.attendance.create(payload));
        showToast("success", t("Success"), t("Attendance recorded"));
      }
      setShowModal(false);
      void load();
    } catch {
      showToast("error", t("Error"), t("An unexpected error occurred. Please try again."));
    }
  }

  const summaryCards = [
    { label: t("Attendance Rate"), value: `${summary.pct}%`, tone: "text-success" },
    { label: t("Present Days"), value: String(summary.present), tone: "text-primary" },
    { label: t("Late Days"), value: String(summary.late), tone: "text-warning" },
    { label: t("Absent Days"), value: String(summary.absent), tone: "text-destructive" },
    { label: t("Total Work Hours"), value: summary.totalHours.toFixed(1), tone: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <Fingerprint className="h-7 w-7 text-primary" />
          {t("Attendance")}
        </h1>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("Record Attendance")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold sm:text-3xl ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <select value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)} className={fieldClass}>
          <option value="all">{t("All Employees")}</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
        <input
          type="month"
          aria-label={t("Month")}
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full">
            <thead className="border-b border-border bg-muted/55">
              <tr>
                {["Employee", "Date", "Check-in", "Check-out", "Hours", "Method", "Status"].map((label) => (
                  <th key={label} className="px-4 py-3 text-start text-xs font-bold text-muted-foreground">{t(label)}</th>
                ))}
                <th className="px-4 py-3" aria-label={t("Action")} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-b border-border/70 transition last:border-b-0 hover:bg-muted/35">
                  <td className="px-4 py-4 font-bold text-foreground">{employeeName(record.employeeId)}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(record.date).toLocaleDateString("ar-OM")}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{record.checkInTime || "—"}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{record.checkOutTime || "—"}</td>
                  <td className="px-4 py-4 font-bold text-primary">{record.workHours.toFixed(1)}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{t(METHOD_LABEL_KEYS[record.method])}</td>
                  <td className="px-4 py-4">
                    <StatusPill tone={statusTone[record.status]}>
                      {t(STATUS_LABEL_KEYS[record.status])}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openEdit(record)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/55 text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      title={t("Edit")}
                      aria-label={t("Edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {t("No attendance records for this period")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="sm"
        title={editingId ? t("Edit Attendance Record") : t("Record Attendance")}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} className="min-h-11 flex-1 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground transition hover:bg-primary/90">
              {editingId ? t("Save Changes") : t("Record")}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="min-h-11 flex-1 rounded-xl bg-muted px-4 py-2 font-bold text-foreground transition hover:bg-muted/80">
              {t("Cancel")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Employee")}</label>
            <select value={empId} onChange={(event) => setEmpId(event.target.value)} className={fieldClass}>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-foreground">{t("Date")}</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-foreground">{t("Status")}</label>
              <select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)} className={fieldClass}>
                <option value="PRESENT">{t("Present")}</option>
                <option value="LATE">{t("Late")}</option>
                <option value="ABSENT">{t("Absent")}</option>
                <option value="HALF_DAY">{t("Half Day")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-foreground">{t("Check-in Time")}</label>
              <input type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-foreground">{t("Check-out Time")}</label>
              <input type="time" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className={fieldClass} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Recording Method")}</label>
            <select value={method} onChange={(event) => setMethod(event.target.value as AttendanceMethod)} className={fieldClass}>
              <option value="MANUAL">{t("Manual")}</option>
              <option value="BIOMETRIC">{t("Biometric")}</option>
              <option value="MOBILE">{t("Mobile")}</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">{t("Notes")}</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={fieldClass} />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            {t("Calculated work hours")}:
            <span className="font-bold text-foreground">{computeAttendanceWorkHours(checkIn, checkOut, status).toFixed(1)} {t("hours")}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
