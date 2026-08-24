export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

export type BackendMode = "supabase" | "tauri";
export type BranchMode = "single" | "multi";

// Explicit environment model. VITE_ENVIRONMENT selects the runtime target.
export type EnvironmentName = "development" | "staging" | "production";

// Browser-facing Supabase values are public by design (anon key). These are
// Demo credentials for local development / trial only. They are NEVER applied
// automatically: a production build must never fall back to demo credentials,
// and even a non-production build uses them only when explicitly selected with
// VITE_USE_DEMO_CREDENTIALS=true (see useDemoFallbacks below).
const LENA_DEMO_SUPABASE_URL = "https://tuzzvqsnbtzvkffmazyf.supabase.co";
const LENA_DEMO_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1enp2cXNuYnR6dmtmZm1henlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMzg5NzQsImV4cCI6MjEwMTgxNDk3NH0.spKglkQKiC5vQCk5HgYFb0XfTst85vZ27izZJ6OvYoE";
const LENA_DEMO_CENTER_ID = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";

// Env var that explicitly opts a NON-PRODUCTION build into the demo
// credentials above. The string value must be exactly "true".
const DEMO_OPT_IN_KEY = "VITE_USE_DEMO_CREDENTIALS";

export function deriveDefaultEnvironment(isProductionBuild: boolean): EnvironmentName {
  return isProductionBuild ? "staging" : "development";
}

function validateUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function validateUUID(uuid: string | undefined): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function parseEnv(
  customEnv?: Record<string, string | undefined>,
  options?: { isProductionBuild?: boolean },
) {
  const getEnv = (key: string) => customEnv ? customEnv[key] : import.meta.env[key];
  const isProdBuild = options?.isProductionBuild ?? (!customEnv && import.meta.env.PROD);

  // Environment: explicit VITE_ENVIRONMENT wins. Otherwise local/test builds
  // are development and an optimized build defaults to staging (the trial
  // target) — but see the fail-closed demo rules below.
  const environmentRaw = getEnv("VITE_ENVIRONMENT")?.trim().toLowerCase();
  let environment: EnvironmentName;
  if (environmentRaw) {
    if (environmentRaw !== "development" && environmentRaw !== "staging" && environmentRaw !== "production") {
      throw new EnvironmentConfigurationError(
        `UNSUPPORTED_ENVIRONMENT: ${environmentRaw} (expected development | staging | production)`,
      );
    }
    environment = environmentRaw;
  } else {
    environment = deriveDefaultEnvironment(isProdBuild);
  }

  // Fail-closed demo credentials (P0.2):
  // Demo credentials are applied ONLY when ALL of the following hold:
  //   1. the build is NOT a production build (vite dev/preview/tests), and
  //   2. the selected environment is not `production`, and
  //   3. the developer explicitly opted in with VITE_USE_DEMO_CREDENTIALS=true.
  // A production build therefore never falls back to demo credentials: without
  // explicit VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (and
  // VITE_CENTER_ID for single-branch) it fails closed below.
  const explicitDemoOptIn =
    getEnv(DEMO_OPT_IN_KEY)?.trim().toLowerCase() === "true";
  const useDemoFallbacks =
    explicitDemoOptIn && !isProdBuild && environment !== "production";

  const backendRaw = (
    getEnv("VITE_DATA_BACKEND")?.trim().toLowerCase()
    || (useDemoFallbacks ? "supabase" : undefined)
  );
  if (backendRaw !== "supabase" && backendRaw !== "tauri") {
    throw new EnvironmentConfigurationError("INVALID_BACKEND_CONFIGURATION: must be 'supabase' or 'tauri'");
  }

  const backend: BackendMode = backendRaw as BackendMode;
  const url = getEnv("VITE_SUPABASE_URL")?.trim()
    || (useDemoFallbacks ? LENA_DEMO_SUPABASE_URL : undefined);
  const key = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY")?.trim()
    || (useDemoFallbacks ? LENA_DEMO_PUBLISHABLE_KEY : undefined);
  
  const branchModeRaw = (getEnv("VITE_BRANCH_MODE")?.trim().toLowerCase()) || "single";
  if (branchModeRaw !== "single" && branchModeRaw !== "multi") {
    throw new EnvironmentConfigurationError(`UNSUPPORTED_BRANCH_CONFIGURATION: ${branchModeRaw}`);
  }
  const branchMode: BranchMode = branchModeRaw as BranchMode;
  const rawCenterId = getEnv("VITE_CENTER_ID")?.trim()
    || (useDemoFallbacks ? LENA_DEMO_CENTER_ID : undefined);

  let centerId: string | undefined;

  if (branchMode === "single") {
    if (!rawCenterId || !validateUUID(rawCenterId)) {
      if (!customEnv && import.meta.env.MODE === "test") {
        // Skip throw for vitest hoisting side-effects
      } else {
        throw new EnvironmentConfigurationError("MISSING_SINGLE_BRANCH_CENTER_ID: VITE_CENTER_ID is missing or invalid");
      }
    }
    centerId = rawCenterId;
  } else if (branchMode === "multi") {
    // Multi-branch: the active center is chosen at runtime from the user's
    // memberships (see tenantContext.activeCenterId). An optional
    // VITE_CENTER_ID may seed a default selection but is not required.
    centerId = rawCenterId && validateUUID(rawCenterId) ? rawCenterId : undefined;
  } else {
    throw new EnvironmentConfigurationError(`UNSUPPORTED_BRANCH_CONFIGURATION: ${backend} with ${branchMode}`);
  }

  // Security check: reject explicit secret keys injected anywhere
  if (backend === "supabase") {
    if (key && key.startsWith("sb_secret_")) {
      throw new EnvironmentConfigurationError("INVALID_SUPABASE_CONFIGURATION");
    }

    const missing: string[] = [];
    if (!url || !validateUrl(url)) missing.push("VITE_SUPABASE_URL");
    if (!key) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");

    if (missing.length > 0) {
      if (!customEnv && import.meta.env.MODE === "test") {
        // Skip
      } else {
        const hint = isProdBuild
          ? " A production build never falls back to demo credentials: set explicit VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (and VITE_CENTER_ID for single-branch). Demo credentials are available only in non-production builds with VITE_USE_DEMO_CREDENTIALS=true."
          : " Set explicit VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or opt into demo credentials for local development with VITE_USE_DEMO_CREDENTIALS=true.";
        throw new EnvironmentConfigurationError(
          `INVALID_SUPABASE_CONFIGURATION: Missing or invalid ${missing.join(", ")}.${hint}`,
        );
      }
    }
  }

  return {
    backend,
    environment,
    supabaseUrl: url,
    supabasePublishableKey: key,
    branchMode,
    centerId
  };
}

let _configError: Error | null = null;
let _config: ReturnType<typeof parseEnv> | null = null;
try {
  _config = parseEnv();
} catch (error: any) {
  _configError = error;
  
  _config = {
    backend: "supabase",
    environment: deriveDefaultEnvironment(import.meta.env.PROD),
    supabaseUrl: undefined,
    supabasePublishableKey: undefined,
    branchMode: "single",
    centerId: undefined
  };
}

export const config = _config!;

export function validateEnvironment(cfg: ReturnType<typeof parseEnv>) {
  if (_configError) {
    throw _configError;
  }
}
