import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { 
  AlertTriangle, CalendarDays, Coins, List, 
  ArrowUpRight, TrendingUp, Users, Scissors, 
  Receipt, Sparkles, ArrowRight, Plus, 
  ShoppingBag, Calendar, UserPlus, FileText,
  Activity, Zap, Clock, ChevronRight, MoreVertical,
  LayoutGrid, Wallet, BarChart3, DollarSign, TrendingDown, CheckCircle2
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
import { ScreenState } from "../shared/components/ScreenState";
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
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [last7Days, setLast7Days] = useState<{date: string; revenue: number}[]>([]);
  const [activity, setActivity] = useState<{id: string, type: string, message: string, createdAt: string, user?: {username?: string}}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  // تشغيلية حقيقية: مواعيد اليوم القادمة + تنبيهات المخزون
  const [todayAppts, setTodayAppts] = useState<{ id: string; time: string; customerName: string; serviceName?: string; status: string }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<{ id: string; name: string; stock: number }[]>([]);
  const [trackedProductCount, setTrackedProductCount] = useState<number | null>(null);

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
      void loadTodayOps();

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

  /** مواعيد اليوم القادمة + تنبيهات المخزون — بيانات حقيقية فقط. */
  async function loadTodayOps() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    try {
      const [apptsRes, customersRes, servicesRes] = await Promise.all([
        useCases.appointments.list({ fromISO: todayStart.toISOString(), toISO: todayEnd.toISOString() }),
        useCases.customers.list(),
        useCases.services.list(),
      ]);
      const customerNames = new Map((customersRes.ok ? customersRes.data : []).map((c) => [c.id, c.name]));
      const serviceNames = new Map((servicesRes.ok ? servicesRes.data : []).map((s) => [s.id, s.name]));
      const upcoming = (apptsRes.ok ? apptsRes.data : [])
        .filter((a) => a.status === "SCHEDULED")
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          time: a.dateTime.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" }),
          customerName: a.customerId ? (customerNames.get(a.customerId) ?? "—") : "—",
          serviceName: a.serviceId ? serviceNames.get(a.serviceId) : undefined,
          status: a.status,
        }));
      setTodayAppts(upcoming);
    } catch {
      setTodayAppts([]);
    }

    try {
      const productsRes = await useCases.products.list();
      const catalog = productsRes.ok ? productsRes.data : [];
      setTrackedProductCount(productsRes.ok ? catalog.length : null);
      const low = catalog
        .filter((p) => p.isActive && p.trackInventory && p.stockQuantity <= (p.reorderLevel ?? 5))
        .sort((a, b) => a.stockQuantity - b.stockQuantity)
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, stock: p.stockQuantity }));
      setLowStockItems(low);
    } catch {
      setLowStockItems([]);
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
                    message: `${t("New expense recorded")}: ${formatOMRAmount(e.amount)} ${s.currency || ""}`.trim(),
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
            onClick={() => nav(isFirstRun ? "/services" : "/pos")}
            className="group relative inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t(isFirstRun ? "Add your services" : "New Invoice")}
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
                {todayAppts.map((a) => (
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
                  <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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

function StatCard({ title, value, subValue, icon, color, variants, compact = false }: {
  title: string
  value: string | number
  subValue: string
  icon: React.ReactNode
  color: string
  variants: import("motion/react").Variants
  compact?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-success/10 text-success",
    blue: "bg-info/10 text-info",
    purple: "bg-primary/10 text-primary",
    rose: "bg-destructive/10 text-destructive",
  };

  return (
    <motion.div 
      variants={variants}
      className={clsx(
        "group relative rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md overflow-hidden",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-6"
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className={clsx(
          "rounded-lg transition-all group-hover:scale-110 shadow-sm",
          compact ? "p-1.5 sm:p-2" : "p-2.5 sm:p-3",
          colorMap[color]
        )}>
          {icon}
        </div>
      </div>
      <div className={clsx("relative z-10", compact ? "mt-2 sm:mt-4" : "mt-4 sm:mt-6")}>
        <p className={clsx(
          "font-bold text-muted-foreground uppercase tracking-wider",
          compact ? "text-[8px] sm:text-[9px]" : "text-[9px]"
        )}>{title}</p>
        <h3 className={clsx(
          "font-bold text-foreground tracking-tighter truncate",
          compact ? "text-lg sm:text-2xl mt-0.5" : "text-2xl sm:text-3xl mt-1 sm:mt-2"
        )}>{value}</h3>
        <p className={clsx(
          "text-muted-foreground font-bold uppercase tracking-wider opacity-60 truncate",
          compact ? "text-[8px] sm:text-[9px] mt-0.5" : "text-[9px] mt-1 sm:mt-2"
        )}>{subValue}</p>
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
    blue: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    emerald: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    purple: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    amber: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    slate: "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
  };

  return (
    <button 
      onClick={onClick}
      className={clsx(
        "group min-h-11 w-full flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:shadow-lg hover:-translate-y-0.5",
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
    emerald: "bg-success/10 text-success",
    orange: "bg-warning/10 text-warning",
    blue: "bg-info/10 text-info",
    rose: "bg-destructive/10 text-destructive"
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
        <span className="text-sm font-bold text-foreground">{formatOMRAmount(value)}</span>
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
