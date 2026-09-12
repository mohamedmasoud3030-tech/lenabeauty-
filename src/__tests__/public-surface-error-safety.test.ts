import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The public (#/book, #/portal) surfaces are reachable by anyone, so an error
 * there must never echo server internals. Before this guard, a missing grant on
 * the Demo project rendered this to an anonymous visitor:
 *
 *   Query failed in [Public.centerInfo]: permission denied for function public_center_info_v1
 *
 * That names an internal object and an internal method, and it was visible on
 * the live deployment.
 */

const PUBLIC_PAGES = [
  "src/pages/public/PublicBookingPage.tsx",
  "src/pages/public/ClientPortalPage.tsx",
];

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public surfaces never render raw server errors", () => {
  it.each(PUBLIC_PAGES)("%s routes error text through formatPublicError", (path) => {
    const source = readSource(path);

    expect(source).toContain("formatPublicError");
    // The raw formatter would pass PostgREST text straight through to a
    // signed-out visitor.
    expect(source).not.toMatch(/\bformatError\s*\(/);
  });

  it.each(PUBLIC_PAGES)("%s supplies a human fallback message for suppressed detail", (path) => {
    const source = readSource(path);
    const calls = source.match(/formatPublicError\([^)]*\)/g) ?? [];

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // Every call passes a second argument: the localized generic message.
      expect(call.split(",").length).toBeGreaterThan(1);
    }
  });
});

describe("formatPublicError behaviour", () => {
  it("suppresses transport detail and keeps a signed-out visitor unblocked", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");
    const raw = {
      code: "INFRASTRUCTURE_ERROR",
      message: "Query failed in [Public.centerInfo]: permission denied for function public_center_info_v1",
    };

    const shown = formatPublicError(raw, "Booking is unavailable right now");

    expect(shown).toBe("Booking is unavailable right now");
    expect(shown).not.toContain("permission denied");
    expect(shown).not.toContain("public_center_info_v1");
    expect(shown).not.toContain("Public.centerInfo");
  });

  it("suppresses PostgREST codes such as PGRST202 and SQLSTATE leaks", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");

    expect(formatPublicError({ message: "PGRST202 Could not find the function" }, "fallback")).toBe("fallback");
    expect(formatPublicError({ message: "42501 permission denied for table customers" }, "fallback")).toBe("fallback");
  });

  it("still shows the server messages the portal is designed to present", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");
    const i18n = (await import("../i18n")).default;

    // Portal lockout is a deliberate, user-recoverable message — never suppressed.
    expect(formatPublicError({ message: "Account temporarily locked. Try again later." }, "fallback")).toBe(
      "Account temporarily locked. Try again later.",
    );

    // snake_case action codes are localized rather than shown raw.
    const shown = formatPublicError({ message: "invalid_portal_credentials" }, "fallback");
    expect(shown).toBe(i18n.t("Invalid portal credentials"));
    expect(shown).not.toContain("_");
    expect(shown).not.toBe("fallback");
  });

  it("localizes every cancel/reschedule action code the server can raise", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");
    const i18n = (await import("../i18n")).default;

    const codes = [
      "appointment_not_found",
      "invalid_portal_credentials",
      "only_scheduled_can_be_cancelled",
      "cannot_cancel_past_or_started_appointment",
      "only_scheduled_can_be_rescheduled",
      "cannot_reschedule_past_or_started_appointment",
      "new_time_must_be_in_future",
      "selected_staff_not_available",
      "this_time_slot_is_no_longer_available",
    ];

    await i18n.changeLanguage("ar");
    for (const code of codes) {
      const shown = formatPublicError({ message: code }, "fallback");
      expect(shown, `${code} was not localized`).not.toBe(code);
      expect(shown, `${code} leaked a snake_case code`).not.toContain("_");
      expect(shown, `${code} fell through to the generic fallback`).not.toBe("fallback");
      expect(shown, `${code} is not Arabic`).toMatch(/[\u0600-\u06FF]/);
    }
    await i18n.changeLanguage("en");
    expect(formatPublicError({ message: "this_time_slot_is_no_longer_available" }, "fallback")).toBe(
      "This time slot is no longer available",
    );
  });

  it("keeps deliberate booking business messages intact", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");

    // Raised by public_create_booking_v1 when a slot is taken mid-flow.
    expect(formatPublicError({ message: "This time slot is no longer available" }, "fallback")).toBe(
      "This time slot is no longer available",
    );
    expect(formatPublicError({ message: "Service is not available" }, "fallback")).toBe("Service is not available");
    expect(formatPublicError({ message: "Cannot book a time in the past" }, "fallback")).toBe(
      "Cannot book a time in the past",
    );
  });

  it("preserves structured validation keys so per-field messages keep working", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");

    const shown = formatPublicError(
      { code: "VALIDATION_ERROR", issues: [{ key: "validation.required" }] },
      "fallback",
    );

    expect(shown).toBe("validation.required");
  });

  it("suppresses SQLSTATE and PostgREST markers", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");

    expect(formatPublicError({ message: "42501 permission denied for table customers" }, "fallback")).toBe("fallback");
    expect(formatPublicError({ message: 'relation "public.customers" does not exist' }, "fallback")).toBe("fallback");
    expect(formatPublicError({ message: "column service_recipes.id does not exist" }, "fallback")).toBe("fallback");
    expect(formatPublicError({ message: "Invalid API key" }, "fallback")).toBe("fallback");
  });

  it("falls back for an empty or missing error", async () => {
    const { formatPublicError } = await import("../shared/hooks/useApplication");

    expect(formatPublicError(undefined, "fallback")).toBe("fallback");
  });
});

describe("i18n parity for the new public fallbacks", () => {
  const keys = [
    "Could not sign in. Please check your phone number and portal code.",
    "The request could not be completed. Please try again.",
  ];

  it("declares every new key in both dictionaries", () => {
    for (const lang of ["ar", "en"]) {
      const source = readSource(`src/i18n/${lang}/booking.ts`);
      for (const key of keys) {
        expect(source, `${lang} missing "${key}"`).toContain(`"${key}"`);
      }
    }
  });

  it("translates the new keys in Arabic rather than leaving English text", () => {
    const arabic = readSource("src/i18n/ar/booking.ts");
    for (const key of keys) {
      const match = arabic.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*"([^"]+)"`));
      expect(match, `no Arabic value for "${key}"`).toBeTruthy();
      expect(match?.[1]).not.toBe(key);
      expect(match?.[1]).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("keeps the ar/en key sets identical once more keys are added", () => {
    const keysIn = (lang: string) => {
      const source = readSource(`src/i18n/${lang}/booking.ts`);
      return new Set([...source.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
    };

    const ar = keysIn("ar");
    const en = keysIn("en");

    expect([...ar].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !ar.has(k))).toEqual([]);
  });
});

describe("no build entrypoint can inject Demo credentials implicitly", () => {
  it("contains no hardcoded Supabase project URL in any build script", () => {
    const scripts = readdirSync(resolve(process.cwd(), "scripts")).filter((f) => f.endsWith(".mjs"));

    for (const file of scripts) {
      const source = readSource(`scripts/${file}`);
      expect(
        /https:\/\/[a-z0-9]+\.supabase\.co/.test(source),
        `${file} embeds a Supabase project URL literal`,
      ).toBe(false);
    }
  });

  it("gates every Demo-constant read behind an explicit opt-in check", () => {
    const scripts = readdirSync(resolve(process.cwd(), "scripts")).filter((f) => f.endsWith(".mjs"));

    for (const file of scripts) {
      const source = readSource(`scripts/${file}`);
      const readsDemoConstants = /LENA_DEMO_SUPABASE_URL/.test(source);
      if (!readsDemoConstants) continue;
      // Reading the Demo constants is only acceptable when the same module
      // also verifies the explicit opt-in before using them.
      expect(source, `${file} reads Demo constants without an opt-in guard`).toContain("VITE_USE_DEMO_CREDENTIALS");
    }
  });

  it("keeps the removed script deleted", () => {
    const scripts = readdirSync(resolve(process.cwd(), "scripts"));
    expect(scripts).not.toContain("vercel-demo-build.mjs");
  });
});
