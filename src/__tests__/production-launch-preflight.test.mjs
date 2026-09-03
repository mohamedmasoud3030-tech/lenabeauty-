import { describe, expect, it } from "vitest";
import { validateProductionEnvironment } from "../../scripts/launch/production-preflight.mjs";

const baseEnv = {
  VITE_ENVIRONMENT: "production",
  VITE_DATA_BACKEND: "supabase",
  VITE_BRANCH_MODE: "single",
  VITE_SUPABASE_URL: "https://customer-prod.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  VITE_CENTER_ID: "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d",
  VITE_USE_DEMO_CREDENTIALS: "false",
};

describe("first customer production preflight", () => {
  it("accepts an isolated explicit Production target", () => {
    const result = validateProductionEnvironment(baseEnv);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects the public Lena Demo project even with otherwise complete values", () => {
    const result = validateProductionEnvironment({
      ...baseEnv,
      VITE_SUPABASE_URL: "https://tuzzvqsnbtzvkffmazyf.supabase.co/",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Production must not target the Lena Demo Supabase project");
  });

  it("rejects placeholder centers and demo opt-in", () => {
    const result = validateProductionEnvironment({
      ...baseEnv,
      VITE_CENTER_ID: "00000000-0000-0000-0000-000000000000",
      VITE_USE_DEMO_CREDENTIALS: "true",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("VITE_CENTER_ID must be a real non-placeholder UUID");
    expect(result.errors).toContain("VITE_USE_DEMO_CREDENTIALS must not be enabled in Production");
  });

  it("rejects privileged server credentials exposed through VITE variables", () => {
    const result = validateProductionEnvironment({
      ...baseEnv,
      VITE_SUPABASE_SERVICE_ROLE_KEY: "server-only",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("Privileged server credentials"))).toBe(true);
  });
});
