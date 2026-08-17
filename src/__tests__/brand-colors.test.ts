import { describe, expect, it, vi, beforeEach } from "vitest";
import { isValidBrandColor, normalizeBrandColor, LENA_BRAND_PALETTE } from "../shared/theme/brandPalette";

/**
 * Strict brand-color contract tests.
 *
 * Brand colors are interpolated into generated CSS (print documents) and
 * persisted (Supabase + localStorage), so only #RRGGBB may pass any boundary.
 * CSS payloads, named colors, rgb()/hsl()/url()/var() values, and malformed
 * hex must all be rejected and normalized to safe defaults.
 */

describe("isValidBrandColor", () => {
  it("accepts strict #RRGGBB values (case-insensitive, trimmed)", () => {
    expect(isValidBrandColor("#8B5CF6")).toBe(true);
    expect(isValidBrandColor("#8b5cf6")).toBe(true);
    expect(isValidBrandColor("  #06B6D4  ")).toBe(true);
  });

  it("rejects CSS injection payloads and malformed colors", () => {
    const payloads = [
      "red",
      "red; } body { display: none; }",
      "rgb(1, 2, 3)",
      "hsl(0, 0%, 0%)",
      "url(https://attacker.invalid/leak)",
      "url(javascript:alert(1))",
      "var(--x)",
      "#123",
      "#12345",
      "#1234567",
      "##123456",
      "#GGGGGG",
      "#8B5CF6 !important",
      "",
      " ",
    ];
    for (const payload of payloads) {
      expect(isValidBrandColor(payload), `should reject ${JSON.stringify(payload)}`).toBe(false);
    }
    expect(isValidBrandColor(null)).toBe(false);
    expect(isValidBrandColor(undefined)).toBe(false);
    expect(isValidBrandColor(123456)).toBe(false);
    expect(isValidBrandColor({ color: "#8B5CF6" })).toBe(false);
  });
});

describe("normalizeBrandColor", () => {
  it("returns valid colors unchanged (trimmed)", () => {
    expect(normalizeBrandColor("#8B5CF6", "#000000")).toBe("#8B5CF6");
    expect(normalizeBrandColor("  #8b5cf6 ", "#000000")).toBe("#8b5cf6");
  });

  it("falls back for any invalid value so no payload ever reaches a stylesheet", () => {
    const fallback = LENA_BRAND_PALETTE.primary;
    for (const payload of ["red; } body{}", "url(x)", "rgb(1,2,3)", "#123", null, undefined, 42]) {
      expect(normalizeBrandColor(payload, fallback)).toBe(fallback);
    }
  });
});

describe("brandingService color sanitization", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  async function freshService() {
    const mod = await import("../infrastructure/services/brandingService");
    return mod.default;
  }

  it("sanitizes malicious cached colors to defaults on load (localStorage is user-writable)", async () => {
    localStorage.setItem(
      "lenabeauty_branding",
      JSON.stringify({
        salonName: "Cached Salon",
        primaryColor: "red; } body { display: none; }",
        secondaryColor: "url(https://attacker.invalid)",
        accentColor: "var(--x)",
      }),
    );
    const service = await freshService();
    expect(service.getSettings().salonName).toBe("Cached Salon");
    expect(service.getSettings().primaryColor).toBe(LENA_BRAND_PALETTE.primary);
    expect(service.getSettings().secondaryColor).toBe(LENA_BRAND_PALETTE.secondary);
    expect(service.getSettings().accentColor).toBe(LENA_BRAND_PALETTE.surfaceAccent);
  });

  it("updateSettings sanitizes colors before caching them", async () => {
    const service = await freshService();
    service.updateSettings({
      primaryColor: "#112233",
      secondaryColor: "red; } body{}",
      accentColor: "hsl(1,2%,3%)",
    });
    expect(service.getSettings().primaryColor).toBe("#112233");
    expect(service.getSettings().secondaryColor).toBe(LENA_BRAND_PALETTE.secondary);
    expect(service.getSettings().accentColor).toBe(LENA_BRAND_PALETTE.surfaceAccent);

    const cached = JSON.parse(localStorage.getItem("lenabeauty_branding") || "{}");
    expect(cached.primaryColor).toBe("#112233");
    expect(cached.secondaryColor).toBe(LENA_BRAND_PALETTE.secondary);
    expect(cached.accentColor).toBe(LENA_BRAND_PALETTE.surfaceAccent);
  });

  it("getCSSVariables only ever emits strict #RRGGBB values (emission boundary)", async () => {
    const service = await freshService();
    // Bypass the sanitizing mutators to prove the emission boundary holds on
    // its own: replace the instance's settings reference with poisoned values
    // (replacing the reference keeps the module-level defaults pristine).
    (service as any).settings = {
      ...(service as any).settings,
      primaryColor: "red; } body { display: none; }",
      secondaryColor: "url(x)",
      accentColor: "#06B6D4",
    };
    const vars = service.getCSSVariables();
    expect(vars["--primary-color"]).toBe(LENA_BRAND_PALETTE.primary);
    expect(vars["--secondary-color"]).toBe(LENA_BRAND_PALETTE.secondary);
    expect(vars["--accent-color"]).toBe("#06B6D4");
  });

  it("updateSettings with a null logo removes the separate cached logo key", async () => {
    const service = await freshService();
    localStorage.setItem("lenabeauty_logo", "data:image/png;base64,STALELOGO");
    service.updateSettings({ logo: null });
    expect(localStorage.getItem("lenabeauty_logo")).toBeNull();
    // A fresh instance must not resurrect the removed logo.
    const reloaded = await freshService();
    expect(reloaded.getSettings().logo).toBeNull();
  });

  it("importSettings rejects non-object JSON", async () => {
    const service = await freshService();
    expect(service.importSettings("[1,2,3]")).toBe(false);
    expect(service.importSettings('"just a string"')).toBe(false);
    expect(service.importSettings("null")).toBe(false);
  });

  it("importSettings rejects empty or unknown-only objects (would wipe real branding with defaults)", async () => {
    const service = await freshService();
    expect(service.importSettings("{}")).toBe(false);
    expect(service.importSettings('{"foo":"bar"}')).toBe(false);
    expect(service.importSettings('{"salonName":"partial"}')).toBe(false);
    // Nothing may be cached from a rejected import.
    expect(localStorage.getItem("lenabeauty_branding")).toBeNull();
  });

  it("importSettings accepts a complete snapshot and normalizes hostile colors", async () => {
    const service = await freshService();
    const ok = service.importSettings(
      JSON.stringify({
        salonName: "Imported", salonNameAr: "مستورد",
        address: "A", addressAr: "ع", phone: "1", email: "e@x.c",
        taxNumber: "T", registrationNumber: "R",
        footerText: "F", footerTextAr: "ف", logo: null,
        primaryColor: "red; } body { display: none; }",
        secondaryColor: "#112233",
        accentColor: "url(https://attacker.invalid)",
      }),
    );
    expect(ok).toBe(true);
    expect(service.getSettings().salonName).toBe("Imported");
    expect(service.getSettings().primaryColor).toBe(LENA_BRAND_PALETTE.primary);
    expect(service.getSettings().secondaryColor).toBe("#112233");
    expect(service.getSettings().accentColor).toBe(LENA_BRAND_PALETTE.surfaceAccent);
  });
});
