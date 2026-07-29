import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Calendar, Clock, Check, Sparkles, ArrowRight, User, Phone, Scissors } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import type { PublicService, PublicStaff, PublicCenterInfo } from "../domain/ports/repositories";

// Booking window: next 14 days, 09:00–21:00 on the hour.
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

function nextDays(count: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

function hourSlots(): number[] {
  const out: number[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) out.push(h);
  return out;
}

export default function BookingPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [center, setCenter] = useState<PublicCenterInfo | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [staff, setStaff] = useState<PublicStaff[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [day, setDay] = useState<Date>(() => nextDays(1)[0]);
  const [hour, setHour] = useState<number | null>(null);
  const [taken, setTaken] = useState<{ dateTimeISO: string; employeeId?: string }[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const days = useMemo(() => nextDays(14), []);
  const slots = useMemo(() => hourSlots(), []);
  const selectedService = services.find((s) => s.id === serviceId);
  const currency = center?.currency || "OMR";

  useEffect(() => {
    (async () => {
      const [svc, stf, info] = await Promise.all([
        useCases.booking.listServices(),
        useCases.booking.listStaff(),
        useCases.booking.getCenterInfo(),
      ]);
      if (svc.ok) setServices(svc.data); else setLoadErr(svc.error.message);
      if (stf.ok) setStaff(stf.data);
      if (info.ok) setCenter(info.data);
    })();
  }, []);

  // Load taken slots whenever the day changes.
  useEffect(() => {
    (async () => {
      const dayISO = day.toISOString().slice(0, 10);
      const res = await useCases.booking.getTakenSlots(dayISO);
      if (res.ok) setTaken(res.data);
      else setTaken([]);
    })();
  }, [day]);

  function slotDate(h: number): Date {
    const d = new Date(day);
    d.setHours(h, 0, 0, 0);
    return d;
  }

  function isSlotTaken(h: number): boolean {
    const target = slotDate(h).getTime();
    return taken.some((s) => {
      const ts = new Date(s.dateTimeISO).getTime();
      if (ts !== target) return false;
      // If a specific staff is chosen, only that staff's bookings block it.
      if (employeeId) return s.employeeId === employeeId;
      return true;
    });
  }

  function isSlotPast(h: number): boolean {
    return slotDate(h).getTime() < Date.now();
  }

  async function submit() {
    if (!serviceId || hour === null || !name.trim() || phone.trim().length < 6) return;
    setSubmitting(true);
    setSubmitErr(null);
    const res = await useCases.booking.createBooking({
      serviceId,
      employeeId: employeeId || undefined,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      dateTimeISO: slotDate(hour).toISOString(),
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) setDone(true);
    else setSubmitErr(res.error.message || t("Something went wrong"));
  }

  const fmtDay = (d: Date) =>
    d.toLocaleDateString(isAr ? "ar-OM" : "en-US", { weekday: "short", day: "numeric", month: "short" });
  const fmtHour = (h: number) =>
    new Date(0, 0, 0, h).toLocaleTimeString(isAr ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" });

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center shadow-2xl"
        >
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("Booking confirmed!")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("We look forward to seeing you.")}</p>
          <div className="rounded-2xl bg-muted/40 p-4 text-sm text-foreground space-y-1 text-start">
            <p><strong>{t("Service")}:</strong> {selectedService?.name}</p>
            <p><strong>{t("Date")}:</strong> {fmtDay(day)} · {hour !== null && fmtHour(hour)}</p>
            <p><strong>{t("Name")}:</strong> {name}</p>
          </div>
          <button
            onClick={() => { setDone(false); setStep(1); setServiceId(""); setEmployeeId(""); setHour(null); setName(""); setPhone(""); setNotes(""); }}
            className="mt-6 w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest"
          >
            {t("Book another")}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
            {center?.name?.[0]?.toUpperCase() || "L"}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-foreground truncate">{center?.name || t("Book an Appointment")}</h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {t("Online Booking")}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {loadErr && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm mb-4">
            {t("Could not load booking options. Please try again later.")}
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-2 rounded-full transition-all ${step >= n ? "w-8 bg-primary" : "w-2 bg-muted"}`} />
          ))}
        </div>

        {/* Step 1: service + staff */}
        {step === 1 && (
          <section className="space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Scissors className="h-4 w-4" /> {t("Choose a service")}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  className={`text-start rounded-2xl border p-4 transition-all ${serviceId === s.id ? "border-primary bg-primary/5 shadow-lg" : "border-border hover:border-primary/40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground text-sm">{s.name}</span>
                    {serviceId === s.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-3">
                    <span className="font-bold text-primary">{s.price.toFixed(2)} {currency}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.durationMinutes} {t("min")}</span>
                  </div>
                </button>
              ))}
              {services.length === 0 && !loadErr && (
                <p className="text-sm text-muted-foreground col-span-2">{t("No services available.")}</p>
              )}
            </div>

            {staff.length > 0 && (
              <>
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 pt-2">
                  <User className="h-4 w-4" /> {t("Preferred staff")} <span className="opacity-50">({t("optional")})</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEmployeeId("")}
                    className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all ${employeeId === "" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {t("Any staff")}
                  </button>
                  {staff.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEmployeeId(e.id)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all ${employeeId === e.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              disabled={!serviceId}
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {t("Next")} <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} />
            </button>
          </section>
        )}

        {/* Step 2: date + time */}
        {step === 2 && (
          <section className="space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> {t("Pick a date")}
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {days.map((d) => {
                const active = d.toDateString() === day.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => { setDay(d); setHour(null); }}
                    className={`shrink-0 rounded-xl px-4 py-3 text-center border transition-all ${active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest">{fmtDay(d)}</div>
                  </button>
                );
              })}
            </div>

            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 pt-2">
              <Clock className="h-4 w-4" /> {t("Pick a time")}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((h) => {
                const disabled = isSlotTaken(h) || isSlotPast(h);
                const active = hour === h;
                return (
                  <button
                    key={h}
                    disabled={disabled}
                    onClick={() => setHour(h)}
                    className={`rounded-xl py-2.5 text-xs font-bold border transition-all ${active ? "border-primary bg-primary text-primary-foreground" : disabled ? "border-border/40 text-muted-foreground/30 line-through cursor-not-allowed" : "border-border text-foreground hover:border-primary/40"}`}
                  >
                    {fmtHour(h)}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl border border-border font-bold text-sm uppercase tracking-widest text-muted-foreground">
                {t("Back")}
              </button>
              <button
                disabled={hour === null}
                onClick={() => setStep(3)}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {t("Next")} <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: details + confirm */}
        {step === 3 && (
          <section className="space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" /> {t("Your details")}
            </h2>

            <div className="rounded-2xl bg-muted/40 p-4 text-sm text-foreground space-y-1">
              <p><strong>{t("Service")}:</strong> {selectedService?.name} · {selectedService?.price.toFixed(2)} {currency}</p>
              <p><strong>{t("Date")}:</strong> {fmtDay(day)} · {hour !== null && fmtHour(hour)}</p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <User className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Full name")}
                  className="w-full h-12 rounded-xl border border-border bg-background ps-10 pe-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="relative">
                <Phone className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder={t("Phone number")}
                  className="w-full h-12 rounded-xl border border-border bg-background ps-10 pe-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("Notes (optional)")}
                rows={2}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary resize-none"
              />
            </div>

            {submitErr && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 text-sm">{submitErr}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl border border-border font-bold text-sm uppercase tracking-widest text-muted-foreground">
                {t("Back")}
              </button>
              <button
                disabled={submitting || !name.trim() || phone.trim().length < 6}
                onClick={submit}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? t("Booking...") : t("Confirm Booking")}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
