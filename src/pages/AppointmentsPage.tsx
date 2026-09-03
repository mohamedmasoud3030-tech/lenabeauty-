import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCases } from "../app/composition/useCases";
import { AppointmentStatus, VisitStage } from "../domain/entities";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import {
  Appt,
  Service,
  Employee,
  Customer,
  SLOT_MINS,
  mapService,
  mapEmployee,
  mapCustomer,
  mapAppt,
  startOfDay,
  addDays,
  startOfWeek,
} from "./appointments/helpers";
import { AppointmentBookingDialog } from "./appointments/AppointmentBookingDialog";
import { AppointmentsOverview } from "./appointments/AppointmentsOverview";
import { AppointmentsSchedule } from "./appointments/AppointmentsSchedule";

export default function AppointmentsPage() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRtl = i18n.language === "ar";
  const [mode, setMode] = useState<"day" | "week">(() =>
    typeof window !== "undefined" && window.innerWidth < 1024 ? "day" : "week",
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
  const [customerId, setCustomerId] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>(AppointmentStatus.SCHEDULED);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [noShowFeeAmount, setNoShowFeeAmount] = useState(0);
  const [chargeNoShowFee, setChargeNoShowFee] = useState(true);
  const [noShowNote, setNoShowNote] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AppointmentStatus>("ALL");

  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerSearchDone, setCustomerSearchDone] = useState(false);
  const customerSearchRequestRef = useRef(0);

  const range = useMemo(() => {
    if (mode === "day") {
      const from = startOfDay(anchor);
      return { from, to: addDays(from, 1), days: [from] };
    }
    const from = startOfWeek(anchor);
    return {
      from,
      to: addDays(from, 7),
      days: Array.from({ length: 7 }, (_, i) => addDays(from, i)),
    };
  }, [mode, anchor]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [serviceRows, employeeRows, appointmentRows] = await Promise.all([
        unwrap(useCases.services.list()),
        unwrap(useCases.employees.list()),
        unwrap(useCases.appointments.list({
          fromISO: range.from.toISOString(),
          toISO: range.to.toISOString(),
        })),
      ]);
      setServices(serviceRows.filter((service) => service.isActive !== false).map(mapService));
      setEmployees(employeeRows.filter((employee) => employee.isActive !== false).map(mapEmployee));
      setAppts(appointmentRows.map(mapAppt));
      if (serviceRows.length && !serviceId) setServiceId(serviceRows[0].id);
      if (employeeRows.length && !employeeId) setEmployeeId(employeeRows[0].id);
    } catch (error: any) {
      console.error(error);
      setLoadError(error?.message || String(error));
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
      const query = customerQ.trim();
      if (!query) {
        if (requestId === customerSearchRequestRef.current) {
          setCustomers([]);
          setCustomerSearchDone(true);
        }
        return;
      }
      try {
        const result = await unwrap(useCases.customers.list(query));
        if (requestId === customerSearchRequestRef.current) setCustomers(result.map(mapCustomer));
      } catch {
        if (requestId === customerSearchRequestRef.current) setCustomers([]);
      } finally {
        if (requestId === customerSearchRequestRef.current) setCustomerSearchDone(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQ]);

  async function handleCreateCustomerInline() {
    const name = customerQ.trim();
    if (!name || creatingCustomer) return;
    setCreatingCustomer(true);
    try {
      const created = await unwrap(useCases.customers.create({ name }));
      setCustomerId(created.id);
      setCustomerQ(created.name);
      setCustomers([]);
      showToast("success", t("Success"), t("Customer created successfully"));
    } catch (error: any) {
      showToast("error", t("Error"), error?.message || String(error));
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function setApptStatus(appt: Appt, next: AppointmentStatus) {
    if (appt.status !== AppointmentStatus.SCHEDULED || next === AppointmentStatus.SCHEDULED) {
      showToast("error", t("Error"), t("Terminal appointments cannot be changed"));
      return;
    }
    setBusy(true);
    try {
      await unwrap(useCases.appointments.update(appt.id, { status: next }));
      showToast("success", t("Success"), t("Appointment updated successfully"));
      await load();
      setOpen(false);
    } catch (error: any) {
      if (error.code === "BACKEND_METHOD_UNSUPPORTED") {
        showToast("error", t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
        showToast("error", t("Error"), error?.message || String(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function advanceVisit(appt: Appt, nextStage: VisitStage) {
    if (appt.status !== AppointmentStatus.SCHEDULED) {
      showToast("error", t("Error"), t("Terminal appointments cannot be changed"));
      return;
    }
    setBusy(true);
    try {
      await unwrap(useCases.appointments.transitionVisit(appt.id, nextStage));
      showToast("success", t("Success"), t("Visit stage updated"));
      await load();
      setOpen(false);
    } catch (error: any) {
      if (error.code === "BACKEND_METHOD_UNSUPPORTED") {
        showToast("error", t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
        showToast("error", t("Error"), error?.message || String(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function openPosForVisit(appt: Appt) {
    navigate(`/pos?appointment=${encodeURIComponent(appt.id)}`);
  }

  const slots = useMemo(() => {
    const count = (24 * 60) / SLOT_MINS;
    return Array.from({ length: count }, (_, i) => i);
  }, []);

  function slotToDate(day: Date, slotIdx: number) {
    const value = startOfDay(day);
    value.setMinutes(slotIdx * SLOT_MINS, 0, 0);
    return value;
  }

  function openBooking(date?: Date) {
    const targetDate = date || new Date();
    if (!date) {
      const minutes = targetDate.getMinutes();
      targetDate.setMinutes(minutes >= 30 ? 30 : 0, 0, 0);
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

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    openBooking();
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
    const existingAppointment = editApptId
      ? appts.find((entry) => entry.id === editApptId)
      : undefined;
    if (existingAppointment && existingAppointment.status !== AppointmentStatus.SCHEDULED) {
      showToast("error", t("Error"), t("Terminal appointments cannot be changed"));
      return;
    }
    if (!customerId) return showToast("error", t("Error"), t("Please select a customer"));
    if (!serviceId) return showToast("error", t("Error"), t("Please select a service"));
    if (!employeeId) return showToast("error", t("Error"), t("Please select an employee"));
    if (Number.isNaN(Number(depositAmount)) || Number(depositAmount) < 0) {
      return showToast("error", t("Error"), t("Deposit cannot be negative"));
    }
    if (Number.isNaN(Number(noShowFeeAmount)) || Number(noShowFeeAmount) < 0) {
      return showToast("error", t("Error"), t("No-show fee cannot be negative"));
    }

    setBusy(true);
    try {
      const input = {
        dateTime: slotDate,
        status,
        customerId,
        employeeId,
        serviceId,
        depositAmount,
        noShowFeeAmount,
        noShowNote: noShowNote || undefined,
      };
      if (editApptId) {
        await unwrap(useCases.appointments.update(editApptId, input));
        showToast("success", t("Success"), t("Appointment updated successfully"));
      } else {
        await unwrap(useCases.appointments.create(input));
        showToast("success", t("Success"), t("Appointment created successfully"));
      }
      await load();
      setOpen(false);
    } catch (error: any) {
      if (error.code === "BACKEND_METHOD_UNSUPPORTED") {
        showToast("error", t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
        showToast("error", t("Error"), error?.message || String(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkNoShow() {
    if (!editApptId) return;
    setBusy(true);
    try {
      const result = await unwrap(useCases.appointments.markNoShow(editApptId, {
        chargeNoShowFee,
        note: noShowNote || undefined,
      }));
      const feeNote = chargeNoShowFee
        ? `${t("No-show fee recorded (not collected)")}: ${result.chargedAmount.toFixed(2)} ${t("OMR")}`
        : t("No-show saved");
      showToast("success", t("Success"), feeNote);
      await load();
      setOpen(false);
    } catch (error: any) {
      showToast("error", t("Error"), error?.message || t("Failed to mark no-show"));
    } finally {
      setBusy(false);
    }
  }

  function handleCancelAppointment() {
    const appt = appts.find((entry) => entry.id === editApptId);
    if (appt) void setApptStatus(appt, AppointmentStatus.CANCELLED);
  }

  const filteredAppts = useMemo(() => {
    if (statusFilter === "ALL") return appts;
    return appts.filter((appt) => appt.status === statusFilter);
  }, [appts, statusFilter]);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appt[]>();
    for (const appt of filteredAppts) {
      const day = startOfDay(new Date(appt.dateTime)).toISOString();
      map.set(day, [...(map.get(day) ?? []), appt]);
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
        <span className="text-base sm:text-lg relative z-10">
          {editApptId ? t("Save Changes") : t("Confirm Booking")}
        </span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      <AppointmentsOverview
        appts={appts}
        mode={mode}
        setMode={setMode}
        setAnchor={setAnchor}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onNewAppointment={() => openBooking()}
      />

      <AppointmentsSchedule
        mode={mode}
        days={range.days}
        apptsByDay={apptsByDay}
        loading={loading}
        loadError={loadError}
        onRetry={load}
        slots={slots}
        slotToDate={slotToDate}
        onNewAppointment={openBooking}
        onOpenAppointment={openEditBooking}
        isRtl={isRtl}
      />

      <AppointmentBookingDialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        editApptId={editApptId}
        footer={bookingFooter}
        slotDate={slotDate}
        onSlotDateChange={(date) => setSlotDate(date)}
        customerQ={customerQ}
        onCustomerQChange={(query) => setCustomerQ(query)}
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
        onDepositChange={(value) => setDepositAmount(value)}
        noShowFeeAmount={noShowFeeAmount}
        onNoShowFeeChange={(value) => setNoShowFeeAmount(value)}
        noShowNote={noShowNote}
        onNoShowNoteChange={(value) => setNoShowNote(value)}
        status={status}
        appts={appts}
        chargeNoShowFee={chargeNoShowFee}
        onChargeNoShowFeeChange={(value) => setChargeNoShowFee(value)}
        onMarkNoShow={() => void handleMarkNoShow()}
        onCancelAppointment={handleCancelAppointment}
        onOpenPos={openPosForVisit}
        onAdvance={(appt, stage) => void advanceVisit(appt, stage)}
      />
    </div>
  );
}
