import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Mic, PhoneOff, Send, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "./Toast";
import {
  askGemini,
  type ChatTurn,
  verifyGeminiKey,
} from "../../infrastructure/gemini/adminAssistant";
import {
  loadPersistedGeminiKey,
  persistGeminiKey,
  removePersistedGeminiKey,
  type GeminiKeyLocation,
} from "../../infrastructure/gemini/adminAssistantStore";
import {
  startLiveAssistant,
  type LiveSession,
  type LiveStatus,
} from "../../infrastructure/gemini/adminAssistantLive";

const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const SUGGESTIONS = [
  { en: "How do I add an appointment?", ar: "كيف أضيف موعدًا؟" },
  { en: "Where is today's point of sale?", ar: "أين نقطة البيع لليوم؟" },
  { en: "How do I add a staff member?", ar: "كيف أضيف موظفة؟" },
];

function errorCopy(code: string, t: (key: string) => string): string {
  if (code === "GEMINI_KEY_MISSING") return t("Add a Gemini key to start");
  if (code === "GEMINI_KEY_REJECTED") return t("Gemini rejected this key. Check it in Google AI Studio.");
  if (code === "GEMINI_UNREACHABLE") return t("Could not reach Gemini. Try again.");
  if (code === "GEMINI_EMPTY_REPLY") return t("The assistant returned an empty reply.");
  if (code === "GEMINI_MODEL_UNAVAILABLE") return t("Gemini model is unavailable. Try again later.");
  if (code === "GEMINI_BUSY") return t("Gemini is busy. Wait a moment and try again.");
  if (code === "GEMINI_MIC_DENIED") return t("Microphone permission is required");
  if (code === "GEMINI_LIVE_UNAVAILABLE") return t("Live voice is not available in this browser");
  return t("Could not reach Gemini. Try again.");
}

function mergeTranscript(previous: string, incoming: string): string {
  const next = incoming.trim();
  if (!previous) return next;
  if (next.startsWith(previous)) return next;
  if (previous.startsWith(next)) return previous;
  return `${previous} ${next}`.replace(/\s+/g, " ").trim();
}

function upsertTurn(prev: ChatTurn[], role: ChatTurn["role"], text: string): ChatTurn[] {
  const last = prev[prev.length - 1];
  if (last?.role === role) {
    return [...prev.slice(0, -1), { role, text: mergeTranscript(last.text, text) }];
  }
  return [...prev, { role, text }];
}

export function AdminAssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<LiveSession | null>(null);
  const liveGen = useRef(0);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return window.localStorage?.getItem("lara_admin_gemini_key")?.trim() ?? "";
    } catch {
      return "";
    }
  });
  const [keyLocation, setKeyLocation] = useState<GeminiKeyLocation | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");

  const active = apiKey.length > 0;
  const liveOn = liveStatus !== "idle";
  const isArabic = i18n.language === "ar";
  const systemInstruction = useMemo(
    () => (isArabic
      ? "أنت مساعدة تشغيل لمديرة مركز تجميل Lara Beauty. أجيبي بالعربية بوضوح واختصار، ووجّهي إلى الشاشات الموجودة: المواعيد، نقطة البيع، العملاء، الخدمات، المخزون، الموظفون، التقارير، الإعدادات. لا تحجزي مواعيد، لا تغيّري سجلات، لا تقرئي ملفات العميلات، ولا تدّعي أنك نفّذت إجراءً في التطبيق. إذا طُلب ذلك، وضّحي أن المديرة تنفّذه من شاشات التطبيق."
      : "You are the Lara Beauty admin assistant for a beauty-center manager. Answer clearly and briefly. Point to existing screens: Appointments, Point of Sale, Customers, Services, Inventory, Employees, Reports, Settings. You cannot book appointments, change records, read customer files, or claim you performed an action in the app. If asked to do those, say the manager must do it on the app screens."),
    [isArabic],
  );

  function stopLive() {
    liveGen.current += 1;
    liveRef.current?.stop();
    liveRef.current = null;
    setLiveStatus("idle");
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadPersistedGeminiKey().then((result) => {
      if (cancelled) return;
      setApiKey(result.key);
      setKeyLocation(result.location);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    stopLive();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => {
      if (apiKey) composerRef.current?.focus();
      else keyInputRef.current?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose, apiKey]);

  useEffect(() => {
    const node = logRef.current;
    if (!node || typeof node.scrollTo !== "function") return;
    node.scrollTo({ top: node.scrollHeight });
  }, [history, sending, inlineError, liveStatus]);

  async function persistKey() {
    const next = keyDraft.trim();
    if (!next || verifying) return;
    setVerifying(true);
    setInlineError("");
    try {
      await verifyGeminiKey(next);
      const location = await persistGeminiKey(next);
      setApiKey(next);
      setKeyLocation(location);
      setKeyDraft("");
      showToast("success", t("Success"), location === "database" ? t("Key saved for this center") : t("Key saved on this device"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "GEMINI_REQUEST_FAILED";
      setInlineError(errorCopy(code, t));
    } finally {
      setVerifying(false);
    }
  }

  async function removeKey() {
    stopLive();
    await removePersistedGeminiKey();
    setApiKey("");
    setKeyLocation(null);
    setHistory([]);
    setInlineError("");
    showToast("success", t("Success"), t("Key removed"));
  }

  async function toggleLive() {
    if (liveRef.current || liveOn) {
      stopLive();
      return;
    }
    const id = liveGen.current + 1;
    liveGen.current = id;
    setInlineError("");
    setLiveStatus("connecting");
    try {
      const session = await startLiveAssistant({
        apiKey,
        systemInstruction,
        language: i18n.language,
        handlers: {
          onStatus: (status) => {
            if (liveGen.current !== id) return;
            setLiveStatus(status);
          },
          onUserTranscript: (text) => {
            if (liveGen.current !== id) return;
            setHistory((prev) => upsertTurn(prev, "user", text));
          },
          onModelTranscript: (text) => {
            if (liveGen.current !== id) return;
            setHistory((prev) => upsertTurn(prev, "model", text));
          },
          onError: (code) => {
            if (liveGen.current !== id) return;
            setInlineError(errorCopy(code, t));
          },
        },
      });
      if (liveGen.current !== id) {
        session.stop();
        return;
      }
      liveRef.current = session;
    } catch (error) {
      if (liveGen.current !== id) return;
      liveRef.current = null;
      setLiveStatus("idle");
      const code = error instanceof Error ? error.message : "GEMINI_LIVE_UNAVAILABLE";
      setInlineError(errorCopy(code, t));
    }
  }

  async function send(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const message = (preset ?? draft).trim();
    if (!message || sending || !active) return;
    setDraft("");
    setInlineError("");
    if (liveRef.current) {
      setHistory((prev) => upsertTurn(prev, "user", message));
      liveRef.current.sendText(message);
      return;
    }
    setSending(true);
    const nextHistory = [...history, { role: "user" as const, text: message }];
    setHistory(nextHistory);
    try {
      const reply = await askGemini({
        apiKey,
        history,
        message,
        systemInstruction,
      });
      setHistory([...nextHistory, { role: "model", text: reply }]);
    } catch (error) {
      const code = error instanceof Error ? error.message : "GEMINI_REQUEST_FAILED";
      setHistory(history);
      setDraft(preset ? "" : message);
      setInlineError(errorCopy(code, t));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const liveLabel = liveStatus === "speaking"
    ? t("Speaking...")
    : liveStatus === "connecting"
      ? t("Connecting live...")
      : liveStatus === "listening"
        ? t("Listening...")
        : t("Talk now. The assistant will answer by voice.");

  return (
    <div
      id="admin-assistant-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-assistant-title"
      className="fixed z-[var(--z-overlay)] inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] flex max-h-[min(36rem,78dvh)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl print:hidden lg:inset-x-auto lg:end-6 lg:bottom-24 lg:w-[28rem]"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="admin-assistant-title" className="truncate text-sm font-bold">{t("Admin assistant")}</h2>
          <p className="truncate text-[11px] text-muted-foreground">{t("Answers operating questions. It does not book, change records, or read customer files.")}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("Close")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div ref={logRef} className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
        {!active ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-muted/60 px-3 py-3">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("Activate with a Gemini API key")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("The key is saved for this center. Staff cannot see it.")}
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{t("Gemini API key")}</span>
              <input
                ref={keyInputRef}
                className={fieldClass}
                type="password"
                autoComplete="off"
                dir="ltr"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void persistKey();
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void persistKey()}
              disabled={!keyDraft.trim() || verifying}
              className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {verifying ? t("Checking key...") : t("Save key")}
            </button>
            {inlineError ? <p role="alert" className="text-xs font-bold text-destructive">{inlineError}</p> : null}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-primary">
                {keyLocation === "database" ? t("Assistant is on for this center") : t("Assistant is on")}
              </p>
              <button type="button" onClick={() => void removeKey()} className="min-h-11 rounded-xl border border-border px-3 text-xs font-bold">
                {t("Remove key")}
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3">
              <button
                type="button"
                onClick={() => void toggleLive()}
                className={clsx(
                  "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold",
                  liveOn ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                {liveOn ? <PhoneOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                {liveOn ? t("End live call") : t("Start live call")}
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">{liveLabel}</p>
            </div>
            {history.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("Ask about daily operations. Conversation is not saved.")}</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((item) => {
                    const label = isArabic ? item.ar : item.en;
                    return (
                      <button
                        key={item.en}
                        type="button"
                        onClick={() => void send(undefined, label)}
                        disabled={sending}
                        className="min-h-11 rounded-full border border-border bg-background px-3 text-xs font-bold hover:bg-muted"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              history.map((turn, index) => (
                <div
                  key={`${turn.role}-${index}`}
                  className={clsx(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    turn.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {turn.text}
                </div>
              ))
            )}
            {sending ? <p className="text-xs font-bold text-muted-foreground">{t("Waiting for a reply...")}</p> : null}
            {inlineError ? <p role="alert" className="text-xs font-bold text-destructive">{inlineError}</p> : null}
          </>
        )}
      </div>

      {active ? (
        <form onSubmit={(event) => void send(event)} className="flex shrink-0 items-end gap-2 border-t border-border p-3">
          <label className="sr-only" htmlFor="assistant-draft">{t("Write a question")}</label>
          <textarea
            id="assistant-draft"
            ref={composerRef}
            className={clsx(fieldClass, "max-h-28 resize-none")}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("Write a question")}
            disabled={sending}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-primary px-3 font-bold text-primary-foreground disabled:opacity-50"
            aria-label={t("Send message")}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : null}
    </div>
  );
}
