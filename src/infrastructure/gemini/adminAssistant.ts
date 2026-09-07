/**
 * Admin-only Gemini client.
 *
 * The API key is entered by the administrator. Persistence lives in
 * adminAssistantStore.ts (center database, with a device fallback). This
 * module never reads bundled env and never embeds a key.
 */

export const GEMINI_KEY_STORAGE_KEY = "lara_admin_gemini_key";
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest"] as const;
export const GEMINI_MODEL = GEMINI_MODELS[0];

export type ChatTurn = { role: "user" | "model"; text: string };

function browserStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function readGeminiKey(): string {
  return browserStorage()?.getItem(GEMINI_KEY_STORAGE_KEY)?.trim() ?? "";
}

export function saveGeminiKey(key: string): void {
  const storage = browserStorage();
  if (!storage) return;
  const trimmed = key.trim();
  if (!trimmed) {
    storage.removeItem(GEMINI_KEY_STORAGE_KEY);
    return;
  }
  storage.setItem(GEMINI_KEY_STORAGE_KEY, trimmed);
}

export function clearGeminiKey(): void {
  browserStorage()?.removeItem(GEMINI_KEY_STORAGE_KEY);
}

function classifyHttpStatus(status: number): string {
  if (status === 400 || status === 401 || status === 403) return "GEMINI_KEY_REJECTED";
  if (status === 404) return "GEMINI_MODEL_UNAVAILABLE";
  if (status === 429) return "GEMINI_BUSY";
  return "GEMINI_REQUEST_FAILED";
}

async function generateOnce(params: {
  apiKey: string;
  model: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemInstruction }] },
          contents: params.contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: params.maxOutputTokens },
        }),
        signal: params.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("GEMINI_UNREACHABLE");
  }

  if (!response.ok) throw new Error(classifyHttpStatus(response.status));

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("GEMINI_EMPTY_REPLY");
  return text;
}

async function generateWithFallback(params: {
  apiKey: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) throw new Error("GEMINI_KEY_MISSING");

  let lastError = "GEMINI_REQUEST_FAILED";
  for (const model of GEMINI_MODELS) {
    try {
      return await generateOnce({ ...params, apiKey, model });
    } catch (error) {
      const code = error instanceof Error ? error.message : "GEMINI_REQUEST_FAILED";
      lastError = code;
      if (code === "GEMINI_MODEL_UNAVAILABLE") continue;
      throw error instanceof Error ? error : new Error(code);
    }
  }
  throw new Error(lastError);
}

export async function verifyGeminiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  await generateWithFallback({
    apiKey,
    systemInstruction: "Reply with the single word OK.",
    contents: [{ role: "user", parts: [{ text: "ping" }] }],
    maxOutputTokens: 16,
    signal,
  });
}

export async function askGemini(params: {
  apiKey: string;
  history: ChatTurn[];
  message: string;
  systemInstruction: string;
  signal?: AbortSignal;
}): Promise<string> {
  const contents = [
    ...params.history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  return generateWithFallback({
    apiKey: params.apiKey,
    contents,
    systemInstruction: params.systemInstruction,
    maxOutputTokens: 2048,
    signal: params.signal,
  });
}
