import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, Users, Clock, TrendingDown, DollarSign } from "lucide-react";
import { AttendanceRecord, EmployeeAdvance, Employee, PayrollLineItem } from "../domain/entities";

interface StaffStat {
  id: string;
  name: string;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  halfDays: number;
  workHours: number;
  attendanceRate: number;
  advancesTotal: number;
  baseSalary: number;
  netSalary: number | null;
}

export default function StaffAnalyticsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [latestLines, setLatestLines] = useState<PayrollLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  async function load() {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);
      const range = { fromISO: from.toISOString(), toISO: to.toISOString() };
      const [emps, att, adv, runList] = await Promise.all([
        unwrap(useCases.employees.list()),
        unwrap(useCases.attendance.list(range)),
        unwrap(useCases.advances.list(range)),
        unwrap(useCases.payroll.listRuns()),
      ]);
      setEmployees(emps);
      setAttendance(att);
      setAdvances(adv);
      const selectedRun = runList.find((run) => run.periodMonth.slice(0, 7) === selectedMonth);
      if (selectedRun) {
        const detail = await unwrap(useCases.payroll.getRun(selectedRun.id));
        setLatestLines(detail.lines);
      } else {
        setLatestLines([]);
      }
    } catch (e) {
      console.error(e);
      showToast("error", t("Error"), (e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedMonth]);

  const stats = useMemo<StaffStat[]>(() => {
    return employees.map((emp) => {
      const empAtt = attendance.filter(
        (a) => a.employeeId === emp.id && new Date(a.date).toISOString().slice(0, 7) === selectedMonth
      );
      const present = empAtt.filter((a) => a.status === "PRESENT").length;
      const late = empAtt.filter((a) => a.status === "LATE").length;
      const absent = empAtt.filter((a) => a.status === "ABSENT").length;
      const half = empAtt.filter((a) => a.status === "HALF_DAY").length;
      const workHours = empAtt.reduce((s, a) => s + (a.workHours || 0), 0);
      const totalDays = empAtt.length || 1;
      const attendanceRate = Math.round(((present + late * 0.5 + half * 0.5) / totalDays) * 100);

      const empAdv = advances.filter(
        (a) => a.employeeId === emp.id &&
          (a.status === "APPROVED" || a.status === "DEDUCTED") &&
          new Date(a.advanceDate).toISOString().slice(0, 7) === selectedMonth
      );
      const advancesTotal = empAdv.reduce((s, a) => s + a.amount, 0);

      const line = latestLines.find((l) => l.employeeId === emp.id);

      return {
        id: emp.id,
        name: emp.name,
        presentDays: present,
        lateDays: late,
        absentDays: absent,
        halfDays: half,
        workHours,
        attendanceRate,
        advancesTotal,
        baseSalary: emp.baseSalary || 0,
        netSalary: line ? line.netSalary : null,
      };
    });
  }, [employees, attendance, advances, latestLines, selectedMonth]);

  const overall = useMemo(() => {
    const totalHours = stats.reduce((s, x) => s + x.workHours, 0);
    const totalAdvances = stats.reduce((s, x) => s + x.advancesTotal, 0);
    const totalNet = stats.reduce((s, x) => s + (x.netSalary || 0), 0);
    const avgRate = stats.length ? Math.round(stats.reduce((s, x) => s + x.attendanceRate, 0) / stats.length) : 0;
    return { totalHours, totalAdvances, totalNet, avgRate };
  }, [stats]);

  const workHoursData = stats.map((s) => ({ name: s.name, hours: Math.round(s.workHours * 10) / 10 }));
  const netData = stats
    .filter((s) => s.netSalary !== null)
    .map((s) => ({ name: s.name, net: Math.round((s.netSalary as number) * 1000) / 1000 }));

  const attendancePie = [
    { name: t("Present"), value: stats.reduce((s, x) => s + x.presentDays, 0), color: "#10b981" },
    { name: t("Late"), value: stats.reduce((s, x) => s + x.lateDays, 0), color: "#f59e0b" },
    { name: t("Absent"), value: stats.reduce((s, x) => s + x.absentDays, 0), color: "#ef4444" },
    { name: t("Half Day"), value: stats.reduce((s, x) => s + x.halfDays, 0), color: "#3b82f6" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="w-8 h-8 text-blue-600" />
          {t("Staff Analytics")}
        </h1>
        <input
          type="month"
          aria-label={t("Month")}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        />
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">{t("Total Work Hours")}</p>
          <p className="text-3xl font-bold text-blue-600">{overall.totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">{t("Average Attendance")}</p>
          <p className="text-3xl font-bold text-green-600">{overall.avgRate}%</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm">{t("Total Advances (Month)")}</p>
          <p className="text-3xl font-bold text-orange-600">{overall.totalAdvances.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">{t("Total Net Salaries")}</p>
          <p className="text-3xl font-bold text-purple-600">{overall.totalNet.toFixed(2)}</p>
        </div>
      </div>

      {/* Per-employee cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.id} className="bg-white rounded-lg shadow-lg p-5 border-l-4 border-blue-500">
            <h3 className="font-bold text-lg text-gray-800 mb-3">{s.name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600">{t("Present Days")}</p>
                <p className="font-bold text-lg text-green-600">{s.presentDays}</p>
              </div>
              <div>
                <p className="text-gray-600">{t("Late Days")}</p>
                <p className="font-bold text-lg text-yellow-600">{s.lateDays}</p>
              </div>
              <div>
                <p className="text-gray-600">{t("Work Hours")}</p>
                <p className="font-bold text-lg text-blue-600">{s.workHours.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-gray-600">{t("Attendance Rate")}</p>
                <p className="font-bold text-lg text-purple-600">{s.attendanceRate}%</p>
              </div>
              <div>
                <p className="text-gray-600">{t("Advances")}</p>
                <p className="font-bold text-lg text-orange-600">{s.advancesTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600">{t("Net Salary (Selected Month)")}</p>
                <p className="font-bold text-lg text-gray-800">{s.netSalary !== null ? s.netSalary.toFixed(2) : "-"}</p>
              </div>
            </div>
          </div>
        ))}
        {stats.length === 0 && !loading && (
          <div className="col-span-full bg-white rounded-lg shadow p-20 text-center text-gray-400">
            {t("No employees available for analytics")}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">{t("Work Hours per Employee")}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={workHoursData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#3b82f6" name={t("Hours")} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">{t("Net Salary per Employee")}</h2>
          {netData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={netData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="net" fill="#8b5cf6" name={t("Net (OMR)")} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
              {t("No payroll run for the selected month")}
            </div>
          )}
        </div>
      </div>

      {attendancePie.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">{t("Attendance Distribution (Month)")}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={attendancePie}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} (${value})`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {attendancePie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
