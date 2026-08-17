import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Clock,
  User, Scissors, Search, Bell, CheckCircle2, Calendar as CalendarIcon,
  Filter, MoreVertical, Phone, MapPin, Sparkles, XCircle, UserPlus
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { getDisplayName, getInitials } from "../shared/displayName";
import {
  formatSalonDate,
  formatSalonTime,
  formatSalonDayHeader,
  formatSalonWeekdayLong,
} from "../shared/dateTime";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { ScreenState } from "../shared/components/ScreenState";
import { PageHeader } from "../shared/components/PageHeader";
import { Modal } from "../shared/components/Modal";

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
  const service = mapService(a.service || {});
  if (Number.isInteger(a.durationMinutesSnapshot) && a.durationMinutesSnapshot > 0) {
    service.durationMins = a.durationMinutesSnapshot;
  }
  return {
    ...a,
    customer: mapCustomer(a.customer || {}),
    employee: mapEmployee(a.employee || {}),
    service,
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
  return formatSalonDayHeader(d, i18n.language);
}

function fmtTime(d: Date) {
  return formatSalonTime(d, i18n.language);
}

function statusClass(s: AppointmentStatus | string) {
  switch (s) {
    case AppointmentStatus.SCHEDULED: return "bg-warning/10 text-warning border-warning/20";
    case "CONFIRMED": return "bg-info/10 text-info border-info/20";
    case AppointmentStatus.COMPLETED: return "bg-success/10 text-success border-success/20";
    case AppointmentStatus.CANCELLED: return "bg-destructive/10 text-destructive border-destructive/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function AppointmentsPage() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  // Portrait phones: day first. Week view on a 320–360px screen is unreadable.
  const [mode, setMode] = useState<"day" | "week">(() =>
    typeof window !== "undefined" && window.innerWidth < 1024 ? "day" : "week"
  );
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [noShowFeeAmount, setNoShowFeeAmount] = useState(0);
  const [chargeNoShowFee, setChargeNoShowFee] = useState(true);
  const [noShowNote, setNoShowNote] = useState("");

  // Status filter: ALL | SCHEDULED | COMPLETED | CANCELLED | NO_SHOW
  const [statusFilter, setStatusFilter] = useState<"ALL" | AppointmentStatus>("ALL");

  // Inline "create customer" inside the booking dialog
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerSearchDone, setCustomerSearchDone] = useState(false);
  const customerSearchRequestRef = useRef(0);

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
    setLoadError(null);
    try {
      const [sv, em, a] = await Promise.all([
        unwrap(useCases.services.list()),
        unwrap(useCases.employees.list()),
        unwrap(useCases.appointments.list({ fromISO: range.from.toISOString(), toISO: range.to.toISOString() })),
      ]);
      setServices(sv.filter((service) => service.isActive !== false).map(mapService));
      setEmployees(em.filter((employee) => employee.isActive !== false).map(mapEmployee));
      setAppts(a.map(mapAppt));
      if (sv.length && !serviceId) setServiceId(sv[0].id);
      if (em.length && !employeeId) setEmployeeId(em[0].id);
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [range.from.getTime(), range.to.getTime()]);

  useEffect(() => {
    setCustomerSearchDone(false);
    const requestId = ++customerSearchRequestRef.current;
    const timer = setTimeout(async () => {
      const q = customerQ.trim();
      if (!q) {
        if (requestId === customerSearchRequestRef.current) {
          setCustomers([]);
          setCustomerSearchDone(true);
        }
        return;
      }
      try {
        const res = await unwrap(useCases.customers.list(q));
        if (requestId === customerSearchRequestRef.current) setCustomers(res.map(mapCustomer));
      } catch {
        if (requestId === customerSearchRequestRef.current) setCustomers([]);
      } finally {
        if (requestId === customerSearchRequestRef.current) setCustomerSearchDone(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQ]);

  /** Inline flow: «عميل جديد → حجز موعد» بدون مغادرة الحوار. */
  async function handleCreateCustomerInline() {
    const name = customerQ.trim();
    if (!name || creatingCustomer) return;
    setCreatingCustomer(true);
    try {
      const created = await unwrap(useCases.customers.create({ name }));
      setCustomerId(created.id);
      setCustomerQ(created.name);
      setCustomers([]);
      showToast('success', t("Success"), t("Customer created successfully"));
    } catch (err: any) {
      showToast('error', t("Error"), err?.message || String(err));
    } finally {
      setCreatingCustomer(false);
    }
  }

  /** Quick status action from the edit dialog (explicit Arabic actions). */
  async function setApptStatus(appt: Appt, next: AppointmentStatus) {
    if (appt.status !== AppointmentStatus.SCHEDULED || next === AppointmentStatus.SCHEDULED) {
      showToast('error', t("Error"), t("Terminal appointments cannot be changed"));
      return;
    }
    setBusy(true);
    try {
      await unwrap(useCases.appointments.update(appt.id, { status: next }));
      showToast('success', t("Success"), t("Appointment updated successfully"));
      await load();
      setOpen(false);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    } finally {
      setBusy(false);
    }
  }

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
    setDepositAmount(0);
    setNoShowFeeAmount(0);
    setChargeNoShowFee(true);
    setNoShowNote("");
  }

  function openEditBooking(appt: Appt) {
    setEditApptId(appt.id);
    setSlotDate(new Date(appt.dateTime));
    setCustomerId(appt.customerId);
    setCustomerQ(appt.customer?.name || "");
    setStatus(appt.status);
    setServiceId(appt.serviceId ?? "");
    setEmployeeId(appt.employeeId ?? "");
    setDepositAmount(appt.depositAmount ?? 0);
    setNoShowFeeAmount(appt.noShowFeeAmount ?? 0);
    setChargeNoShowFee((appt.noShowFeeAmount ?? 0) > 0 || (appt.depositAmount ?? 0) > 0);
    setNoShowNote(appt.noShowNote ?? "");
    setOpen(true);
  }

  async function submitBooking() {
    if (!slotDate) return;
    const existingAppointment = editApptId ? appts.find((entry) => entry.id === editApptId) : undefined;
    if (existingAppointment && existingAppointment.status !== AppointmentStatus.SCHEDULED) {
      return showToast('error', t("Error"), t("Terminal appointments cannot be changed"));
    }
    if (!customerId) return showToast('error', t("Error"), t("Please select a customer"));
    if (!serviceId) return showToast('error', t("Error"), t("Please select a service"));
    if (!employeeId) return showToast('error', t("Error"), t("Please select an employee"));
    if (isNaN(Number(depositAmount)) || Number(depositAmount) < 0) return showToast('error', t("Error"), t("Deposit cannot be negative"));
    if (isNaN(Number(noShowFeeAmount)) || Number(noShowFeeAmount) < 0) return showToast('error', t("Error"), t("No-show fee cannot be negative"));

    setBusy(true);
    try {
      if (editApptId) {
        await unwrap(useCases.appointments.update(editApptId, {
          dateTime: slotDate,
          status,
          customerId,
          employeeId,
          serviceId,
          depositAmount,
          noShowFeeAmount,
          noShowNote: noShowNote || undefined,
        }));
        showToast('success', t("Success"), t("Appointment updated successfully"));
      } else {
        await unwrap(useCases.appointments.create({
          dateTime: slotDate,
          status,
          customerId,
          employeeId,
          serviceId,
          depositAmount,
          noShowFeeAmount,
          noShowNote: noShowNote || undefined,
        }));
        showToast('success', t("Success"), t("Appointment created successfully"));
      }
      await load();
      setOpen(false);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReminder(appt: Appt) {
    if (!appt.customer?.phone) return showToast('error', t("Error"), t("Customer phone number not found"));
    try {
      setBusy(true);
      await unwrap(useCases.appointments.sendReminder(appt.id));
      showToast('success', t("Success"), t("Reminder sent successfully"));
    } catch (e) {
      const error = e as Error & { code?: string };
      const message = error.code === "BACKEND_METHOD_UNSUPPORTED"
        ? t("Automated reminders are unavailable; use the manual WhatsApp action instead.")
        : (error.message || String(error));
      showToast('error', t("Error"), message);
    } finally {
      setBusy(false);
    }
  }

  // Stats
  const apptStats = useMemo(() => ({
    total: appts.length,
    scheduled: appts.filter(a => a.status === AppointmentStatus.SCHEDULED).length,
    completed: appts.filter(a => a.status === AppointmentStatus.COMPLETED).length,
    cancelled: appts.filter(a => a.status === AppointmentStatus.CANCELLED).length,
    noShow: appts.filter(a => a.status === AppointmentStatus.NO_SHOW).length,
    protected: appts.filter(a => (a.depositAmount ?? 0) > 0 || (a.noShowFeeAmount ?? 0) > 0).length,
  }), [appts]);

  const filteredAppts = useMemo(() => {
    if (statusFilter === "ALL") return appts;
    return appts.filter(a => a.status === statusFilter);
  }, [appts, statusFilter]);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appt[]>();
    for (const a of filteredAppts) {
      const d = startOfDay(new Date(a.dateTime)).toISOString();
      map.set(d, [...(map.get(d) ?? []), a]);
    }
    return map;
  }, [filteredAppts]);

  const bookingFooter = (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={busy || !customerId || (!!editApptId && status !== AppointmentStatus.SCHEDULED)}
        onClick={submitBooking}
        className="group relative flex-1 min-h-14 rounded-2xl bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden touch-target"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        <CheckCircle2 className="h-6 w-6 relative z-10" />
        <span className="text-base sm:text-lg relative z-10">{editApptId ? t("Save Changes") : t("Confirm Booking")}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={<CalendarDays className="h-7 w-7 sm:h-8 sm:w-8" />}
        title={t("Appointments")}
        subtitle={t("Manage your spa schedule")}
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2 bg-muted/50 p-1.5 rounded-[1.5rem] border border-border shadow-inner w-full justify-center sm:justify-start">
              <button
                onClick={() => setAnchor(new Date())}
                className="min-h-11 px-4 sm:px-5 py-2.5 text-xs font-bold text-foreground hover:bg-card rounded-xl transition-all shadow-sm"
              >
                {t("Today")}
              </button>
              <div className="flex items-center border-x border-border/50 px-1 sm:px-2 gap-1 sm:gap-2">
                <button
                  onClick={() => setAnchor(d => mode === "day" ? addDays(d, -1) : addDays(d, -7))}
                  className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                  title={t("Previous")}
                >
                  {i18n.language === "ar" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => setAnchor(d => mode === "day" ? addDays(d, 1) : addDays(d, 7))}
                  className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                  title={t("Next")}
                >
                  {i18n.language === "ar" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMode("day")}
                  className={clsx(
                    "min-h-11 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                    mode === "day" ? "bg-card text-primary shadow-md" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("Day")}
                </button>
                <button
                  onClick={() => setMode("week")}
                  className={clsx(
                    "min-h-11 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                    mode === "week" ? "bg-card text-primary shadow-md" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("Week")}
                </button>
              </div>
            </div>
            <button
              onClick={() => openBooking()}
              className="h-13 min-h-[52px] px-6 sm:px-8 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
              {t("New Appointment")}
            </button>
          </>
        }
      />

      {/* Status filter — فصل واضح بين القادم والمنتهي والملغي */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { id: "ALL", label: t("All") },
          { id: AppointmentStatus.SCHEDULED, label: t("Upcoming") },
          { id: AppointmentStatus.COMPLETED, label: t("Completed") },
          { id: AppointmentStatus.CANCELLED, label: t("Canceled") },
          { id: AppointmentStatus.NO_SHOW, label: t("No-show") },
        ] as { id: "ALL" | AppointmentStatus; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className={clsx(
              "min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
              statusFilter === id
                ? "bg-primary text-primary-foreground border-primary/20 shadow-md"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats — horizontal chips on small phones so the timeline stays above the fold */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:overflow-visible sm:pb-0 sm:gap-4">
        {[
          { label: t('Total'), value: apptStats.total, color: 'text-primary', bg: 'bg-primary/10', icon: CalendarDays },
          { label: t('Scheduled'), value: apptStats.scheduled, color: 'text-warning', bg: 'bg-warning/10', icon: Clock },
          { label: t('Completed'), value: apptStats.completed, color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
          { label: t('No-Show'), value: apptStats.noShow, color: 'text-warning', bg: 'bg-warning/10', icon: Bell },
          { label: t('Protected Appointments'), value: apptStats.protected, color: 'text-info', bg: 'bg-info/10', icon: Sparkles },
          { label: t('Cancelled'), value: apptStats.cancelled, color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
        ].map(({ label, value, color, bg, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="min-w-[132px] shrink-0 sm:min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm hover:shadow-md transition-all"
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
          {loading ? (
            <div className="min-h-[400px]">
              <ScreenState state="loading" title={t("Loading appointments...")} compact />
            </div>
          ) : loadError ? (
            <div className="min-h-[400px]">
              <ScreenState
                state="error"
                title={t("Failed to load appointments")}
                description={t("Something went wrong while loading. Try again.")}
                actionLabel="Retry"
                onAction={load}
                errorDetail={loadError}
                compact
              />
            </div>
          ) : Array.from(apptsByDay.values()).flat().length === 0 ? (
            <div className="min-h-[400px]">
              <ScreenState
                state="empty"
                icon={<CalendarIcon className="h-6 w-6" />}
                title={t("No Appointments")}
                description={t("Book an appointment to get started")}
                actionLabel="New Appointment"
                onAction={() => openBooking()}
                compact
              />
            </div>
          ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[1200px]">
              <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: `120px repeat(${range.days.length}, 1fr)` }}>
                <div className="p-8 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-muted-foreground/40" />
                </div>
                {range.days.map((d) => (
                  <div key={d.toISOString()} className="border-r border-border/50 p-8 text-center space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{formatSalonWeekdayLong(d, i18n.language)}</div>
                    <div className="text-2xl font-bold text-foreground">{formatSalonDate(d, i18n.language)}</div>
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
          )}
        </div>

        {/* Mobile View - Timeline style for today */}
        <div className="lg:hidden space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-border bg-card/50">
              <ScreenState state="loading" title={t("Loading appointments...")} compact />
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-border bg-card/50">
              <ScreenState
                state="error"
                title={t("Failed to load appointments")}
                description={t("Something went wrong while loading. Try again.")}
                actionLabel="Retry"
                onAction={load}
                errorDetail={loadError}
                compact
              />
            </div>
          ) : Array.from(apptsByDay.values()).flat().length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/50">
              <ScreenState
                state="empty"
                icon={<CalendarIcon className="h-6 w-6" />}
                title={t("No Appointments")}
                description={t("Book an appointment to get started")}
                actionLabel="New Appointment"
                onAction={() => openBooking()}
                compact
              />
            </div>
          ) : (
            range.days.filter((day) => {
              // Week-on-phone: skip empty days so the timeline is not a wall of blanks.
              if (mode === "day" || window.innerWidth >= 1024) return true;
              const key = startOfDay(day).toISOString();
              const isToday = startOfDay(new Date()).toISOString() === key;
              return isToday || (apptsByDay.get(key)?.length ?? 0) > 0;
            }).map((day) => {
              const dayKey = startOfDay(day).toISOString();
              const dayAppts = (apptsByDay.get(dayKey) ?? []).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
              const isToday = startOfDay(new Date()).toISOString() === dayKey;

              return (
                <div key={`mobile-${dayKey}`} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <h3 className={clsx(
                        "font-bold uppercase tracking-wider",
                        isToday ? "text-primary text-sm" : "text-muted-foreground text-xs"
                      )}>
                        {fmtDayHeader(day)}
                      </h3>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">
                          {t("Today")}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => openBooking(slotToDate(day, 9 * 2))}
                      className="h-10 px-3 text-xs font-bold text-primary flex items-center gap-1.5 hover:bg-primary/10 rounded-lg transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("Add")}</span>
                    </button>
                  </div>

                  {dayAppts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-6 text-center">
                      <p className="text-xs font-bold text-muted-foreground">{t("No appointments for this day")}</p>
                    </div>
                  ) : isToday ? (
                    // Today's Timeline View - vertical timeline with clear time/employee/status
                    <div className="relative">
                      {dayAppts.map((a, idx) => {
                        const dt = new Date(a.dateTime);
                        const isFirst = idx === 0;
                        const isLast = idx === dayAppts.length - 1;
                        return (
                          <div key={`m-${a.id}`} className="flex gap-3">
                            {/* Timeline connector */}
                            <div className="flex flex-col items-center">
                              <div className={clsx(
                                "h-10 w-10 rounded-xl flex items-center justify-center text-[10px] font-bold shadow-sm z-10",
                                statusClass(a.status)
                              )}>
                                {a.status === AppointmentStatus.SCHEDULED ? (
                                  <Clock className="h-4 w-4" />
                                ) : a.status === AppointmentStatus.COMPLETED ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </div>
                              {!isLast && <div className="w-0.5 flex-1 bg-border/50 my-1" />}
                            </div>
                            
                            {/* Card content */}
                            <motion.button
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                              onClick={() => openEditBooking(a)}
                              className="flex-1 min-h-[72px] bg-card border border-border rounded-xl p-3 mb-3 text-start shadow-sm hover:shadow-md hover:border-primary/30 transition-all touch-target"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-foreground truncate">{a.customer?.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{a.service?.name}</p>
                                </div>
                                <span className={clsx("px-2 py-1 rounded-lg text-[9px] font-bold shrink-0", statusClass(a.status))}>
                                  {t(a.status)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-primary" />
                                  {fmtTime(dt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-primary" />
                                  {a.employee?.name || "—"}
                                </span>
                              </div>
                            </motion.button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Other days - compact list
                    <div className="space-y-2">
                      {dayAppts.map(a => {
                        const dt = new Date(a.dateTime);
                        return (
                          <motion.button
                            key={`m-${a.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => openEditBooking(a)}
                            className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 text-start shadow-sm hover:shadow-md hover:border-primary/30 transition-all touch-target"
                          >
                            <div className={clsx("h-10 w-14 rounded-lg flex items-center justify-center text-xs font-bold", statusClass(a.status))}>
                              {fmtTime(dt)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground truncate">{a.customer?.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{a.service?.name}</p>
                            </div>
                            <ChevronRight className={clsx("h-4 w-4 text-muted-foreground shrink-0", isRtl && "rotate-180")} />
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
          
          {/* Sticky Quick Book FAB */}
          <button
            type="button"
            onClick={() => openBooking()}
            aria-label={t("New Appointment")}
            className="fixed end-4 above-bottom-nav z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all lg:hidden touch-target"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </motion.div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <span>{editApptId ? t("Edit Appointment") : t("Book Appointment")}</span>
          </span>
        }
        description={t("Fill in the details below")}
        footer={bookingFooter}
        disableClose={busy}
        className="sm:max-w-2xl sm:rounded-[3rem]"
      >
        <div className="space-y-6 sm:space-y-8 sm:p-5">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 rounded-[2rem] bg-muted/30 border border-border shadow-inner">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Date")}</label>
                    <div className="relative">
                      <CalendarIcon className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="date"
                        dir="ltr"
                        lang="en"
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
                      {slotDate && (
                        <p className="mt-1 ms-2 text-[11px] font-bold text-muted-foreground" dir="auto">{formatSalonDate(slotDate, i18n.language)}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Time")}</label>
                    <div className="relative">
                      <Clock className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="time"
                        dir="ltr"
                        lang="en"
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
                      {slotDate && (
                        <p className="mt-1 ms-2 text-[11px] font-bold text-muted-foreground" dir="auto">{formatSalonTime(slotDate, i18n.language)}</p>
                      )}
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
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">{getInitials(c, "·")}</div>
                                <div className="text-start">
                                  <span className="font-bold text-foreground block">{getDisplayName(c, t("Unnamed"))}</span>
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
                  {!customerId && customerQ.trim().length > 0 && customerSearchDone && customers.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4"
                    >
                      <p className="text-xs font-bold text-muted-foreground mb-2">{t("Customer not found")}</p>
                      <button
                        onClick={() => void handleCreateCustomerInline()}
                        disabled={creatingCustomer}
                        className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                      >
                        <UserPlus className="h-4 w-4" />
                        {creatingCustomer ? t("Creating...") : `${t("Create customer")}: ${customerQ.trim()}`}
                      </button>
                    </motion.div>
                  )}
                  {customerId && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground truncate">{customerQ}</span>
                      </div>
                      <button onClick={() => { setCustomerId(""); setCustomerQ(""); }} className="text-xs font-bold text-destructive hover:underline shrink-0 ms-2">{t("Remove")}</button>
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
                        {employees.map((e) => <option key={e.id} value={e.id}>{getDisplayName(e, t("Unnamed"))}</option>)}
                      </select>
                      <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Deposit Amount")}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 px-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("No-Show Fee")}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 px-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      value={noShowFeeAmount}
                      onChange={(e) => setNoShowFeeAmount(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("No-Show Policy Note")}</label>
                  <textarea
                    className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 px-6 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all min-h-[96px] resize-y"
                    value={noShowNote}
                    onChange={(e) => setNoShowNote(e.target.value)}
                    placeholder={t("Optional deposit or no-show policy details") }
                  />
                </div>

                {editApptId && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Status")}</label>
                    <div className={clsx("rounded-[1.5rem] border px-6 py-4 text-sm font-bold", statusClass(status))}>
                      {t(status)}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {editApptId && status === AppointmentStatus.SCHEDULED && (
                    <div className="rounded-[1.5rem] border border-warning/20 bg-warning/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-warning">{t("Mark as No-Show")}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {t("Manual no-show fee record")}: {Math.max(depositAmount, noShowFeeAmount).toFixed(2)} {t("OMR")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("Recording this amount does not create a payment or invoice.")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <input
                            type="checkbox"
                            checked={chargeNoShowFee}
                            onChange={(e) => setChargeNoShowFee(e.target.checked)}
                          />
                          {t("Record no-show fee")}
                        </label>
                        <button
                          onClick={async () => {
                            if (!editApptId) return;
                            setBusy(true);
                            try {
                              const res = await unwrap(useCases.appointments.markNoShow(editApptId, { chargeNoShowFee, note: noShowNote || undefined }));
                              const feeNote = chargeNoShowFee
                                ? `${t("No-show fee recorded (not collected)")}: ${res.chargedAmount.toFixed(2)} ${t("OMR")}`
                                : t("No-show saved");
                              showToast('success', t("Success"), feeNote);
                              await load();
                              setOpen(false);
                            } catch (err: any) {
                              showToast('error', t("Error"), err?.message || t("Failed to mark no-show"));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="h-12 px-5 rounded-2xl bg-warning text-white font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                          disabled={busy}
                        >
                          {t("Mark as No-Show")}
                        </button>
                      </div>
                    </div>
                  )}

                  {editApptId && status === AppointmentStatus.SCHEDULED && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { const appt = appts.find(a => a.id === editApptId); if (appt) void setApptStatus(appt, AppointmentStatus.COMPLETED); }}
                        disabled={busy}
                        className="h-12 rounded-2xl bg-success/10 text-success border border-success/20 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-success hover:text-white transition-all active:scale-95"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("Complete Appointment")}
                      </button>
                      <button
                        onClick={() => { const appt = appts.find(a => a.id === editApptId); if (appt) void setApptStatus(appt, AppointmentStatus.CANCELLED); }}
                        disabled={busy}
                        className="h-12 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-destructive hover:text-white transition-all active:scale-95"
                      >
                        <XCircle className="h-4 w-4" />
                        {t("Cancel Appointment")}
                      </button>
                    </div>
                  )}

                </div>
              </div>
      </Modal>
    </div>
  );
}
