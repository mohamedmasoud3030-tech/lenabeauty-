import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PageHeader } from "../shared/components/PageHeader";
import { ListState } from "../shared/components/ListState";
import { clsx } from "clsx";

const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const CHANNELS = ["PHONE", "WHATSAPP", "INSTAGRAM", "WEB", "OTHER"] as const;
const STATUSES = ["NEW", "QUALIFIED", "BOOKED", "CLOSED"] as const;

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "QUALIFIED") return t("Qualified");
  if (status === "BOOKED") return t("Booked");
  if (status === "CLOSED") return t("Closed");
  return t("New");
}

function channelLabel(channel: string, t: (key: string) => string) {
  if (channel === "WHATSAPP") return t("WhatsApp");
  if (channel === "INSTAGRAM") return t("Instagram");
  if (channel === "WEB") return t("Web");
  if (channel === "PHONE") return t("Phone call");
  return t("Other");
}

function whatsappHref(phone?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function schedulePath(lead: {
  customerName?: string;
  customerPhone?: string;
  preferredServiceId?: string;
  preferredDate?: string;
}) {
  const params = new URLSearchParams({ new: "1" });
  if (lead.customerName) params.set("guest", lead.customerName);
  if (lead.customerPhone) params.set("phone", lead.customerPhone);
  if (lead.preferredServiceId) params.set("service", lead.preferredServiceId);
  if (lead.preferredDate) {
    const when = new Date(lead.preferredDate);
    if (!Number.isNaN(when.getTime())) params.set("when", when.toISOString());
  }
  return `/appointments?${params.toString()}`;
}

export default function AdvancedAutomationPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [preferredServiceId, setPreferredServiceId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [sourceChannel, setSourceChannel] = useState<(typeof CHANNELS)[number]>("PHONE");
  const [filter, setFilter] = useState<"ALL" | (typeof STATUSES)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [leadRows, serviceRows] = await Promise.all([
        unwrap(useCases.advanced.listAiBookingLeads()),
        unwrap(useCases.services.list()).catch(() => []),
      ]);
      setLeads(leadRows);
      setServices(serviceRows);
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(
    () => (filter === "ALL" ? leads : leads.filter((lead) => lead.status === filter)),
    [leads, filter],
  );

  async function saveLead() {
    if (!customerName.trim() || saving) return;
    setSaving(true);
    try {
      await unwrap(useCases.advanced.createAiBookingLead({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        summary: summary.trim() || undefined,
        preferredServiceId: preferredServiceId || undefined,
        preferredDateISO: preferredDate ? new Date(preferredDate).toISOString() : undefined,
        sourceChannel,
      }));
      setCustomerName("");
      setCustomerPhone("");
      setSummary("");
      setPreferredServiceId("");
      setPreferredDate("");
      showToast("success", t("Success"), t("Request saved"));
      await load();
    } catch (error) {
      showToast("error", t("Error"), formatError(error));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(lead: { id: string; customerName?: string; customerPhone?: string; preferredServiceId?: string; preferredDate?: string }, status: (typeof STATUSES)[number]) {
    try {
      await unwrap(useCases.advanced.updateAiBookingLeadStatus(lead.id, status));
      setLeads((previous) => previous.map((row) => (row.id === lead.id ? { ...row, status } : row)));
      if (status === "BOOKED") nav(schedulePath(lead));
    } catch (error) {
      showToast("error", t("Error"), formatError(error));
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        icon={<ClipboardList className="h-7 w-7" />}
        title={t("Booking requests")}
        subtitle={t("Follow-up list")}
      />
      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t("Capture a request to visit. This list does not book automatically.")}
      </p>

      <div className="rounded-2xl border border-border bg-card p-4 grid gap-3 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("Guest name")}</span>
          <input className={fieldClass} value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("Phone")}</span>
          <input className={fieldClass} dir="ltr" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("Preferred service")}</span>
          <select className={fieldClass} value={preferredServiceId} onChange={(event) => setPreferredServiceId(event.target.value)}>
            <option value="">{t("Any service")}</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("Preferred date")}</span>
          <input className={fieldClass} type="datetime-local" value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("Channel")}</span>
          <select className={fieldClass} value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value as (typeof CHANNELS)[number])}>
            {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel(channel, t)}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("What they asked for")}</span>
          <input className={fieldClass} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <button type="button" onClick={() => void saveLead()} disabled={saving || !customerName.trim()} className="min-h-11 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50 md:col-span-2">
          {saving ? t("Processing...") : t("Save request")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={clsx("min-h-11 px-3 rounded-xl text-xs font-bold border", filter === status ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}
          >
            {status === "ALL" ? t("All") : statusLabel(status, t)}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-start">
                <th>{t("Guest name")}</th>
                <th>{t("Phone")}</th>
                <th>{t("Channel")}</th>
                <th>{t("Preferred date")}</th>
                <th>{t("What they asked for")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {visible.map((lead) => {
                const wa = whatsappHref(lead.customerPhone);
                return (
                  <tr key={lead.id} className="[&>td]:px-5 [&>td]:py-3 [&>td]:text-start align-top">
                    <td>
                      <p className="font-bold">{lead.customerName}</p>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{statusLabel(lead.status, t)}</p>
                    </td>
                    <td dir="ltr">{lead.customerPhone || "—"}</td>
                    <td>{channelLabel(lead.sourceChannel, t)}</td>
                    <td>{lead.preferredDate ? new Date(lead.preferredDate).toLocaleString(i18n.language === "ar" ? "ar-OM" : "en-US") : "—"}</td>
                    <td>{lead.summary || "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {wa ? <a href={wa} target="_blank" rel="noreferrer" className="min-h-11 px-3 rounded-lg border border-border flex items-center text-xs font-bold">{t("Contact on WhatsApp")}</a> : null}
                        {lead.status === "NEW" ? <button type="button" onClick={() => void setStatus(lead, "QUALIFIED")} className="min-h-11 px-3 rounded-lg border border-border text-xs font-bold">{t("Mark as contacted")}</button> : null}
                        {lead.status !== "BOOKED" && lead.status !== "CLOSED" ? <button type="button" onClick={() => void setStatus(lead, "BOOKED")} className="min-h-11 px-3 rounded-lg border border-border text-xs font-bold">{t("Mark as booked")}</button> : null}
                        {lead.status !== "CLOSED" ? <button type="button" onClick={() => void setStatus(lead, "CLOSED")} className="min-h-11 px-3 rounded-lg border border-border text-xs font-bold">{t("Close request")}</button> : null}
                        <button type="button" onClick={() => nav(schedulePath(lead))} className="min-h-11 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold">{t("Open schedule")}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <ListState loading={loading && visible.length === 0} error={loadError} empty={visible.length === 0} onRetry={() => void load()} loadingTitle={t("Loading requests...")} errorTitle={t("Failed to load requests")} emptyTitle={t("No booking requests")} emptyDescription={t("Add the first request")} emptyIcon={<ClipboardList className="h-6 w-6" />} colSpan={6} compact />
            </tbody>
          </table>
        </div>
        <div className="lg:hidden p-4 space-y-3">
          {visible.map((lead) => {
            const wa = whatsappHref(lead.customerPhone);
            return (
              <div key={lead.id} className="rounded-xl border border-border p-3 space-y-2">
                <p className="font-bold">{lead.customerName}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{lead.customerPhone || "—"} · {statusLabel(lead.status, t)}</p>
                <p className="text-sm">{lead.summary || "—"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {wa ? <a href={wa} target="_blank" rel="noreferrer" className="min-h-11 px-3 rounded-lg border border-border flex items-center text-xs font-bold">{t("Contact on WhatsApp")}</a> : null}
                  {lead.status === "NEW" ? <button type="button" onClick={() => void setStatus(lead, "QUALIFIED")} className="min-h-11 px-3 rounded-lg border border-border text-xs font-bold">{t("Mark as contacted")}</button> : null}
                  {lead.status !== "BOOKED" && lead.status !== "CLOSED" ? <button type="button" onClick={() => void setStatus(lead, "BOOKED")} className="min-h-11 px-3 rounded-lg border border-border text-xs font-bold">{t("Mark as booked")}</button> : null}
                  {lead.status !== "CLOSED" ? <button type="button" onClick={() => void setStatus(lead, "CLOSED")} className="min-h-11 px-3 rounded-lg border border-border text-xs font-bold">{t("Close request")}</button> : null}
                  <button type="button" onClick={() => nav(schedulePath(lead))} className="min-h-11 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold">{t("Open schedule")}</button>
                </div>
              </div>
            );
          })}
          <ListState loading={loading && visible.length === 0} error={loadError} empty={visible.length === 0} onRetry={() => void load()} loadingTitle={t("Loading requests...")} errorTitle={t("Failed to load requests")} emptyTitle={t("No booking requests")} emptyDescription={t("Add the first request")} emptyIcon={<ClipboardList className="h-6 w-6" />} compact />
        </div>
      </div>
    </div>
  );
}
