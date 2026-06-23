import { useEffect, useMemo, useState } from "react";
import { 
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Clock, 
  User, Scissors, Search, Bell, CheckCircle2, Calendar as CalendarIcon,
  Filter, MoreVertical, Phone, MapPin, Sparkles, XCircle
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";

type Customer = { id: string; name: string; phone: string | null };
type Service = { id: string; name: string; category: string; durationMins: number; price: number };
type Employee = { id: string; name: string };

import { AppointmentStatus, Appointment } from "../domain/entities";

type Appt = Appointment & {
  customer: Customer;
  employee: Employee;
  service: Service;
};

const SLOT_MINS = 30;

function mapService(s: any): Service {
  return {
    id: s.id || "",
    name: s.name || "",
    category: s.category || s.categoryId || "",
    durationMins: s.durationMins || s.durationMinutes || 30,
    price: s.price || 0,
  };
}

function mapEmployee(e: any): Employee {
  return {
    id: e.id || "",
    name: e.name || "",
  };
}

function mapCustomer(c: any): Customer {
  return {
    id: c.id || "",
    name: c.name || "",
    phone: c.phone || null,
  };
}

function mapAppt(a: any): Appt {
  return {
    ...a,
    customer: mapCustomer(a.customer || {}),
    employee: mapEmployee(a.employee || {}),
    service: mapService(a.service || {}),
  };
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); 
  const diff = (day + 1) % 7; 
  return addDays(x, -diff);
}

function fmtDayHeader(d: Date) {
  const lang = i18n.language || "ar";
  return d.toLocaleDateString(lang, { weekday: "short", day: "2-digit", month: "2-digit" });
}

function fmtTime(d: Date) {
  const lang = i18n.language || "ar";
  return d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s: AppointmentStatus | string) {
  switch (s) {
    case AppointmentStatus.SCHEDULED: return "معلق";
    case "CONFIRMED": return "مؤكد";
    case AppointmentStatus.COMPLETED: return "مكتمل";
    case AppointmentStatus.CANCELLED: return "ملغي";
    default: return s;
  }
}

function statusClass(s: AppointmentStatus | string) {
  switch (s) {
    case AppointmentStatus.SCHEDULED: return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "CONFIRMED": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case AppointmentStatus.COMPLETED: return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case AppointmentStatus.CANCELLED: return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function AppointmentsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [open, setOpen] = useState(false);
  const [editApptId, setEditApptId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState<Date | null>(null);

  const [customerQ, setCustomerQ] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");

  const [serviceId, setServiceId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [status, setStatus] = useState<AppointmentStatus>(AppointmentStatus.SCHEDULED);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (mode === "day") {
      const from = startOfDay(anchor);
      const to = addDays(from, 1);
      return { from, to, days: [from] };
    }
    const from = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const to = addDays(from, 7);
    return { from, to, days };
  }, [mode, anchor]);

  async function load() {
    setLoading(true);
    try {
      const [sv, em, a] = await Promise.all([
        unwrap(useCases.services.list()),
        unwrap(useCases.employees.list()),
        unwrap(useCases.appointments.list({ fromISO: range.from.toISOString(), toISO: range.to.toISOString() })),
      ]);
      setServices(sv.map(mapService));
      setEmployees(em.map(mapEmployee));
      setAppts(a.map(mapAppt));
      if (sv.length && !serviceId) setServiceId(sv[0].id);
      if (em.length && !employeeId) setEmployeeId(em[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [range.from.getTime(), range.to.getTime()]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = customerQ.trim();
      if (!q) {
        setCustomers([]);
        return;
      }
      const res = await unwrap(useCases.customers.list(q));
      setCustomers(res.map(mapCustomer));
    }, 250);
    return () => clearTimeout(t);
  }, [customerQ]);

  const slots = useMemo(() => {
    const count = (24 * 60) / SLOT_MINS;
    return Array.from({ length: count }, (_, i) => i);
  }, []);

  function slotToDate(day: Date, slotIdx: number) {
    const d = startOfDay(day);
    d.setMinutes(slotIdx * SLOT_MINS, 0, 0);
    return d;
  }

  function openBooking(d?: Date) {
    const targetDate = d || new Date();
    if (!d) {
      const mins = targetDate.getMinutes();
      targetDate.setMinutes(mins >= 30 ? 30 : 0, 0, 0);
    }
    setEditApptId(null);
    setSlotDate(targetDate);
    setOpen(true);
    setCustomerId("");
    setCustomerQ("");
    setCustomers([]);
    setStatus(AppointmentStatus.SCHEDULED);
  }

  function openEditBooking(appt: Appt) {
    setEditApptId(appt.id);
    setSlotDate(new Date(appt.dateTime));
    setCustomerId(appt.customerId);
    setCustomerQ(appt.customer?.name || "");
    setStatus(appt.status);
    setServiceId(appt.serviceId);
    setEmployeeId(appt.employeeId);
    setOpen(true);
  }

  async function deleteAppt(id: string) {
    const ok = await confirm({
      title: t("Confirm"),
      message: t("Are you sure you want to delete this appointment?"),
      type: "danger"
    });
    if (!ok) return;
    try {
      await unwrap(useCases.appointments.delete(id));
      await load();
      showToast('success', t("Success"), t("Appointment deleted successfully"));
      setOpen(false);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', 'Error', err?.message || String(err));
      }
    }
  }

  async function submitBooking() {
    if (!slotDate) return;
    if (!customerId) return showToast('error', 'Error', t("Please select a customer"));
    if (!serviceId) return showToast('error', 'Error', t("Please select a service"));
    if (!employeeId) return showToast('error', 'Error', t("Please select an employee"));

    setBusy(true);
    try {
      if (editApptId) {
        await unwrap(useCases.appointments.update(editApptId, {
          dateTime: slotDate,
          status,
          customerId,
          employeeId,
          serviceId,
        }));
        showToast('success', t("Success"), t("Appointment updated successfully"));
      } else {
        await unwrap(useCases.appointments.create({
          dateTime: slotDate,
          status,
          customerId,
          employeeId,
          serviceId,
        }));
        showToast('success', t("Success"), t("Appointment created successfully"));
      }
      await load();
      setOpen(false);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', 'Error', err?.message || String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function cycleStatus(appt: Appt) {
    const order: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW];
    const idx = order.indexOf(appt.status);
    const next = order[(idx + 1) % order.length];
    await unwrap(useCases.appointments.update(appt.id, { status: next }));
    await load();
  }

  async function sendReminder(appt: Appt) {
    if (!appt.customer?.phone) return showToast('error', 'Error', t("Customer phone number not found"));
    try {
      setBusy(true);
      await unwrap(useCases.appointments.sendReminder(appt.id));
      showToast('error', 'Error', t("Reminder sent successfully (Simulated)"));
    } catch (e) {
      showToast('error', 'Error', ((e as Error).message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appt[]>();
    for (const a of appts) {
      const d = startOfDay(new Date(a.dateTime)).toISOString();
      map.set(d, [...(map.get(d) ?? []), a]);
    }
    return map;
  }, [appts]);

  // Stats
  const apptStats = useMemo(() => ({
    total: appts.length,
    scheduled: appts.filter(a => a.status === AppointmentStatus.SCHEDULED).length,
    completed: appts.filter(a => a.status === AppointmentStatus.COMPLETED).length,
    cancelled: appts.filter(a => a.status === AppointmentStatus.CANCELLED).length,
  }), [appts]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <CalendarDays className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t("Appointments")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Manage your spa schedule")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2 bg-muted/50 p-1.5 rounded-[1.5rem] border border-border shadow-inner w-full justify-center sm:justify-start">
            <button 
              onClick={() => setAnchor(new Date())} 
              className="px-5 py-2.5 text-xs font-bold text-foreground hover:bg-card rounded-xl transition-all shadow-sm"
            >
              {t("Today")}
            </button>
            <div className="flex items-center border-x border-border/50 px-2 gap-2">
              <button 
                onClick={() => setAnchor(d => mode === "day" ? addDays(d, -1) : addDays(d, -7))} 
                className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                title={t("Previous")}
              >
                {i18n.language === "ar" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>
              <button 
                onClick={() => setAnchor(d => mode === "day" ? addDays(d, 1) : addDays(d, 7))} 
                className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                title={t("Next")}
              >
                {i18n.language === "ar" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setMode("day")} 
                className={clsx(
                  "px-5 py-2.5 rounded-xl text-xs font-bold transition-all", 
                  mode === "day" ? "bg-card text-primary shadow-md" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("Day")}
              </button>
              <button 
                onClick={() => setMode("week")} 
                className={clsx(
                  "px-5 py-2.5 rounded-xl text-xs font-bold transition-all", 
                  mode === "week" ? "bg-card text-primary shadow-md" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("Week")}
              </button>
            </div>
          </div>
          <button 
            onClick={() => openBooking()} 
            className="h-14 px-8 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
          >
            <Plus className="h-6 w-6" />
            {t("New Appointment")}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('Total'), value: apptStats.total, color: 'text-primary', bg: 'bg-primary/10', icon: CalendarDays },
          { label: t('Scheduled'), value: apptStats.scheduled, color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
          { label: t('Completed'), value: apptStats.completed, color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
          { label: t('Cancelled'), value: apptStats.cancelled, color: 'text-rose-600', bg: 'bg-rose-500/10', icon: XCircle },
        ].map(({ label, value, color, bg, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 lg:space-y-0"
      >
        <div className="hidden lg:block overflow-hidden rounded-[3rem] border border-border bg-card shadow-2xl">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[1200px]">
              <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: `120px repeat(${range.days.length}, 1fr)` }}>
                <div className="p-8 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-muted-foreground/40" />
                </div>
                {range.days.map((d) => (
                  <div key={d.toISOString()} className="border-r border-border/50 p-8 text-center space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{d.toLocaleDateString(i18n.language || "ar", { weekday: "long" })}</div>
                    <div className="text-2xl font-bold text-foreground">{d.toLocaleDateString(i18n.language || "ar", { day: "2-digit", month: "2-digit" })}</div>
                  </div>
                ))}
              </div>

              <div className="max-h-[75vh] overflow-y-auto overflow-x-hidden relative scrollbar-hide">
                <div className="grid" style={{ gridTemplateColumns: `120px repeat(${range.days.length}, 1fr)`, gridTemplateRows: `repeat(${slots.length}, 80px)` }}>
                  {slots.map((slotIdx) => {
                    const t = slotToDate(range.days[0], slotIdx);
                    const isHour = t.getMinutes() === 0;
                    return (
                      <div key={`time-${slotIdx}`} className="flex items-start justify-center border-b border-border/30 py-4 text-xs font-bold text-muted-foreground/60">
                        {isHour ? fmtTime(t) : ""}
                      </div>
                    );
                  })}

                  {range.days.map((day) => {
                    const dayKey = startOfDay(day).toISOString();
                    const dayAppts = apptsByDay.get(dayKey) ?? [];
                    return (
                      <div key={dayKey} className="relative border-r border-border/30 group/day">
                        {slots.map((slotIdx) => (
                          <button
                            key={`${dayKey}-${slotIdx}`}
                            onClick={() => openBooking(slotToDate(day, slotIdx))}
                            className="h-[80px] w-full border-b border-border/30 transition-all hover:bg-primary/[0.02] flex items-center justify-center group/slot"
                          >
                            <Plus className="h-4 w-4 text-primary opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                          </button>
                        ))}

                        <div className="pointer-events-none absolute inset-0 p-2">
                          <AnimatePresence>
                            {dayAppts.map((a) => {
                              const dt = new Date(a.dateTime);
                              const minutes = dt.getHours() * 60 + dt.getMinutes();
                              const row = minutes / SLOT_MINS;
                              const span = (a.service?.durationMins ?? 30) / SLOT_MINS;
                              
                              return (
                                <motion.div
                                  layoutId={a.id}
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  key={a.id}
                                  style={{ position: "absolute", top: row * 80 + 8, right: 8, left: 8, height: span * 80 - 16 }}
                                  className={clsx(
                                    "pointer-events-auto flex flex-col justify-between rounded-[1.5rem] border p-4 shadow-lg transition-all hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer group/appt",
                                    statusClass(a.status)
                                  )}
                                  onClick={(e) => { e.stopPropagation(); openEditBooking(a); }}
                                >
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="truncate text-sm font-bold leading-tight">{a.customer?.name}</div>
                                      <MoreVertical className="h-4 w-4 opacity-0 group-hover/appt:opacity-100 transition-opacity shrink-0" />
                                    </div>
                                    <div className="truncate text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                                      <Scissors className="h-3 w-3" />
                                      {a.service?.name}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-bold mt-2">
                                    <div className="flex items-center gap-2 bg-white/20 px-2 py-1 rounded-lg">
                                      <Clock className="h-3 w-3" />
                                      <span>{fmtTime(dt)}</span>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden space-y-6">
          {range.days.map((day) => {
            const dayKey = startOfDay(day).toISOString();
            const dayAppts = apptsByDay.get(dayKey) ?? [];
            if (dayAppts.length === 0) return null;

            return (
              <div key={`mobile-${dayKey}`} className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-2">
                  {fmtDayHeader(day)}
                </h3>
                <div className="grid gap-4">
                  {dayAppts.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(a => {
                    const dt = new Date(a.dateTime);
                    return (
                      <motion.div
                        key={`m-${a.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => openEditBooking(a)}
                        className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden"
                      >
                        <div className={clsx("absolute top-0 inset-x-0 h-1.5", statusClass(a.status).replace("bg-", "bg-").split(" ")[0])} />
                        
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="font-bold text-foreground text-lg">{a.customer?.name}</span>
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                              <Scissors className="h-3 w-3" />
                              {a.service?.name}
                            </div>
                          </div>
                          <span className={clsx("rounded-xl px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm", statusClass(a.status))}>
                            {t(a.status)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 border-t border-border pt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl">
                            <Clock className="h-4 w-4 text-primary" />
                            {fmtTime(dt)}
                          </div>
                          <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl flex-1">
                            <User className="h-4 w-4 text-primary" />
                            <span className="truncate">{a.employee?.name}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Array.from(apptsByDay.values()).flat().length === 0 && !loading && (
             <div className="py-20 text-center flex flex-col items-center justify-center gap-6 opacity-20">
               <CalendarIcon className="h-16 w-16" />
               <p className="text-lg font-bold uppercase tracking-[0.2em]">{t("No Appointments")}</p>
             </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-2xl rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-6 sm:px-10 py-5 sm:py-8 bg-muted/20">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <CalendarIcon className="h-7 w-7" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold text-foreground">{editApptId ? t("Edit Appointment") : t("Book Appointment")}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Fill in the details below")}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setOpen(false)} 
                  className="h-12 w-12 rounded-full hover:bg-muted flex items-center justify-center transition-all hover:rotate-90"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                <div className="grid grid-cols-2 gap-6 p-6 rounded-[2rem] bg-muted/30 border border-border shadow-inner">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Date")}</label>
                    <div className="relative">
                      <CalendarIcon className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="date"
                        className="w-full rounded-2xl border border-border bg-card ps-11 pe-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-start"
                        value={slotDate ? `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}` : ''}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const [y, m, d] = e.target.value.split('-');
                          const newDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                          if (slotDate) newDate.setHours(slotDate.getHours(), slotDate.getMinutes());
                          setSlotDate(newDate);
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Time")}</label>
                    <div className="relative">
                      <Clock className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="time"
                        className="w-full rounded-2xl border border-border bg-card ps-11 pe-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-start"
                        value={slotDate ? `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}` : ''}
                        onChange={(e) => {
                          if (!e.target.value || !slotDate) return;
                          const [h, m] = e.target.value.split(':');
                          const d = new Date(slotDate);
                          d.setHours(parseInt(h), parseInt(m));
                          setSlotDate(d);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Customer")}</label>
                  <div className="relative group">
                    <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      value={customerQ}
                      onChange={(e) => setCustomerQ(e.target.value)}
                      placeholder={t("Search by name or phone...")}
                    />
                    <AnimatePresence>
                      {customers.length > 0 && !customerId && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute bottom-full inset-x-0 mb-4 max-h-64 overflow-auto rounded-[2rem] border border-border shadow-2xl bg-card z-10 p-2"
                        >
                          {customers.map((c) => (
                            <button 
                              key={c.id} 
                              onClick={() => { setCustomerId(c.id); setCustomerQ(c.name); }} 
                              className="flex w-full items-center justify-between px-6 py-4 rounded-2xl text-start text-sm hover:bg-muted transition-all group/item"
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">{c.name[0]}</div>
                                <div className="text-start">
                                  <span className="font-bold text-foreground block">{c.name}</span>
                                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest">{c.phone}</span>
                                </div>
                              </div>
                              <ChevronRight className={clsx("h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-all", i18n.language === "ar" && "rotate-180")} />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {customerId && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span className="text-sm font-bold text-foreground">{customerQ}</span>
                      </div>
                      <button onClick={() => { setCustomerId(""); setCustomerQ(""); }} className="text-xs font-bold text-rose-500 hover:underline">{t("Remove")}</button>
                    </motion.div>
                  )}
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Service")}</label>
                    <div className="relative">
                      <Scissors className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select 
                        className="w-full appearance-none rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-12 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer" 
                        value={serviceId} 
                        onChange={(e) => setServiceId(e.target.value)}
                      >
                        {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.durationMins} {t("min")})</option>)}
                      </select>
                      <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Specialist")}</label>
                    <div className="relative">
                      <User className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select 
                        className="w-full appearance-none rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-12 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer" 
                        value={employeeId} 
                        onChange={(e) => setEmployeeId(e.target.value)}
                      >
                        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>

                {editApptId && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Status")}</label>
                    <div className="relative">
                      <Clock className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select 
                        className="w-full appearance-none rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-12 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer" 
                        value={status} 
                        onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                      >
                        <option value={AppointmentStatus.SCHEDULED}>{t("SCHEDULED")}</option>
                        <option value="CONFIRMED">{t("CONFIRMED")}</option>
                        <option value={AppointmentStatus.COMPLETED}>{t("COMPLETED")}</option>
                        <option value={AppointmentStatus.CANCELLED}>{t("CANCELLED")}</option>
                        <option value={AppointmentStatus.NO_SHOW}>{t("NO_SHOW")}</option>
                      </select>
                      <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  {editApptId && (
                    <button
                      onClick={() => void deleteAppt(editApptId)}
                      className="w-16 h-16 shrink-0 rounded-[2rem] bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center flex-col gap-1 border border-rose-500/20 active:scale-95"
                      title={t("Delete")}
                    >
                      <XCircle className="h-6 w-6" />
                    </button>
                  )}
                  <button
                    disabled={busy || !customerId}
                    onClick={submitBooking}
                    className="group relative flex-1 h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <CheckCircle2 className="h-6 w-6 relative z-10" />
                    <span className="text-lg relative z-10">{editApptId ? t("Save Changes") : t("Confirm Booking")}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
