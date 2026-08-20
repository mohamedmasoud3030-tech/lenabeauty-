/**
 * Factory that wires the notification service with real channels.
 * ------------------------------------------------------------
 * The singleton is created lazily on first access so tests can
 * construct their own instances with stub channels.
 */

import {
  NotificationChannelId,
  NotificationService,
} from "../../domain/notification";
import { ToastChannel, WhatsAppWaMeChannel } from "./channels";
import { config } from "../../config/env";

/**
 * Options for building the notification service.
 * `showToast` is required so the toast channel can render.
 */
export interface CreateNotificationServiceOptions {
  showToast: (title: string, message: string, level?: "success" | "error" | "info" | "warning") => void;
  getPhoneForCustomer?: (customerId: string) => string | undefined;
  getLanguage?: () => "ar" | "en";
  testMode?: boolean;
}

/**
 * Build a fully wired notification service with the real channels.
 * In development/staging the testMode flag is derived from the build.
 */
export function createNotificationService(
  options: CreateNotificationServiceOptions,
): NotificationService {
  const toastChannel = new ToastChannel(options.showToast);
  const whatsappChannel = new WhatsAppWaMeChannel(
    options.getPhoneForCustomer ?? (() => undefined),
  );

  const channels: Record<NotificationChannelId, any> = {
    toast: toastChannel,
    in_app: toastChannel, // in-app center uses the same toast adapter for now
    whatsapp_wa_me: whatsappChannel,
    whatsapp_api: {
      channelId: "whatsapp_api",
      audience: "customer",
      displayNameKey: "WhatsApp API",
      isAvailable: () => false,
      isConfigured: () => false,
      send: async () => ({
        notificationId: "unavailable",
        context: {} as any,
        channel: "whatsapp_api",
        deliveryStatus: "FAILED",
        attemptedAt: new Date(),
        errorMessage: "WhatsApp Business API not configured",
        dedupKey: "n/a",
      }),
    },
    sms: {
      channelId: "sms",
      audience: "customer",
      displayNameKey: "SMS",
      isAvailable: () => false,
      isConfigured: () => false,
      send: async () => ({
        notificationId: "unavailable",
        context: {} as any,
        channel: "sms",
        deliveryStatus: "FAILED",
        attemptedAt: new Date(),
        errorMessage: "SMS provider not configured",
        dedupKey: "n/a",
      }),
    },
    email: {
      channelId: "email",
      audience: "customer",
      displayNameKey: "Email",
      isAvailable: () => false,
      isConfigured: () => false,
      send: async () => ({
        notificationId: "unavailable",
        context: {} as any,
        channel: "email",
        deliveryStatus: "FAILED",
        attemptedAt: new Date(),
        errorMessage: "Email provider not configured",
        dedupKey: "n/a",
      }),
    },
    push: {
      channelId: "push",
      audience: "customer",
      displayNameKey: "Push",
      isAvailable: () => false,
      isConfigured: () => false,
      send: async () => ({
        notificationId: "unavailable",
        context: {} as any,
        channel: "push",
        deliveryStatus: "FAILED",
        attemptedAt: new Date(),
        errorMessage: "Push provider not configured",
        dedupKey: "n/a",
      }),
    },
  };

  const testMode = options.testMode ?? config.environment === "development";

  return new NotificationService({
    channels,
    getPreferences: () => undefined,
    getLanguage: options.getLanguage ?? (() => "ar"),
    testMode,
  });
}
