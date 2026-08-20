/**
 * Deduplication for notification delivery.
 * A deterministic dedup key is derived from the event context so
 * repeated triggers produce at most one send per channel within a window.
 */

import { NotificationContext } from "./types";

/**
 * Build the deterministic dedup key for a notification.
 * Format: notif_<centerId>_<customerId|staff>_<eventId>_<referenceId>_<channel>
 */
export function buildDedupKey(
  context: NotificationContext,
  channelId: string,
): string {
  const scope = context.customerId ?? `staff:${context.staffId ?? "unknown"}`;
  return [
    "notif",
    context.centerId,
    scope,
    context.eventId,
    context.referenceId ?? "no-ref",
    channelId,
  ].join("_");
}

/**
 * In-memory deduplication store for the current session.
 * Persisted store (database) is provided by the repository layer.
 */
export class DedupStore {
  private recent = new Map<string, number>();

  constructor(private windowMinutes: number) {}

  /**
   * Check whether the key has been seen within the window.
   * Returns true if it's a duplicate (should skip).
   */
  isDuplicate(key: string, now: number = Date.now()): boolean {
    const last = this.recent.get(key);
    if (last === undefined) return false;
    return now - last < this.windowMinutes * 60_000;
  }

  /** Record a key as seen now. */
  mark(key: string, now: number = Date.now()): void {
    this.recent.set(key, now);
  }

  /** Forget keys older than the window (bounded memory). */
  prune(now: number = Date.now()): void {
    const cutoff = now - this.windowMinutes * 60_000;
    for (const [key, ts] of this.recent) {
      if (ts < cutoff) this.recent.delete(key);
    }
  }
}

/**
 * A small rate limiter: max N events per windowMs per key.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Whether sending now would exceed the limit. */
  allow(key: string, now: number = Date.now()): boolean {
    const list = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
}
