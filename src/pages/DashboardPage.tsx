import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  AlertTriangle, CalendarDays, Coins, List, 
  ArrowUpRight, TrendingUp, Users, Scissors, 
  Receipt, Sparkles, ArrowRight, Plus, 
  ShoppingBag, Calendar, UserPlus, FileText,
  Activity, Zap, Clock, ChevronRight, MoreVertical,
  LayoutGrid, Wallet, BarChart3
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../auth";
import { clsx } from "clsx";
import { 
  AreaChart, Area, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, Tooltip 
} from "recharts";
import { useNavigate } from "react-router-dom";
import { DashboardSummary, PnlData } from "../application/dto";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const me = useAuth().me;
  const nav = useNavigate();
  // Using explicit types based on expected structure
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [activity, setActivity] = useState<{id: string, type: string, message: string, createdAt: string, user?: {username?: string}}[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const s = await unwrap(useCases.dashboard.getSummary());
      setSummary(s);

      void loadActivity(s);

      if (s && s.canViewRevenue) {
        const p = await unwrap(useCases.dashboard.getPnlMonth());
        setPnl(p);
      } else {
        setPnl(null);
      }
    } catch (err: any) {
      // In a real app we might show a toast here. In dashboard we just leave things null.
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         // show a gentle toast, but it's acceptable for dashboard to just render empty state when unsupported
         // But per requirements, DO NOT simulate success. We should show standard error.
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      }
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
        .slice(0, 8);

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

  const trendData = useMemo(() => [
    { date: "M", value: 400 }, { date: "T", value: 300 }, { date: "W", value: 500 }, { date: "T", value: 450 }, { date: "F", value: 600 }, { date: "S", value: 550 }, { date: "S", value: 700 }
  ], []);

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 sm:space-y-12 pb-12"
    >
      {/* Backend Required Warning Banner */}
      {!summary?.canViewRevenue && (
        <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-[1.5rem] py-3 px-6 shrink-0 flex items-center justify-start gap-4 backdrop-blur-sm">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <div>
            <span className="text-sm font-bold block">{t("Backend Required")}</span>
            <span className="text-[10px] font-medium uppercase tracking-widest opacity-80">{t("BACKEND_METHOD_UNSUPPORTED")}</span>
          </div>
        </div>
      )}

      {/* Welcome Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
        <div className="space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {t("Intelligence Dashboard")}
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-foreground leading-tight">
            {t("Welcome back")}, <span className="text-primary">{me?.username || 'admin'}</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-xl max-w-2xl font-medium">
            {t("Your center is performing optimally today. Here's a quick look at the latest metrics and activities.")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={load} 
            className="group relative h-16 w-16 rounded-[2rem] border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-xl hover:scale-110 active:scale-95"
          >
            <Zap className={clsx("h-6 w-6", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => nav("/pos")}
            className="group relative inline-flex items-center justify-center rounded-[2rem] bg-primary px-10 py-5 text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-3">
              <Plus className="h-5 w-5" />
              {t("New Invoice")}
            </span>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          variants={item}
          title={t("Today's Revenue")} 
          value={loading ? "…" : summary?.canViewRevenue ? summary?.todayRevenue : "—"}
          subValue={summary?.canViewRevenue ? t("Total Invoices Today") : t("Backend Required")}
          icon={<Coins className="h-6 w-6" />}
          trend="+0%"
          color="emerald"
          chartData={summary?.canViewRevenue ? trendData : []}
        />
        <StatCard 
          variants={item}
          title={t("Appointments")} 
          value={loading ? "…" : summary?.appointments ?? 0}
          subValue={t("Total Appointments")}
          icon={<CalendarDays className="h-6 w-6" />}
          trend="+0"
          color="blue"
          chartData={trendData}
        />
        <StatCard 
          variants={item}
          title={t("Customers")} 
          value={loading ? "…" : summary?.customers ?? 0}
          subValue={t("Total customers")}
          icon={<Users className="h-6 w-6" />}
          trend="+0"
          color="purple"
          chartData={trendData}
        />
        <StatCard 
          variants={item}
          title={t("Low Stock")} 
          value={loading ? "…" : summary?.lowStockCount ?? 0}
          subValue={t("Items need attention")}
          icon={<AlertTriangle className="h-6 w-6" />}
          trend={(summary?.lowStockCount && summary.lowStockCount > 0) ? "Action" : "Clear"}
          color="rose"
          chartData={trendData}
        />
      </div>

      {/* Quick Actions Bento */}
      <motion.div variants={item} className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard 
          title={t("Book Appointment")} 
          icon={<Calendar className="h-6 w-6" />} 
          color="blue" 
          onClick={() => nav("/appointments")}
        />
        <QuickActionCard 
          title={t("Add Customer")} 
          icon={<UserPlus className="h-6 w-6" />} 
          color="emerald" 
          onClick={() => nav("/customers")}
        />
        <QuickActionCard 
          title={t("Manage Services")} 
          icon={<Scissors className="h-6 w-6" />} 
          color="purple" 
          onClick={() => nav("/services")}
        />
        <QuickActionCard 
          title={t("View Reports")} 
          icon={<BarChart3 className="h-6 w-6" />} 
          color="amber" 
          onClick={() => nav("/reports")}
        />
      </motion.div>

      <div className="grid gap-4 sm:gap-6 lg:gap-10 lg:grid-cols-5">
        {/* Recent Activity */}
        <motion.div variants={item} className="lg:col-span-3 rounded-[2rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-5 lg:px-10 lg:py-8 bg-muted/30">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Activity className="h-6 w-6 text-primary" />
                {t("Live Activity Feed")}
              </h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("Real-time operational updates")}</p>
            </div>
            <button className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary hover:opacity-80 transition-opacity">
              {t("View Full Log")}
              <ArrowRight className={clsx("h-3 w-3 transition-transform", i18n.language === "ar" ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
            </button>
          </div>
          <div className="p-6 space-y-3 max-h-[600px] overflow-auto scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {activity.length === 0 && !loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground text-center py-48 flex flex-col items-center gap-6"
                >
                  <div className="h-20 w-20 rounded-[2rem] bg-muted flex items-center justify-center">
                    <List className="h-10 w-10 opacity-20" />
                  </div>
                  <p className="font-bold uppercase tracking-[0.3em] opacity-40">{t("No Activity Recorded")}</p>
                </motion.div>
              )}
              {activity.map((x, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                  key={x.id} 
                  className="group flex items-center gap-6 rounded-[2rem] p-6 transition-all hover:bg-muted/50 hover:shadow-inner border border-transparent hover:border-border"
                >
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all group-hover:scale-110 shadow-inner">
                    <ActivityIcon type={x.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-base font-bold truncate text-foreground leading-tight group-hover:text-primary transition-colors">{x.message}</p>
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-xl uppercase shrink-0 tracking-widest">
                        {new Date(x.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-5 w-5 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shadow-sm">
                        {x.user?.username?.[0] || 'S'}
                      </div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        {x.user?.username ? `${t("By")}: ${x.user.username}` : t("System")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Financial Health Summary */}
        <motion.div variants={item} className="lg:col-span-2 rounded-[2rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
          <div className="border-b border-border px-6 py-5 sm:px-10 sm:py-8 bg-muted/30">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Wallet className="h-6 w-6 text-emerald-500" />
                {t("Financial Health")}
                <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">{t("Backend Required")}</span>
              </h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("Monthly Performance Overview")}</p>
            </div>
          </div>
          <div className="p-6 sm:p-10 flex-1 flex flex-col">
            {!summary?.canViewRevenue ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="h-24 w-24 rounded-[2.5rem] bg-muted flex items-center justify-center">
                  <Coins className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">{t("Backend Required")}</p>
                  <p className="text-xs text-muted-foreground px-12 leading-relaxed">{t("Financial data requires the process_checkout_v1 RPC and invoice schema to be implemented.")}</p>
                </div>
              </div>
            ) : !pnl ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{t("Processing Analytics...")}</p>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-10 h-full flex flex-col">
                <div className="relative rounded-[1.5rem] sm:rounded-[2.5rem] bg-emerald-500 p-6 sm:p-10 text-white shadow-2xl shadow-emerald-500/20 overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">{t("Net Profit")}</p>
                    <div className="flex items-baseline gap-2 sm:gap-3 mt-3 sm:mt-4">
                      <h3 className="text-4xl sm:text-6xl font-bold tracking-tighter">{pnl.profit}</h3>
                      <span className="text-xs sm:text-sm font-bold opacity-70 uppercase tracking-widest">{summary?.currency}</span>
                    </div>
                  </div>
                  <TrendingUp className="absolute bottom-[-30px] end-[-30px] h-48 w-48 text-white/10 rotate-[-15deg] group-hover:scale-110 transition-transform duration-700" />
                </div>
                
                <div className="space-y-6 flex-1">
                  <FinancialRow label={t("Gross Revenue")} value={pnl.revenue} currency={summary?.currency} icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} color="emerald" />
                  <FinancialRow label={t("Staff Salaries")} value={pnl.baseSalaries} currency={summary?.currency} icon={<Users className="h-5 w-5 text-orange-500" />} color="orange" />
                  <FinancialRow label={t("Commissions")} value={pnl.commissions} currency={summary?.currency} icon={<Scissors className="h-5 w-5 text-blue-500" />} color="blue" />
                  <FinancialRow label={t("Other Expenses")} value={pnl.expenses} currency={summary?.currency} icon={<AlertTriangle className="h-5 w-5 text-rose-500" />} color="rose" />
                </div>

                <div className="pt-8">
                  <button 
                    onClick={() => nav("/reports")}
                    className="group w-full rounded-[1.5rem] bg-secondary py-5 text-sm font-bold text-secondary-foreground transition-all hover:bg-secondary/80 flex items-center justify-center gap-3 shadow-lg"
                  >
                    {t("View Detailed Reports")}
                    <ArrowRight className={clsx("h-5 w-5 transition-transform", i18n.language === "ar" ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, subValue, icon, trend, color, variants, chartData }: {title: string, value: string | number, subValue: string, icon: React.ReactNode, trend: string, color: string, variants: import("motion/react").Variants, chartData: {date: string; value: number}[]}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary text-primary-foreground",
    emerald: "bg-emerald-500 text-white",
    blue: "bg-blue-500 text-white",
    purple: "bg-purple-500 text-white",
    rose: "bg-rose-500 text-white",
    accent: "bg-accent text-accent-foreground"
  };

  const lightColorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
    purple: "bg-purple-500/10 text-purple-600",
    rose: "bg-rose-500/10 text-rose-600",
    accent: "bg-accent/10 text-accent"
  };

  return (
    <motion.div 
      variants={variants}
      className="group relative rounded-[2rem] sm:rounded-[3rem] border border-border bg-card p-5 sm:p-10 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-2 overflow-hidden"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className={clsx("rounded-2xl p-4 sm:p-5 transition-all group-hover:scale-110 shadow-inner", lightColorMap[color])}>
          {icon}
        </div>
        <div className={clsx("flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] font-bold uppercase tracking-widest shadow-sm", lightColorMap[color])}>
          <ArrowUpRight className="h-3.5 w-3.5" />
          {trend}
        </div>
      </div>
      <div className="mt-6 sm:mt-10 relative z-10">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{title}</p>
        <h3 className="text-3xl sm:text-5xl font-bold text-foreground mt-2 sm:mt-3 tracking-tighter truncate">{value}</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase tracking-[0.2em] opacity-60 truncate">{subValue}</p>
      </div>
      
      {/* Mini Chart Background */}
      <div className="absolute bottom-0 inset-x-0 h-24 opacity-10 group-hover:opacity-20 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color === "emerald" ? "#10b981" : color === "blue" ? "#3b82f6" : color === "purple" ? "#a855f7" : "#f43f5e"} 
              fill={color === "emerald" ? "#10b981" : color === "blue" ? "#3b82f6" : color === "purple" ? "#a855f7" : "#f43f5e"} 
              strokeWidth={4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className={clsx("absolute bottom-0 inset-x-10 h-1.5 rounded-t-full opacity-0 group-hover:opacity-100 transition-opacity", colorMap[color])} />
    </motion.div>
  );
}

function QuickActionCard({ title, icon, color, onClick }: {title: string, icon: React.ReactNode, color: string, onClick: () => void}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white",
    emerald: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white",
    purple: "bg-purple-500/10 text-purple-600 group-hover:bg-purple-500 group-hover:text-white",
    amber: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
  };

  return (
    <button 
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-6 rounded-[2.5rem] border border-border bg-card p-8 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
    >
      <div className={clsx("h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner", colorClasses[color])}>
        {icon}
      </div>
      <span className="text-xs font-bold text-foreground uppercase tracking-[0.2em] group-hover:text-primary transition-colors">{title}</span>
    </button>
  );
}

function FinancialRow({ label, value, currency, icon, color }: {label: string, value: number | string, currency?: string, icon: React.ReactNode, color: string}) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    blue: "bg-blue-500/10 text-blue-600",
    rose: "bg-rose-500/10 text-rose-600"
  };

  return (
    <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-muted/50 transition-all border border-transparent hover:border-border">
      <div className="flex items-center gap-5">
        <div className={clsx("h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner", colorClasses[color])}>
          {icon}
        </div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-end">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="ms-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{currency}</span>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "INVOICE_CREATED": return <Receipt className="h-6 w-6" />;
    case "APPOINTMENT_CREATED": return <CalendarDays className="h-6 w-6" />;
    case "USER_CREATED": return <Users className="h-6 w-6" />;
    case "EXPENSE_CREATED": return <Coins className="h-6 w-6" />;
    default: return <List className="h-6 w-6" />;
  }
}

