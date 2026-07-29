import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, MessageCircle, Phone, X, Check, AlertCircle } from "lucide-react";
import { clsx } from "clsx";

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
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return { notifications, addNotification, removeNotification };
}

interface NotificationDisplayProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationDisplay({ notification, onClose }: NotificationDisplayProps) {
  const icons = {
    success: <Check className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    info: <Bell className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
  };

  const colors = {
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-200/50",
    error: "bg-rose-500/10 text-rose-600 border-rose-200/50",
    info: "bg-blue-500/10 text-blue-600 border-blue-200/50",
    warning: "bg-amber-500/10 text-amber-600 border-amber-200/50",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 20 }}
      className={clsx(
        "rounded-lg border p-4 shadow-lg backdrop-blur-sm",
        colors[notification.type]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[notification.type]}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">{notification.title}</h3>
          <p className="text-xs mt-1 opacity-90">{notification.message}</p>
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="text-xs font-bold mt-2 hover:underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close notification"
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
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

export function NotificationContainer({
  notifications,
  onRemove,
}: NotificationContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm">
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

// Message Template Types
export interface MessageTemplate {
  id: string;
  name: string;
  type: "whatsapp" | "sms" | "email";
  trigger: "appointment_booked" | "appointment_reminder" | "payment_received" | "custom";
  template: string;
  enabled: boolean;
  variables: string[]; // e.g., ["{customer_name}", "{appointment_time}"]
}

// Notification Settings Component
interface NotificationSettingsProps {
  templates: MessageTemplate[];
  onSave: (templates: MessageTemplate[]) => void;
  loading?: boolean;
}

export function NotificationSettings({
  templates,
  onSave,
  loading,
}: NotificationSettingsProps) {
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [localTemplates, setLocalTemplates] = useState(templates);

  const handleSave = () => {
    onSave(localTemplates);
  };

  const handleToggle = (id: string) => {
    setLocalTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleUpdateTemplate = (id: string, template: string) => {
    setLocalTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, template } : t))
    );
  };

  return (
    <div className="space-y-6">
      {localTemplates.map((template) => (
        <motion.div
          key={template.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {template.type === "whatsapp" && (
                <MessageCircle className="h-5 w-5 text-green-600" />
              )}
              {template.type === "sms" && (
                <Phone className="h-5 w-5 text-blue-600" />
              )}
              <div>
                <h3 className="font-bold text-foreground">{template.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  {template.trigger}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.enabled}
                onChange={() => handleToggle(template.id)}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs font-bold text-muted-foreground">
                {template.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Message Template
            </label>
            <textarea
              value={template.template}
              onChange={(e) => handleUpdateTemplate(template.id, e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-card/50 text-foreground text-sm font-bold resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {template.variables.join(", ")}
            </p>
          </div>
        </motion.div>
      ))}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        disabled={loading}
        className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
      >
        {loading ? "Saving..." : "Save Settings"}
      </motion.button>
    </div>
  );
}

// Quick Notification Sender
interface QuickNotificationSenderProps {
  onSend: (message: string, type: "whatsapp" | "sms", recipients: string[]) => void;
  loading?: boolean;
}

export function QuickNotificationSender({
  onSend,
  loading,
}: QuickNotificationSenderProps) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"whatsapp" | "sms">("whatsapp");
  const [recipientText, setRecipientText] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const handleSend = () => {
    const recipients = recipientText
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (message.trim() && recipients.length > 0) {
      setSelectedRecipients(recipients);
      onSend(message, type, recipients);
      setMessage("");
      setRecipientText("");
      setSelectedRecipients([]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 space-y-6"
    >
      <div>
        <h3 className="text-lg font-bold text-foreground mb-2">Send Quick Message</h3>
        <p className="text-sm text-muted-foreground">
          Send notifications to your customers via WhatsApp or SMS
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Message Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "whatsapp" | "sms")}
            className="w-full px-4 py-3 rounded-lg border border-border bg-card/50 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
          Recipients
        </label>
        <textarea
          value={recipientText}
          onChange={(e) => setRecipientText(e.target.value)}
          placeholder="+96890000000, +96891111111"
          className="w-full px-4 py-3 rounded-lg border border-border bg-card/50 text-foreground font-bold resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Enter one phone number per line or separate them with commas.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          className="w-full px-4 py-3 rounded-lg border border-border bg-card/50 text-foreground font-bold resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          rows={4}
        />
        <p className="text-xs text-muted-foreground mt-2">
          {message.length} / 160 characters
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSend}
        disabled={loading || !message.trim() || recipientText.trim().length === 0}
        className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
      >
        {loading ? "Sending..." : "Send Message"}
      </motion.button>
    </motion.div>
  );
}
