import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, MessageCircle, Phone, X, Check, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";

export interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
}

let notificationId = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id">) => {
    const id = `notification-${++notificationId}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 5000,
    };

    setNotifications((prev) => [...prev, newNotification]);

    if (newNotification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  return { notifications, addNotification, removeNotification };
}

interface NotificationDisplayProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationDisplay({ notification, onClose }: NotificationDisplayProps) {
  const { t } = useTranslation();
  const icons = {
    success: <Check className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    info: <Bell className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
  };

  const colors = {
    success: "bg-success/10 text-success border-success/50",
    error: "bg-destructive/10 text-destructive border-destructive/50",
    info: "bg-info/10 text-info border-info/50",
    warning: "bg-warning/10 text-warning border-warning/50",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 20 }}
      className={clsx("rounded-xl border p-4 shadow-lg backdrop-blur-sm", colors[notification.type])}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">{icons[notification.type]}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">{notification.title}</h3>
          <p className="mt-1 text-xs opacity-90">{notification.message}</p>
          {notification.action ? (
            <button type="button" onClick={notification.action.onClick} className="mt-2 min-h-11 text-xs font-bold hover:underline">
              {notification.action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition hover:bg-foreground/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

interface NotificationContainerProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

export function NotificationContainer({ notifications, onRemove }: NotificationContainerProps) {
  return (
    <div className="fixed bottom-4 end-4 z-50 max-w-sm space-y-3">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationDisplay
            key={notification.id}
            notification={notification}
            onClose={() => onRemove(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: "whatsapp" | "sms" | "email";
  trigger: "appointment_booked" | "appointment_reminder" | "payment_received" | "custom";
  template: string;
  enabled: boolean;
  variables: string[];
}

interface NotificationSettingsProps {
  templates: MessageTemplate[];
  onSave: (templates: MessageTemplate[]) => void;
  loading?: boolean;
}

export function NotificationSettings({ templates, onSave, loading }: NotificationSettingsProps) {
  const { t } = useTranslation();
  const [localTemplates, setLocalTemplates] = useState(templates);

  const handleToggle = (id: string) => {
    setLocalTemplates((prev) => prev.map((template) => (
      template.id === id ? { ...template, enabled: !template.enabled } : template
    )));
  };

  const handleUpdateTemplate = (id: string, templateText: string) => {
    setLocalTemplates((prev) => prev.map((template) => (
      template.id === id ? { ...template, template: templateText } : template
    )));
  };

  return (
    <div className="space-y-6">
      {localTemplates.map((template) => (
        <motion.div
          key={template.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {template.type === "whatsapp" ? <MessageCircle className="h-5 w-5 text-success" /> : null}
              {template.type === "sms" ? <Phone className="h-5 w-5 text-info" /> : null}
              <div>
                <h3 className="font-bold text-foreground">{template.name}</h3>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{template.trigger}</p>
              </div>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={template.enabled}
                onChange={() => handleToggle(template.id)}
                className="h-4 w-4 rounded"
              />
              <span className="text-xs font-bold text-muted-foreground">
                {template.enabled ? t("Enabled") : t("Disabled")}
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("Message Template")}
            </label>
            <textarea
              value={template.template}
              onChange={(event) => handleUpdateTemplate(template.id, event.target.value)}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("Available variables")}: {template.variables.join(", ")}
            </p>
          </div>
        </motion.div>
      ))}

      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSave(localTemplates)}
        disabled={loading}
        className="min-h-11 w-full rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition disabled:opacity-50"
      >
        {loading ? t("Saving...") : t("Save Settings")}
      </motion.button>
    </div>
  );
}

interface QuickNotificationSenderProps {
  onSend: (message: string, type: "whatsapp" | "sms", recipients: string[]) => void;
  loading?: boolean;
}

export function QuickNotificationSender({ onSend, loading }: QuickNotificationSenderProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [recipientText, setRecipientText] = useState("");

  const handleSend = () => {
    const recipients = recipientText
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (message.trim() && recipients.length > 0) {
      onSend(message, "whatsapp", recipients);
      setMessage("");
      setRecipientText("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
          <MessageCircle className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{t("Send Quick Message")}</h3>
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("Recipients")}
        </label>
        <textarea
          value={recipientText}
          onChange={(event) => setRecipientText(event.target.value)}
          placeholder="+96890000000"
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          rows={2}
          dir="ltr"
        />
        <p className="mt-2 text-xs text-muted-foreground">{t("Manual WhatsApp mode supports one recipient at a time")}</p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("Message")}
        </label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("Type your message here...")}
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          rows={4}
        />
        <p className="mt-2 text-xs text-muted-foreground">{message.length} / 160</p>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleSend}
        disabled={loading || !message.trim() || recipientText.trim().length === 0}
        className="min-h-11 w-full rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition disabled:opacity-50"
      >
        {loading ? t("Sending...") : t("Send Message")}
      </motion.button>
    </motion.div>
  );
}
