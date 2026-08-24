import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity } from "lucide-react";
import { AttendanceRecord, EmployeeAdvance, Employee, PayrollLineItem } from "../domain/entities";
import { formatOMRAmount } from "../shared/money";

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

const chartText = "hsl(var(--muted-foreground))";
const chartGrid = "hsl(var(--border))";

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
    } catch (error) {
      console.error(error);
      showToast("error", t("Error"), (error as Error).message || String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedMonth]);

  const stats = useMemo<StaffStat[]>(() => employees.map((employee) => {
    const employeeAttendance = attendance.filter(
      (record) => record.employeeId === employee.id && new Date(record.date).toISOString().slice(0, 7) === selectedMonth,
    );
    const presentDays = employeeAttendance.filter((record) => record.status === "PRESENT").length;
    const lateDays = employeeAttendance.filter((record) => record.status === "LATE").length;
    const absentDays = employeeAttendance.filter((record) => record.status === "ABSENT").length;
    const halfDays = employeeAttendance.filter((record) => record.status === "HALF_DAY").length;
    const workHours = employeeAttendance.reduce((sum, record) => sum + (record.workHours || 0), 0);
    const totalDays = employeeAttendance.length || 1;
    const attendanceRate = Math.round(((presentDays + lateDays * 0.5 + halfDays * 0.5) / totalDays) * 100);

    const employeeAdvances = advances.filter(
      (advance) => advance.employeeId === employee.id
        && (advance.status === "APPROVED" || advance.status === "DEDUCTED")
        && new Date(advance.advanceDate).toISOString().slice(0, 7) === selectedMonth,
    );
    const advancesTotal = employeeAdvances.reduce((sum, advance) => sum + advance.amount, 0);
    const line = latestLines.find((item) => item.employeeId === employee.id);

    return {
      id: employee.id,
      name: employee.name,
      presentDays,
      lateDays,
      absentDays,
      halfDays,
      workHours,
      attendanceRate,
      advancesTotal,
      baseSalary: employee.baseSalary || 0,
      netSalary: line ? line.netSalary : null,
    };
  }), [employees, attendance, advances, latestLines, selectedMonth]);

  const overall = useMemo(() => {
    const totalHours = stats.reduce((sum, stat) => sum + stat.workHours, 0);
    const totalAdvances = stats.reduce((sum, stat) => sum + stat.advancesTotal, 0);
    const totalNet = stats.reduce((sum, stat) => sum + (stat.netSalary || 0), 0);
    const avgRate = stats.length
      ? Math.round(stats.reduce((sum, stat) => sum + stat.attendanceRate, 0) / stats.length)
      : 0;
    return { totalHours, totalAdvances, totalNet, avgRate };
  }, [stats]);

  const workHoursData = stats.map((stat) => ({ name: stat.name, hours: Math.round(stat.workHours * 10) / 10 }));
  const netData = stats
    .filter((stat) => stat.netSalary !== null)
    .map((stat) => ({ name: stat.name, net: Math.round((stat.netSalary as number) * 1000) / 1000 }));

  const attendancePie = [
    { name: t("Present"), value: stats.reduce((sum, stat) => sum + stat.presentDays, 0), color: "hsl(var(--success))" },
    { name: t("Late"), value: stats.reduce((sum, stat) => sum + stat.lateDays, 0), color: "hsl(var(--warning))" },
    { name: t("Absent"), value: stats.reduce((sum, stat) => sum + stat.absentDays, 0), color: "hsl(var(--destructive))" },
    { name: t("Half Day"), value: stats.reduce((sum, stat) => sum + stat.halfDays, 0), color: "hsl(var(--primary))" },
  ].filter((item) => item.value > 0);

  const summaryCards = [
    { label: t("Total Work Hours"), value: overall.totalHours.toFixed(1), tone: "text-primary" },
    { label: t("Average Attendance"), value: `${overall.avgRate}%`, tone: "text-success" },
    { label: t("Total Advances (Month)"), value: `${formatOMRAmount(overall.totalAdvances)} OMR`, tone: "text-warning" },
    { label: t("Total Net Salaries"), value: `${formatOMRAmount(overall.totalNet)} OMR`, tone: "text-secondary" },
  ];

  const axisProps = { tick: { fill: chartText, fontSize: 12 }, axisLine: { stroke: chartGrid }, tickLine: { stroke: chartGrid } };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <Activity className="h-7 w-7 text-primary" />
          {t("Staff Analytics")}
        </h1>
        <input
          type="month"
          aria-label={t("Month")}
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="min-h-11 rounded-xl border border-input bg-background px-4 py-2 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold sm:text-3xl ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <article key={stat.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-foreground">{stat.name}</h3>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{stat.attendanceRate}%</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label={t("Present Days")} value={String(stat.presentDays)} valueClass="text-success" />
              <Metric label={t("Late Days")} value={String(stat.lateDays)} valueClass="text-warning" />
              <Metric label={t("Work Hours")} value={stat.workHours.toFixed(1)} valueClass="text-primary" />
              <Metric label={t("Attendance Rate")} value={`${stat.attendanceRate}%`} valueClass="text-secondary" />
              <Metric label={t("Advances")} value={`${formatOMRAmount(stat.advancesTotal)} OMR`} valueClass="text-warning" />
              <Metric
                label={t("Net Salary (Selected Month)")}
                value={stat.netSalary !== null ? `${formatOMRAmount(stat.netSalary)} OMR` : "—"}
                valueClass="text-foreground"
              />
            </div>
          </article>
        ))}
        {stats.length === 0 && !loading ? (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
            {t("No employees available for analytics")}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title={t("Work Hours per Employee")}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={workHoursData}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: `1px solid ${chartGrid}`, borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
              <Legend wrapperStyle={{ color: chartText }} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name={t("Hours")} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("Net Salary per Employee")}>
          {netData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={netData}>
                <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: `1px solid ${chartGrid}`, borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
                <Legend wrapperStyle={{ color: chartText }} />
                <Bar dataKey="net" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} name={t("Net (OMR)")} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              {t("No payroll run for the selected month")}
            </div>
          )}
        </ChartCard>
      </div>

      {attendancePie.length > 0 ? (
        <ChartCard title={t("Attendance Distribution (Month)")}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={attendancePie}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} (${value})`}
                outerRadius={96}
                dataKey="value"
              >
                {attendancePie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: `1px solid ${chartGrid}`, borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="rounded-xl bg-muted/55 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
