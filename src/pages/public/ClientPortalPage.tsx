import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Coins,
  History,
  KeyRound,
  Loader2,
  LogOut,
  Receipt,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { useCases } from "../../app/composition/useCases";
import { config } from "../../config/env";
import { formatError } from "../../shared/hooks/useApplication";
import { formatOMRAmount } from "../../shared/money";
import { PublicShell, usePublicDirection } from "./PublicShell";
import type { PortalCredentials, PortalProfile } from "../../domain/ports/repositories";

/**
 * Client portal (#/portal) — a customer sees their own record with a phone
 * number + per-customer code issued by the salon (Customers screen →
 * "Portal code"). The server re-verifies the exact pair on every call and
 * locks the account after repeated failures; nothing here can read another
 * customer's data.
 */

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 20;
const SLOT_MINUTES = 30;

function credentialsFrom(centerId: string, phone: string, token: string): PortalCredentials {
  return { centerId, phone: phone.trim(), token: token.trim() };
}

export default function ClientPortalPage() {
  const { t, i18n } = useTranslation();
  usePublicDirection();
  const [searchParams] = useSearchParams();

  const centerParam = searchParams.get("center");
  const centerId = centerParam || config.centerId || "";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<{ appointmentId: string; day: Date; time: Date | null } | null>(null);

  const loadProfile = useCallback(
    async (credentials: PortalCredentials) => {
      setLoadingProfile(true);
      const result = await useCases.public.portalProfile(credentials);
      setLoadingProfile(false);
      if (!result.ok) {
        setActionError(formatError(result.error));
        return;
      }
      setProfile(result.data);
      setActionError(null);
    },
    [],
  );

  useEffect(() => {
    if (profile && phone && code && centerId) {
      void loadProfile(credentialsFrom(centerId, phone, code));
    }
    // Initial load only; actions trigger reloads explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn() {
    if (!centerId) {
      setSignInError(t("This portal link is not configured. Please contact the salon."));
      return;
    }
    if (phone.trim().length < 6 || code.trim().length < 4) {
      setSignInError(t("Enter your phone number and the code given to you by the salon"));
      return;
    }
    setSigningIn(true);
    setSignInError(null);
    const credentials = credentialsFrom(centerId, phone, code);
    const result = await useCases.public.portalProfile(credentials);
    setSigningIn(false);
    if (!result.ok) {
      setSignInError(formatError(result.error));
      return;
    }
    setProfile(result.data);
  }

  function signOut() {
    setProfile(null);
    setPhone("");
    setCode("");
    setActionError(null);
    setRescheduling(null);
  }

  async function cancelAppointment(appointmentId: string) {
    if (!profile) return;
    setBusyAppointmentId(appointmentId);
    setActionError(null);
    const result = await useCases.public.cancelBooking(credentialsFrom(centerId, phone, code), appointmentId);
    setBusyAppointmentId(null);
    if (!result.ok) {
      setActionError(formatError(result.error));
      return;
    }
    await loadProfile(credentialsFrom(centerId, phone, code));
  }

  async function submitReschedule() {
    if (!rescheduling?.time) return;
    setBusyAppointmentId(rescheduling.appointmentId);
    setActionError(null);
    const result = await useCases.public.rescheduleBooking(
      credentialsFrom(centerId, phone, code),
      rescheduling.appointmentId,
      rescheduling.time,
    );
    setBusyAppointmentId(null);
    if (!result.ok) {
      setActionError(formatError(result.error));
      return;
    }
    setRescheduling(null);
    await loadProfile(credentialsFrom(centerId, phone, code));
  }

  const upcoming = useMemo(
    () =>
      (profile?.appointments ?? [])
        .filter((appointment) => appointment.status === "SCHEDULED" && appointment.dateTime.getTime() > Date.now())
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()),
    [profile],
  );

  const past = useMemo(
    () =>
      (profile?.appointments ?? [])
        .filter((appointment) => !(appointment.status === "SCHEDULED" && appointment.dateTime.getTime() > Date.now()))
        .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())
        .slice(0, 10),
    [profile],
  );

  const rescheduleDays = useMemo(() => {
    const list: Date[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i += 1) list.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
    return list;
  }, [rescheduling]);

  const rescheduleSlots = useMemo(() => {
    if (!rescheduling) return [];
    const now = Date.now();
    const slots: Date[] = [];
    const cursor = new Date(rescheduling.day);
    cursor.setHours(DAY_START_HOUR, 0, 0, 0);
    const end = new Date(rescheduling.day);
    end.setHours(DAY_END_HOUR, 0, 0, 0);
    while (cursor < end) {
      if (cursor.getTime() > now) slots.push(new Date(cursor));
      cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
    }
    return slots;
  }, [rescheduling]);

  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const locale = i18n.language === "ar" ? "ar-OM" : "en-US";

  function formatWhen(date: Date): string {
    return `${date.toLocaleDateString(locale)} — ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <PublicShell centerName={profile ? profile.name : t("Client Portal")} highlight={t("Your visits, your rewards")}>
      {!profile ? (
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">{t("Sign in to your portal")}</h1>
              <p className="text-xs text-muted-foreground">{t("Use the phone number you booked with and the code from the salon")}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="portal-phone" className="text-xs font-bold text-muted-foreground">{t("Phone Number")}</label>
            <input
              id="portal-phone"
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
            <label htmlFor="portal-code" className="text-xs font-bold text-muted-foreground">{t("Portal Code")}</label>
            <input
              id="portal-code"
              type="text"
              autoComplete="off"
              dir="ltr"
              className="min-h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm font-bold tracking-widest outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          {signInError && <p className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{signInError}</p>}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void signIn()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
          >
            {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Sign In")}
          </button>
        </div>
      ) : loadingProfile ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">{t("Loading your visits...")}</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* summary */}
          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
              <Coins className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 text-base font-bold text-foreground">{profile.loyaltyPoints}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("Loyalty Points")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
              <Wallet className="mx-auto h-4 w-4 text-success" />
              <p className="mt-1 text-base font-bold text-foreground">{formatOMRAmount(profile.totalSpent)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("Total Spent")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
              <History className="mx-auto h-4 w-4 text-secondary" />
              <p className="mt-1 text-base font-bold text-foreground">{profile.invoices.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("Visits")}</p>
            </div>
          </section>

          {actionError && <p className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{actionError}</p>}

          {/* upcoming */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("Upcoming Appointments")}
            </h2>
            {upcoming.length === 0 && (
              <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{t("No upcoming appointments")}</p>
            )}
            {upcoming.map((appointment) => {
              const isBusy = busyAppointmentId === appointment.id;
              const isReschedulingThis = rescheduling?.appointmentId === appointment.id;
              return (
                <div key={appointment.id} className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{appointment.serviceName || t("Appointment")}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {appointment.employeeName || t("Staff")}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" dir={isRtl ? "rtl" : "ltr"}>
                        <Clock className="h-3 w-3" />
                        {formatWhen(appointment.dateTime)}
                      </p>
                    </div>
                  </div>

                  {isReschedulingThis ? (
                    <div className="space-y-3 rounded-xl bg-muted/40 p-3">
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
                        {rescheduleDays.map((option) => {
                          const selected = rescheduling.day.toDateString() === option.toDateString();
                          return (
                            <button
                              key={option.toISOString()}
                              type="button"
                              onClick={() => setRescheduling({ ...rescheduling, day: option, time: null })}
                              className={`min-h-11 shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                                selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"
                              }`}
                            >
                              {option.toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {rescheduleSlots.map((option) => {
                          const selected = rescheduling.time?.getTime() === option.getTime();
                          return (
                            <button
                              key={option.getTime()}
                              type="button"
                              onClick={() => setRescheduling({ ...rescheduling, time: option })}
                              className={`min-h-11 rounded-lg border px-1 py-2 text-xs font-bold transition ${
                                selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"
                              }`}
                            >
                              {option.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!rescheduling.time || isBusy}
                          onClick={() => void submitReschedule()}
                          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {t("Confirm New Time")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRescheduling(null)}
                          className="flex min-h-11 items-center gap-1 rounded-xl bg-muted px-3 text-xs font-bold text-muted-foreground"
                        >
                          <BackIcon className="h-3.5 w-3.5" />
                          {t("Back")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setRescheduling({ appointmentId: appointment.id, day: new Date(), time: null })}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-muted text-xs font-bold text-foreground transition hover:bg-primary/10 disabled:opacity-50"
                      >
                        {t("Reschedule")}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void cancelAppointment(appointment.id)}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive/10 text-xs font-bold text-destructive transition hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        {t("Cancel Appointment")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* invoices */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Receipt className="h-4 w-4 text-primary" />
              {t("Visit History")}
            </h2>
            {profile.invoices.length === 0 && (
              <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{t("No visits recorded yet")}</p>
            )}
            {profile.invoices.slice(0, 10).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{invoice.date.toLocaleDateString(locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(invoice.paymentMethod === "cash" ? "Cash" : invoice.paymentMethod === "card" ? "Card" : invoice.paymentMethod === "transfer" ? "Transfer" : "Payment")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">{formatOMRAmount(invoice.totalAmount)} {t("OMR")}</p>
              </div>
            ))}
            {past.length > 0 && (
              <details className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <summary className="cursor-pointer text-xs font-bold text-muted-foreground">{t("Past appointments")}</summary>
                <ul className="mt-2 space-y-1.5">
                  {past.map((appointment) => (
                    <li key={appointment.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-foreground">{appointment.serviceName || t("Appointment")}</span>
                      <span className="text-muted-foreground" dir={isRtl ? "rtl" : "ltr"}>{formatWhen(appointment.dateTime)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground transition hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("Exit Portal")}
          </button>
        </div>
      )}
    </PublicShell>
  );
}
