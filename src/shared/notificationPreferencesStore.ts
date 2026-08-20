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

const cache = new Map<string, CustomerNotificationPreference[] | null>();

/**
 * Mark a customer's preferences as explicitly unknown after a failed load.
 * The pipeline treats `null` as fail-closed (do not send customer messages),
 * never as the default opt-in.
 */
export function setNotificationPreferencesUnknown(customerId: string): void {
  cache.set(customerId, null);
}

export function setNotificationPreferences(
  customerId: string,
  preferences: CustomerNotificationPreference[],
): void {
  cache.set(customerId, preferences);
}

export function getNotificationPreferences(
  customerId: string | undefined,
): CustomerNotificationPreference[] | undefined | null {
  if (!customerId) return undefined;
  return cache.get(customerId);
}

export function clearNotificationPreferences(customerId: string): void {
  cache.delete(customerId);
}

/** Whether preferences are known (loaded successfully) for this customer. */
export function hasKnownPreferences(
  customerId: string | undefined,
): boolean {
  if (!customerId) return false;
  return cache.has(customerId);
}
