/**
 * NotificationService — the orchestrator of the communication system.
 *
 * Pipeline per notification:
 *   event meta → preferences check → dedup check → rate limit
 *   → channel availability → render message → channel send → log result
 *
 * This is a pure orchestrator: it accepts channel adapters and a
 * preference provider, so it is fully testable without any provider.
 */

import {
  NotificationChannel,
  NotificationChannelId,
  NotificationContext,
  NotificationEventMeta,
  NotificationResult,
} from "./types";
import { getEventMeta } from "./events";
import {
  CustomerNotificationPreference,
  canDeliver,
} from "./preferences";
import { DedupStore, RateLimiter, buildDedupKey } from "./dedup";
import { renderMessage } from "./templates";
import { logger } from "../../shared/logger";
import { createShortId } from "../../shared/ids";

export interface NotificationServiceDeps {
  /** Channel adapters, keyed by channel id. Missing channels are skipped. */
  channels: Partial<Record<NotificationChannelId, NotificationChannel>>;
  /** Per-customer preferences (undefined = defaults). */
  getPreferences: (
    customerId: string | undefined,
  ) => CustomerNotificationPreference[] | undefined;
  /** Language for message rendering. */
  getLanguage: () => "ar" | "en";
  /** Custom templates override (optional, from settings). */
  getCustomTemplate?: (eventId: string) => string | undefined;
  /** Test mode: prefixes messages and never calls external providers. */
  testMode?: boolean;
  /** Dedup window override (minutes). */
  dedupWindowMinutes?: number;
}

export class NotificationService {
  private dedup: DedupStore;
  private rateLimiter: RateLimiter;

  constructor(private deps: NotificationServiceDeps) {
    this.dedup = new DedupStore(deps.dedupWindowMinutes ?? 1440);
    this.rateLimiter = new RateLimiter(50, 60_000);
  }

  /**
   * Dispatch a notification through the pipeline.
   * Returns the delivery result (or a skipped result).
   */
  async dispatch(context: NotificationContext): Promise<NotificationResult> {
    const meta = getEventMeta(context.eventId);
    if (!meta) {
      return this.skipped(
        context,
        "QUEUED" as never,
        "UNKNOWN_EVENT",
        `Unknown event: ${context.eventId}`,
      );
    }

    // 1. Choose the channel: prefer the context's preferred channel if it is
    //    available for this event; otherwise fall back to the first available.
    const channelId = this.resolveChannel(meta, context.preferredChannel);
    if (!channelId) {
      return this.skipped(
        context,
        "SKIPPED_PREFERENCE" as never,
        "NO_CHANNEL",
        "No available channel for this event",
      );
    }

    const channel = this.deps.channels[channelId];
    if (!channel) {
      return this.skipped(
        context,
        "SKIPPED_PREFERENCE" as never,
        "NO_CHANNEL_ADAPTER",
        `Channel adapter missing: ${channelId}`,
      );
    }

    // 2. Dedup check (deterministic key).
    const dedupKey = buildDedupKey(context, channelId);
    if (this.dedup.isDuplicate(dedupKey)) {
      return this.skipped(
        context,
        "SKIPPED_DUPLICATE" as never,
        "DUPLICATE",
        "Duplicate notification within dedup window",
      );
    }

    // 3. Preference gate (opt-in + quiet hours).
    const prefs = this.deps.getPreferences(context.customerId);
    if (!canDeliver(prefs, channelId, { bypassQuietHours: meta.bypassQuietHours })) {
      return this.skipped(
        context,
        "SKIPPED_PREFERENCE" as never,
        "PREFERENCE",
        `Customer preference blocks channel ${channelId}`,
      );
    }

    // 4. Rate limit.
    const rateKey = `${channelId}:${context.customerId ?? "staff"}`;
    if (!this.rateLimiter.allow(rateKey)) {
      return this.skipped(
        context,
        "SKIPPED_DUPLICATE" as never,
        "RATE_LIMIT",
        "Rate limit reached",
      );
    }

    // 5. Channel availability.
    if (!channel.isAvailable() || !channel.isConfigured()) {
      return this.skipped(
        context,
        "SKIPPED_PREFERENCE" as never,
        "CHANNEL_UNAVAILABLE",
        `Channel ${channelId} is not available/configured`,
      );
    }

    // 6. Render the message.
    const language = this.deps.getLanguage();
    const customTemplate = this.deps.getCustomTemplate?.(context.eventId);
    let rendered = renderMessage(context.eventId, language, context.variables, customTemplate);
    if (this.deps.testMode) {
      rendered = `[TEST MODE] ${rendered}`;
    }

    // 7. Send via the channel.
    this.dedup.mark(dedupKey);
    const result = await channel.send(context, rendered);
    logger.debug("[NotificationService]", { event: context.eventId, channel: channelId, status: result.deliveryStatus });
    return result;
  }

  /** In-app staff toast helper — convenient wrapper around dispatch. */
  notifyStaff(
    eventId: NotificationContext["eventId"],
    centerId: string,
    variables: NotificationContext["variables"],
    referenceId?: string,
  ): Promise<NotificationResult> {
    return this.dispatch({
      centerId,
      eventId,
      referenceId,
      variables,
      templateKey: eventId,
      preferredChannel: "toast",
      triggeredAt: new Date(),
    });
  }

  private resolveChannel(
    meta: NotificationEventMeta,
    preferred: NotificationChannelId,
  ): NotificationChannelId | undefined {
    if (meta.availableChannels.includes(preferred)) return preferred;
    return meta.availableChannels[0];
  }

  private skipped(
    context: NotificationContext,
    status: NotificationResult["deliveryStatus"],
    errorCode: string,
    message: string,
  ): NotificationResult {
    logger.debug("[NotificationService]", { skip: errorCode, event: context.eventId });
    return {
      notificationId: `skip_${Date.now()}_${createShortId(4)}`,
      context,
      channel: context.preferredChannel,
      deliveryStatus: status,
      attemptedAt: new Date(),
      errorMessage: message,
      dedupKey: buildDedupKey(context, context.preferredChannel),
    };
  }
}
