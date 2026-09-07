/**
 * Admin-only Gemini client.
 *
 * The API key is entered by the administrator. Persistence lives in
 * adminAssistantStore.ts (center database, with a device fallback). This
 * module never reads bundled env and never embeds a key.
 *
 * Activation notes:
 * - 2.5-class models are reasoning models and their thinking tokens are
 *   charged against `maxOutputTokens`. A small budget therefore returns a
 *   candidate with no text at all, which used to surface as a bogus
 *   "empty reply" while the key was perfectly valid. Thinking is disabled for
 *   this assistant and the verification budget is generous.
 * - Verification only proves the key is accepted: any HTTP 200 counts, even
 *   when the model returns no text.
 */

export const GEMINI_KEY_STORAGE_KEY = "lara_admin_gemini_key";
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"] as const;
export const GEMINI_MODEL = GEMINI_MODELS[0];
export const GEMINI_STUDIO_KEY_URL = "https://aistudio.google.com/apikey";

export type ChatTurn = { role: "user" | "model"; text: string };

/** Error carrying a stable code (message) plus the raw provider detail. */
export class GeminiError extends Error {
  readonly detail: string;

  constructor(code: string, detail = "") {
    super(code);
    this.name = "GeminiError";
    this.detail = detail;
  }
}

export function geminiErrorDetail(error: unknown): string {
  return error instanceof GeminiError ? error.detail : "";
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/**
 * Pasted keys frequently arrive with wrapping quotes, a `key=` prefix, soft
 * line breaks, or invisible bidi marks picked up from an Arabic UI. None of
 * those belong in the header, and all of them make Google answer
 * "API key not valid".
 */
export function sanitizeGeminiKey(raw: string): string {
  return raw
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:Bearer|bearer)/, "")
    .replace(/^(?:key|apikey|api_key|API_KEY|x-goog-api-key)[:=]/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

export function readGeminiKey(): string {
  return sanitizeGeminiKey(browserStorage()?.getItem(GEMINI_KEY_STORAGE_KEY) ?? "");
}

export function saveGeminiKey(key: string): void {
  const storage = browserStorage();
  if (!storage) return;
  const trimmed = sanitizeGeminiKey(key);
  if (!trimmed) {
    storage.removeItem(GEMINI_KEY_STORAGE_KEY);
    return;
  }
  storage.setItem(GEMINI_KEY_STORAGE_KEY, trimmed);
}

export function clearGeminiKey(): void {
  browserStorage()?.removeItem(GEMINI_KEY_STORAGE_KEY);
}

type ProviderError = { status: string; reason: string; message: string };

async function readProviderError(response: Response): Promise<ProviderError> {
  let raw = "";
  try {
    if (typeof response.text === "function") raw = (await response.text()) ?? "";
  } catch {
    raw = "";
  }
  if (!raw && typeof response.json === "function") {
    try {
      raw = JSON.stringify(await response.json());
    } catch {
      raw = "";
    }
  }
  try {
    const parsed = JSON.parse(raw) as {
      error?: { status?: string; message?: string; details?: Array<{ reason?: string }> };
    };
    const error = parsed.error ?? {};
    return {
      status: error.status ?? "",
      reason: error.details?.find((item) => item.reason)?.reason ?? "",
      message: (error.message ?? "").trim(),
    };
  } catch {
    return { status: "", reason: "", message: raw.slice(0, 300).trim() };
  }
}

function classifyHttpStatus(status: number, provider: ProviderError): string {
  const haystack = `${provider.reason} ${provider.status} ${provider.message}`.toLowerCase();
  const keyInvalid = haystack.includes("api_key_invalid")
    || haystack.includes("api key not valid")
    || haystack.includes("api key expired");
  const referrerBlocked = haystack.includes("referer")
    || haystack.includes("referrer")
    || haystack.includes("api_key_http_referrer_blocked")
    || haystack.includes("requests from this ip");
  const serviceDisabled = haystack.includes("service_disabled")
    || haystack.includes("has not been used in project")
    || haystack.includes("is disabled");

  if (status === 404) return "GEMINI_MODEL_UNAVAILABLE";
  if (status === 429) return "GEMINI_BUSY";
  if (status >= 500) return "GEMINI_SERVER_ERROR";
  if (keyInvalid) return "GEMINI_KEY_INVALID";
  if (status === 403 && referrerBlocked) return "GEMINI_KEY_REFERRER_BLOCKED";
  if (status === 403 && serviceDisabled) return "GEMINI_API_DISABLED";
  if (status === 401) return "GEMINI_KEY_INVALID";
  if (status === 403) return "GEMINI_KEY_REJECTED";
  if (status === 400) return "GEMINI_REQUEST_REJECTED";
  return "GEMINI_REQUEST_FAILED";
}

type Candidate = { finishReason?: string; content?: { parts?: Array<{ text?: string }> } };

type GenerateResult = { text: string; finishReason: string; blockReason: string };

function rejectsThinkingConfig(code: string, provider: ProviderError): boolean {
  if (code !== "GEMINI_REQUEST_REJECTED") return false;
  const message = provider.message.toLowerCase();
  return message.includes("thinking") || message.includes("thinkingbudget") || message.includes("thinking_budget");
}

async function callGenerate(params: {
  apiKey: string;
  model: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  maxOutputTokens: number;
  disableThinking: boolean;
  signal?: AbortSignal;
}): Promise<GenerateResult> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.4,
    maxOutputTokens: params.maxOutputTokens,
  };
  // Thinking tokens are billed against maxOutputTokens; leaving them on can
  // consume the whole budget and return a candidate with no text.
  if (params.disableThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };

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
          generationConfig,
        }),
        signal: params.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GeminiError("GEMINI_UNREACHABLE", error instanceof Error ? error.message : "");
  }

  if (!response.ok) {
    const provider = await readProviderError(response);
    const code = classifyHttpStatus(response.status, provider);
    if (params.disableThinking && rejectsThinkingConfig(code, provider)) {
      return callGenerate({ ...params, disableThinking: false });
    }
    throw new GeminiError(code, provider.message);
  }

  const payload = await response.json() as {
    candidates?: Candidate[];
    promptFeedback?: { blockReason?: string };
  };
  const candidate = payload.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  return {
    text,
    finishReason: candidate?.finishReason ?? "",
    blockReason: payload.promptFeedback?.blockReason ?? "",
  };
}

function emptyReplyCode(result: GenerateResult): string {
  if (result.blockReason) return "GEMINI_BLOCKED_REPLY";
  if (result.finishReason === "MAX_TOKENS") return "GEMINI_TRUNCATED_REPLY";
  if (result.finishReason === "SAFETY" || result.finishReason === "PROHIBITED_CONTENT") return "GEMINI_BLOCKED_REPLY";
  return "GEMINI_EMPTY_REPLY";
}

const RETRYABLE_ON_NEXT_MODEL = new Set([
  "GEMINI_MODEL_UNAVAILABLE",
  "GEMINI_SERVER_ERROR",
  "GEMINI_EMPTY_REPLY",
  "GEMINI_TRUNCATED_REPLY",
]);

async function generateWithFallback(params: {
  apiKey: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  maxOutputTokens: number;
  allowEmpty?: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = sanitizeGeminiKey(params.apiKey);
  if (!apiKey) throw new GeminiError("GEMINI_KEY_MISSING");

  let lastError: GeminiError = new GeminiError("GEMINI_REQUEST_FAILED");
  for (const model of GEMINI_MODELS) {
    try {
      const result = await callGenerate({ ...params, apiKey, model, disableThinking: true });
      if (result.text) return result.text;
      if (params.allowEmpty) return "";
      throw new GeminiError(emptyReplyCode(result), result.finishReason || result.blockReason);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error instanceof GeminiError
        ? error
        : new GeminiError(error instanceof Error ? error.message : "GEMINI_REQUEST_FAILED");
      if (RETRYABLE_ON_NEXT_MODEL.has(lastError.message)) continue;
      throw lastError;
    }
  }
  throw lastError;
}

/**
 * Activation check. A key is accepted when Gemini answers HTTP 200, even if
 * the model produced no text for the ping.
 */
export async function verifyGeminiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  await generateWithFallback({
    apiKey,
    systemInstruction: "Reply with the single word OK.",
    contents: [{ role: "user", parts: [{ text: "ping" }] }],
    maxOutputTokens: 256,
    allowEmpty: true,
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
