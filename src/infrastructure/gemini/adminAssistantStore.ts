import { config } from "../../config/env";
import { getSupabaseClient } from "../supabase/client";
import { clearGeminiKey, readGeminiKey, saveGeminiKey } from "./adminAssistant";

export type GeminiKeyLocation = "database" | "device";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

function centerId(): string | undefined {
  return config.centerId?.trim() || undefined;
}

function canUseRemoteStore(): boolean {
  if (import.meta.env.MODE === "test") return false;
  return config.backend === "supabase" && Boolean(centerId());
}

function rpcClient(): RpcClient {
  return getSupabaseClient() as unknown as RpcClient;
}

async function readFromDatabase(): Promise<string | null> {
  const id = centerId();
  if (!canUseRemoteStore() || !id) return null;
  try {
    const { data, error } = await rpcClient().rpc("get_center_gemini_key_v1", { p_center_id: id });
    if (error) return null;
    const key = typeof (data as { api_key?: unknown } | null)?.api_key === "string"
      ? (data as { api_key: string }).api_key.trim()
      : "";
    return key || "";
  } catch {
    return null;
  }
}

async function writeToDatabase(apiKey: string): Promise<boolean> {
  const id = centerId();
  if (!canUseRemoteStore() || !id) return false;
  try {
    const { error } = await rpcClient().rpc("save_center_gemini_key_v1", {
      p_center_id: id,
      p_api_key: apiKey,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function loadPersistedGeminiKey(): Promise<{ key: string; location: GeminiKeyLocation | null }> {
  const remote = await readFromDatabase();
  if (remote) {
    saveGeminiKey(remote);
    return { key: remote, location: "database" };
  }
  if (remote === "") {
    clearGeminiKey();
    return { key: "", location: "database" };
  }
  const local = readGeminiKey();
  return { key: local, location: local ? "device" : null };
}

export async function persistGeminiKey(apiKey: string): Promise<GeminiKeyLocation> {
  const trimmed = apiKey.trim();
  saveGeminiKey(trimmed);
  const saved = await writeToDatabase(trimmed);
  return saved ? "database" : "device";
}

export async function removePersistedGeminiKey(): Promise<void> {
  clearGeminiKey();
  await writeToDatabase("");
}
