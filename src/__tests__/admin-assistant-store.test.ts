import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GEMINI_KEY_STORAGE_KEY } from "../infrastructure/gemini/adminAssistant";
import {
  loadPersistedGeminiKey,
  persistGeminiKey,
  removePersistedGeminiKey,
} from "../infrastructure/gemini/adminAssistantStore";

/**
 * Gemini admin key persistence contracts.
 *
 * In test mode the center-database store is disabled by design
 * (`canUseRemoteStore()`), so the default path is the device fallback.
 * The remote behavior is exercised by flipping the runtime mode and driving
 * the mocked RPC client — including the "heal" branch that pushes a
 * device-only key up to the center row.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
}));

vi.mock("../infrastructure/supabase/client", () => ({
  getSupabaseClient: () => ({ rpc: h.rpc }),
}));

vi.mock("../config/env", () => ({
  config: { centerId: "center-1", backend: "supabase" },
}));

describe("gemini key persistence — device fallback (remote store disabled in tests)", () => {
  beforeEach(() => {
    localStorage.clear();
    h.rpc.mockReset();
    h.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("persist trims the key, stores it on the device, and reports the device location", async () => {
    const location = await persistGeminiKey("  AIza-1  ");
    expect(location).toBe("device");
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("AIza-1");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("load returns the stored device key, or an empty result when nothing exists", async () => {
    await persistGeminiKey("AIza-1");
    await expect(loadPersistedGeminiKey()).resolves.toEqual({ key: "AIza-1", location: "device" });

    localStorage.clear();
    await expect(loadPersistedGeminiKey()).resolves.toEqual({ key: "", location: null });
  });

  it("remove clears the device key", async () => {
    await persistGeminiKey("AIza-1");
    await removePersistedGeminiKey();
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBeNull();
    await expect(loadPersistedGeminiKey()).resolves.toEqual({ key: "", location: null });
  });
});

describe("gemini key persistence — center database (remote store enabled)", () => {
  beforeEach(() => {
    localStorage.clear();
    h.rpc.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadRemoteStore() {
    // Flip the runtime mode so canUseRemoteStore() passes (center + supabase
    // are already provided by the mocked config), then re-import fresh.
    vi.stubEnv("MODE", "development");
    vi.resetModules();
    return import("../infrastructure/gemini/adminAssistantStore");
  }

  it("a key from the database wins and is synced to the device", async () => {
    h.rpc.mockResolvedValue({ data: { api_key: "remote-key" }, error: null });
    const store = await loadRemoteStore();

    await expect(store.loadPersistedGeminiKey()).resolves.toEqual({
      key: "remote-key",
      location: "database",
    });
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("remote-key");
    expect(h.rpc).toHaveBeenCalledWith(
      "get_center_gemini_key_v1",
      { p_center_id: "center-1" },
    );
  });

  it("an empty database row with a device key heals up to the database", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "dev-key");
    h.rpc.mockImplementation(((rpcName: string) => {
      if (rpcName === "get_center_gemini_key_v1") {
        return Promise.resolve({ data: { api_key: "" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }) as never);
    const store = await loadRemoteStore();

    await expect(store.loadPersistedGeminiKey()).resolves.toEqual({
      key: "dev-key",
      location: "database",
    });
    expect(h.rpc).toHaveBeenCalledWith(
      "save_center_gemini_key_v1",
      { p_center_id: "center-1", p_api_key: "dev-key" },
    );
  });

  it("a failed heal stays on the device", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "dev-key");
    h.rpc.mockImplementation(((rpcName: string) => {
      if (rpcName === "get_center_gemini_key_v1") {
        return Promise.resolve({ data: { api_key: "" }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "offline" } });
    }) as never);
    const store = await loadRemoteStore();

    await expect(store.loadPersistedGeminiKey()).resolves.toEqual({
      key: "dev-key",
      location: "device",
    });
  });

  it("a failed RPC read falls back to the device key", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "dev-key");
    h.rpc.mockRejectedValue(new Error("network down"));
    const store = await loadRemoteStore();

    await expect(store.loadPersistedGeminiKey()).resolves.toEqual({
      key: "dev-key",
      location: "device",
    });
  });

  it("persist in remote mode reports the database when the RPC accepts", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    const store = await loadRemoteStore();

    await expect(store.persistGeminiKey("  k-1  ")).resolves.toBe("database");
    expect(h.rpc).toHaveBeenCalledWith(
      "save_center_gemini_key_v1",
      { p_center_id: "center-1", p_api_key: "k-1" },
    );
  });
});
