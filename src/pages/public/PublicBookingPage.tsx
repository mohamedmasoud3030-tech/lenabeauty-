import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Scissors,
  User,
} from "lucide-react";
import { useCases } from "../../app/composition/useCases";
import { config } from "../../config/env";
import { formatPublicError } from "../../shared/hooks/useApplication";
import { formatOMRAmount } from "../../shared/money";
import { PublicShell, usePublicDirection } from "./PublicShell";
import type { PublicServiceOption, PublicStaffOption } from "../../domain/ports/repositories";

/**
 * Public online booking (#/book) — the anonymous customer-facing surface for
 * the RPC set shipped in the canonical migrations (public_*_v1).
 *
 * The server owns every rule: active service/staff, slot availability,
 * past-time rejection, phone shape, and the appointment integrity trigger
 * (staff is REQUIRED — a booking without a specialist cannot exist in the
 * database). This screen only presents choices and shows server errors.
 */

const BOOKING_DAYS_AHEAD = 14;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 20;
const SLOT_MINUTES = 30;

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function slotTimesForDay(day: Date): Date[] {
  const slots: Date[] = [];
  const cursor = startOfLocalDay(day);
  cursor.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = startOfLocalDay(day);
  end.setHours(DAY_END_HOUR, 0, 0, 0);
  while (cursor < end) {
    slots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
  }
  return slots;
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Step = "service" | "staff" | "time" | "details" | "done";

export default function PublicBookingPage() {
  const { t, i18n } = useTranslation();
  usePublicDirection();
  const [searchParams] = useSearchParams();

  const centerParam = searchParams.get("center");
  const centerId = centerParam || config.centerId || "";

  const [centerName, setCenterName] = useState<string>("");
  const [services, setServices] = useState<PublicServiceOption[]>([]);
  const [staff, setStaff] = useState<PublicStaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<PublicServiceOption | null>(null);
  const [specialist, setSpecialist] = useState<PublicStaffOption | null>(null);
  const [day, setDay] = useState<Date>(() => new Date());
  const [slot, setSlot] = useState<Date | null>(null);
  const [takenSlots, setTakenSlots] = useState<{ time: number; employeeId: string | null }[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState<string>("");

  const days = useMemo(() => {
    const list: Date[] = [];
    const base = startOfLocalDay(new Date());
    for (let i = 0; i < BOOKING_DAYS_AHEAD; i += 1) {
      list.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
    }
    return list;
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!centerId) {
      setLoadError(t("This booking link is not configured. Please contact the salon."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [infoRes, servicesRes, staffRes] = await Promise.all([
      useCases.public.getCenterInfo(centerId),
      useCases.public.listServices(centerId),
      useCases.public.listStaff(centerId),
    ]);
    if (!infoRes.ok || !servicesRes.ok || !staffRes.ok) {
      const failure = [infoRes, servicesRes, staffRes].find((response) => !response.ok);
      setLoadError(
        failure && !failure.ok
          ? formatPublicError(failure.error, t("Booking is unavailable right now"))
          : t("Booking is unavailable right now"),
      );
      setLoading(false);
      return;
    }
    setCenterName(infoRes.data.name);
    setServices(servicesRes.data);
    setStaff(staffRes.data);
    setLoading(false);
  }, [centerId, t]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const loadTakenSlots = useCallback(async (targetDay: Date) => {
    setTakenSlots([]);
    const result = await useCases.public.listTakenSlots(centerId, targetDay);
    if (result.ok) {
      setTakenSlots(result.data.map((taken) => ({ time: new Date(taken.dateTime).getTime(), employeeId: taken.employeeId })));
    }
  }, [centerId]);

  useEffect(() => {
    if (step === "time") {
      void loadTakenSlots(day);
    }
  }, [step, day, loadTakenSlots]);

  const slots = useMemo(() => {
    if (step !== "time") return [];
    const now = Date.now();
    return slotTimesForDay(day).map((time) => {
      // Only this specialist's taken starts are greyed out; the server still
      // owns the final word (exact-conflict + range-overlap rejections).
      const takenBySpecialist = takenSlots.some(
        (taken) => taken.time === time.getTime() && specialist && taken.employeeId === specialist.id,
      );
      return { time, disabled: time.getTime() <= now || takenBySpecialist };
    });
  }, [step, day, takenSlots, specialist]);

  function pickService(option: PublicServiceOption) {
    setService(option);
    setSpecialist(null);
    setStep("staff");
  }

  function pickStaff(option: PublicStaffOption) {
    setSpecialist(option);
    setSlot(null);
    setStep("time");
  }

  function backOneStep() {
    setFormError(null);
    if (step === "staff") setStep("service");
    else if (step === "time") setStep("staff");
    else if (step === "details") setStep("time");
  }

  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  async function submitBooking() {
    if (!service || !specialist || !slot) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      setFormError(t("Please enter your full name"));
      return;
    }
    if (trimmedPhone.length < 6 || trimmedPhone.length > 20) {
      setFormError(t("Please enter a valid phone number"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await useCases.public.createBooking({
      centerId,
      serviceId: service.id,
      employeeId: specialist.id,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      dateTime: slot,
      notes: notes.trim() ? notes.trim() : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(formatPublicError(result.error, t("Booking is unavailable right now")));
      // The slot may have been taken in the meantime — refresh availability.
      if (step === "details") void loadTakenSlots(day);
      return;
    }
    setConfirmationId(result.data.appointmentId);
    setStep("done");
  }

  return (
    <PublicShell centerName={centerName || t("Book an Appointment")} highlight={t("Online Booking")}>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">{t("Loading booking options...")}</span>
        </div>
      ) : loadError ? (
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-bold text-destructive">{t("Booking is unavailable right now")}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{loadError}</p>
        </div>
      ) : step === "done" ? (
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{t("Your appointment is booked")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("We look forward to seeing you")} {centerName ? `— ${centerName}` : ""}
          </p>
          <div className="rounded-xl bg-muted/60 p-4 text-start">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("Service")}</dt>
                <dd className="font-bold text-foreground">{service?.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("Specialist")}</dt>
                <dd className="font-bold text-foreground">{specialist?.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("Date & Time")}</dt>
                <dd className="font-bold text-foreground" dir={isRtl ? "rtl" : "ltr"}>
                  {slot ? `${slot.toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US")} — ${slot.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("Reference")}</dt>
                <dd className="font-mono text-xs font-bold text-foreground">{confirmationId.slice(0, 8).toUpperCase()}</dd>
              </div>
            </dl>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("Need to change it? Ask the salon for your portal code, then open the client portal from this page.")}
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          {/* progress */}
          <ol className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {(["service", "staff", "time", "details"] as Step[]).map((label, index) => {
              const order = { service: 0, staff: 1, time: 2, details: 3, done: 4 }[step];
              const state = index < order ? "done" : index === order ? "current" : "todo";
              return (
                <li
                  key={label}
                  className={`flex-1 rounded-full px-2 py-1 text-center ${
                    state === "current" ? "bg-primary text-primary-foreground" : state === "done" ? "bg-primary/15 text-primary" : "bg-muted"
                  }`}
                >
                  {t(label === "service" ? "Service" : label === "staff" ? "Specialist" : label === "time" ? "Time" : "Confirm")}
                </li>
              );
            })}
          </ol>

          {step !== "service" && (
            <button
              type="button"
              onClick={backOneStep}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-muted px-3 text-sm font-bold text-muted-foreground transition hover:text-foreground"
            >
              <BackIcon className="h-4 w-4" />
              {t("Back")}
            </button>
          )}

          {step === "service" && (
            <section className="space-y-2">
              {services.length === 0 && (
                <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{t("No services are published for booking yet")}</p>
              )}
              {services.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pickService(option)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-start shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex items-center gap-3">
                    <Scissors className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-bold text-foreground">{option.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {option.durationMinutes}
                    </span>
                    <span className="text-foreground">{formatOMRAmount(option.price)} {t("OMR")}</span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {step === "staff" && (
            <section className="space-y-2">
              {staff.length === 0 && (
                <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{t("No specialists are available for booking yet")}</p>
              )}
              {staff.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pickStaff(option)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">{option.name}</span>
                </button>
              ))}
            </section>
          )}

          {step === "time" && (
            <section className="space-y-4">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.map((option) => {
                  const selected = dayKey(option) === dayKey(day);
                  return (
                    <button
                      key={dayKey(option)}
                      type="button"
                      onClick={() => { setDay(option); setSlot(null); }}
                      className={`flex min-h-11 shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-center transition ${
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase opacity-80">
                        {option.toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US", { weekday: "short" })}
                      </span>
                      <span className="text-sm font-bold">{option.getDate()}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map(({ time, disabled }) => {
                  const selected = slot && time.getTime() === slot.getTime();
                  return (
                    <button
                      key={time.getTime()}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSlot(time)}
                      className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-bold transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : disabled
                            ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/40 line-through"
                            : "border-border bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      {time.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!slot}
                onClick={() => setStep("details")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-40"
              >
                <CalendarDays className="h-4 w-4" />
                {t("Continue")}
              </button>
            </section>
          )}

          {step === "details" && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="space-y-1.5">
                <label htmlFor="booking-name" className="text-xs font-bold text-muted-foreground">{t("Your Name")}</label>
                <input
                  id="booking-name"
                  type="text"
                  autoComplete="name"
                  className="min-h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="booking-phone" className="text-xs font-bold text-muted-foreground">{t("Phone Number")}</label>
                <input
                  id="booking-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  className="min-h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="booking-notes" className="text-xs font-bold text-muted-foreground">{t("Notes (optional)")}</label>
                <textarea
                  id="booking-notes"
                  className="min-h-11 w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              {formError && <p className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{formError}</p>}

              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitBooking()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("Confirm Booking")}
              </button>
            </section>
          )}
        </div>
      )}
    </PublicShell>
  );
}
