import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Bell, MessageCircle, Phone, Settings2 } from "lucide-react";
import { PremiumCard, CardHeader, CardContent, CardFooter } from "../shared/components/PremiumCard";
import { NotificationSettings, QuickNotificationSender, useNotifications } from "../shared/components/NotificationSystem";
import { MessageTemplate } from "../shared/components/NotificationSystem";

const defaultTemplates: MessageTemplate[] = [
  {
    id: "appointment_booked",
    name: "Appointment Booked",
    type: "whatsapp",
    trigger: "appointment_booked",
    template: "Hello {customer_name}! Your appointment is confirmed for {appointment_date} at {appointment_time}. See you soon!",
    enabled: true,
    variables: ["{customer_name}", "{appointment_date}", "{appointment_time}", "{service_name}"],
  },
  {
    id: "appointment_reminder",
    name: "Appointment Reminder",
    type: "whatsapp",
    trigger: "appointment_reminder",
    template: "Hi {customer_name}! Reminder: You have an appointment tomorrow at {appointment_time}. We're looking forward to seeing you!",
    enabled: true,
    variables: ["{customer_name}", "{appointment_time}"],
  },
  {
    id: "payment_received",
    name: "Payment Received",
    type: "whatsapp",
    trigger: "payment_received",
    template: "Thank you {customer_name}! We've received your payment of {amount} OMR. Your receipt has been sent to your email.",
    enabled: true,
    variables: ["{customer_name}", "{amount}"],
  },
  {
    id: "sms_reminder",
    name: "SMS Appointment Reminder",
    type: "sms",
    trigger: "appointment_reminder",
    template: "Reminder: You have an appointment at {salon_name} tomorrow at {appointment_time}. Reply CONFIRM to confirm.",
    enabled: false,
    variables: ["{salon_name}", "{appointment_time}"],
  },
];

export default function NotificationsSettingsPage() {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const [templates, setTemplates] = useState<MessageTemplate[]>(defaultTemplates);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"templates" | "send">("templates");

  const handleSaveTemplates = async (updatedTemplates: MessageTemplate[]) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setTemplates(updatedTemplates);
      addNotification({
        type: "success",
        title: "Settings Saved",
        message: "Your notification templates have been updated successfully.",
      });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to save settings. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (
    message: string,
    type: "whatsapp" | "sms",
    recipients: string[]
  ) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      addNotification({
        type: "success",
        title: "Message Sent",
        message: `Your ${type.toUpperCase()} message has been sent to ${recipients.length} recipient(s).`,
      });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to send message. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                {t("Notifications")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("Manage WhatsApp and SMS notifications for your customers")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 border-b border-border/50"
        >
          {[
            { id: "templates", label: "Message Templates", icon: Settings2 },
            { id: "send", label: "Send Message", icon: MessageCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "templates" | "send")}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        {activeTab === "templates" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <NotificationSettings
              templates={templates}
              onSave={handleSaveTemplates}
              loading={loading}
            />
          </motion.div>
        )}

        {activeTab === "send" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <QuickNotificationSender onSend={handleSendMessage} loading={loading} />

            {/* Info Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <PremiumCard variant="glass">
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-foreground">WhatsApp Integration</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Send personalized messages directly to your customers' WhatsApp. Perfect for appointment reminders and promotions.
                  </p>
                  <button className="text-sm font-bold text-primary hover:underline">
                    Connect WhatsApp →
                  </button>
                </CardContent>
              </PremiumCard>

              <PremiumCard variant="glass">
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <Phone className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-foreground">SMS Integration</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reach customers who prefer SMS. Great for quick reminders and confirmations.
                  </p>
                  <button className="text-sm font-bold text-primary hover:underline">
                    Connect SMS Provider →
                  </button>
                </CardContent>
              </PremiumCard>
            </div>

            {/* Usage Stats */}
            <PremiumCard variant="glass">
              <CardHeader>
                <h3 className="font-bold text-foreground">Usage This Month</h3>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      WhatsApp Messages
                    </p>
                    <p className="text-2xl font-bold text-foreground">342</p>
                    <p className="text-xs text-muted-foreground mt-1">of 1000 included</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      SMS Messages
                    </p>
                    <p className="text-2xl font-bold text-foreground">128</p>
                    <p className="text-xs text-muted-foreground mt-1">of 500 included</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Delivery Rate
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">98.5%</p>
                    <p className="text-xs text-muted-foreground mt-1">Excellent</p>
                  </div>
                </div>
              </CardContent>
            </PremiumCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}

