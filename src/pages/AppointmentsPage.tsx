import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Clock,
  User, Scissors, Bell, CheckCircle2, Calendar as CalendarIcon,
  MoreVertical, Sparkles, XCircle
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import {
  formatSalonDate,
  formatSalonWeekdayLong,
} from "../shared/dateTime";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import i18n from "i18next";
import { ScreenState } from "../shared/components/ScreenState";
import { PageHeader } from "../shared/components/PageHeader";

import { AppointmentStatus, Appointment, VisitStage } from "../domain/entities";
import { effectiveVisitStage, allowedVisitStages } from "../domain/visit";
import {
  Appt,
  Service,
  Employee,
  Customer,
  SLOT_MINS,
  visitStageLabel,
  visitActionLabel,
  mapService,
  mapEmployee,
  mapCustomer,
  mapAppt,
  startOfDay,
  addDays,
  startOfWeek,
  fmtDayHeader,
  fmtTime,
  statusClass,
  paymentStateLabel,
} from "./appointments/helpers";
import { AppointmentBookingDialog } from "./appointments/AppointmentBookingDialog";

export default function AppointmentsPage() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  /** Advance a scheduled visit to its next operational stage (server-enforced). */
  async function advanceVisit(appt: Appt, nextStage: VisitStage) {
    if (appt.status !== AppointmentStatus.SCHEDULED) {
      showToast('error', t("Error"), t("Terminal appointments cannot be changed"));
      return;
    }
    setBusy(true);
    try {
      await unwrap(useCases.appointments.transitionVisit(appt.id, nextStage));
      showToast('success', t("Success"), t("Visit stage updated"));
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

  /**
   * Visit → POS handoff. A visit that reached READY_FOR_CHECKOUT is completed
   * through checkout/payment (the server-authoritative path), never by another
   * local stage transition. Navigate to POS with the appointment id so the
   * sale is prepared from the actual visit.
   */
  function openPosForVisit(appt: Appt) {
    navigate(`/pos?appointment=${encodeURIComponent(appt.id)}`);
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

  /** Mark the edited appointment as no-show (optional fee note). */
  async function handleMarkNoShow() {
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
  }

  /** Cancel the edited appointment from the dialog. */
  function handleCancelAppointment() {
    const appt = appts.find(a => a.id === editApptId);
    if (appt) void setApptStatus(appt, AppointmentStatus.CANCELLED);
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
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] font-bold mt-2">
                                    <div className="flex items-center gap-2 bg-white/20 px-2 py-1 rounded-lg">
                                      <Clock className="h-3 w-3" />
                                      <span>{fmtTime(dt)}</span>
                                    </div>
                                    <span className="rounded-lg bg-white/20 px-2 py-1">{t(a.status)}</span>
                                    <span className="rounded-lg bg-muted/60 px-2 py-1">{paymentStateLabel(a, t)}</span>
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
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  <span className={clsx("px-2 py-1 rounded-lg text-[9px] font-bold shrink-0", statusClass(a.status))}>
                                    {t(a.status)}
                                  </span>
                                  <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[9px] font-bold shrink-0">
                                    {paymentStateLabel(a, t)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-primary" />
                                  {fmtTime(dt)}
                                </span>
                                <span className="flex items-center gap-1 min-w-0 truncate">
                                  <User className="h-3 w-3 text-primary shrink-0" />
                                  {a.employee?.name || "—"}
                                </span>
                                <span className="ms-auto shrink-0 text-[9px] font-bold text-primary">
                                  {a.status === AppointmentStatus.SCHEDULED ? t("Next: Check in") : t("Open appointment")}
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

      <AppointmentBookingDialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        editApptId={editApptId}
        footer={bookingFooter}
        slotDate={slotDate}
        onSlotDateChange={(d) => setSlotDate(d)}
        customerQ={customerQ}
        onCustomerQChange={(q) => setCustomerQ(q)}
        customers={customers}
        customerId={customerId}
        onSelectCustomer={(id, name) => { setCustomerId(id); setCustomerQ(name); }}
        onClearCustomer={() => { setCustomerId(""); setCustomerQ(""); }}
        customerSearchDone={customerSearchDone}
        creatingCustomer={creatingCustomer}
        onCreateCustomer={() => void handleCreateCustomerInline()}
        services={services}
        serviceId={serviceId}
        onServiceChange={(id) => setServiceId(id)}
        employees={employees}
        employeeId={employeeId}
        onEmployeeChange={(id) => setEmployeeId(id)}
        depositAmount={depositAmount}
        onDepositChange={(v) => setDepositAmount(v)}
        noShowFeeAmount={noShowFeeAmount}
        onNoShowFeeChange={(v) => setNoShowFeeAmount(v)}
        noShowNote={noShowNote}
        onNoShowNoteChange={(v) => setNoShowNote(v)}
        status={status}
        appts={appts}
        chargeNoShowFee={chargeNoShowFee}
        onChargeNoShowFeeChange={(v) => setChargeNoShowFee(v)}
        onMarkNoShow={() => void handleMarkNoShow()}
        onCancelAppointment={handleCancelAppointment}
        onOpenPos={openPosForVisit}
        onAdvance={(appt, stage) => void advanceVisit(appt, stage)}
      />
    </div>
  );
}
