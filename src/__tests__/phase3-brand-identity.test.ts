import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PARENT_HOUSE_NAME, PRODUCT_NAME, PRODUCT_NAME_AR, appName } from "../config/brand";
import { formatOMRAmount, OMR_FRACTION_DIGITS } from "../shared/money";
import brandingService from "../infrastructure/services/brandingService";

/**
 * PHASE 3 — brand and money consistency.
 *
 * Two identities must stay separated:
 *
 *   FIXED      the product and its developer (src/config/brand.ts)
 *   SALON      the name and logo an operator saves in Settings
 *
 * The rule this file enforces: the salon's identity replaces the product
 * everywhere a salon-facing surface renders, and the developer attribution is
 * never overwritten by a customer setting. Before Phase 3 the shell, the
 * document title and the receipt signature were hard-coded, so configuring a
 * salon renamed nothing.
 */

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function listSources(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { recursive: true })
    .map((entry) => String(entry))
    .filter((entry) => /\.(ts|tsx|css)$/.test(entry) && !entry.includes("__tests__"))
    .map((entry) => `${dir}/${entry}`);
}

afterEach(() => {
  brandingService.resetToDefaults();
});

describe("fixed product identity", () => {
  it("keeps the product name and the developer attribution as constants", () => {
    expect(PRODUCT_NAME).toBe("Lara Beauty");
    expect(PRODUCT_NAME_AR).toBe("لارا بيوتي");
    expect(PARENT_HOUSE_NAME).toBe("LENA Digital House");
  });

  it("is the single place the product name is written literally", () => {
    const offenders: string[] = [];
    for (const file of [...listSources("src"), "vite.config.ts", "index.html"]) {
      const source = readSource(file);
      if (file === "src/config/brand.ts") continue;
      // Prose in comments/docs is allowed; an assignment or JSX literal is not.
      for (const match of source.matchAll(/(?:=\s*|>|:\s*|,\s*)["'`]([^"'`]*\bLara Beauty\b[^"'`]*)["'`]/g)) {
        const line = source.slice(0, match.index).split("\n").length;
        const lineText = source.split("\n")[line - 1] ?? "";
        if (lineText.trimStart().startsWith("*") || lineText.trimStart().startsWith("//")) continue;
        offenders.push(`${file}:${line}`);
      }
    }
    // Two files may name the product literally:
    //   - i18n dictionaries: the name is a translation value;
    //   - index.html: the static pre-boot shell. Its <title> is replaced by
    //     Layout with the salon name as soon as React mounts, and the installed
    //     app label comes from the manifest, which is built from the constant.
    const allowed = offenders.filter(
      (entry) => !entry.includes("src/i18n/") && !entry.startsWith("index.html:"),
    );
    expect(allowed).toEqual([]);
  });

  it("lets an operator brand the installed app per client, defaulting to the product name", () => {
    expect(appName()).toBe(PRODUCT_NAME);
  });

  it("keeps the developer attribution in its designated places", () => {
    // Login endorsement is the developer's own surface and must not follow a
    // customer setting.
    expect(readSource("src/pages/LoginPage.tsx")).toContain("PARENT_HOUSE_NAME");
    expect(readSource("src/lib/lena-house.ts")).toContain("PARENT_HOUSE_NAME");
    expect(readSource("src/lib/lena-house.ts")).toContain("PARENT_HOUSE_URL");
  });

  it("fails the PWA manifest over to the product name rather than a stale literal", () => {
    const vite = readSource("vite.config.ts");
    expect(vite).toContain("appName()");
    expect(vite).not.toMatch(/short_name:\s*['"]Lara/);
  });
});

describe("salon identity replaces the product identity end to end", () => {
  it("starts from the product fallback so an unconfigured deployment invents nothing", () => {
    brandingService.resetToDefaults();
    const settings = brandingService.getSettings();

    expect(settings.salonName).toBe(PRODUCT_NAME);
    expect(settings.salonNameAr).toBe(PRODUCT_NAME_AR);
    expect(brandingService.getSalonLogo()).toBeNull();
  });

  it("reports the configured salon name in both languages", () => {
    brandingService.updateSettings({ salonName: "Layla Beauty", salonNameAr: "ليلى بيوتي" });

    expect(brandingService.getSalonName(false)).toBe("Layla Beauty");
    expect(brandingService.getSalonName(true)).toBe("ليلى بيوتي");
  });

  it("falls back per language when only one name is configured", () => {
    brandingService.updateSettings({ salonName: "Layla Beauty", salonNameAr: "   " });

    expect(brandingService.getSalonName(false)).toBe("Layla Beauty");
    expect(brandingService.getSalonName(true)).toBe(PRODUCT_NAME_AR);
  });

  it("notifies subscribers so the shell updates without a reload", () => {
    const seen: string[] = [];
    const unsubscribe = brandingService.subscribe((settings) => seen.push(settings.salonName));

    // Subscribing must not fire immediately: the hook already reads the
    // current value before it subscribes, so an initial callback would be a
    // redundant render.
    expect(seen).toEqual([]);

    brandingService.updateSettings({ salonName: "Layla Beauty" });
    brandingService.updateSettings({ salonName: "Noor Beauty" });
    unsubscribe();
    brandingService.updateSettings({ salonName: "Ignored" });

    expect(seen).toEqual(["Layla Beauty", "Noor Beauty"]);
  });

  it("keeps working when one subscriber throws", () => {
    const seen: string[] = [];
    const unsubscribeBad = brandingService.subscribe(() => {
      throw new Error("broken subscriber");
    });
    const unsubscribeGood = brandingService.subscribe((settings) => seen.push(settings.salonName));

    brandingService.updateSettings({ salonName: "Layla Beauty" });

    unsubscribeBad();
    unsubscribeGood();
    expect(seen).toEqual(["Layla Beauty"]);
  });

  it("exposes the salon logo separately from the product mark", () => {
    brandingService.updateSettings({ logo: "data:image/png;base64,AAA" });
    expect(brandingService.getSalonLogo()).toBe("data:image/png;base64,AAA");

    brandingService.updateSettings({ logo: null });
    expect(brandingService.getSalonLogo()).toBeNull();
  });
});

describe("salon-facing surfaces read the salon identity", () => {
  const surfaces = [
    "src/ui/layout/Sidebar.tsx",
    "src/ui/layout/Layout.tsx",
    "src/ui/layout/MobileNavigationSheet.tsx",
  ];

  it.each(surfaces)("%s renders the configured salon name", (path) => {
    const source = readSource(path);
    expect(source).toContain("useSalonIdentity");
    expect(source).not.toMatch(/>\s*Lara Beauty\s*</);
  });

  it("renders the salon's logo in the shell once it is configured", () => {
    for (const path of surfaces) {
      const source = readSource(path);
      expect(source, `${path} does not fall back to the salon logo`).toContain("salon.logoUrl");
    }
  });

  it("titles the browser tab with the salon name", () => {
    const layout = readSource("src/ui/layout/Layout.tsx");
    expect(layout).toContain("`${pageTitle} — ${salon.name}`");
    expect(layout).not.toContain("— Lara Beauty");
  });

  it("signs printed receipts with the salon, falling back to the product mark", () => {
    const print = readSource("src/shared/components/InvoicePrintLayout.tsx");
    expect(print).toContain("aria-label={salonName}");
    expect(print).not.toContain("LARA · BEAUTY");
    // The product mark survives only as the unconfigured fallback.
    expect(print).toMatch(/receiptLogo\s*\?[\s\S]*?\/lena-mark\.svg/);
  });

  it("introduces the AI assistant as the salon's own assistant", () => {
    const assistant = readSource("src/shared/components/AdminAssistantPanel.tsx");
    expect(assistant).toContain("useSalonIdentity");
    expect(assistant).toContain("${salon.name}");
  });

  it("never translates a customer-supplied salon name as an i18n key", () => {
    // A salon called "Book" or "Settings" must not be rewritten by the
    // dictionary. The hook returns the raw value.
    const hook = readSource("src/shared/hooks/useSalonIdentity.ts");
    expect(hook).toContain("brandingService.getSalonName");
    expect(hook).not.toMatch(/\bt\(\s*.*salonName/);
  });
});

describe("OMR amounts are formatted by one contract", () => {
  it("uses three decimals, the precision the database and checkout contract use", () => {
    expect(OMR_FRACTION_DIGITS).toBe(3);
    expect(formatOMRAmount(12.075)).toBe("12.075");
  });

  it("renders no-show fees with full OMR precision", () => {
    // Regression: these two sites used toFixed(2), so a 12.075 OMR fee showed
    // as 12.08 while every other amount in the app showed three decimals.
    expect(formatOMRAmount(12.075)).not.toBe((12.075).toFixed(2));

    for (const path of [
      "src/pages/AppointmentsPage.tsx",
      "src/pages/appointments/AppointmentBookingDialog.tsx",
    ]) {
      const source = readSource(path);
      expect(source, `${path} still formats money with toFixed`).toContain("formatOMRAmount");
      expect(source).not.toMatch(/chargedAmount\.toFixed|noShowFeeAmount\)\.toFixed/);
    }
  });

  it("leaves no raw toFixed money formatting in the shipped source", () => {
    const offenders: string[] = [];
    for (const file of [...listSources("src/pages"), ...listSources("src/shared"), ...listSources("src/infrastructure")]) {
      const source = readSource(file);
      source.split("\n").forEach((line, index) => {
        if (!/toFixed\((2|3)\)/.test(line)) return;
        // Work hours and percentages are not money.
        if (/hours|Hours|percent|Percent|%\s*\)/i.test(line)) return;
        offenders.push(`${file}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("never leaks NaN or negative zero into a receipt", () => {
    expect(formatOMRAmount(Number.NaN)).toBe("0.000");
    expect(formatOMRAmount(Number.POSITIVE_INFINITY)).toBe("0.000");
    expect(formatOMRAmount(-0.0000001)).toBe("0.000");
  });
});
