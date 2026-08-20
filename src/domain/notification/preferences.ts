/**
 * Customer notification preferences.
 * Preference-gated delivery: no message is sent to a customer
 * who has opted out of that channel or is in quiet hours.
 */

import {
  CustomerNotificationPreference,
  DEFAULT_PREFERENCES,
  NotificationChannelId,
} from "./types";

/**
 * Returns the default preferences for a new customer.
 * WhatsApp is opted in by default; SMS/Email/Push are opted out.
 */
export function defaultPreferences(): CustomerNotificationPreference[] {
  return (Object.keys(DEFAULT_PREFERENCES) as NotificationChannelId[]).map(
    (channelId) => ({
      channelId,
      optIn: DEFAULT_PREFERENCES[channelId],
      updatedAt: new Date(),
    }),
  );
}

/**
 * Find the preference for a channel, defaulting to DEFAULT_PREFERENCES.
 */
export function getChannelPreference(
  preferences: CustomerNotificationPreference[] | undefined,
  channelId: NotificationChannelId,
): CustomerNotificationPreference {
  const found = preferences?.find((p) => p.channelId === channelId);
  if (found) return found;
  return {
    channelId,
    optIn: DEFAULT_PREFERENCES[channelId] ?? false,
    updatedAt: new Date(),
  };
}

/** Whether a channel is opted in for this customer. */
export function isOptedIn(
  preferences: CustomerNotificationPreference[] | undefined,
  channelId: NotificationChannelId,
): boolean {
  return getChannelPreference(preferences, channelId).optIn;
}

/**
 * Whether the current local time falls within the customer's quiet hours.
 * Quiet hours are expressed as "HH:mm" (24h). If no quiet hours set,
 * defaults to 21:00 – 08:00.
 */
export function isInQuietHours(
  preferences: CustomerNotificationPreference[] | undefined,
  channelId: NotificationChannelId,
  now: Date = new Date(),
): boolean {
  const pref = getChannelPreference(preferences, channelId);
  const start = parseTime(pref.quietHourStart ?? "21:00");
  const end = parseTime(pref.quietHourEnd ?? "08:00");
  const current = now.getHours() * 60 + now.getMinutes();

  if (start < end) {
    // e.g. 01:00 – 06:00
    return current >= start && current < end;
  }
  // Overnight window, e.g. 21:00 – 08:00
  return current >= start || current < end;
}

/**
 * The allowed-to-send check combining opt-in and quiet hours.
 * `bypassQuietHours` is true for urgent events (appointment booked, cancelled).
 */
export function canDeliver(
  preferences: CustomerNotificationPreference[] | undefined | null,
  channelId: NotificationChannelId,
  options: { bypassQuietHours: boolean; now?: Date },
): boolean {
  // Fail closed: null = preferences unknown, never default-opt-in.
  if (preferences === null) return false;
  if (!isOptedIn(preferences, channelId)) return false;
  if (options.bypassQuietHours) return true;
  return !isInQuietHours(preferences, channelId, options.now);
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map((v) => Number(v) || 0);
  return h * 60 + m;
}

export type { CustomerNotificationPreference } from "./types";
