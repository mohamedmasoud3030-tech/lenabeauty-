import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, MessageCircle, Settings2, Save, Clock3, CheckCircle2 } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PremiumCard, CardContent, CardHeader } from "../shared/components/PremiumCard";
import { QuickNotificationSender } from "../shared/components/NotificationSystem";
import { ScreenState } from "../shared/components/ScreenState";
import { whatsappService } from "../infrastructure/services/whatsappService";

const fallbackTemplates = {
  booking: "Hello {customer_name}! Your appointment is confirmed for {appointment_date} at {appointment_time}.",
  reminder: "Reminder: your appointment is tomorrow at {appointment_time}. We look forward to seeing you!",
  smsReminder: "Reminder: your appointment is tomorrow at {appointment_time}.",
};

export default function NotificationsSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
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
          // SMS is intentionally not exposed until an operational sender exists.
          smsEnabled: false,
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
      console.error("Notification settings load failed", error);
      setLoadError(t("Failed to load notification settings"));
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setLoading(true);
    try {
      await unwrap(useCases.settings.updateNotificationSettings({ ...form, smsEnabled: false }));
      showToast("success", t("Success"), t("Notification settings saved successfully"));
    } catch (error) {
      console.error("Notification settings save failed", error);
      showToast("error", t("Error"), t("Failed to save notification settings"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(message: string, type: "whatsapp" | "sms", recipients: string[]) {
    setSending(true);
    try {
      if (type !== "whatsapp" || recipients.length !== 1) {
        throw new Error(t("Failed to send message"));
      }
      await whatsappService.sendBulkNotifications([{
        customerId: "manual-1",
        phone: recipients[0],
        message,
        type: "special_offer",
      }]);
      setStats(await whatsappService.getNotificationStats());
      showToast("success", t("WhatsApp link opened"), t("Complete the send manually in WhatsApp; sending and delivery are not verified."));
    } catch (error) {
      console.error("Manual message send failed", error);
      showToast("error", t("Error"), t("Failed to send message"));
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
      {!embedded ? (
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-14 sm:w-14 sm:rounded-2xl">
            <Bell className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t("Notifications")}</h1>
            <p className="text-sm text-muted-foreground">{t("Configure WhatsApp and SMS reminders for appointments and campaigns")}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <PremiumCard variant="glass">
          <CardContent className="py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Status")}</p>
            <div className="mt-2 flex items-center gap-2 text-lg font-bold text-foreground">
              {whatsAppConnected ? <CheckCircle2 className="h-5 w-5 text-success" /> : <MessageCircle className="h-5 w-5 text-primary" />}
              {whatsAppConnected ? t("Automated provider connected") : t("Manual link mode")}
            </div>
          </CardContent>
        </PremiumCard>
        <PremiumCard variant="glass">
          <CardContent className="py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Messages Sent")}</p>
            <div className="mt-2 text-2xl font-bold text-foreground">{stats.totalSent}</div>
          </CardContent>
        </PremiumCard>
        <PremiumCard variant="glass">
          <CardContent className="py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Delivery Rate")}</p>
            <div className="mt-2 text-2xl font-bold text-success">{stats.successRate.toFixed(1)}%</div>
          </CardContent>
        </PremiumCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PremiumCard variant="glass">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-foreground">{t("Reminder Automation")}</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block space-y-2 rounded-2xl border border-border bg-card/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-foreground">WhatsApp</span>
                <input
                  type="checkbox"
                  checked={form.whatsappEnabled}
                  onChange={(event) => update("whatsappEnabled", event.target.checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("Enable automated booking confirmations and reminders via WhatsApp")}</p>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Reminder Enabled")}</span>
                <select
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={String(form.reminderEnabled)}
                  onChange={(event) => update("reminderEnabled", event.target.value === "true")}
                >
                  <option value="true">{t("Enabled")}</option>
                  <option value="false">{t("Disabled")}</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Reminder Hours Before")}</span>
                <div className="relative">
                  <Clock3 className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="min-h-11 w-full rounded-xl border border-input bg-background py-3 ps-10 pe-4 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    value={form.reminderHoursBefore}
                    onChange={(event) => update("reminderHoursBefore", Number(event.target.value) || 24)}
                  />
                </div>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Sender Name")}</span>
              <input
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={form.whatsappSenderName}
                onChange={(event) => update("whatsappSenderName", event.target.value)}
                placeholder="LenaBeauty"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Booking Confirmation Template")}</span>
              <textarea
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={form.whatsappTemplateBooking}
                onChange={(event) => update("whatsappTemplateBooking", event.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("WhatsApp Reminder Template")}</span>
              <textarea
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={form.whatsappTemplateReminder}
                onChange={(event) => update("whatsappTemplateReminder", event.target.value)}
              />
            </label>

            <button
              type="button"
              onClick={saveSettings}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? t("Saving...") : t("Save Notification Settings")}
            </button>
          </CardContent>
        </PremiumCard>

        <QuickNotificationSender onSend={handleSendMessage} loading={sending} />
      </div>
    </div>
  );
}
