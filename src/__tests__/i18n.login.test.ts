import { describe, expect, it } from "vitest";
import i18n from "../i18n";

describe("LoginPage Arabic translations", () => {
  it("defines Arabic translations for all login strings", async () => {
    await i18n.changeLanguage("ar");

    const keys = [
      "Sign In",
      "Signing in...",
      "Welcome Back",
      "Enter credentials to continue",
      "Username",
      "Password",
      "Invalid credentials",
      "Authentication not configured yet. Database setup required.",
      "Login failed. Check your details.",
      "Supabase production login is disabled until configured.",
      "Spa Management System — v1.1",
      "Light mode",
      "Dark mode",
    ];

    for (const key of keys) {
      expect(i18n.t(key)).not.toBe(key);
      expect(i18n.t(key)).not.toMatch(/[A-Za-z]{3,}/);
    }
  });
});
