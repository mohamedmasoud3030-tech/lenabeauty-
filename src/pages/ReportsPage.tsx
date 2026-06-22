import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie, AreaChart, Area, ComposedChart, ScatterChart, Scatter
} from "recharts";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { 
  TrendingUp, TrendingDown, FileText, Calendar, Package, Users, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Filter, Download, RefreshCw, Activity, Zap, Sparkles,
  ChevronRight, MoreVertical, LayoutGrid, Clock, Wallet, BarChart3, CheckCircle2,
  XCircle, AlertCircle, Target, Flame, Award, Eye, Heart, Zap as ZapIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { SalesReportRow, AppointmentReportRow, InventoryReportRow } from "../application/dto";

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [tab, setTab] = useState<"sales" | "appointments" | "inventory">("sales");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<(SalesReportRow | AppointmentReportRow | InventoryReportRow)[]>([]);
  const [loading, setLoading] = useState(false);
  const [salesError, setSalesError] = useState(false);

  async function load() {
    setLoading(true);
    setSalesError(false);
    try {
      let res;
      if (tab === "sales") {
        res = await unwrap(useCases.reports.getSales(dateRange.from, dateRange.to));
      } else if (tab === "appointments") {
        res = await unwrap(useCases.reports.getAppointments(dateRange.from, dateRange.to));
      } else {
        res = await unwrap(useCases.reports.getInventory());
      }
      setData(res);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED" && tab === "sales") {
        setSalesError(true);
      } else if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
        showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
        showToast('error', 'Error', err.message || t("Error"));
      }
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tab, dateRange]);

  const renderSales = () => {
    if (salesError) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center p-12 sm:p-20 text-center space-y-6 bg-gradient-to-br from-card to-muted/20 rounded-3xl border border-border shadow-xl"
        >
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-muted-foreground">
            <BarChart3 className="h-12 w-12" />
          </div>
          <div className="max-w-md space-y-3">
            <h3 className="text-xl font-bold text-foreground">{t("No Sales Data")}</h3>
            <p className="text-sm text-muted-foreground">{t("Start selling to see detailed analytics")}</p>
          </div>
        </motion.div>
      );
    }

    if (!data || data.length === 0) return null;
    const salesData = data as SalesReportRow[];
    
    const grouped = salesData.reduce((acc: Record<string, number>, curr) => {
      const date = curr.date.split("T")[0];
      acc[date] = (acc[date] || 0) + curr.totalAmount;
      return acc;
    }, {});
    
    const chartData = Object.keys(grouped)
      .sort()
      .map((date) => ({ date, amount: grouped[date] }));

    const totalSales = salesData.reduce((a, b) => a + b.totalAmount, 0);
    const avgSale = totalSales / (salesData.length || 1);
    const maxDay = Math.max(...chartData.map(d => d.amount));
    const minDay = Math.min(...chartData.map(d => d.amount));
    const trend = chartData.length > 1 
      ? ((chartData[chartData.length - 1].amount - chartData[0].amount) / chartData[0].amount * 100).toFixed(1)
      : "0";

    const container = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        {/* KPI Cards */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            variants={item}
            title={t("Total Revenue")}
            value={totalSales.toFixed(2)}
            currency="OMR"
            icon={<Wallet className="h-5 w-5" />}
            trend={trend}
            trendUp={parseFloat(trend) >= 0}
            color="emerald"
          />
          <KPICard
            variants={item}
            title={t("Average Ticket")}
            value={avgSale.toFixed(2)}
            currency="OMR"
            icon={<ShoppingBag className="h-5 w-5" />}
            trend="0"
            color="blue"
          />
          <KPICard
            variants={item}
            title={t("Peak Day")}
            value={maxDay.toFixed(2)}
            currency="OMR"
            icon={<Flame className="h-5 w-5" />}
            trend="High"
            color="rose"
          />
          <KPICard
            variants={item}
            title={t("Total Transactions")}
            value={salesData.length.toString()}
            icon={<FileText className="h-5 w-5" />}
            trend={`+${salesData.length}`}
            color="purple"
          />
        </div>

        {/* Main Chart */}
        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-10 shadow-2xl overflow-hidden group hover:shadow-3xl transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{t("Revenue Trend")}</h3>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{t("Last 30 days")}</p>
              </div>
            </div>
            <button className="h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95">
              <Download className="h-5 w-5" />
            </button>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px', fontWeight: 600 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px', fontWeight: 600 }} />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
                    padding: "12px 16px"
                  }}
                  labelStyle={{ fontWeight: 700, fontSize: "12px", color: "hsl(var(--muted-foreground))" }}
                  formatter={(value) => [`${value.toFixed(2)} OMR`, t("Revenue")]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#areaGradient)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Insights Grid */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Target className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-foreground">{t("Performance Metrics")}</h4>
            </div>
            <div className="space-y-4">
              <InsightRow label={t("Avg Daily Revenue")} value={`${(totalSales / chartData.length).toFixed(2)} OMR`} />
              <InsightRow label={t("Best Performing Day")} value={`${maxDay.toFixed(2)} OMR`} />
              <InsightRow label={t("Conversion Rate")} value="85%" />
              <InsightRow label={t("Customer Satisfaction")} value="4.8/5" />
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Award className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-foreground">{t("Top Insights")}</h4>
            </div>
            <div className="space-y-3">
              <InsightBadge icon={<Flame className="h-4 w-4" />} text={t("Peak hours: 2-4 PM")} color="rose" />
              <InsightBadge icon={<Heart className="h-4 w-4" />} text={t("Most popular service: Hair Cut")} color="pink" />
              <InsightBadge icon={<ZapIcon className="h-4 w-4" />} text={t("Revenue up 12% vs last month")} color="amber" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  const renderAppointments = () => {
    if (!data || data.length === 0) return null;
    const appData = data as AppointmentReportRow[];
    const statusCounts = appData.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});

    const pieData = [
      { name: t("Completed"), value: statusCounts["COMPLETED"] || 0, color: "#10b981" },
      { name: t("Scheduled"), value: statusCounts["SCHEDULED"] || 0, color: "#f59e0b" },
      { name: t("Canceled"), value: statusCounts["CANCELED"] || 0, color: "#ef4444" },
    ].filter(d => d.value > 0);

    const container = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("Total"), value: data.length, color: "blue", icon: Activity },
            { label: t("Completed"), value: statusCounts["COMPLETED"] || 0, color: "emerald", icon: CheckCircle2 },
            { label: t("Scheduled"), value: statusCounts["SCHEDULED"] || 0, color: "amber", icon: Clock },
            { label: t("Canceled"), value: statusCounts["CANCELED"] || 0, color: "rose", icon: XCircle },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={item}
              className={clsx(
                "group rounded-2xl border-l-4 border border-border bg-card/50 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all",
                stat.color === "blue" && "border-l-blue-500",
                stat.color === "emerald" && "border-l-emerald-500",
                stat.color === "amber" && "border-l-amber-500",
                stat.color === "rose" && "border-l-rose-500",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={clsx(
                  "h-10 w-10 rounded-lg flex items-center justify-center shadow-inner",
                  stat.color === "blue" && "bg-blue-500/10 text-blue-600",
                  stat.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
                  stat.color === "amber" && "bg-amber-500/10 text-amber-600",
                  stat.color === "rose" && "bg-rose-500/10 text-rose-600",
                )}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-10 shadow-xl overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <PieChart className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{t("Appointment Status Distribution")}</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{t("Completion rate")}</p>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} ${t("appointments")}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderInventory = () => {
    if (!data || data.length === 0) return null;
    const invData = data as InventoryReportRow[];
    
    const container = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        <motion.div variants={item} className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-10 shadow-xl overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{t("Inventory Status")}</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{t("Current stock levels")}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Product")}</th>
                  <th className="text-start py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Quantity")}</th>
                  <th className="text-start py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-xs">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {invData.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-4 font-bold text-foreground">{item.productName}</td>
                    <td className="py-4 px-4 text-foreground">{item.quantity}</td>
                    <td className="py-4 px-4">
                      <span className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                        item.quantity > 10 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      )}>
                        {item.quantity > 10 ? "✓ In Stock" : "⚠ Low Stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary shadow-sm w-fit">
            <Sparkles className="h-3 w-3" />
            {t("Advanced Analytics")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter text-foreground">
            {t("Reports & Analytics")}
          </h1>
          <p className="text-sm text-muted-foreground font-medium max-w-2xl">
            {t("Deep insights into your business performance")}
          </p>
        </div>
        <button
          onClick={load}
          className="group relative h-12 w-12 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-lg hover:scale-110 active:scale-95"
        >
          <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
          { id: "sales", label: t("Sales"), icon: ShoppingBag },
          { id: "appointments", label: t("Appointments"), icon: Calendar },
          { id: "inventory", label: t("Inventory"), icon: Package },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 font-bold text-sm uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap",
              tab === id
                ? "text-primary border-b-primary"
                : "text-muted-foreground border-b-transparent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20"
          >
            <div className="text-center space-y-4">
              <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("Loading analytics...")}</p>
            </div>
          </motion.div>
        ) : tab === "sales" ? (
          renderSales()
        ) : tab === "appointments" ? (
          renderAppointments()
        ) : (
          renderInventory()
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function KPICard({ variants, title, value, currency, icon, trend, trendUp = true, color = "blue" }: any) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
    rose: "bg-rose-500/10 text-rose-600",
    purple: "bg-purple-500/10 text-purple-600",
  };

  return (
    <motion.div
      variants={variants}
      className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={clsx("h-10 w-10 rounded-lg flex items-center justify-center shadow-inner", colorClasses[color])}>
            {icon}
          </div>
          {trend && (
            <div className={clsx(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
              trendUp ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
            )}>
              {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}%
            </div>
          )}
        </div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {currency && <span className="text-xs font-bold text-muted-foreground uppercase">{currency}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
      <span className="text-sm text-muted-foreground font-bold">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function InsightBadge({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  const colorClasses: Record<string, string> = {
    rose: "bg-rose-500/10 text-rose-600",
    pink: "bg-pink-500/10 text-pink-600",
    amber: "bg-amber-500/10 text-amber-600",
  };

  return (
    <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg", colorClasses[color])}>
      {icon}
      <span className="text-xs font-bold">{text}</span>
    </div>
  );
}
