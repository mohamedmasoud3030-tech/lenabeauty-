/**
 * Admin-only Gemini client.
 *
 * The API key is entered by the administrator and kept in this browser only.
 * It is never read from bundled env, never committed, and never written to
 * Supabase. The model answers questions; it cannot change salon records.
 */

export const GEMINI_KEY_STORAGE_KEY = "lara_admin_gemini_key";
export const GEMINI_MODEL = "gemini-2.0-flash";

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

export async function askGemini(params: {
  apiKey: string;
  history: ChatTurn[];
  message: string;
  systemInstruction: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) throw new Error("GEMINI_KEY_MISSING");

  const contents = [
    ...params.history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
        signal: params.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("GEMINI_UNREACHABLE");
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new Error("GEMINI_KEY_REJECTED");
  }
  if (!response.ok) throw new Error("GEMINI_REQUEST_FAILED");

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
