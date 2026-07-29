import { describe, expect, it, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../i18n";
import DemoDataBanner from "../shared/components/DemoDataBanner";
import { mapErrorToMessageKey } from "../application/errors/ErrorMapper";

describe("i18n coverage regressions (Phase A)", () => {
  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  // In AR, keys are non-identical to their translation, so `t(key) !== key`
  // proves the key exists. In EN many keys ARE the English text, so we only
  // assert AR-non-identity + that the resolved string is non-empty in both.
  const resolvesIn = async (lang: string, keys: string[]) => {
    await i18n.changeLanguage(lang);
    for (const k of keys) {
      const v = i18n.t(k);
      expect(v, `${lang} empty ${k}`).toBeTruthy();
      if (lang === "ar") {
        expect(v, `AR missing translation for ${k}`).not.toBe(k);
      }
    }
  };

  it("appointment status keys resolve in both languages (CANCELLED/NO_SHOW were missing)", async () => {
    const statuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];
    await resolvesIn("ar", statuses);
    await resolvesIn("en", statuses);
  });

  it("error.* keys (from ErrorMapper) resolve in both languages", async () => {
    const keys = [
      "error.unexpected",
      "error.auth_not_configured",
      "error.unauthorized",
      "error.forbidden",
      "error.not_found",
      "error.validation",
      "error.conflict",
      "error.infrastructure",
      "error.invalid_credentials",
    ];
    // These dotted keys are NOT the literal text, so they must differ in both languages.
    for (const lang of ["ar", "en"]) {
      await i18n.changeLanguage(lang);
      for (const k of keys) {
        expect(i18n.t(k), `${lang} missing ${k}`).not.toBe(k);
      }
    }
  });

  it("ErrorMapper maps codes to the i18n keys that exist", async () => {
    await i18n.changeLanguage("en");
    const key = mapErrorToMessageKey({ code: "FORBIDDEN" });
    expect(key).toBe("error.forbidden");
    expect(i18n.t(key)).not.toBe(key);
  });

  it("lazy-chart UI strings resolve in both languages", async () => {
    const keys = ["Show chart", "Tap to view", "Collapse", "Last updated"];
    await resolvesIn("ar", keys);
    await resolvesIn("en", keys);
  });
});

describe("DemoDataBanner", () => {
  it("renders the demo-data disclosure (Arabic)", async () => {
    await i18n.changeLanguage("ar");
    render(<DemoDataBanner />);
    expect(screen.getByText(i18n.t("Demo data"))).toBeInTheDocument();
  });

  it("renders the demo-data disclosure (English)", async () => {
    await i18n.changeLanguage("en");
    render(<DemoDataBanner />);
    expect(screen.getByText("Demo data")).toBeInTheDocument();
  });
});
