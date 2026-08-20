/**
 * Communication system tests:
 * - Template interpolation & validation
 * - Bilingual template parity
 * - Deduplication
 * - Preference enforcement (opt-in, quiet hours, urgent bypass)
 * - Rate limiting
 * - Notification service orchestration
 * - WhatsApp wa.me channel behavior
 * - Toast channel behavior
 * - Test mode prefixing
 */

import { describe, expect, it, vi } from "vitest";
import {
  extractVariables,
  validateTemplate,
  validateBilingualTemplate,
  interpolateTemplate,
  renderMessage,
  DEFAULT_TEMPLATES,
  buildDedupKey,
  DedupStore,
  RateLimiter,
  defaultPreferences,
  isOptedIn,
  isInQuietHours,
  canDeliver,
  NotificationService,
} from "../domain/notification";
import {
  ToastChannel,
  WhatsAppWaMeChannel,
} from "../infrastructure/notification";

describe("template interpolation", () => {
  it("replaces all known variables", () => {
    const rendered = interpolateTemplate(
      "Hello {customer_name}, your appointment is at {appointment_time}",
      { customer_name: "Fatima", appointment_time: "4:00 PM" },
    );
    expect(rendered).toBe("Hello Fatima, your appointment is at 4:00 PM");
  });

  it("leaves unknown/missing variables as placeholders", () => {
    const rendered = interpolateTemplate(
      "Hi {customer_name} ({missing_var})",
      { customer_name: "Sara" },
    );
    expect(rendered).toBe("Hi Sara ({missing_var})");
  });

  it("handles numbers by stringifying", () => {
    const rendered = interpolateTemplate(
      "You earned {loyalty_points} points",
      { loyalty_points: 20 },
    );
    expect(rendered).toBe("You earned 20 points");
  });
});

describe("template validation", () => {
  it("rejects unknown variables", () => {
    const errors = validateTemplate("Hello {nonsense_var}");
    expect(errors.some((e) => e.includes("Unknown template variable: nonsense_var"))).toBe(true);
  });

  it("rejects HTML injection", () => {
    const errors = validateTemplate("Hello <script>alert(1)</script>");
    expect(errors.some((e) => e.includes("HTML tags"))).toBe(true);
  });

  it("rejects double braces", () => {
    const errors = validateTemplate("Hello {{customer_name}}");
    expect(errors.some((e) => e.includes("double braces"))).toBe(true);
  });

  it("accepts a valid template", () => {
    const errors = validateTemplate("Hello {customer_name}, appointment at {appointment_time}");
    expect(errors).toEqual([]);
  });

  it("rejects over-length templates", () => {
    const errors = validateTemplate("x".repeat(5000));
    expect(errors.some((e) => e.includes("4096"))).toBe(true);
  });
});

describe("bilingual template parity", () => {
  it("every default template has matching variables in ar and en", () => {
    for (const [eventId, template] of Object.entries(DEFAULT_TEMPLATES)) {
      const errors = validateBilingualTemplate(template, eventId);
      expect(errors, `${eventId} had errors: ${errors.join("; ")}`).toEqual([]);
    }
  });
});

describe("renderMessage", () => {
  it("uses the default template when no custom is provided", () => {
    const message = renderMessage(
      "appointment_booked",
      "en",
      {
        customer_name: "Fatima",
        center_name: "LenaBeauty",
        service_name: "Haircut",
        appointment_date: "Aug 20",
        appointment_time: "4:00 PM",
        staff_name: "Sara",
      },
    );
    expect(message).toContain("Fatima");
    expect(message).toContain("LenaBeauty");
    expect(message).toContain("Haircut");
  });

  it("prefers a custom template", () => {
    const message = renderMessage(
      "appointment_booked",
      "en",
      { customer_name: "Fatima" },
      "Custom: {customer_name}",
    );
    expect(message).toBe("Custom: Fatima");
  });

  it("falls back to a placeholder for missing events", () => {
    const message = renderMessage("unknown_event", "en", {});
    expect(message).toContain("No template");
  });
});

describe("deduplication", () => {
  it("builds a deterministic dedup key", () => {
    const ctx = {
      centerId: "c1",
      customerId: "cu1",
      eventId: "appointment_booked",
      referenceId: "a1",
      templateKey: "appointment_booked",
      variables: {},
      preferredChannel: "whatsapp_wa_me",
      triggeredAt: new Date(),
    } as const;
    const key1 = buildDedupKey(ctx as any, "whatsapp_wa_me");
    const key2 = buildDedupKey(ctx as any, "whatsapp_wa_me");
    expect(key1).toBe(key2);
    expect(key1).toContain("c1");
    expect(key1).toContain("cu1");
    expect(key1).toContain("appointment_booked");
  });

  it("detects duplicates within the window", () => {
    const store = new DedupStore(60);
    const key = "notif_c1_cu1_event_ref_channel";
    expect(store.isDuplicate(key)).toBe(false);
    store.mark(key);
    expect(store.isDuplicate(key)).toBe(true);
  });

  it("allows the key again after the window expires", () => {
    const store = new DedupStore(1);
    const key = "notif_c1_cu1_event_ref_channel";
    store.mark(key, 1000);
    expect(store.isDuplicate(key, 1000 + 61_000)).toBe(false);
  });
});

describe("rate limiting", () => {
  it("allows up to the max within the window", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.allow("key")).toBe(true);
    expect(limiter.allow("key")).toBe(true);
    expect(limiter.allow("key")).toBe(true);
    expect(limiter.allow("key")).toBe(false);
  });
});

describe("preference enforcement", () => {
  it("defaults: WhatsApp opted in, SMS/Email opted out", () => {
    const prefs = defaultPreferences();
    expect(isOptedIn(prefs, "whatsapp_wa_me")).toBe(true);
    expect(isOptedIn(prefs, "sms")).toBe(false);
    expect(isOptedIn(prefs, "email")).toBe(false);
  });

  it("opt-out blocks delivery", () => {
    const prefs = [
      { channelId: "whatsapp_wa_me", optIn: false, updatedAt: new Date() },
    ];
    expect(canDeliver(prefs as any, "whatsapp_wa_me", { bypassQuietHours: true })).toBe(false);
  });

  it("quiet hours block delivery for non-urgent events", () => {
    const prefs = [
      { channelId: "whatsapp_wa_me", optIn: true, quietHourStart: "21:00", quietHourEnd: "08:00", updatedAt: new Date() },
    ];
    // 10 PM local
    const night = new Date("2026-08-20T22:00:00");
    expect(canDeliver(prefs as any, "whatsapp_wa_me", { bypassQuietHours: false, now: night })).toBe(false);
    // 10 AM local
    const day = new Date("2026-08-20T10:00:00");
    expect(canDeliver(prefs as any, "whatsapp_wa_me", { bypassQuietHours: false, now: day })).toBe(true);
  });

  it("urgent events bypass quiet hours", () => {
    const prefs = [
      { channelId: "whatsapp_wa_me", optIn: true, quietHourStart: "21:00", quietHourEnd: "08:00", updatedAt: new Date() },
    ];
    const night = new Date("2026-08-20T22:00:00");
    expect(canDeliver(prefs as any, "whatsapp_wa_me", { bypassQuietHours: true, now: night })).toBe(true);
  });

  it("isInQuietHours handles the overnight window", () => {
    const prefs = [
      { channelId: "sms", optIn: true, quietHourStart: "21:00", quietHourEnd: "08:00", updatedAt: new Date() },
    ];
    expect(isInQuietHours(prefs as any, "sms", new Date("2026-08-20T23:30:00"))).toBe(true);
    expect(isInQuietHours(prefs as any, "sms", new Date("2026-08-20T07:00:00"))).toBe(true);
    expect(isInQuietHours(prefs as any, "sms", new Date("2026-08-20T12:00:00"))).toBe(false);
  });
});

describe("WhatsApp wa.me channel", () => {
  it("fails cleanly when the customer has no phone", async () => {
    const channel = new WhatsAppWaMeChannel(() => undefined);
    const result = await channel.send(
      {
        centerId: "c1",
        customerId: "cu1",
        eventId: "appointment_booked",
        templateKey: "appointment_booked",
        variables: {},
        preferredChannel: "whatsapp_wa_me",
        triggeredAt: new Date(),
      },
      "Hello Fatima",
    );
    expect(result.deliveryStatus).toBe("FAILED");
    expect(result.errorMessage).toContain("No phone");
  });

  it("opens a wa.me link and never claims delivery", async () => {
    const open = vi.fn();
    const channel = new WhatsAppWaMeChannel(() => "+96891234567", open);
    const result = await channel.send(
      {
        centerId: "c1",
        customerId: "cu1",
        eventId: "appointment_reminder",
        templateKey: "appointment_reminder",
        variables: {},
        preferredChannel: "whatsapp_wa_me",
        triggeredAt: new Date(),
      },
      "Reminder",
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe("96891234567");
    expect(result.deliveryStatus).toBe("QUEUED"); // not DELIVERED — no receipt
  });

  it("is configured without credentials", () => {
    const channel = new WhatsAppWaMeChannel(() => undefined);
    expect(channel.isConfigured()).toBe(true);
  });
});

describe("toast channel", () => {
  it("delivers staff toasts in the browser", async () => {
    const showToast = vi.fn();
    const channel = new ToastChannel(showToast, () => true);
    expect(channel.isAvailable()).toBe(true);
    expect(channel.isConfigured()).toBe(true);

    const result = await channel.send(
      {
        centerId: "c1",
        eventId: "low_stock_alert",
        templateKey: "low_stock_alert",
        variables: { customer_name: "Test" },
        preferredChannel: "toast",
        triggeredAt: new Date(),
      },
      "Shampoo is low on stock",
    );
    expect(showToast).toHaveBeenCalledWith("Low stock alert", "Shampoo is low on stock");
    expect(result.deliveryStatus).toBe("SENT");
  });

  it("is unavailable outside the browser", () => {
    const channel = new ToastChannel(() => {}, () => false);
    expect(channel.isAvailable()).toBe(false);
  });
});

describe("NotificationService orchestration", () => {
  const bookingCtx = {
    centerId: "c1",
    customerId: "cu1",
    eventId: "appointment_booked",
    referenceId: "a1",
    templateKey: "appointment_booked",
    variables: {},
    preferredChannel: "whatsapp_wa_me",
    triggeredAt: new Date(),
  };
  function buildService(overrides: any = {}) {
    const channels = overrides.channels ?? {
      toast: new ToastChannel(() => {}, () => true),
      whatsapp_wa_me: new WhatsAppWaMeChannel(() => "+96891234567", () => {}),
    };
    const service = new NotificationService({
      channels,
      getPreferences: overrides.getPreferences ?? (() => undefined),
      getLanguage: () => "en",
      testMode: false,
      ...overrides.deps,
    });
    return service;
  }

  it("dispatches a customer appointment event to WhatsApp", async () => {
    const service = buildService();
    const result = await service.dispatch({
      centerId: "c1",
      customerId: "cu1",
      eventId: "appointment_booked",
      referenceId: "a1",
      templateKey: "appointment_booked",
      variables: {
        customer_name: "Fatima",
        center_name: "LenaBeauty",
        service_name: "Haircut",
        appointment_date: "Aug 20",
        appointment_time: "4:00 PM",
        staff_name: "Sara",
      },
      preferredChannel: "whatsapp_wa_me",
      triggeredAt: new Date(),
    });
    expect(result.deliveryStatus).toBe("QUEUED");
  });

  it("skips duplicates for the same event+reference", async () => {
    const service = buildService();
    const ctx = bookingCtx;
    const first = await service.dispatch(ctx as any);
    expect(first.deliveryStatus).toBe("QUEUED");
    const second = await service.dispatch(ctx as any);
    expect(second.deliveryStatus).toBe("SKIPPED_DUPLICATE");
  });

  it("respects opt-out preferences", async () => {
    const service = buildService({
      getPreferences: () => [
        { channelId: "whatsapp_wa_me", optIn: false, updatedAt: new Date() },
      ],
    });
    const result = await service.dispatch({
      centerId: "c1",
      customerId: "cu1",
      eventId: "appointment_booked",
      referenceId: "a1",
      templateKey: "appointment_booked",
      variables: {},
      preferredChannel: "whatsapp_wa_me",
      triggeredAt: new Date(),
    });
    expect(result.deliveryStatus).toBe("SKIPPED_PREFERENCE");
  });

  it("prefixes messages in test mode", async () => {
    const showToast = vi.fn();
    const service = new NotificationService({
      channels: { toast: new ToastChannel(showToast, () => true) },
      getPreferences: () => undefined,
      getLanguage: () => "en",
      testMode: true,
    });
    await service.notifyStaff("low_stock_alert", "c1", { customer_name: "X" }, "p1");
    const rendered = showToast.mock.calls[0][1];
    expect(rendered.startsWith("[TEST MODE]")).toBe(true);
  });

  it("skips when the event is unknown", async () => {
    const service = buildService();
    const result = await service.dispatch({
      centerId: "c1",
      eventId: "not_a_real_event",
      templateKey: "x",
      variables: {},
      preferredChannel: "toast",
      triggeredAt: new Date(),
    } as any);
    expect(result.deliveryStatus).toBe("QUEUED"); // skipped with UNKNOWN_EVENT
    expect(result.errorMessage).toContain("Unknown event");
  });

  it("staff notification helper dispatches via toast", async () => {
    const showToast = vi.fn();
    const service = new NotificationService({
      channels: { toast: new ToastChannel(showToast, () => true) },
      getPreferences: () => undefined,
      getLanguage: () => "en",
      testMode: false,
    });
    const result = await service.notifyStaff("appointment_completed", "c1", {}, "a1");
    expect(result.deliveryStatus).toBe("SENT");
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
