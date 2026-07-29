import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Force multi-branch mode for these tests.
vi.mock("../config/env", () => ({
  config: { backend: "supabase", branchMode: "multi", centerId: undefined },
}));

import { tenantContext, setActiveCenter, requireConfiguredCenterId } from "../infrastructure/tenantContext";

describe("Multi-branch tenant context", () => {
  beforeEach(() => {
    setActiveCenter(null);
  });
  afterEach(() => {
    setActiveCenter(null);
  });

  it("throws when no active center is selected", () => {
    expect(() => requireConfiguredCenterId()).toThrow();
  });

  it("returns the active center once selected", () => {
    setActiveCenter("center-abc");
    expect(requireConfiguredCenterId()).toBe("center-abc");
    expect(tenantContext.activeCenterId).toBe("center-abc");
  });

  it("persists the selection to localStorage", () => {
    setActiveCenter("center-xyz");
    expect(localStorage.getItem("lb_active_center_id")).toBe("center-xyz");
    setActiveCenter(null);
    expect(localStorage.getItem("lb_active_center_id")).toBeNull();
  });
});
