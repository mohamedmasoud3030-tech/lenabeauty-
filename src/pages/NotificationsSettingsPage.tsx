import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Bell, MessageCircle, Phone, Settings2, Save, Clock3, CheckCircle2 } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PremiumCard, CardContent, CardHeader } from "../shared/components/PremiumCard";
import { QuickNotificationSender } from "../shared/components/NotificationSystem";
import { whatsappService } from "../infrastructure/services/whatsappService";

const fallbackTemplates = {
  booking: "Hello {customer_name}! Your appointment is confirmed for {appointment_date} at {appointment_time}.",
  reminder: "Reminder: your appointment is tomorrow at {appointment_time}. We look forward to seeing you!",
  smsReminder: "Reminder: your appointment is tomorrow at {appointment_time}."
};

export default function NotificationsSettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
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
    try {
      const [settingsRes, statsRes] = await Promise.all([
        useCases.settings.getNotificationSettings(),
        whatsappService.getNotificationStats(),
      ]);
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
      if (type === "whatsapp") {
        await whatsappService.sendBulkNotifications(
          recipients.map((phone, index) => ({
            customerId: `manual-${index + 1}`,
            phone,
            message,
            type: "special_offer",
          }))
        );
      }
      setStats(await whatsappService.getNotificationStats());
      showToast("success", t("Success"), t("Your message has been queued successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err.message || t("Failed to send message"));
    } finally {
      setSending(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Bell className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("Notifications")}</h1>
          <p className="text-sm text-muted-foreground">{t("Configure WhatsApp and SMS reminders for appointments and campaigns")}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Status")}</p><div className="mt-2 flex items-center gap-2 text-lg font-bold text-foreground">{whatsAppConnected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Bell className="h-5 w-5 text-amber-600" />}{whatsAppConnected ? t("Connected") : t("Sandbox / Mock Mode")}</div></CardContent></PremiumCard>
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Messages Sent")}</p><div className="mt-2 text-2xl font-bold text-foreground">{stats.totalSent}</div></CardContent></PremiumCard>
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Delivery Rate")}</p><div className="mt-2 text-2xl font-bold text-emerald-600">{stats.successRate.toFixed(1)}%</div></CardContent></PremiumCard>
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
            </label>
            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Reminder Template")}</span>
              <textarea rows={4} className="w-full rounded-xl border border-border bg-card px-4 py-3 font-medium" value={form.whatsappTemplateReminder} onChange={(e) => update("whatsappTemplateReminder", e.target.value)} />
            </label>
            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("SMS Reminder Template")}</span>
              <textarea rows={3} className="w-full rounded-xl border border-border bg-card px-4 py-3 font-medium" value={form.smsTemplateReminder} onChange={(e) => update("smsTemplateReminder", e.target.value)} />
            </label>

            <button onClick={saveSettings} disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Save className="h-4 w-4" />{loading ? t("Saving...") : t("Save Notification Settings")}</button>
          </CardContent>
        </PremiumCard>

        <div className="space-y-6">
          <QuickNotificationSender onSend={handleSendMessage} loading={sending} />
          <PremiumCard variant="glass">
            <CardHeader><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-600" /><h2 className="font-bold text-foreground">{t("Provider Notes")}</h2></div></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{t("WhatsApp automation is ready in the app layer. To go live, connect a WhatsApp Business API token outside the repository.")}</p>
              <p>{t("SMS automation follows the same settings model, but still needs your chosen SMS provider credentials.")}</p>
              <p>{t("Until credentials are supplied, the app safely operates in mock mode for QA.")}</p>
            </CardContent>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
