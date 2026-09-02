import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  AlertTriangle, CalendarDays, Coins, List, 
  ArrowUpRight, TrendingUp, Users, Scissors, 
  Sparkles, ArrowRight, Plus, 
  ShoppingBag, Calendar, UserPlus, FileText,
  Activity, Zap, Clock, ChevronRight, MoreVertical,
  LayoutGrid, Wallet, BarChart3, DollarSign, TrendingDown, CheckCircle2
} from "lucide-react";
import { useToast } from "../shared/components/Toast";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../auth";
import { clsx } from "clsx";
import { 
  AreaChart, Area, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, Cell
} from "recharts";
import { LazyChart } from "../shared/components/LazyChart";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "./dashboard/useDashboardData";
import { StatCard, QuickActionButton, FinancialRow, ActivityIcon } from "./dashboard/widgets";
import { ScreenState } from "../shared/components/ScreenState";
import { Spinner } from "../shared/components/Spinner";
import { GettingStartedCard } from "../shared/components/GettingStartedCard";
import { NavigationNotice } from "../shared/components/NavigationNotice";
import { getDisplayName } from "../shared/displayName";
import { formatOMRAmount } from "../shared/money";
import { UserRole } from "../domain/entities/Session";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const me = useAuth().me;
  const nav = useNavigate();
  const {
    summary,
    pnl,
    last7Days,
    activity,
    loading,
    todayAppts,
    lowStockItems,
    trackedProductCount,
    load,
  } = useDashboardData();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  // Real data only — never fall back to fabricated day labels. When the query
  // returns nothing (no sales), the chart area renders a clear empty state.
  const chartData = useMemo(() => (Array.isArray(last7Days) ? last7Days : []), [last7Days]);

  const totalRevenue7Days = useMemo(() => chartData.reduce((sum, d) => sum + (d.revenue || 0), 0), [chartData]);

  // "Welcome back" is only truthful once the center actually has history.
  const hasCenterData = Boolean(
    (summary?.customers ?? 0) > 0 ||
    (summary?.appointments ?? 0) > 0 ||
    (summary?.sales ?? 0) > 0,
  );
  const isFirstRun = !hasCenterData;
  const isAdmin = me?.role === UserRole.ADMIN;

  // P0.3: derive operational exceptions only from data already loaded.
  // We never infer payment or fabricate a failed-write state on the dashboard.
  const needsAttention = useMemo(() => {
    const now = Date.now();
    const lateAppointments = todayAppts
      .filter((a) => a.status === "SCHEDULED" && new Date(a.dateTime).getTime() < now)
      .map((a) => ({
        id: `late-${a.id}`,
        title: t("Appointment needs attention"),
        detail: `${a.time} · ${a.customerName}`,
        action: t("Open schedule"),
        route: "/appointments",
        tone: "warning" as const,
      }));
    const stockWarnings = lowStockItems.map((p) => ({
      id: `stock-${p.id}`,
      title: `${t("Low Stock")}: ${p.name}`,
      detail: `${p.stock} ${t("remaining")}`,
      action: t("Open inventory"),
      route: "/inventory",
      tone: "danger" as const,
    }));
    return [...lateAppointments, ...stockWarnings].slice(0, 6);
  }, [todayAppts, lowStockItems, t]);

  function formatChartDay(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US", { day: "numeric", month: "short" });
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 sm:space-y-8 pb-12 min-w-0 overflow-x-clip"
    >

      {/* Welcome Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div className="space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary shadow-sm w-fit">
            <Sparkles className="h-3 w-3" />
            {t("Today at your center")}
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-foreground leading-tight">
            {/* A first visit to an empty center must not be greeted as a
                return. "Welcome back" only once the center has real data. */}
            {t(hasCenterData ? "Welcome back" : "Welcome")}
            {me?.username ? <>, <span className="text-primary">{getDisplayName(me, me.username)}</span></> : null}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl font-medium">
            {t(isFirstRun
              ? "Start with your service menu. Then you can book and sell."
              : "Here is the latest recorded information for your center.")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={load}
            aria-label={t("Refresh")}
            className="group relative h-12 w-12 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-lg hover:scale-110 active:scale-95"
          >
            <Zap className={clsx("h-5 w-5", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => nav(isFirstRun ? "/services" : "/appointments")}
            className="group relative inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t(isFirstRun ? "Add your services" : "Open today's schedule")}
            </span>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          </button>
        </div>
      </motion.div>

      {/* Explains a redirect that already happened (admin-only route or an
          unknown path) instead of leaving it silent. */}
      <NavigationNotice />

      {/* One ordered path for a brand-new center. Self-retiring: it renders
          nothing once the center has services, a team and customers. */}
      <motion.div variants={item}>
        <GettingStartedCard viewerRole={me?.role} />
      </motion.div>

      {/* Key Metrics Grid - 2x2 on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-4">
        {/* Tiles show measured values only. The former trend badge was a
            hardcoded literal, never a computed comparison, so it is gone
            rather than faked. A role that may not read revenue is told it is
            restricted — never that the center earned nothing. */}
        <StatCard 
          variants={item}
          title={t("Today's Revenue")} 
          value={loading ? "…" : summary?.canViewRevenue ? formatOMRAmount(summary?.todayRevenue) : "—"}
          subValue={summary?.canViewRevenue ? t("Invoices") : t("Restricted")}
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
          color="emerald"
          compact
        />
        <StatCard 
          variants={item}
          title={t("Appointments")} 
          value={loading ? "…" : summary?.appointments ?? 0}
          subValue={t("Today")}
          icon={<CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />}
          color="blue"
          compact
        />
        <StatCard 
          variants={item}
          title={t("Customers")} 
          value={loading ? "…" : summary?.customers ?? 0}
          subValue={`+${summary?.newCustomersThisMonth || 0} ${t("New")}`}
          icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
          color="purple"
          compact
        />
        <StatCard 
          variants={item}
          title={t("Low Stock")} 
          value={loading ? "…" : summary?.lowStockCount ?? 0}
          subValue={t("Items")}
          icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />}
          color={summary?.lowStockCount && summary.lowStockCount > 0 ? "rose" : "emerald"}
          compact
        />
      </div>

      {/* On a first visit the setup card is the only daily action. Extra
          empty "today" panels compete with it and claim healthy stock when
          there is no catalog yet. */}
      {!isFirstRun && (
      <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-4 bg-muted/20">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t("Today's Appointments")}
            </h2>
            <button
              onClick={() => nav("/appointments")}
              className="min-h-11 inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-opacity"
            >
              {t("View All")}
            </button>
          </div>
          <div className="p-4 sm:p-6">
            {todayAppts.length === 0 ? (
              <ScreenState
                state="empty"
                compact
                icon={<CalendarDays className="h-6 w-6" />}
                title={t("No upcoming appointments today")}
                description={t("Book an appointment to get started")}
                actionLabel="New Appointment"
                onAction={() => nav("/appointments")}
              />
            ) : (
              <div className="space-y-2">
                {todayAppts.slice(0, 8).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => nav("/appointments")}
                    className="w-full min-h-11 flex items-center gap-3 rounded-xl border border-border p-3 text-start hover:bg-muted/40 hover:border-primary/30 transition-all touch-target"
                  >
                    <div className="h-10 w-14 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {a.time}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{a.customerName}</p>
                      {a.serviceName && (
                        <p className="text-[10px] font-bold text-muted-foreground truncate">{a.serviceName}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={clsx(
                          "rounded-full border px-2 py-0.5 text-[9px] font-bold",
                          a.status === "COMPLETED"
                            ? "border-success/20 bg-success/10 text-success"
                            : "border-warning/20 bg-warning/10 text-warning"
                        )}>
                          {t(a.status)}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {a.status === "SCHEDULED" ? t("Next: Check in") : t("Open appointment")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={clsx("h-4 w-4 text-muted-foreground shrink-0", i18n.language === "ar" && "rotate-180")} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={item} className="rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-4 bg-muted/20">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {t("Operational Alerts")}
            </h2>
            <button
              onClick={() => nav("/inventory")}
              className="min-h-11 inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-opacity"
            >
              {t("View All")}
            </button>
          </div>
          <div className="p-4 sm:p-6">
            {lowStockItems.length === 0 ? (
              <ScreenState
                state="empty"
                compact
                icon={<CheckCircle2 className="h-6 w-6" />}
                title={t("No low stock alerts")}
                description={trackedProductCount === 0
                  ? t("Add products when you start tracking stock.")
                  : t("Inventory levels are healthy")}
              />
            ) : (
              <div className="space-y-2">
                {lowStockItems.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => nav("/inventory")}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-start hover:bg-muted/40 hover:border-warning/40 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">{t("Low Stock")}</p>
                    </div>
                    <span className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center text-xs font-bold shrink-0">
                      {p.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      )}

      {!isFirstRun && (
        <motion.section variants={item} aria-labelledby="needs-attention-title" className="rounded-2xl sm:rounded-3xl border border-warning/20 bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-warning/20 bg-warning/5 px-4 sm:px-6 py-4">
            <div>
              <h2 id="needs-attention-title" className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
                {t("Needs Attention")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("Resolve today's exceptions before they become delays.")}</p>
            </div>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">
              {needsAttention.length}
            </span>
          </div>
          <div className="p-4 sm:p-6">
            {needsAttention.length === 0 ? (
              <ScreenState
                state="empty"
                compact
                icon={<CheckCircle2 className="h-6 w-6" />}
                title={t("Nothing needs attention")}
                description={t("Today's schedule and stock have no recorded exceptions.")}
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {needsAttention.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => nav(item.route)}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background/40 p-3 text-start transition-colors hover:border-warning/40 hover:bg-warning/5 touch-target"
                  >
                    <span className={clsx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      item.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                    )}>
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{item.title}</span>
                      <span className="block truncate text-[10px] font-bold text-muted-foreground">{item.detail}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-bold text-primary">{item.action}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
        
        {/* 7-Day Revenue Chart */}
        <motion.div variants={item} className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
          <div className="border-b border-border px-4 sm:px-6 py-4 sm:py-6 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                  {t("7-Day Revenue")}
                </h2>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("Daily revenue trend")}</p>
              </div>
              <div className="text-end">
                <p className="text-sm font-bold text-foreground">{formatOMRAmount(totalRevenue7Days)} {summary?.currency}</p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase">{t("Total")}</p>
              </div>
            </div>
          </div>
          {/* Block-level wrapper (NOT flex) — ResponsiveContainer needs a
              definite width to measure on iOS Safari; flex centering on the
              direct parent made the chart collapse to 0px on iPhones. */}
          <div className="p-4 sm:p-6 flex-1 min-h-[200px] sm:min-h-[300px] w-full min-w-0">
            {loading ? (
              <div className="w-full h-full min-h-[260px] flex items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Spinner />
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t("Loading Chart...")}</p>
                </div>
              </div>
            ) : chartData.length === 0 || totalRevenue7Days === 0 ? (
              <ScreenState
                state="empty"
                compact
                icon={<BarChart3 className="h-6 w-6" />}
                title={t("No Revenue Data")}
                description={t("Start selling to see trends")}
                actionLabel="New Invoice"
                onAction={() => nav("/pos")}
              />
            ) : (
              <LazyChart height={isMobile ? 180 : 260}>
                <ResponsiveContainer width="100%" height={isMobile ? 180 : 260}>
                  <AreaChart data={chartData} margin={{ top: 10, right: isMobile ? 6 : 24, left: isMobile ? -16 : 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      style={{ fontSize: '10px', fontWeight: 600 }}
                      tickFormatter={formatChartDay}
                      minTickGap={16}
                      tickMargin={6}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      style={{ fontSize: '10px', fontWeight: 600 }}
                      width={isMobile ? 36 : 48}
                      tickFormatter={(v) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                      }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                      labelFormatter={(label) => formatChartDay(String(label))}
                      formatter={(value) => [`${formatOMRAmount(value)} ${summary?.currency}`, t("Revenue")]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--success))"
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
                <Wallet className="h-5 w-5 text-success" />
                {t("Financial Summary")}
              </h2>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("This Month")}</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                <Spinner />
                <p className="text-[10px] font-bold uppercase tracking-widest">{t("Processing...")}</p>
              </div>
            ) : !pnl ? (
              <ScreenState
                state="empty"
                compact
                icon={<Coins className="h-6 w-6" />}
                title={t("No Financial Data")}
                description={t("Complete transactions to see data")}
                actionLabel="New Invoice"
                onAction={() => nav("/pos")}
              />
            ) : (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Net Profit - Highlighted */}
                <div className="relative rounded-xl bg-gradient-to-br from-success to-success p-4 text-white shadow-lg overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-80">{t("Net Profit")}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <h3 className="text-3xl sm:text-4xl font-bold tracking-tighter">{formatOMRAmount(pnl.profit)}</h3>
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
                    label={t("Other Expenses")} 
                    value={pnl.expenses} 
                    currency={summary?.currency} 
                    icon={<AlertTriangle className="h-4 w-4" />}
                    color="rose"
                  />
                </div>

                {isAdmin && (
                <button 
                  onClick={() => nav("/reports")}
                  className="group w-full min-h-11 rounded-lg bg-secondary py-3 text-xs font-bold text-secondary-foreground transition-all hover:bg-secondary/80 flex items-center justify-center gap-2 shadow-lg mt-auto"
                >
                  {t("View Detailed Reports")}
                  <ArrowRight className={clsx("h-4 w-4 transition-transform", i18n.language === "ar" ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
                </button>
                )}
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
                {/* Not "Live": this is a polled 90-day window refreshed on
                    demand, so it is named for what it actually is. */}
                {t("Recent Activity")}
              </h2>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{t("Recent updates")}</p>
            </div>
            <button 
              onClick={load}
              className="group min-h-11 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary hover:opacity-80 transition-opacity"
            >
              {t("Refresh")}
              <Zap className={clsx("h-3 w-3 transition-transform", loading && "animate-spin")} />
            </button>
          </div>
          <div className="p-4 sm:p-6 space-y-2 max-h-[400px] overflow-auto scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {activity.length === 0 && !loading && (
                <ScreenState
                  state="empty"
                  compact
                  icon={<List className="h-6 w-6" />}
                  title={t("No Activity Yet")}
                  description={t("Recent updates will appear here")}
                />
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
            {isAdmin && (
            <QuickActionButton 
              title={t("View Reports")} 
              icon={<BarChart3 className="h-4 w-4" />} 
              color="amber" 
              onClick={() => nav("/reports")}
            />
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
