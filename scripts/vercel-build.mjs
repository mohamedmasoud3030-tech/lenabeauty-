#!/usr/bin/env node
/**
 * Canonical Vercel build entrypoint (`vercel.json` → `buildCommand`).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The previous entrypoint (`vercel-demo-build.mjs`) injected the Demo project
 * credentials into every build unconditionally, and hard-set
 * `VITE_ENVIRONMENT=staging`. Two consequences:
 *
 *   1. A customer deployment could not be targeted from the Vercel dashboard.
 *      `VITE_SUPABASE_URL` and friends were spread from `process.env` first and
 *      then overwritten by the Demo constants, so setting them in Vercel had
 *      no effect at all — the deployed build silently pointed at the PUBLIC
 *      Demo database.
 *   2. Pinning `VITE_ENVIRONMENT=staging` meant the runtime guard
 *      `PRODUCTION_DEMO_PROJECT_FORBIDDEN` (src/config/env.ts) could never fire
 *      on a Vercel deployment, so the last line of defence was dead.
 *
 * This script fixes both by being EXPLICIT and FAIL-CLOSED. It resolves exactly
 * one of two targets and refuses to guess:
 *
 *   A. Explicit target  (customer / production / any real deployment)
 *      Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and
 *      VITE_ENVIRONMENT in the Vercel project. Nothing is injected; the values
 *      pass through unchanged. Production + the Demo host is rejected here as
 *      well as at runtime, so the failure happens at build time.
 *
 *   B. Demo target      (the public trial deployment)
 *      Set VITE_USE_DEMO_CREDENTIALS=true in the Vercel project. Only then are
 *      the Demo constants read from src/config/env.ts, and the environment is
 *      forced to `staging` so a Demo build can never masquerade as Production.
 *
 * Setting both is an error — an ambiguous target is exactly the class of
 * mistake that must not be resolved silently.
 *
 * Errors are printed with the exact variables to set, because the most likely
 * reader of this output is a deploy that just failed and needs to know why.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Resolved from the working directory rather than import.meta.url: under
// Vitest's SSR transform import.meta.url is not a file: URL, and both Vercel
// and the test suite run this script from the repository root.
const DEMO_SOURCE_PATH = "src/config/env.ts";
const DEMO_OPT_IN_KEY = "VITE_USE_DEMO_CREDENTIALS";

const SUPPORTED_ENVIRONMENTS = ["development", "staging", "production"];

function readDemoConstants(source) {
  const read = (name) => {
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*"([^"]+)"`));
    if (!match?.[1]) throw new Error(`Missing ${name} in src/config/env.ts`);
    return match[1];
  };
  return {
    url: read("LENA_DEMO_SUPABASE_URL"),
    key: read("LENA_DEMO_PUBLISHABLE_KEY"),
    centerId: read("LENA_DEMO_CENTER_ID"),
  };
}

export function loadDemoConstants() {
  return readDemoConstants(readFileSync(resolve(process.cwd(), DEMO_SOURCE_PATH), "utf8"));
}

export function hostnameOf(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isDemoHost(url) {
  const host = hostnameOf(url);
  if (!host) return false;
  return host === hostnameOf(loadDemoConstants().url);
}

function isPrivilegedKey(key) {
  const value = String(key ?? "");
  if (value.startsWith("sb_secret_")) return true;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(payload?.role ?? "").toLowerCase() === "service_role";
  } catch {
    return false;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

function isHttpsUrl(value) {
  const host = hostnameOf(value);
  if (!host) return false;
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolve and validate the build target. Pure — reads nothing but `env` — so
 * the deployment contract is testable without touching a real Vercel build.
 *
 * @returns {{ ok: boolean, errors: string[], warnings: string[], resolved?: Record<string,string>, summary?: object }}
 */
export function validateVercelBuildEnvironment(env = {}) {
  const errors = [];
  const warnings = [];

  const demoOptIn = String(env[DEMO_OPT_IN_KEY] ?? "").trim().toLowerCase() === "true";
  const explicitUrl = String(env.VITE_SUPABASE_URL ?? "").trim();
  const explicitKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  const hasExplicitTarget = Boolean(explicitUrl || explicitKey);

  const rawEnvironment = String(env.VITE_ENVIRONMENT ?? "").trim().toLowerCase();
  const backend = String(env.VITE_DATA_BACKEND ?? "supabase").trim().toLowerCase() || "supabase";
  const branchMode = String(env.VITE_BRANCH_MODE ?? "single").trim().toLowerCase() || "single";

  if (demoOptIn && hasExplicitTarget) {
    errors.push(
      "AMBIGUOUS_BUILD_TARGET: both VITE_USE_DEMO_CREDENTIALS=true and an explicit VITE_SUPABASE_URL/KEY are set. " +
        "Remove VITE_USE_DEMO_CREDENTIALS to deploy a real Supabase project, or remove the explicit values to deploy the public Demo.",
    );
  }

  if (backend !== "supabase") {
    errors.push(`INVALID_BUILD_BACKEND: VITE_DATA_BACKEND must be 'supabase' (received '${backend}').`);
  }

  if (branchMode !== "single" && branchMode !== "multi") {
    errors.push(`INVALID_BUILD_BRANCH_MODE: VITE_BRANCH_MODE must be 'single' or 'multi' (received '${branchMode}').`);
  }

  if (!demoOptIn && !hasExplicitTarget) {
    errors.push(
      "MISSING_BUILD_TARGET: this build cannot tell which Supabase project it targets. " +
        "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (plus VITE_ENVIRONMENT) in the Vercel project, " +
        `or set ${DEMO_OPT_IN_KEY}=true to deploy the public Demo. ` +
        "The build deliberately does not fall back to Demo credentials on its own.",
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // ---- Target A: an explicit Supabase project -------------------------------
  if (!demoOptIn) {
    if (!rawEnvironment) {
      errors.push(
        "MISSING_BUILD_ENVIRONMENT: VITE_ENVIRONMENT must be set explicitly on Vercel " +
          "(development | staging | production). It is no longer inferred, so a build can never " +
          "silently declare itself staging.",
      );
    } else if (!SUPPORTED_ENVIRONMENTS.includes(rawEnvironment)) {
      errors.push(`UNSUPPORTED_ENVIRONMENT: ${rawEnvironment} (expected development | staging | production).`);
    }

    if (!isHttpsUrl(explicitUrl)) {
      errors.push("INVALID_SUPABASE_URL: VITE_SUPABASE_URL must be an https Supabase project URL.");
    }
    if (!explicitKey) {
      errors.push("MISSING_SUPABASE_KEY: VITE_SUPABASE_PUBLISHABLE_KEY is required.");
    }
    if (isPrivilegedKey(explicitKey)) {
      errors.push(
        "INVALID_SUPABASE_CONFIGURATION: VITE_SUPABASE_PUBLISHABLE_KEY looks privileged " +
          "(sb_secret_* or a service_role JWT). Only the publishable/anon key may reach a browser bundle.",
      );
    }
    if (rawEnvironment === "production" && isDemoHost(explicitUrl)) {
      errors.push(
        "PRODUCTION_DEMO_PROJECT_FORBIDDEN: VITE_ENVIRONMENT=production must not target the public Demo project. " +
          "Provision a separate Supabase project for customer Production data.",
      );
    }

    const centerId = String(env.VITE_CENTER_ID ?? "").trim();
    if (branchMode === "single" && !isUuid(centerId)) {
      errors.push(
        "MISSING_SINGLE_BRANCH_CENTER_ID: VITE_CENTER_ID is required and must be a valid UUID in single-branch mode.",
      );
    }
    if (branchMode === "multi" && centerId && !isUuid(centerId)) {
      errors.push("INVALID_CENTER_ID: VITE_CENTER_ID is optional in multi-branch mode but must be a UUID when set.");
    }

    if (errors.length > 0) {
      return { ok: false, errors, warnings };
    }

    if (isDemoHost(explicitUrl) && rawEnvironment !== "production") {
      warnings.push(
        `This build targets the PUBLIC Demo project (${hostnameOf(explicitUrl)}) in '${rawEnvironment}'. ` +
          "Never write real customer data to it.",
      );
    }

    return {
      ok: true,
      errors,
      warnings,
      resolved: {
        VITE_DATA_BACKEND: "supabase",
        VITE_BRANCH_MODE: branchMode,
        VITE_ENVIRONMENT: rawEnvironment,
        VITE_SUPABASE_URL: explicitUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: explicitKey,
        ...(centerId ? { VITE_CENTER_ID: centerId } : {}),
      },
      summary: {
        mode: "explicit",
        environment: rawEnvironment,
        targetHost: hostnameOf(explicitUrl),
        centerId: centerId || null,
      },
    };
  }

  // ---- Target B: the public Demo, explicitly opted in -----------------------
  const demo = loadDemoConstants();

  if (rawEnvironment === "production") {
    errors.push(
      "PRODUCTION_DEMO_PROJECT_FORBIDDEN: VITE_USE_DEMO_CREDENTIALS=true cannot be combined with " +
        "VITE_ENVIRONMENT=production. Unset VITE_USE_DEMO_CREDENTIALS and point the build at a real project.",
    );
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    errors,
    warnings,
    resolved: {
      VITE_DATA_BACKEND: "supabase",
      VITE_BRANCH_MODE: "single",
      VITE_ENVIRONMENT: "staging",
      VITE_SUPABASE_URL: demo.url,
      VITE_SUPABASE_PUBLISHABLE_KEY: demo.key,
      VITE_CENTER_ID: demo.centerId,
    },
    summary: {
      mode: "demo",
      environment: "staging",
      targetHost: hostnameOf(demo.url),
      centerId: demo.centerId,
    },
  };
}

export function formatSummary(summary) {
  const parts = [
    `mode=${summary.mode}`,
    `environment=${summary.environment}`,
    `target=${summary.targetHost}`,
    `center=${summary.centerId ?? "(runtime)"}`,
  ];
  return `[vercel-build] ${parts.join(" ")}`;
}

function main() {
  const result = validateVercelBuildEnvironment(process.env);

  for (const warning of result.warnings) {
    console.warn(`[vercel-build] WARNING: ${warning}`);
  }

  if (!result.ok) {
    console.error("\n[vercel-build] BUILD REFUSED — the deployment target could not be resolved.\n");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    console.error("\nSee docs/DELIVERY-GUIDE.md (Step 4) for the two supported configurations.\n");
    process.exit(1);
  }

  console.log(formatSummary(result.summary));

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npm, ["run", "build"], {
    stdio: "inherit",
    env: { ...process.env, ...result.resolved },
  });

  if (build.error) throw build.error;
  process.exit(build.status ?? 1);
}

// Only run the build when this file is the process entrypoint — never when a
// test imports the validators above.
function invokedDirectly() {
  const entry = process.argv[1];
  return Boolean(entry && entry.replaceAll("\\", "/").endsWith("scripts/vercel-build.mjs"));
}

if (invokedDirectly()) {
  main();
}
