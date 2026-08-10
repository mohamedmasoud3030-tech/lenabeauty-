export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

export type BackendMode = "supabase" | "tauri";
export type BranchMode = "single" | "multi";

// Browser-facing Supabase values are public by design. Keep them only as
// production fallbacks so a missing Vercel VITE_* variable cannot disable the
// single-center Lena deployment; explicit environment values still override
// these defaults for other deployments.
const LENA_PRODUCTION_SUPABASE_URL = "https://tuzzvqsnbtzvkffmazyf.supabase.co";
const LENA_PRODUCTION_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1enp2cXNuYnR6dmtmZm1henlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMzg5NzQsImV4cCI6MjEwMTgxNDk3NH0.spKglkQKiC5vQCk5HgYFb0XfTst85vZ27izZJ6OvYoE";
const LENA_PRODUCTION_CENTER_ID = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";

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

export function parseEnv(customEnv?: Record<string, string | undefined>) {
  const getEnv = (key: string) => customEnv ? customEnv[key] : import.meta.env[key];
  const useProductionFallbacks = !customEnv && import.meta.env.PROD;

  const backendRaw = (
    getEnv("VITE_DATA_BACKEND")?.trim().toLowerCase()
    || (useProductionFallbacks ? "supabase" : undefined)
  );
  if (backendRaw !== "supabase" && backendRaw !== "tauri") {
    throw new EnvironmentConfigurationError("INVALID_BACKEND_CONFIGURATION: must be 'supabase' or 'tauri'");
  }

  const backend: BackendMode = backendRaw as BackendMode;
  const url = getEnv("VITE_SUPABASE_URL")?.trim()
    || (useProductionFallbacks ? LENA_PRODUCTION_SUPABASE_URL : undefined);
  const key = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY")?.trim()
    || (useProductionFallbacks ? LENA_PRODUCTION_PUBLISHABLE_KEY : undefined);
  
  const branchModeRaw = (getEnv("VITE_BRANCH_MODE")?.trim().toLowerCase()) || "single";
  if (branchModeRaw !== "single" && branchModeRaw !== "multi") {
    throw new EnvironmentConfigurationError(`UNSUPPORTED_BRANCH_CONFIGURATION: ${branchModeRaw}`);
  }
  const branchMode: BranchMode = branchModeRaw as BranchMode;
  const rawCenterId = getEnv("VITE_CENTER_ID")?.trim()
    || (useProductionFallbacks ? LENA_PRODUCTION_CENTER_ID : undefined);

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
        throw new EnvironmentConfigurationError(`INVALID_SUPABASE_CONFIGURATION: Missing or invalid ${missing.join(", ")}`);
      }
    }
  }

  return {
    backend,
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
