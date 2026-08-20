/**
 * Module-scoped notification-preference cache.
 *
 * The notification pipeline's getPreferences is synchronous, while the
 * source of truth (customer_notification_preferences) lives in Supabase.
 * Pages that select a customer (POS, Appointments) load preferences via the
 * RPC and store them here; the pipeline reads this cache. Absent entries
 * fall back to defaults in canDeliver (opt-in for WhatsApp, quiet hours),
 * so a missing cache never blocks a legitimate send.
 */
import type { CustomerNotificationPreference } from "../domain/notification";

const cache = new Map<string, CustomerNotificationPreference[]>();

export function setNotificationPreferences(
  customerId: string,
  preferences: CustomerNotificationPreference[],
): void {
  cache.set(customerId, preferences);
}

export function getNotificationPreferences(
  customerId: string | undefined,
): CustomerNotificationPreference[] | undefined {
  if (!customerId) return undefined;
  return cache.get(customerId);
}

export function clearNotificationPreferences(customerId: string): void {
  cache.delete(customerId);
}
