import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Bell, MessageCircle, Phone, Settings2, Save, Clock3, CheckCircle2 } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PremiumCard, CardContent, CardHeader } from "../shared/components/PremiumCard";
import { QuickNotificationSender } from "../shared/components/NotificationSystem";
import { ScreenState } from "../shared/components/ScreenState";
import { whatsappService } from "../infrastructure/services/whatsappService";
import { validateTemplate, extractVariables } from "../domain/notification";

const fallbackTemplates = {
  booking: "Hello {customer_name}! Your appointment is confirmed for {appointment_date} at {appointment_time}.",
  reminder: "Reminder: your appointment is tomorrow at {appointment_time}. We look forward to seeing you!",
  smsReminder: "Reminder: your appointment is tomorrow at {appointment_time}."
};

/**
 * TemplatePreview — renders what a template will look like with sample data.
 * Uses the shared template engine; unknown variables are shown as placeholders.
 */
function TemplatePreview({ template, language }: { template: string; language: "ar" | "en" }) {
  const { t } = useTranslation();
  const sampleVars: Record<string, string | number> = {
    customer_name: language === "ar" ? "فاطمة" : "Fatima",
    appointment_date: language === "ar" ? "20 أغسطس 2026" : "Aug 20, 2026",
    appointment_time: language === "ar" ? "4:00 م" : "4:00 PM",
    service_name: language === "ar" ? "قص وتصفيف" : "Haircut & Styling",
    staff_name: language === "ar" ? "سارة" : "Sara",
    center_name: "LenaBeauty",
    payment_amount: "15.500 OMR",
    payment_method: language === "ar" ? "نقد" : "Cash",
    loyalty_points: "20",
    total_points: "120",
    tier_name: language === "ar" ? "ذهبي" : "Gold",
    tier_discount: "10",
    reward_name: language === "ar" ? "خصم 10%" : "10% discount",
    days_left: "3",
    invoice_serial: "INV-0001",
  };
  const errors = validateTemplate(template);
  const rendered = interpolatePreview(template, sampleVars);
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {t("Preview")}
      </p>
      <p dir={language === "ar" ? "rtl" : "ltr"} className="whitespace-pre-wrap text-xs text-foreground/90">
        {rendered}
      </p>
      {errors.length > 0 && (
        <p className="text-[10px] font-bold text-destructive">{errors.join(" · ")}</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Variables: {extractVariables(template).join(", ") || "—"}
      </p>
    </div>
  );
}

function interpolatePreview(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

export default function NotificationsSettingsPage({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [stats, setStats] = useState({ totalSent: 0, totalDelivered: 0, totalFailed: 0, successRate: 0 });
  const [form, setForm] = useState({
    whatsappEnabled: false,
    smsEnabled: false,
    reminderEnabled: true,
    reminderHoursBefore: 24,
    whatsappSenderName: "",
    smsSenderName: "",
    whatsappTemplateBooking: fallbackTemplates.booking,
    whatsappTemplateReminder: fallbackTemplates.reminder,
    smsTemplateReminder: fallbackTemplates.smsReminder,
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [settingsRes, statsRes] = await Promise.all([
        useCases.settings.getNotificationSettings(),
        whatsappService.getNotificationStats(),
      ]);
      if (!settingsRes.ok && settingsRes.error.code !== "NOT_FOUND") throw settingsRes.error;
      if (settingsRes.ok) {
        setForm({
          whatsappEnabled: settingsRes.data.whatsappEnabled,
          smsEnabled: settingsRes.data.smsEnabled,
          reminderEnabled: settingsRes.data.reminderEnabled,
          reminderHoursBefore: settingsRes.data.reminderHoursBefore,
          whatsappSenderName: settingsRes.data.whatsappSenderName || "",
          smsSenderName: settingsRes.data.smsSenderName || "",
          whatsappTemplateBooking: settingsRes.data.whatsappTemplateBooking || fallbackTemplates.booking,
          whatsappTemplateReminder: settingsRes.data.whatsappTemplateReminder || fallbackTemplates.reminder,
          smsTemplateReminder: settingsRes.data.smsTemplateReminder || fallbackTemplates.smsReminder,
        });
      }
      setStats(statsRes);
      setWhatsAppConnected(whatsappService.isConfigured());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setLoading(true);
    try {
      await unwrap(useCases.settings.updateNotificationSettings(form));
      showToast("success", t("Success"), t("Notification settings saved successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err.message || t("Failed to save notification settings"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(message: string, type: "whatsapp" | "sms", recipients: string[]) {
    setSending(true);
    try {
      if (type === "sms") {
        throw new Error(t("SMS provider is not configured"));
      }
      if (recipients.length !== 1) {
        throw new Error(t("Manual WhatsApp mode supports one recipient at a time"));
      }
      await whatsappService.sendBulkNotifications([{
        customerId: "manual-1",
        phone: recipients[0],
        message,
        type: "special_offer",
      }]);
      setStats(await whatsappService.getNotificationStats());
      showToast("success", t("WhatsApp link opened"), t("Complete the send manually in WhatsApp; sending and delivery are not verified."));
    } catch (err: any) {
      showToast("error", t("Error"), err.message || t("Failed to send message"));
    } finally {
      setSending(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loadError) {
    return (
      <ScreenState
        state="error"
        title={t("Failed to load notification settings")}
        description={loadError}
        actionLabel={t("Retry")}
        onAction={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {!embedded && (
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Bell className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("Notifications")}</h1>
            <p className="text-sm text-muted-foreground">{t("Configure WhatsApp and SMS reminders for appointments and campaigns")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Status")}</p><div className="mt-2 flex items-center gap-2 text-lg font-bold text-foreground">{whatsAppConnected ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Bell className="h-5 w-5 text-warning" />}{whatsAppConnected ? t("Automated provider connected") : t("Manual link mode")}</div></CardContent></PremiumCard>
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Messages Sent")}</p><div className="mt-2 text-2xl font-bold text-foreground">{stats.totalSent}</div></CardContent></PremiumCard>
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Delivery Rate")}</p><div className="mt-2 text-2xl font-bold text-success">{stats.successRate.toFixed(1)}%</div></CardContent></PremiumCard>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <PremiumCard variant="glass">
          <CardHeader>
            <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Reminder Automation")}</h2></div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="rounded-2xl border border-border p-4 space-y-2 bg-card/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">WhatsApp</span>
                  <input type="checkbox" checked={form.whatsappEnabled} onChange={(e) => update("whatsappEnabled", e.target.checked)} />
                </div>
                <p className="text-xs text-muted-foreground">{t("Enable automated booking confirmations and reminders via WhatsApp")}</p>
              </label>
              <label className="rounded-2xl border border-border p-4 space-y-2 bg-card/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">SMS</span>
                  <input type="checkbox" checked={form.smsEnabled} onChange={(e) => update("smsEnabled", e.target.checked)} />
                </div>
                <p className="text-xs text-muted-foreground">{t("Enable fallback reminders over SMS")}</p>
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Reminder Enabled")}</span>
                <select className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={String(form.reminderEnabled)} onChange={(e) => update("reminderEnabled", e.target.value === "true")}>
                  <option value="true">{t("Enabled")}</option>
                  <option value="false">{t("Disabled")}</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Reminder Hours Before")}</span>
                <div className="relative">
                  <Clock3 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="number" min="1" max="168" className="w-full rounded-xl border border-border bg-card ps-10 pe-4 py-3 font-bold" value={form.reminderHoursBefore} onChange={(e) => update("reminderHoursBefore", Number(e.target.value) || 24)} />
                </div>
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Sender Name")}</span>
                <input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.whatsappSenderName} onChange={(e) => update("whatsappSenderName", e.target.value)} placeholder="LenaBeauty" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("SMS Sender Name")}</span>
                <input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.smsSenderName} onChange={(e) => update("smsSenderName", e.target.value)} placeholder="LenaBeauty" />
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Booking Confirmation Template")}</span>
              <textarea rows={4} className="w-full rounded-xl border border-border bg-card px-4 py-3 font-medium" value={form.whatsappTemplateBooking} onChange={(e) => update("whatsappTemplateBooking", e.target.value)} />
              <TemplatePreview template={form.whatsappTemplateBooking} language={i18n.language === "ar" ? "ar" : "en"} />
            </label>
            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Reminder Template")}</span>
              <textarea rows={4} className="w-full rounded-xl border border-border bg-card px-4 py-3 font-medium" value={form.whatsappTemplateReminder} onChange={(e) => update("whatsappTemplateReminder", e.target.value)} />
              <TemplatePreview template={form.whatsappTemplateReminder} language={i18n.language === "ar" ? "ar" : "en"} />
            </label>
            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("SMS Reminder Template")}</span>
              <textarea rows={3} className="w-full rounded-xl border border-border bg-card px-4 py-3 font-medium" value={form.smsTemplateReminder} onChange={(e) => update("smsTemplateReminder", e.target.value)} />
              <TemplatePreview template={form.smsTemplateReminder} language={i18n.language === "ar" ? "ar" : "en"} />
            </label>

            <button onClick={saveSettings} disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Save className="h-4 w-4" />{loading ? t("Saving...") : t("Save Notification Settings")}</button>
          </CardContent>
        </PremiumCard>

        <div className="space-y-6">
          <QuickNotificationSender onSend={handleSendMessage} loading={sending} />
          <PremiumCard variant="glass">
            <CardHeader><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-success" /><h2 className="font-bold text-foreground">{t("Provider Notes")}</h2></div></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{t("WhatsApp currently opens one manual wa.me link; sending and delivery are not verified.")}</p>
              <p>{t("SMS sending is disabled until a server-side provider is implemented.")}</p>
              <p>{t("Automated messaging requires consent, server-side credentials, delivery receipts, and monitoring.")}</p>
            </CardContent>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
