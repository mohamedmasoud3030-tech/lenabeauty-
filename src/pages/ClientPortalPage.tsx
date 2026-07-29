import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CalendarDays, CreditCard, LogIn, Phone, ShieldCheck, Sparkles, User, Receipt, Star, Images, BellRing, Gift, XCircle, RefreshCcw } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { getTierBySpend } from "../domain/loyalty";

const storageKey = "lenabeauty_client_portal_session";
type PortalSession = { customerId: string; phone: string; token: string; name: string; loyaltyPoints: number; totalSpent: number; };
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;
function nextDays(count: number): Date[] { const out: Date[] = []; const base = new Date(); base.setHours(0,0,0,0); for (let i=0;i<count;i++){ const d=new Date(base); d.setDate(base.getDate()+i); out.push(d);} return out; }
function hourSlots(): number[] { const out:number[]=[]; for (let h=OPEN_HOUR; h<CLOSE_HOUR; h++) out.push(h); return out; }

export default function ClientPortalPage() {
  const { t, i18n } = useTranslation();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PortalSession | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDay, setRescheduleDay] = useState<Date>(() => nextDays(1)[0]);
  const [rescheduleHour, setRescheduleHour] = useState<number | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => { const raw = localStorage.getItem(storageKey); if (!raw) return; try { const parsed = JSON.parse(raw) as PortalSession; setSession(parsed); setPhone(parsed.phone); setToken(parsed.token); } catch { localStorage.removeItem(storageKey); } }, []);
  useEffect(() => { if (!session) return; void loadProfile(session); }, [session?.customerId]);

  async function login() {
    setLoading(true); setError(null);
    try {
      const res = await useCases.booking.clientPortalLogin(phone.trim(), token.trim());
      if (!res.ok) throw res.error;
      const nextSession: PortalSession = { customerId: res.data.customerId, phone: phone.trim(), token: token.trim(), name: res.data.name, loyaltyPoints: res.data.loyaltyPoints, totalSpent: res.data.totalSpent };
      localStorage.setItem(storageKey, JSON.stringify(nextSession)); setSession(nextSession);
    } catch (e: any) { setError(e?.message || t("Login failed. Check your details.")); } finally { setLoading(false); }
  }

  async function loadProfile(current: PortalSession) {
    setLoading(true); setError(null);
    try { const res = await useCases.booking.getClientPortalProfile(current.customerId, current.phone, current.token); if (!res.ok) throw res.error; setProfile(res.data); }
    catch (e: any) { setError(e?.message || t("Could not load client portal profile")); }
    finally { setLoading(false); }
  }

  async function cancelAppointment(appointmentId: string) {
    if (!session) return;
    setLoading(true);
    try {
      const res = await useCases.booking.cancelBooking({ appointmentId, phone: session.phone, token: session.token, reason: cancelReason || undefined });
      if (!res.ok) throw res.error;
      setCancelReason("");
      await loadProfile(session);
    } catch (e: any) { setError(e?.message || t("Failed to cancel booking")); }
    finally { setLoading(false); }
  }

  async function rescheduleAppointment() {
    if (!session || !rescheduleId || rescheduleHour === null) return;
    const d = new Date(rescheduleDay); d.setHours(rescheduleHour, 0, 0, 0);
    setLoading(true);
    try {
      const res = await useCases.booking.rescheduleBooking({ appointmentId: rescheduleId, phone: session.phone, token: session.token, newDateTimeISO: d.toISOString(), reason: rescheduleReason || undefined });
      if (!res.ok) throw res.error;
      setRescheduleId(null); setRescheduleHour(null); setRescheduleReason("");
      await loadProfile(session);
    } catch (e: any) { setError(e?.message || t("Failed to reschedule booking")); }
    finally { setLoading(false); }
  }

  const tier = useMemo(() => getTierBySpend(profile?.customer?.totalSpent || session?.totalSpent || 0), [profile, session]);
  const days = useMemo(() => nextDays(14), []);
  const slots = useMemo(() => hourSlots(), []);
  const isAr = i18n.language === "ar";
  const fmtDay = (d: Date) => d.toLocaleDateString(isAr ? "ar-OM" : "en-US", { weekday: "short", day: "numeric", month: "short" });
  const fmtHour = (h: number) => new Date(0, 0, 0, h).toLocaleTimeString(isAr ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" });

  if (!session) {
    return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 shadow-2xl space-y-6"><div className="text-center space-y-2"><div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto"><ShieldCheck className="h-8 w-8" /></div><h1 className="text-3xl font-bold text-foreground">{t("Client Portal")}</h1><p className="text-sm text-muted-foreground">{t("Use your phone number and portal code to view your appointments and loyalty details")}</p></div><div className="space-y-4"><div className="relative"><Phone className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input className="w-full rounded-xl border border-border bg-background ps-11 pe-4 py-3 font-bold" placeholder="968XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></div><div className="relative"><CreditCard className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input className="w-full rounded-xl border border-border bg-background ps-11 pe-4 py-3 font-bold uppercase tracking-[0.2em]" placeholder="PORTAL CODE" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} dir="ltr" /></div></div>{error && <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}<button onClick={login} disabled={loading || !phone.trim() || !token.trim()} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"><LogIn className="h-4 w-4" />{loading ? t("Loading...") : t("Sign In")}</button></motion.div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><User className="h-7 w-7" /></div><div><h1 className="text-3xl font-bold text-foreground">{profile?.customer?.name || session.name}</h1><p className="text-sm text-muted-foreground">{t("Client Portal")}</p></div></div><button onClick={() => { localStorage.removeItem(storageKey); setSession(null); setProfile(null); }} className="h-11 px-5 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground hover:text-foreground">{t("Sign Out")}</button></div>
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <div className="grid md:grid-cols-4 gap-4"><div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Loyalty Points")}</p><p className="mt-2 text-2xl font-bold text-primary">{profile?.customer?.loyaltyPoints ?? session.loyaltyPoints}</p></div><div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Total Spent")}</p><p className="mt-2 text-2xl font-bold text-foreground">{Number(profile?.customer?.totalSpent ?? session.totalSpent).toFixed(2)} {t("OMR")}</p></div><div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Tier")}</p><p className="mt-2 text-2xl font-bold text-amber-600">{tier.icon} {t(tier.labelKey)}</p></div><div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Referral Code")}</p><p className="mt-2 text-xl font-bold text-foreground">{profile?.referral?.code || "—"}</p></div></div>
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-5"><CalendarDays className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Appointments")}</h2></div><div className="space-y-3">{(profile?.appointments || []).map((appt: any) => (<div key={appt.id} className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-foreground">{appt.serviceName || t("Service")}</p><p className="text-xs text-muted-foreground mt-1">{new Date(appt.dateTimeISO).toLocaleString(i18n.language || "ar")}</p>{appt.employeeName && <p className="text-xs text-muted-foreground mt-1">{t("Specialist")}: {appt.employeeName}</p>}</div><span className="rounded-xl bg-primary/10 text-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{t(appt.status)}</span></div>{appt.status === 'SCHEDULED' && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => setRescheduleId(appt.id)} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold"><RefreshCcw className="inline h-3.5 w-3.5 me-1" />{t("Reschedule")}</button><button onClick={() => cancelAppointment(appt.id)} className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"><XCircle className="inline h-3.5 w-3.5 me-1" />{t("Cancel Booking")}</button></div>}{(appt.depositAmount > 0 || appt.noShowFeeAmount > 0 || appt.noShowFeeCharged > 0) && <div className="mt-3 grid sm:grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-background border border-border p-3"><strong>{t("Deposit Amount")}:</strong> {appt.depositAmount.toFixed(2)} {t("OMR")}</div><div className="rounded-xl bg-background border border-border p-3"><strong>{t("No-Show Fee")}:</strong> {appt.noShowFeeAmount.toFixed(2)} {t("OMR")}</div><div className="rounded-xl bg-background border border-border p-3"><strong>{t("Charged")}:</strong> {appt.noShowFeeCharged.toFixed(2)} {t("OMR")}</div></div>}</div>))}{(!profile?.appointments || profile.appointments.length === 0) && <p className="text-sm text-muted-foreground">{t("No Appointments")}</p>}</div></div>
            {rescheduleId && <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm space-y-4"><div className="flex items-center gap-3"><RefreshCcw className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Reschedule Booking")}</h2></div><div className="flex flex-wrap gap-2">{days.map((d) => <button key={d.toISOString()} onClick={() => setRescheduleDay(d)} className={`rounded-xl px-3 py-2 text-xs font-bold border ${d.toDateString() === rescheduleDay.toDateString() ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{fmtDay(d)}</button>)}</div><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{slots.map((h) => <button key={h} onClick={() => setRescheduleHour(h)} className={`rounded-xl py-2 text-xs font-bold border ${rescheduleHour === h ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{fmtHour(h)}</button>)}</div><textarea value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} placeholder={t("Reason (optional)") as string} className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none" rows={2} /><div className="flex gap-3"><button onClick={() => { setRescheduleId(null); setRescheduleHour(null); setRescheduleReason(""); }} className="flex-1 h-11 rounded-xl border border-border text-sm font-bold">{t("Close")}</button><button onClick={rescheduleAppointment} disabled={rescheduleHour === null || loading} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">{t("Confirm Reschedule")}</button></div></div>}
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-5"><Receipt className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Invoices")}</h2></div><div className="space-y-3">{(profile?.invoices || []).map((invoice: any) => (<div key={invoice.id} className="rounded-2xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4"><div><p className="font-bold text-foreground">{invoice.serialNumber || invoice.id.slice(-6).toUpperCase()}</p><p className="text-xs text-muted-foreground mt-1">{new Date(invoice.dateISO).toLocaleString(i18n.language || "ar")}</p></div><div className="text-end"><p className="font-bold text-primary">{invoice.totalAmount.toFixed(2)} {t("OMR")}</p><p className="text-xs text-muted-foreground">{t(invoice.paymentMethod.charAt(0).toUpperCase() + invoice.paymentMethod.slice(1))}</p></div></div>))}{(!profile?.invoices || profile.invoices.length === 0) && <p className="text-sm text-muted-foreground">{t("No Invoices")}</p>}</div></div>
          </div>
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><Sparkles className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Tier Benefits")}</h2></div><p className="text-sm text-muted-foreground">{tier.icon} {t(tier.labelKey)} · {tier.discountPercent}% {t("Tier discount")}</p></div>
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><Star className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Reviews")}</h2></div><div className="space-y-2">{(profile?.reviews || []).slice(0,5).map((review:any)=><div key={review.id} className="rounded-xl bg-muted/20 p-3 text-sm"><div className="font-semibold">{Array.from({ length: review.rating }).map(()=> '★').join('')}</div><div className="text-muted-foreground">{review.comment || '—'}</div></div>)}{(!profile?.reviews || profile.reviews.length===0) && <p className="text-sm text-muted-foreground">{t("No reviews yet")}</p>}</div></div>
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><Images className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Service Gallery")}</h2></div><div className="space-y-2">{(profile?.serviceFiles || []).slice(0,4).map((file:any)=><div key={file.id} className="rounded-xl bg-muted/20 p-3 text-sm"><div className="font-semibold">{file.title}</div><div className="text-muted-foreground">{file.note || '—'}</div><div className="mt-2 flex flex-wrap gap-2 text-[10px]">{(file.images || []).map((img:any)=><span key={img.id} className="rounded-full bg-background border border-border px-2 py-1">{img.imageKind}</span>)}</div></div>)}{(!profile?.serviceFiles || profile.serviceFiles.length===0) && <p className="text-sm text-muted-foreground">{t("No service files yet")}</p>}</div></div>
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><BellRing className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Notification Timeline")}</h2></div><div className="space-y-2">{(profile?.notificationTimeline || []).slice(0,5).map((event:any)=><div key={event.id} className="rounded-xl bg-muted/20 p-3 text-sm"><div className="font-semibold">{event.channel} · {event.deliveryStatus}</div><div className="text-muted-foreground">{event.messagePreview}</div></div>)}{(!profile?.notificationTimeline || profile.notificationTimeline.length===0) && <p className="text-sm text-muted-foreground">{t("No notification events yet")}</p>}</div></div>
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><Gift className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Referral")}</h2></div><p className="text-sm text-muted-foreground">{t("Share your referral code with friends")}</p><p className="mt-3 text-lg font-bold" dir="ltr">{profile?.referral?.code || '—'}</p><p className="text-xs text-muted-foreground mt-1">{t("Points Earned")}: {profile?.referral?.pointsEarned || 0}</p></div>
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Portal Access")}</h2></div><textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t("Cancellation note (optional)") as string} className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none" rows={2} /><p className="mt-3 text-xs text-muted-foreground" dir="ltr">{session.phone}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
