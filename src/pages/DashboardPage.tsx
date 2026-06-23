import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { 
  AlertTriangle, CalendarDays, Coins, List, 
  ArrowUpRight, TrendingUp, Users, Scissors, 
  Receipt, Sparkles, ArrowRight, Plus, 
  ShoppingBag, Calendar, UserPlus, FileText,
  Activity, Zap, Clock, ChevronRight, MoreVertical,
  LayoutGrid, Wallet, BarChart3, DollarSign, TrendingDown
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../auth";
import { clsx } from "clsx";
import { 
  AreaChart, Area, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, Cell
} from "recharts";
import { LazyChart, AutoRefreshChart, ChartSkeleton } from "../shared/components/LazyChart";
import { useNavigate } from "react-router-dom";
import { DashboardSummary, PnlData } from "../application/dto";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const me = useAuth().me;
  const nav = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [last7Days, setLast7Days] = useState<{date: string; revenue: number}[]>([]);
  const [activity, setActivity] = useState<{id: string, type: string, message: string, createdAt: string, user?: {username?: string}}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-refresh every 60 seconds
  const loadRef = useCallback(async () => { await load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const s = await unwrap(useCases.dashboard.getSummary());
      setSummary(s);

      void loadActivity(s);

      if (s && s.canViewRevenue) {
        try {
          const p = await unwrap(useCases.dashboard.getPnlMonth());
          setPnl(p);
        } catch (e) {
          console.error("Failed to load P&L:", e);
        }

        try {
          const last7 = await unwrap(useCases.dashboard.getRevenueLast7Days());
          setLast7Days(last7 || []);
        } catch (e) {
          console.error("Failed to load 7-day revenue:", e);
        }
      } else {
        setPnl(null);
        setLast7Days([]);
      }
    } catch (err: any) {
      showToast('error', t("Error"), err.message || t("Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  }

  async function loadActivity(s: DashboardSummary | null) {
    type ActivityEvent = { id: string; type: string; message: string; createdAt: string; user?: { username?: string } };
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const tasks: Promise<ActivityEvent[]>[] = [
        useCases.appointments
          .list({ fromISO: windowStart.toISOString(), toISO: windowEnd.toISOString() })
          .then((res) =>
            res.ok
              ? res.data.map((a) => ({
                  id: `appt-${a.id}`,
                  type: "APPOINTMENT_CREATED",
                  message: t("New appointment scheduled"),
                  createdAt: new Date(a.createdAt).toISOString(),
                }))
              : []
          )
          .catch(() => []),
        useCases.customers
          .list()
          .then((res) =>
            res.ok
              ? res.data.map((c) => ({
                  id: `cust-${c.id}`,
                  type: "USER_CREATED",
                  message: `${t("New customer")}: ${c.name}`,
                  createdAt: new Date(c.createdAt).toISOString(),
                }))
              : []
          )
          .catch(() => []),
      ];

      if (s?.canViewRevenue) {
        tasks.push(
          useCases.expenses
            .list()
            .then((res) =>
              res.ok
                ? res.data.map((e) => ({
                    id: `exp-${e.id}`,
                    type: "EXPENSE_CREATED",
                    message: `${t("New expense recorded")}: ${e.amount} ${s.currency || ""}`.trim(),
                    createdAt: new Date(e.createdAt).toISOString(),
                  }))
                : []
            )
            .catch(() => [])
        );
      }

      const results = await Promise.all(tasks);
      const merged = results
        .flat()
        .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
        .slice(0, 6);

      setActivity(merged);
    } catch {
      setActivity([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const chartData = useMemo(() => last7Days.length > 0 ? last7Days : [
    { date: "Mon", revenue: 0 }, { date: "Tue", revenue: 0 }, { date: "Wed", revenue: 0 }, 
    { date: "Thu", revenue: 0 }, { date: "Fri", revenue: 0 }, { date: "Sat", revenue: 0 }, { date: "Sun", revenue: 0 }
  ], [last7Days]);

  const totalRevenue7Days = useMemo(() => chartData.reduce((sum, d) => sum + (d.revenue || 0), 0), [chartData]);
  const avgRevenue7Days = useMemo(() => totalRevenue7Days / chartData.length, [totalRevenue7Days, chartData]);

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 sm:space-y-8 pb-12"
    >

      {/* Welcome Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div className="space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary shadow-sm w-fit">
            <Sparkles className="h-3 w-3" />
            {t("Intelligence Dashboard")}
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-foreground leading-tight">
            {t("Welcome back")}, <span className="text-primary">{me?.username || 'admin'}</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl font-medium">
            {t("Your center is performing optimally today. Here's a quick look at the latest metrics and activities.")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={load} 
            className="group relative h-12 w-12 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-lg hover:scale-110 active:scale-95"
          >
            <Zap className={clsx("h-5 w-5", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => nav("/pos")}
            className="group relative inline-flex items-center justify-center rounded-xl bg-primary px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("New Invoice")}
            </span>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          </button>
        </div>
      </motion.div>

      {/* Key Metrics Grid */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          variants={item}
          title={t("Today's Revenue")} 
          value={loading ? "…" : summary?.canViewRevenue ? `${summary?.todayRevenue || 0}` : "—"}
          subValue={summary?.canViewRevenue ? t("Total Invoices Today") : t("No data")}
          icon={<DollarSign className="h-5 w-5" />}
          trend={summary?.canViewRevenue ? "+0%" : "—"}
          color="emerald"
        />
        <StatCard 
          variants={item}
          title={t("Appointments")} 
          value={loading ? "…" : summary?.appointments ?? 0}
          subValue={t("Scheduled")}
          icon={<CalendarDays className="h-5 w-5" />}
          trend={`+${summary?.todayAppointments || 0}`}
          color="blue"
        />
        <StatCard 
          variants={item}
          title={t("Customers")} 
          value={loading ? "…" : summary?.customers ?? 0}
          subValue={`+${summary?.newCustomersThisMonth || 0} ${t("This Month")}`}
          icon={<Users className="h-5 w-5" />}
          trend={`+${summary?.newCustomersThisMonth || 0}`}
          color="purple"
        />
        <StatCard 
          variants={item}
          title={t("Low Stock")} 
          value={loading ? "…" : summary?.lowStockCount ?? 0}
          subValue={t("Items need attention")}
          icon={<AlertTriangle className="h-5 w-5" />}
          trend={(summary?.lowStockCount && summary.lowStockCount > 0) ? "⚠️ Action" : "✓ Clear"}
          color={summary?.lowStockCount && summary.lowStockCount > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
        
        {/* 7-Day Revenue Chart */}
        <motion.div variants={item} className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
          <div className="border-b border-border px-4 sm:px-6 py-4 sm:py-6 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  {t("7-Day Revenue")}
                </h2>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("Daily revenue trend")}</p>
              </div>
              <div className="text-end">
                <p className="text-sm font-bold text-foreground">{totalRevenue7Days.toFixed(2)} {summary?.currency}</p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase">{t("Total")}</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 flex-1 min-h-[300px] flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 opacity-40">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-widest">{t("Loading Chart...")}</p>
              </div>
            ) : chartData.length === 0 || totalRevenue7Days === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 opacity-30 text-center">
                <BarChart3 className="h-12 w-12" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest">{t("No Revenue Data")}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">{t("Start selling to see trends")}</p>
                </div>
              </div>
            ) : (
              <LazyChart height={isMobile ? 180 : 260}>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 260}>
                <AreaChart data={chartData} margin={{ top: 10, right: isMobile ? 10 : 30, left: isMobile ? -20 : 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--muted-foreground)" 
                    style={{ fontSize: '12px', fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)"
                    style={{ fontSize: '12px', fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                    labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                    formatter={(value) => [`${value} ${summary?.currency}`, t("Revenue")]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
              </LazyChart>
            )}
          </div>
        </motion.div>

        {/* Financial Summary Card */}
        <motion.div variants={item} className="rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
          <div className="border-b border-border px-4 sm:px-6 py-4 sm:py-6 bg-muted/20">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" />
                {t("Financial Summary")}
              </h2>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("This Month")}</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-widest">{t("Processing...")}</p>
              </div>
            ) : !pnl ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                <Coins className="h-12 w-12" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest">{t("No Financial Data")}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">{t("Complete transactions to see data")}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Net Profit - Highlighted */}
                <div className="relative rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-80">{t("Net Profit")}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <h3 className="text-3xl sm:text-4xl font-bold tracking-tighter">{pnl.profit}</h3>
                      <span className="text-xs font-bold opacity-70 uppercase">{summary?.currency}</span>
                    </div>
                  </div>
                  <TrendingUp className="absolute bottom-[-20px] end-[-20px] h-32 w-32 text-white/10 group-hover:scale-110 transition-transform duration-700" />
                </div>

                {/* Financial Rows */}
                <div className="space-y-2 flex-1">
                  <FinancialRow 
                    label={t("Gross Revenue")} 
                    value={pnl.revenue} 
                    currency={summary?.currency} 
                    icon={<TrendingUp className="h-4 w-4" />}
                    color="emerald"
                  />
                  <FinancialRow 
                    label={t("Staff Salaries")} 
                    value={pnl.baseSalaries} 
                    currency={summary?.currency} 
                    icon={<Users className="h-4 w-4" />}
                    color="orange"
                  />
                  <FinancialRow 
                    label={t("Commissions")} 
                    value={pnl.commissions} 
                    currency={summary?.currency} 
                    icon={<Scissors className="h-4 w-4" />}
                    color="blue"
                  />
                  <FinancialRow 
                    label={t("Other Expenses")} 
                    value={pnl.expenses} 
                    currency={summary?.currency} 
                    icon={<AlertTriangle className="h-4 w-4" />}
                    color="rose"
                  />
                </div>

                <button 
                  onClick={() => nav("/reports")}
                  className="group w-full rounded-lg bg-secondary py-3 text-xs font-bold text-secondary-foreground transition-all hover:bg-secondary/80 flex items-center justify-center gap-2 shadow-lg mt-auto"
                >
                  {t("View Detailed Reports")}
                  <ArrowRight className={clsx("h-4 w-4 transition-transform", i18n.language === "ar" ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Activity & Quick Actions */}
      <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
        
        {/* Activity Feed */}
        <motion.div variants={item} className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-4 sm:py-6 bg-muted/20">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {t("Live Activity")}
              </h2>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("Recent updates")}</p>
            </div>
            <button 
              onClick={load}
              className="group flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary hover:opacity-80 transition-opacity"
            >
              {t("Refresh")}
              <Zap className={clsx("h-3 w-3 transition-transform", loading && "animate-spin")} />
            </button>
          </div>
          <div className="p-4 sm:p-6 space-y-2 max-h-[400px] overflow-auto scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {activity.length === 0 && !loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground text-center py-12 flex flex-col items-center gap-4 opacity-30"
                >
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <List className="h-6 w-6" />
                  </div>
                  <p className="font-bold uppercase tracking-[0.3em]">{t("No Activity Yet")}</p>
                </motion.div>
              )}
              {activity.map((x, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                  key={x.id} 
                  className="group flex items-center gap-3 rounded-lg p-3 transition-all hover:bg-muted/50 hover:shadow-inner border border-transparent hover:border-border"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all text-sm font-bold">
                    <ActivityIcon type={x.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-foreground leading-tight group-hover:text-primary transition-colors">{x.message}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 opacity-60">
                      {new Date(x.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item} className="rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t("Quick Actions")}
          </h2>
          <div className="space-y-2">
            <QuickActionButton 
              title={t("Book Appointment")} 
              icon={<Calendar className="h-4 w-4" />} 
              color="blue" 
              onClick={() => nav("/appointments")}
            />
            <QuickActionButton 
              title={t("Add Customer")} 
              icon={<UserPlus className="h-4 w-4" />} 
              color="emerald" 
              onClick={() => nav("/customers")}
            />
            <QuickActionButton 
              title={t("Manage Services")} 
              icon={<Scissors className="h-4 w-4" />} 
              color="purple" 
              onClick={() => nav("/services")}
            />
            <QuickActionButton 
              title={t("View Reports")} 
              icon={<BarChart3 className="h-4 w-4" />} 
              color="amber" 
              onClick={() => nav("/reports")}
            />
            <QuickActionButton 
              title={t("Settings")} 
              icon={<MoreVertical className="h-4 w-4" />} 
              color="slate" 
              onClick={() => nav("/settings")}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, subValue, icon, trend, color, variants }: {
  title: string
  value: string | number
  subValue: string
  icon: React.ReactNode
  trend: string
  color: string
  variants: import("motion/react").Variants
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
    purple: "bg-purple-500/10 text-purple-600",
    rose: "bg-rose-500/10 text-rose-600",
  };

  return (
    <motion.div 
      variants={variants}
      className="group relative rounded-xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className={clsx("rounded-lg p-2.5 sm:p-3 transition-all group-hover:scale-110 shadow-sm", colorMap[color])}>
          {icon}
        </div>
        <div className={clsx("flex items-center gap-1 rounded-lg px-2 sm:px-3 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm", colorMap[color])}>
          <ArrowUpRight className="h-3 w-3" />
          {trend}
        </div>
      </div>
      <div className="mt-4 sm:mt-6 relative z-10">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{title}</p>
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2 tracking-tighter truncate">{value}</h3>
        <p className="text-[9px] text-muted-foreground mt-1 sm:mt-2 font-bold uppercase tracking-[0.2em] opacity-60 truncate">{subValue}</p>
      </div>
    </motion.div>
  );
}

function QuickActionButton({ title, icon, color, onClick }: {
  title: string
  icon: React.ReactNode
  color: string
  onClick: () => void
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white",
    emerald: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white",
    purple: "bg-purple-500/10 text-purple-600 hover:bg-purple-500 hover:text-white",
    amber: "bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white",
    slate: "bg-slate-500/10 text-slate-600 hover:bg-slate-500 hover:text-white",
  };

  return (
    <button 
      onClick={onClick}
      className={clsx(
        "group w-full flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:shadow-lg hover:-translate-y-0.5",
        colorClasses[color]
      )}
    >
      <div className="flex-shrink-0">
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-start flex-1">{title}</span>
      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function FinancialRow({ label, value, currency, icon, color }: {
  label: string
  value: number | string
  currency?: string
  icon: React.ReactNode
  color: string
}) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    blue: "bg-blue-500/10 text-blue-600",
    rose: "bg-rose-500/10 text-rose-600"
  };

  return (
    <div className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-all border border-transparent hover:border-border">
      <div className="flex items-center gap-2.5">
        <div className={clsx("h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm", colorClasses[color])}>
          {icon}
        </div>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-end">
        <span className="text-sm font-bold text-foreground">{value}</span>
        <span className="ms-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{currency}</span>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "INVOICE_CREATED": return <Receipt className="h-5 w-5" />;
    case "APPOINTMENT_CREATED": return <CalendarDays className="h-5 w-5" />;
    case "USER_CREATED": return <Users className="h-5 w-5" />;
    case "EXPENSE_CREATED": return <Coins className="h-5 w-5" />;
    default: return <List className="h-5 w-5" />;
  }
}
