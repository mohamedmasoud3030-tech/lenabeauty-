/**
 * Local, anonymous activation signals.
 *
 * Stored only on this device. No names, emails, or customer records.
 * Used to know whether first value was reached — not for marketing.
 */
export const ACTIVATION_STORAGE_KEY = "lenabeauty_activation_events";

export type ActivationEventName =
  | "guide_shown"
  | "guide_dismissed"
  | "first_service_created"
  | "center_fully_setup"
  | "first_value_reached";

export interface ActivationEvent {
  name: ActivationEventName;
  at: string;
}

const MAX_EVENTS = 40;

export function readActivationEvents(): ActivationEvent[] {
  try {
    const raw = localStorage.getItem(ACTIVATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ActivationEvent => {
      return Boolean(
        row
        && typeof row === "object"
        && typeof (row as ActivationEvent).name === "string"
        && typeof (row as ActivationEvent).at === "string",
      );
    });
  } catch {
    return [];
  }
}

export function recordActivationEvent(name: ActivationEventName): void {
  try {
    const next = [...readActivationEvents(), { name, at: new Date().toISOString() }].slice(-MAX_EVENTS);
    localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function hasActivationEvent(name: ActivationEventName): boolean {
  return readActivationEvents().some((event) => event.name === name);
}
