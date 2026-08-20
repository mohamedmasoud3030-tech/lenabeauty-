/**
 * Channel adapters for the notification system.
 * ------------------------------------------------------------
 * ToastChannel — in-app staff toasts (browser only, no PII leaves device).
 * WhatsAppWaMeChannel — manual wa.me deep-link handoff for customers.
 */

import {
  NotificationChannel,
  NotificationChannelId,
  NotificationContext,
  NotificationResult,
} from "../../domain/notification";
import { normalizePhone, buildWhatsAppLink } from "../services/whatsappService";

/**
 * Toast channel: surfaces staff notifications as in-app toasts.
 * Uses a callback so the UI can render without circular imports.
 */
export class ToastChannel implements NotificationChannel {
  readonly channelId: NotificationChannelId = "toast";
  readonly audience: "staff" = "staff";
  readonly displayNameKey = "In-App Alert";

  constructor(
    private sendToast: (title: string, message: string, level?: "success" | "error" | "info" | "warning") => void,
    private isBrowser: () => boolean = () => typeof window !== "undefined",
  ) {}

  isAvailable(): boolean {
    return this.isBrowser();
  }

  isConfigured(): boolean {
    return true; // always available in the browser
  }

  async send(context: NotificationContext, renderedMessage: string): Promise<NotificationResult> {
    const title = this.titleFor(context.eventId);
    this.sendToast(title, renderedMessage);
    return {
      notificationId: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      context,
      channel: this.channelId,
      deliveryStatus: "SENT",
      attemptedAt: new Date(),
      dedupKey: `toast_${context.centerId}_${context.eventId}_${context.referenceId ?? "no-ref"}`,
    };
  }

  private titleFor(eventId: string): string {
    switch (eventId) {
      case "appointment_booked":
        return "Appointment booked";
      case "appointment_reminder":
        return "Appointment reminder";
      case "appointment_cancelled":
        return "Appointment cancelled";
      case "appointment_completed":
        return "Appointment completed";
      case "low_stock_alert":
        return "Low stock alert";
      case "invoice_complete":
        return "Invoice issued";
      default:
        return "Notification";
    }
  }
}

/**
 * WhatsApp wa.me channel: opens a manual deep link.
 * No delivery guarantee — the user presses Send in their real WhatsApp.
 */
export class WhatsAppWaMeChannel implements NotificationChannel {
  readonly channelId: NotificationChannelId = "whatsapp_wa_me";
  readonly audience: "customer" = "customer";
  readonly displayNameKey = "WhatsApp";

  constructor(
    private getPhone: (customerId: string) => string | undefined,
    private openLink: (phone: string, message: string) => void = (phone, message) => {
      if (typeof window !== "undefined") {
        window.open(buildWhatsAppLink(phone, message), "_blank", "noopener,noreferrer");
      }
    },
  ) {}

  isAvailable(): boolean {
    return true;
  }

  isConfigured(): boolean {
    return true; // wa.me requires no credentials
  }

  async send(context: NotificationContext, renderedMessage: string): Promise<NotificationResult> {
    const phone = context.customerId ? this.getPhone(context.customerId) : undefined;
    if (!phone) {
      return {
        notificationId: `wa_${Date.now()}`,
        context,
        channel: this.channelId,
        deliveryStatus: "FAILED",
        attemptedAt: new Date(),
        errorMessage: "No phone number for customer",
        dedupKey: context.referenceId ?? "no-ref",
      };
    }

    const normalized = normalizePhone(phone);
    this.openLink(normalized, renderedMessage);

    // Opening a link is NOT delivery — keep status pending per the project's
    // truthful-logging rule (see whatsappService).
    return {
      notificationId: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      context,
      channel: this.channelId,
      deliveryStatus: "QUEUED",
      attemptedAt: new Date(),
      dedupKey: context.referenceId ?? "no-ref",
    };
  }
}
