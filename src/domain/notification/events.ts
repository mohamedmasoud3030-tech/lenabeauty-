/**
 * Notification event registry.
 * Defines the event-channel matrix from the spec.
 */

import { NotificationEventId, NotificationEventMeta } from "./types";

export const EVENT_REGISTRY: Record<NotificationEventId, NotificationEventMeta> = {
  appointment_booked: {
    id: "appointment_booked",
    labelKey: "Appointment Booked",
    category: "transactional",
    priority: "high",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me", "toast"],
    dedupWindowMinutes: 60,
    maxRetries: 3,
    bypassQuietHours: true,
  },
  appointment_reminder: {
    id: "appointment_reminder",
    labelKey: "Appointment Reminder",
    category: "transactional",
    priority: "medium",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me", "toast"],
    dedupWindowMinutes: 1440,
    maxRetries: 3,
    bypassQuietHours: false,
  },
  appointment_cancelled: {
    id: "appointment_cancelled",
    labelKey: "Appointment Cancelled",
    category: "transactional",
    priority: "high",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me", "toast"],
    dedupWindowMinutes: 60,
    maxRetries: 3,
    bypassQuietHours: true,
  },
  appointment_rescheduled: {
    id: "appointment_rescheduled",
    labelKey: "Appointment Rescheduled",
    category: "transactional",
    priority: "high",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me", "toast"],
    dedupWindowMinutes: 60,
    maxRetries: 3,
    bypassQuietHours: true,
  },
  appointment_completed: {
    id: "appointment_completed",
    labelKey: "Appointment Completed",
    category: "transactional",
    priority: "low",
    audience: "staff",
    availableChannels: ["toast"],
    dedupWindowMinutes: 60,
    maxRetries: 0,
    bypassQuietHours: true,
  },
  invoice_complete: {
    id: "invoice_complete",
    labelKey: "Invoice Complete",
    category: "transactional",
    priority: "high",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me", "toast"],
    dedupWindowMinutes: 60,
    maxRetries: 3,
    bypassQuietHours: false,
  },
  loyalty_points_earned: {
    id: "loyalty_points_earned",
    labelKey: "Loyalty Points Earned",
    category: "optional",
    priority: "low",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me"],
    dedupWindowMinutes: 1440,
    maxRetries: 1,
    bypassQuietHours: false,
  },
  tier_upgrade: {
    id: "tier_upgrade",
    labelKey: "Tier Upgrade",
    category: "optional",
    priority: "medium",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me"],
    dedupWindowMinutes: 1440,
    maxRetries: 1,
    bypassQuietHours: false,
  },
  reward_expiring: {
    id: "reward_expiring",
    labelKey: "Reward Expiring",
    category: "optional",
    priority: "low",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me"],
    dedupWindowMinutes: 1440,
    maxRetries: 1,
    bypassQuietHours: false,
  },
  low_stock_alert: {
    id: "low_stock_alert",
    labelKey: "Low Stock Alert",
    category: "optional",
    priority: "low",
    audience: "staff",
    availableChannels: ["toast"],
    dedupWindowMinutes: 720,
    maxRetries: 0,
    bypassQuietHours: true,
  },
  payment_received: {
    id: "payment_received",
    labelKey: "Payment Received",
    category: "transactional",
    priority: "high",
    audience: "customer",
    availableChannels: ["whatsapp_wa_me", "toast"],
    dedupWindowMinutes: 60,
    maxRetries: 3,
    bypassQuietHours: false,
  },
};

export function getEventMeta(eventId: string): NotificationEventMeta | undefined {
  return EVENT_REGISTRY[eventId as NotificationEventId];
}

export function isKnownEvent(eventId: string): boolean {
  return eventId in EVENT_REGISTRY;
}
