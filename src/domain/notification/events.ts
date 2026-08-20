/**
 * Notification event registry.
 * Defines the event-channel matrix from the spec.
 */

import { NotificationEventId, NotificationEventMeta } from "./types";

/** Human-readable labels keyed by event id (kept separate from the table). */
const EVENT_LABELS: Record<NotificationEventId, string> = {
  appointment_booked: "Appointment Booked",
  appointment_reminder: "Appointment Reminder",
  appointment_cancelled: "Appointment Cancelled",
  appointment_rescheduled: "Appointment Rescheduled",
  appointment_completed: "Appointment Completed",
  invoice_complete: "Invoice Complete",
  loyalty_points_earned: "Loyalty Points Earned",
  tier_upgrade: "Tier Upgrade",
  reward_expiring: "Reward Expiring",
  low_stock_alert: "Low Stock Alert",
  payment_received: "Payment Received",
};

export const EVENT_REGISTRY: Record<NotificationEventId, NotificationEventMeta> =
  Object.fromEntries(
    (
      [
        ["appointment_booked", "transactional", "high", "customer", ["whatsapp_wa_me", "toast"], 60, 3, true],
        ["appointment_reminder", "transactional", "medium", "customer", ["whatsapp_wa_me", "toast"], 1440, 3, false],
        ["appointment_cancelled", "transactional", "high", "customer", ["whatsapp_wa_me", "toast"], 60, 3, true],
        ["appointment_rescheduled", "transactional", "high", "customer", ["whatsapp_wa_me", "toast"], 60, 3, true],
        ["appointment_completed", "transactional", "low", "staff", ["toast"], 60, 0, true],
        ["invoice_complete", "transactional", "high", "customer", ["whatsapp_wa_me", "toast"], 60, 3, false],
        ["loyalty_points_earned", "optional", "low", "customer", ["whatsapp_wa_me"], 1440, 1, false],
        ["tier_upgrade", "optional", "medium", "customer", ["whatsapp_wa_me"], 1440, 1, false],
        ["reward_expiring", "optional", "low", "customer", ["whatsapp_wa_me"], 1440, 1, false],
        ["low_stock_alert", "optional", "low", "staff", ["toast"], 720, 0, true],
        ["payment_received", "transactional", "high", "customer", ["whatsapp_wa_me", "toast"], 60, 3, false],
      ] as const
    ).map(([id, category, priority, audience, channels, dedup, retries, bypass]) => [
      id,
      {
        id,
        labelKey: EVENT_LABELS[id],
        category,
        priority,
        audience,
        availableChannels: [...channels] as NotificationEventMeta["availableChannels"],
        dedupWindowMinutes: dedup,
        maxRetries: retries,
        bypassQuietHours: bypass,
      },
    ]),
  ) as Record<NotificationEventId, NotificationEventMeta>;

export function getEventMeta(eventId: string): NotificationEventMeta | undefined {
  return EVENT_REGISTRY[eventId as NotificationEventId];
}

export function isKnownEvent(eventId: string): boolean {
  return eventId in EVENT_REGISTRY;
}
