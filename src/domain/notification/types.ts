/**
 * Core notification domain types
 * ------------------------------------------------------------
 * Provider-neutral types for the communication system.
 * No channel-specific code lives here.
 */

/** Unique event identifiers for the event-channel matrix. */
export type NotificationEventId =
  | "appointment_booked"
  | "appointment_reminder"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_completed"
  | "invoice_complete"
  | "loyalty_points_earned"
  | "tier_upgrade"
  | "reward_expiring"
  | "low_stock_alert"
  | "payment_received";

/** Channel identifiers — current and future. */
export type NotificationChannelId =
  | "toast"
  | "in_app"
  | "whatsapp_wa_me"
  | "whatsapp_api"
  | "sms"
  | "email"
  | "push";

/** Category: transactional must deliver; optional is best-effort. */
export type NotificationCategory = "transactional" | "optional";

/** Priority for delivery scheduling. */
export type NotificationPriority = "high" | "medium" | "low";

/** Delivery status — aligned with customer_notification_timeline.delivery_status. */
export type DeliveryStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "READ"
  | "SKIPPED_PREFERENCE"
  | "SKIPPED_DUPLICATE";

/** Direction of the notification. */
export type NotificationDirection = "OUTBOUND" | "INBOUND";

/** Target audience. */
export type NotificationAudience = "staff" | "customer";

/**
 * Metadata about a notification event type.
 */
export interface NotificationEventMeta {
  id: NotificationEventId;
  labelKey: string; // i18n key for the event name
  category: NotificationCategory;
  priority: NotificationPriority;
  audience: NotificationAudience;
  availableChannels: NotificationChannelId[];
  dedupWindowMinutes: number;
  maxRetries: number;
  bypassQuietHours: boolean;
}

/**
 * Defined once per notification and passed through the pipeline.
 * The dedup key is derived deterministically from centerId, customerId,
 * eventId, and referenceId.
 */
export interface NotificationContext {
  centerId: string;
  customerId?: string; // undefined for staff-only events (e.g. low stock)
  staffId?: string;
  eventId: NotificationEventId;
  /** Business object this notification relates to (appointment ID, invoice ID, etc.). */
  referenceId?: string;
  /** i18n template key. */
  templateKey: string;
  /** Variables for template interpolation, keyed by variable name (without braces). */
  variables: Record<string, string | number | undefined>;
  /** Preferred channel; if not available, fallback logic applies. */
  preferredChannel: NotificationChannelId;
  /** When the triggering event occurred. */
  triggeredAt: Date;
}

/**
 * Result of a notification send attempt.
 */
export interface NotificationResult {
  notificationId: string;
  context: NotificationContext;
  channel: NotificationChannelId;
  deliveryStatus: DeliveryStatus;
  attemptedAt: Date;
  errorMessage?: string;
  /** Dedup key used to detect duplicates. */
  dedupKey: string;
}

/**
 * Channel delivery contract.
 * Every channel adapter implements this interface.
 */
export interface NotificationChannel {
  readonly channelId: NotificationChannelId;
  readonly audience: NotificationAudience;
  /** Whether this channel is available in the current environment. */
  isAvailable(): boolean;
  /** Whether the channel is configured (has credentials, etc.). */
  isConfigured(): boolean;
  /** Send a notification. Returns the delivery result. */
  send(context: NotificationContext, renderedMessage: string): Promise<NotificationResult>;
  /** Channel display name (i18n key). */
  displayNameKey: string;
}

/**
 * In-app notification (toast) level.
 */
export type ToastLevel = "success" | "error" | "info" | "warning";

/**
 * Customer notification preference entry.
 */
export interface CustomerNotificationPreference {
  channelId: NotificationChannelId;
  optIn: boolean;
  optInToken?: string;
  // For one-click unsubscribe
  quietHourStart?: string; // "HH:mm" in 24h format
  quietHourEnd?: string;
  updatedAt: Date;
}

/**
 * Template entry with bilingual (Arabic/English) content.
 */
export interface BilingualTemplate {
  ar: string;
  en: string;
}

/**
 * Default preferences applied to new customers.
 */
export const DEFAULT_PREFERENCES: Record<NotificationChannelId, boolean> = {
  toast: true,
  in_app: true,
  whatsapp_wa_me: true,
  whatsapp_api: false,
  sms: false,
  email: false,
  push: false,
};