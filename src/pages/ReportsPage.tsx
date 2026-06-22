import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from "recharts";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { 
  FileText, Calendar, Package, TrendingUp, Users, 
  ShoppingBag, ArrowUpRight, ArrowDownRight, Filter, 
  Download, RefreshCw, PieChart as PieChartIcon, 
  Activity, Zap, Sparkles, ChevronRight, ChevronLeft, MoreVertical,
  LayoutGrid, Clock, Wallet, BarChart3, CheckCircle2, XCircle, AlertCircle
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
    load();
  }, [tab, dateRange]);

  const renderSales = () => {
    if (salesError) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 bg-card rounded-[3rem] border border-border shadow-xl">
           <div className="h-24 w-24 rounded-[2.5rem] bg-muted flex items-center justify-center text-muted-foreground">
             <BarChart3 className="h-12 w-12" />
           </div>
           <div className="max-w-md space-y-2">
             <h3 className="text-lg font-bold text-foreground">{t("Backend Required")}</h3>
             <p className="text-sm text-muted-foreground leading-relaxed">
               {t("Financial reports and sales analytics require the process_checkout_v1 RPC and invoice schema to be applied to the Supabase database.")}
             </p>
           </div>
        </div>
      );
    }

    if (!data) return null;
    const salesData = data as SalesReportRow[];
    const grouped = salesData.reduce((acc: Record<string, number>, curr) => {
      const date = curr.date.split("T")[0];
      acc[date] = (acc[date] || 0) + curr.totalAmount;
      return acc;
    }, {});
    const chartData = Object.keys(grouped).map((date) => ({
      date,
      amount: grouped[date],
    }));

    const totalSales = salesData.reduce((a, b) => a + b.totalAmount, 0);
    const avgSale = totalSales / (salesData.length || 1);
    
    return (
      <div className="space-y-10">
        <div className="grid gap-8 md:grid-cols-3">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-[2.5rem] border border-border bg-card p-10 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 end-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp className="h-24 w-24 -rotate-12" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <TrendingUp className="h-7 w-7" />
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-xl text-emerald-600 font-bold text-xs shadow-sm">
                <ArrowUpRight className="h-4 w-4" />
                12%
              </div>
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">{t("Total Revenue")}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{totalSales.toFixed(2)}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="group rounded-[2.5rem] border border-border bg-card p-10 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 end-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <FileText className="h-24 w-24 rotate-12" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <FileText className="h-7 w-7" />
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-xl text-emerald-600 font-bold text-xs shadow-sm">
                <ArrowUpRight className="h-4 w-4" />
                8%
              </div>
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">{t("Total Invoices")}</div>
            <div className="text-4xl font-bold text-foreground">{data.length}</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="group rounded-[2.5rem] border border-border bg-card p-10 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 end-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShoppingBag className="h-24 w-24" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <div className="flex items-center gap-2 bg-rose-500/10 px-4 py-1.5 rounded-xl text-rose-600 font-bold text-xs shadow-sm">
                <ArrowDownRight className="h-4 w-4" />
                3%
              </div>
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">{t("Average Ticket")}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{avgSale.toFixed(2)}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[3rem] border border-border bg-card p-10 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground uppercase tracking-[0.2em]">{t("Revenue Dynamics")}</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-xl border border-border">
                <div className="h-3 w-3 rounded-full bg-primary shadow-sm" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Daily Sales")}</span>
              </div>
              <button className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 700 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 700 }} 
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                  contentStyle={{ 
                    borderRadius: "24px", 
                    border: "1px solid hsl(var(--border))", 
                    backgroundColor: "hsl(var(--card))", 
                    boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
                    padding: "16px 20px"
                  }}
                  itemStyle={{ fontWeight: 800, fontSize: "16px", color: "hsl(var(--primary))" }}
                  labelStyle={{ fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "8px", color: "hsl(var(--muted-foreground))" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4}
                  fill="url(#areaGradient)" 
                  name={t("Sales")} 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderAppointments = () => {
    if (!data) return null;
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

    return (
      <div className="space-y-10">
        <div className="grid gap-8 md:grid-cols-4">
          {[
            { label: t("Total"), value: data.length, color: "blue", icon: Activity },
            { label: t("Completed"), value: statusCounts["COMPLETED"] || 0, color: "emerald", icon: CheckCircle2 },
            { label: t("Scheduled"), value: statusCounts["SCHEDULED"] || 0, color: "amber", icon: Clock },
            { label: t("Canceled"), value: statusCounts["CANCELED"] || 0, color: "rose", icon: XCircle },
          ].map((stat, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label}
              className={clsx(
                "group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl border-l-[8px] hover:shadow-2xl transition-all",
                stat.color === "blue" && "border-l-blue-500",
                stat.color === "emerald" && "border-l-emerald-500",
                stat.color === "amber" && "border-l-amber-500",
                stat.color === "rose" && "border-l-rose-500",
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={clsx(
                  "h-10 w-10 rounded-xl flex items-center justify-center shadow-inner",
                  stat.color === "blue" && "bg-blue-500/10 text-blue-600",
                  stat.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
                  stat.color === "amber" && "bg-amber-500/10 text-amber-600",
                  stat.color === "rose" && "bg-rose-500/10 text-rose-600",
                )}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</div>
              <div className="text-4xl font-bold text-foreground">{stat.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 sm:gap-6 lg:gap-10 lg:grid-cols-[1fr_450px]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
          >
            <div className="border-b border-border bg-muted/30 px-6 sm:px-10 py-5 sm:py-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">{t("Appointment Log")}</h3>
              </div>
              <button className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
                <Download className="h-5 w-5" />
              </button>
            </div>
            <div className="hidden lg:block overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[800px] text-sm md:min-w-full">
                <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                  <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                    <th>{t("Date")}</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Service")}</th>
                    <th>{t("Employee")}</th>
                    <th>{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {appData.map((app, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02 } }}
                      key={app.id} 
                      className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start"
                    >
                      <td className="text-muted-foreground font-bold text-xs uppercase tracking-tight">{new Date(app.dateTime).toLocaleString(i18n.language || "ar")}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shadow-inner">
                            {app.customer?.name?.[0]}
                          </div>
                          <span className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{app.customer?.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2.5 rounded-2xl bg-primary/5 px-4 py-2 text-xs font-bold text-primary border border-primary/10 shadow-sm">
                          {app.service?.name}
                        </div>
                      </td>
                      <td className="text-foreground font-bold text-xs uppercase tracking-widest opacity-60">{app.employee?.name}</td>
                      <td>
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-2xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm",
                            app.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-600" :
                            app.status === "CANCELED" ? "bg-rose-500/10 text-rose-600" :
                            "bg-amber-500/10 text-amber-600"
                          )}
                        >
                          {t(app.status)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Appointments */}
            <div className="lg:hidden p-4 grid gap-4 grid-cols-1">
              {appData.map((app, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  key={`m-${app.id}`}
                  className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shadow-inner shrink-0">
                        {app.customer?.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                        <span className="font-bold text-foreground text-lg truncate w-full">{app.customer?.name}</span>
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground border border-transparent shadow-sm shrink-0">
                           {app.service?.name}
                        </div>
                      </div>
                    </div>
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-2xl px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] shadow-sm shrink-0",
                        app.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-600" :
                        app.status === "CANCELED" ? "bg-rose-500/10 text-rose-600" :
                        "bg-amber-500/10 text-amber-600"
                      )}
                    >
                      {t(app.status)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Date")}</span>
                      <span className="font-bold text-foreground text-xs uppercase tracking-tight">{new Date(app.dateTime).toLocaleString(i18n.language || "ar", { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-end">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Employee")}</span>
                      <span className="font-bold text-foreground text-xs uppercase tracking-tight">{app.employee?.name}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-[3rem] border border-border bg-card p-10 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden"
          >
            <div className="absolute top-0 end-0 p-10 opacity-5">
              <PieChartIcon className="h-32 w-32" />
            </div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-[0.2em] mb-12 w-full text-start">{t("Status Distribution")}</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={10}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: "24px", border: "none", boxShadow: "0 20px 40px rgba(0,0,0,0.15)", padding: "16px 20px" }}
                    itemStyle={{ fontWeight: 800, fontSize: "14px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-5 w-full mt-12">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-muted/30 border border-border shadow-inner group hover:bg-card hover:shadow-xl transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{item.name}</span>
                  </div>
                  <span className="text-lg font-bold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    if (!data) return null;
    const invData = data as InventoryReportRow[];
    const lowStock = invData.filter((p) => p.stockQuantity < 5);
    const totalValue = invData.reduce((a, b) => a + (b.cost || 0) * b.stockQuantity, 0);

    return (
      <div className="space-y-10">
        <div className="grid gap-8 md:grid-cols-3">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-[2.5rem] border border-border bg-card p-10 shadow-xl hover:shadow-2xl transition-all"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Package className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Total Products")}</span>
            </div>
            <div className="text-4xl font-bold text-foreground">{data.length}</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="group rounded-[2.5rem] border border-border bg-card p-10 shadow-xl hover:shadow-2xl transition-all"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Wallet className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Inventory Value")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{totalValue.toFixed(2)}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={clsx(
              "group rounded-[2.5rem] border border-border bg-card p-10 shadow-xl border-l-[10px] hover:shadow-2xl transition-all",
              lowStock.length > 0 ? "border-l-rose-500" : "border-l-emerald-500"
            )}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className={clsx(
                "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner",
                lowStock.length > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
              )}>
                <AlertCircle className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Low Stock Items")}</span>
            </div>
            <div className="text-4xl font-bold text-foreground">{lowStock.length}</div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
        >
          <div className="border-b border-border bg-muted/30 px-6 sm:px-10 py-5 sm:py-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">{t("Inventory Status")}</h3>
            </div>
            <button className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
              <Download className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden lg:block overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[800px] text-sm md:min-w-full font-sans">
              <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                  <th>{t("Product")}</th>
                  <th>{t("Stock")}</th>
                  <th>{t("Cost")}</th>
                  <th>{t("Price")}</th>
                  <th>{t("Total Value")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {invData.map((p, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02 } }}
                    key={p.id} 
                    className={clsx(
                      "group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start", 
                      p.stockQuantity < 5 && "bg-rose-500/5"
                    )}
                  >
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-inner">
                          {p.name[0]}
                        </div>
                        <div className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{p.name}</div>
                      </div>
                    </td>
                    <td>
                      <div className={clsx(
                        "inline-flex items-center gap-2.5 rounded-2xl px-5 py-2.5 text-xs font-bold border shadow-sm",
                        p.stockQuantity < 5 ? "bg-rose-500/10 text-rose-700 border-rose-200" : "bg-muted text-foreground border-border"
                      )}>
                        {p.stockQuantity}
                      </div>
                    </td>
                    <td className="text-muted-foreground font-bold text-base">{p.cost.toFixed(2)}</td>
                    <td className="text-foreground font-bold text-base">{p.price.toFixed(2)}</td>
                    <td className="text-primary font-bold text-lg">{(p.stockQuantity * p.cost).toFixed(2)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Inventory Status */}
          <div className="lg:hidden p-4 grid gap-4 grid-cols-1">
            {invData.map((p, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                key={`m-inv-${p.id}`}
                className={clsx(
                  "bg-card border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden",
                  p.stockQuantity < 5 ? "border-rose-500/30" : "border-border"
                )}
              >
                {p.stockQuantity < 5 && (
                  <div className="absolute top-0 end-0 bg-rose-500/10 text-rose-600 px-3 py-1 rounded-bl-2xl text-[10px] font-bold uppercase tracking-wider">
                    {t("Low Stock")}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shadow-inner shrink-0">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                    <span className="font-bold text-foreground text-lg truncate w-full">{p.name}</span>
                    <div className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[10px] font-bold border shadow-sm shrink-0",
                      p.stockQuantity < 5 ? "bg-rose-500/10 text-rose-700 border-rose-200 animate-pulse" : "bg-muted text-foreground border-border"
                    )}>
                      {p.stockQuantity} {t("In Stock")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Cost")} / {t("Price")}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-muted-foreground text-xs">{p.cost.toFixed(2)}</span>
                      <span className="text-muted-foreground/30">/</span>
                      <span className="font-bold text-foreground text-xs">{p.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-end">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t("Total Value")}</span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-bold text-primary text-base">{(p.stockQuantity * p.cost).toFixed(2)}</span>
                      <span className="text-[8px] font-bold text-primary uppercase tracking-widest">{t("OMR")}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <BarChart3 className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
              {t("Reports")}
              <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest leading-tight">{t("Backend Required")}</span>
            </h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Analyze your business performance")}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
          {tab !== "inventory" && (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-[1.5rem] border border-border shadow-xl w-full sm:w-auto">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl border border-border shadow-inner w-full sm:w-auto">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="border-none bg-transparent text-xs font-bold focus:ring-0 text-foreground outline-none uppercase tracking-wider w-full sm:min-w-[120px]"
                />
              </div>
              {i18n.language === "ar" ? (
                <ChevronLeft className="h-4 w-4 text-muted-foreground opacity-30 rotate-90 sm:rotate-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 rotate-90 sm:rotate-0" />
              )}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl border border-border shadow-inner w-full sm:w-auto">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="border-none bg-transparent text-xs font-bold focus:ring-0 text-foreground outline-none uppercase tracking-wider w-full sm:min-w-[120px]"
                />
              </div>
            </div>
          )}
          <button 
            onClick={load}
            className="h-14 w-14 rounded-[1.5rem] border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-xl hover:scale-110 active:scale-95 shrink-0 self-center mx-auto sm:mx-0"
          >
            <RefreshCw className={clsx("h-6 w-6", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-[2rem] w-full sm:w-fit border border-border shadow-inner overflow-x-auto scrollbar-hide select-none">
        {[
          { id: "sales", label: t("Sales"), icon: FileText },
          { id: "appointments", label: t("Appointments"), icon: Calendar },
          { id: "inventory", label: t("Inventory"), icon: Package },
        ].map((tItem) => (
          <button
            key={tItem.id}
            onClick={() => setTab(tItem.id as "sales" | "appointments" | "inventory")}
            className={clsx(
              "flex items-center gap-3 px-8 py-3.5 rounded-[1.5rem] text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap",
              tab === tItem.id 
                ? "bg-card text-primary shadow-xl border border-border scale-105" 
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <tItem.icon className="h-4 w-4" />
            {tItem.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-48 flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">{t("Processing Analytics...")}</p>
          </motion.div>
        ) : (
          <motion.div 
            key={tab}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            {tab === "sales" && renderSales()}
            {tab === "appointments" && renderAppointments()}
            {tab === "inventory" && renderInventory()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
