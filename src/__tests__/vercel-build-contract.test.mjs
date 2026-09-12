import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isDemoHost,
  loadDemoConstants,
  validateVercelBuildEnvironment,
} from "../../scripts/vercel-build.mjs";

/**
 * Deployment-target contract for the Vercel build.
 *
 * Regression these tests lock down: the build entrypoint used to spread
 * `process.env` and then overwrite it with the Demo constants, so setting
 * VITE_SUPABASE_URL in the Vercel dashboard had no effect and every deploy —
 * including a customer deploy — silently targeted the public Demo database.
 * The build must now be explicit and fail closed.
 */

const PROJECT_REF = "abcdefghijklmnopqrst";
const CENTER_ID = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";

const explicitTarget = {
  VITE_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  VITE_CENTER_ID: CENTER_ID,
  VITE_ENVIRONMENT: "production",
};

describe("vercel build environment contract", () => {
  it("resolves an explicit production target without touching the Demo constants", () => {
    const result = validateVercelBuildEnvironment(explicitTarget);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({
      mode: "explicit",
      environment: "production",
      targetHost: `${PROJECT_REF}.supabase.co`,
    });
    // The explicit values must survive verbatim — this is the assertion the
    // old script would have failed, because Demo overwrote both of them.
    expect(result.resolved.VITE_SUPABASE_URL).toBe(explicitTarget.VITE_SUPABASE_URL);
    expect(result.resolved.VITE_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_example");
    expect(result.resolved.VITE_CENTER_ID).toBe(CENTER_ID);
    expect(result.resolved.VITE_ENVIRONMENT).toBe("production");
  });

  it("refuses to build when no target is configured instead of falling back to Demo", () => {
    const result = validateVercelBuildEnvironment({});

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("MISSING_BUILD_TARGET");
    expect(result.resolved).toBeUndefined();
  });

  it("refuses to infer the environment, so a build can never silently declare itself staging", () => {
    const { VITE_ENVIRONMENT, ...withoutEnvironment } = explicitTarget;
    void VITE_ENVIRONMENT;

    const result = validateVercelBuildEnvironment(withoutEnvironment);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("MISSING_BUILD_ENVIRONMENT");
  });

  it("rejects the public Demo project as a Production database at build time", () => {
    const demo = loadDemoConstants();
    const result = validateVercelBuildEnvironment({
      ...explicitTarget,
      VITE_SUPABASE_URL: demo.url,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("PRODUCTION_DEMO_PROJECT_FORBIDDEN");
  });

  it("rejects an ambiguous build that opts into Demo and sets an explicit target", () => {
    const result = validateVercelBuildEnvironment({
      ...explicitTarget,
      VITE_USE_DEMO_CREDENTIALS: "true",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("AMBIGUOUS_BUILD_TARGET");
  });

  it("keeps the Demo deployment working, but only via an explicit opt-in", () => {
    const demo = loadDemoConstants();
    const result = validateVercelBuildEnvironment({ VITE_USE_DEMO_CREDENTIALS: "true" });

    expect(result.ok).toBe(true);
    expect(result.resolved.VITE_SUPABASE_URL).toBe(demo.url);
    expect(result.resolved.VITE_CENTER_ID).toBe(demo.centerId);
    // A Demo build must never be able to claim production.
    expect(result.resolved.VITE_ENVIRONMENT).toBe("staging");
    expect(result.summary.mode).toBe("demo");
  });

  it("refuses to let the Demo opt-in be combined with VITE_ENVIRONMENT=production", () => {
    const result = validateVercelBuildEnvironment({
      VITE_USE_DEMO_CREDENTIALS: "true",
      VITE_ENVIRONMENT: "production",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("PRODUCTION_DEMO_PROJECT_FORBIDDEN");
  });

  it("rejects a privileged key in a browser-facing variable", () => {
    const privileged = ["sb", "secret", "server-only"].join("_");
    const result = validateVercelBuildEnvironment({
      ...explicitTarget,
      VITE_SUPABASE_PUBLISHABLE_KEY: privileged,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("INVALID_SUPABASE_CONFIGURATION");
  });

  it("warns but does not block when a non-production build targets the Demo project", () => {
    const demo = loadDemoConstants();
    const result = validateVercelBuildEnvironment({
      ...explicitTarget,
      VITE_SUPABASE_URL: demo.url,
      VITE_ENVIRONMENT: "staging",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toContain("PUBLIC Demo");
  });

  it("requires a valid center id in single-branch mode", () => {
    const result = validateVercelBuildEnvironment({ ...explicitTarget, VITE_CENTER_ID: "not-a-uuid" });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("MISSING_SINGLE_BRANCH_CENTER_ID");
  });

  it("does not require a center id in multi-branch mode", () => {
    const { VITE_CENTER_ID, ...withoutCenter } = explicitTarget;
    void VITE_CENTER_ID;

    const result = validateVercelBuildEnvironment({
      ...withoutCenter,
      VITE_BRANCH_MODE: "multi",
      VITE_ENVIRONMENT: "staging",
    });

    expect(result.ok).toBe(true);
    expect(result.resolved.VITE_CENTER_ID).toBeUndefined();
  });

  /**
   * Preview deployments, added after every branch push ended as a failed Vercel
   * deployment with no preview to open: the Preview environment has no
   * production credentials, and the guard correctly refused to guess a target.
   * The rule now is narrow and explicit — a preview may fall back to the public
   * Demo, and only a preview.
   */
  it("builds a Vercel preview against the public Demo instead of failing", () => {
    const result = validateVercelBuildEnvironment({ VERCEL_ENV: "preview" });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({ mode: "demo", demoReason: "vercel-preview" });
    expect(result.warnings.join(" ")).toMatch(/PREVIEW_DEMO_TARGET/);
    expect(result.resolved.VITE_SUPABASE_URL).toBe(loadDemoConstants().url);
  });

  it("keeps production fail-closed: no preview rule leaks into it", () => {
    const result = validateVercelBuildEnvironment({ VERCEL_ENV: "production" });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/MISSING_BUILD_TARGET/);
  });

  it("still refuses a target-less build outside Vercel", () => {
    // No VERCEL_ENV at all: CI and local runs stay explicit.
    const result = validateVercelBuildEnvironment({});

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/MISSING_BUILD_TARGET/);
  });

  it("honours an explicit target in a preview, and says so", () => {
    const result = validateVercelBuildEnvironment({
      ...explicitTarget,
      VITE_ENVIRONMENT: "staging",
      VERCEL_ENV: "preview",
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ mode: "explicit", environment: "staging" });
    expect(result.summary.demoReason).toBeUndefined();
    expect(result.warnings.join(" ")).not.toMatch(/PREVIEW_DEMO_TARGET/);
  });

  it("treats the explicit Demo opt-in as its own reason, not the preview rule", () => {
    const result = validateVercelBuildEnvironment({
      VITE_USE_DEMO_CREDENTIALS: "true",
      VERCEL_ENV: "production",
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ mode: "demo", demoReason: "explicit-opt-in" });
  });

  it("still refuses a production preview that would target the Demo", () => {
    // A preview that declares itself production must not reach the Demo host.
    const result = validateVercelBuildEnvironment({
      VERCEL_ENV: "preview",
      VITE_ENVIRONMENT: "production",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/PRODUCTION_DEMO_PROJECT_FORBIDDEN/);
  });

  it("detects the Demo host regardless of surrounding whitespace or case", () => {
    const demo = loadDemoConstants();
    expect(isDemoHost(demo.url)).toBe(true);
    expect(isDemoHost(`  ${demo.url.toUpperCase()}  `)).toBe(true);
    expect(isDemoHost("https://example.supabase.co")).toBe(false);
    expect(isDemoHost("not a url")).toBe(false);
  });
});

describe("vercel.json wiring", () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

  it("runs the fail-closed build entrypoint", () => {
    expect(config.buildCommand).toBe("node scripts/vercel-build.mjs");
  });

  it("no longer references the removed unconditional Demo build script", () => {
    expect(config.buildCommand).not.toContain("vercel-demo-build");
  });
});
