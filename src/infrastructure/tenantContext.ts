import { config } from "../config/env";

const STORAGE_KEY = "lb_active_center_id";

function loadStoredCenter(): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export const tenantContext = {
  // Active center for multi-branch mode. Seeded from localStorage so the
  // operator's last choice survives reloads. In single-branch mode this is
  // unused and the fixed config.centerId is authoritative.
  activeCenterId: (config.branchMode === "multi" ? loadStoredCenter() : null) as string | null,
};

/** Sets and persists the active center (multi-branch). */
export function setActiveCenter(id: string | null): void {
  tenantContext.activeCenterId = id;
  try {
    if (typeof localStorage !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function requireConfiguredCenterId(): string {
  if (config.branchMode === "single") {
    if (!config.centerId) {
      throw new Error("Single-branch center ID is not configured");
    }
    return config.centerId;
  }
  // Multi-branch: prefer the runtime selection, fall back to a seeded default.
  if (tenantContext.activeCenterId) {
    return tenantContext.activeCenterId;
  }
  if (config.centerId) {
    return config.centerId;
  }
  throw new Error("Active center is not configured");
}
