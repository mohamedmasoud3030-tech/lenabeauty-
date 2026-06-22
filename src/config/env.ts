export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

export type BackendMode = "supabase" | "tauri";
export type BranchMode = "single" | "multi";

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

  const backendRaw = getEnv("VITE_DATA_BACKEND")?.trim().toLowerCase();
  if (backendRaw !== "supabase" && backendRaw !== "tauri") {
    throw new EnvironmentConfigurationError("INVALID_BACKEND_CONFIGURATION: must be 'supabase' or 'tauri'");
  }

  const backend: BackendMode = backendRaw as BackendMode;
  const url = getEnv("VITE_SUPABASE_URL")?.trim() || undefined;
  const key = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY")?.trim() || undefined;
  
  const branchModeRaw = (getEnv("VITE_BRANCH_MODE")?.trim().toLowerCase()) || "single";
  if (branchModeRaw !== "single" && branchModeRaw !== "multi") {
    throw new EnvironmentConfigurationError(`UNSUPPORTED_BRANCH_CONFIGURATION: ${branchModeRaw}`);
  }
  const branchMode: BranchMode = branchModeRaw as BranchMode;
  const rawCenterId = getEnv("VITE_CENTER_ID")?.trim() || undefined;

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
    throw new EnvironmentConfigurationError(`UNSUPPORTED_BRANCH_CONFIGURATION: multi-branch not yet implemented`);
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
