import { describe, expect, it } from "vitest";
import { validateProductionEnvironment } from "../../scripts/launch/production-preflight.mjs";

const productionProjectRef = "abcdefghijklmnopqrst";
const canonicalCenterId = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";
const baseEnv = {
  VITE_ENVIRONMENT: "production",
  VITE_DATA_BACKEND: "supabase",
  VITE_BRANCH_MODE: "single",
  PRODUCTION_SUPABASE_PROJECT_REF: productionProjectRef,
  VITE_SUPABASE_URL: `https://${productionProjectRef}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  VITE_CENTER_ID: canonicalCenterId,
  VITE_USE_DEMO_CREDENTIALS: "false",
};

function legacyJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `header.${payload}.signature`;
}

function modernPrivilegedKey() {
  return ["sb", "secret", "server-only"].join("_");
}

describe("first customer production preflight", () => {
  it("accepts an isolated explicit Production target", () => {
    const result = validateProductionEnvironment(baseEnv);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary.productionProjectRef).toBe(productionProjectRef);
    expect(result.summary.centerId).toBe(canonicalCenterId);
  });

  it("rejects the public Lena Demo project even with otherwise complete values", () => {
    const result = validateProductionEnvironment({
      ...baseEnv,
      PRODUCTION_SUPABASE_PROJECT_REF: "tuzzvqsnbtzvkffmazyf",
      VITE_SUPABASE_URL: "https://tuzzvqsnbtzvkffmazyf.supabase.co/",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Production project ref must not equal the Lena Demo project");
    expect(result.errors).toContain("Production must not target the Lena Demo Supabase project");
  });

  it("rejects a URL that does not match the explicitly approved production project ref", () => {
    const result = validateProductionEnvironment({
      ...baseEnv,
      VITE_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("VITE_SUPABASE_URL must match PRODUCTION_SUPABASE_PROJECT_REF");
  });

  it("rejects missing or malformed production project refs", () => {
    const missing = validateProductionEnvironment({ ...baseEnv, PRODUCTION_SUPABASE_PROJECT_REF: "" });
    const malformed = validateProductionEnvironment({ ...baseEnv, PRODUCTION_SUPABASE_PROJECT_REF: "not-a-ref" });
    expect(missing.ok).toBe(false);
    expect(malformed.ok).toBe(false);
    expect(missing.errors).toContain("PRODUCTION_SUPABASE_PROJECT_REF must be an explicit 20-character Supabase project ref");
  });

  it("rejects placeholder, noncanonical centers and demo opt-in", () => {
    const placeholder = validateProductionEnvironment({
      ...baseEnv,
      VITE_CENTER_ID: "00000000-0000-0000-0000-000000000000",
      VITE_USE_DEMO_CREDENTIALS: "true",
    });
    const otherCenter = validateProductionEnvironment({
      ...baseEnv,
      VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(placeholder.ok).toBe(false);
    expect(placeholder.errors).toContain("VITE_CENTER_ID must be a real non-placeholder UUID");
    expect(placeholder.errors).toContain("VITE_USE_DEMO_CREDENTIALS must not be enabled in Production");
    expect(otherCenter.ok).toBe(false);
    expect(otherCenter.errors).toContain("VITE_CENTER_ID must equal the canonical first-customer center UUID seeded by the migration chain");
  });

  it("rejects modern and legacy privileged keys exposed through the publishable slot", () => {
    for (const key of [modernPrivilegedKey(), legacyJwt("service_role")]) {
      const result = validateProductionEnvironment({
        ...baseEnv,
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("A Supabase privileged/service-role key must never be exposed as VITE_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  it("still accepts legacy anon JWTs as browser-safe publishable credentials", () => {
    const result = validateProductionEnvironment({
      ...baseEnv,
      VITE_SUPABASE_PUBLISHABLE_KEY: legacyJwt("anon"),
    });
    expect(result.ok).toBe(true);
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
