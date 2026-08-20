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
    whatsapp_api: unavailableChannel("whatsapp_api", "WhatsApp API", "WhatsApp Business API not configured"),
    sms: unavailableChannel("sms", "SMS", "SMS provider not configured"),
    email: unavailableChannel("email", "Email", "Email provider not configured"),
    push: unavailableChannel("push", "Push", "Push provider not configured"),
  };

  /**
   * Shared unavailable-channel adapter: every future provider channel has the
   * same disabled shape (no credentials, no delivery) until owner approval
   * activates it. Keeps the four stubs from duplicating identical blocks.
   */
  function unavailableChannel(
    channelId: NotificationChannelId,
    displayNameKey: string,
    errorMessage: string,
  ): any {
    return {
      channelId,
      audience: "customer",
      displayNameKey,
      isAvailable: () => false,
      isConfigured: () => false,
      send: async () => ({
        notificationId: "unavailable",
        context: {} as any,
        channel: channelId,
        deliveryStatus: "FAILED",
        attemptedAt: new Date(),
        errorMessage,
        dedupKey: "n/a",
      }),
    };
  }

  const testMode = options.testMode ?? config.environment === "development";

  return new NotificationService({
    channels,
    getPreferences: () => undefined,
    getLanguage: options.getLanguage ?? (() => "ar"),
    testMode,
  });
}
