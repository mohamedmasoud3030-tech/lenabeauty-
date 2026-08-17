import { describe, expect, it, afterAll } from "vitest";
import i18n from "../i18n";

const VALIDATION_KEYS = [
  "validation.required",
  "validation.required_select",
  "validation.number_invalid",
  "validation.number_non_negative",
  "validation.number_positive",
  "validation.number_integer",
  "validation.percent_range",
  "validation.over_max",
  "validation.phone_invalid",
  "validation.email_invalid",
  "validation.date_invalid",
  "validation.date_range",
  "validation.past_date",
  "validation.checkout_after_checkin",
  "validation.logo_type",
  "validation.logo_size",
  "validation.vat_range",
];

const UI_KEYS = [
  "VAT Rate",
  "Tax rate saved",
  "Branding settings saved successfully",
  "Reorder Level",
];

describe("validation i18n key coverage", () => {
  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("all validation.* keys resolve and differ from the key in Arabic", async () => {
    for (const lang of ["ar", "en"]) {
      await i18n.changeLanguage(lang);
      for (const key of VALIDATION_KEYS) {
        const value = i18n.t(key);
        expect(value, `${lang} missing ${key}`).toBeTruthy();
        expect(value, `${lang} ${key} equals key`).not.toBe(key);
      }
    }
  });

  it("branding/VAT/reorder UI keys resolve in both languages", async () => {
    for (const lang of ["ar", "en"]) {
      await i18n.changeLanguage(lang);
      for (const key of UI_KEYS) {
        const value = i18n.t(key);
        expect(value, `${lang} missing ${key}`).toBeTruthy();
        if (lang === "ar") expect(value, `${lang} ${key} equals key`).not.toBe(key);
      }
    }
  });
});
