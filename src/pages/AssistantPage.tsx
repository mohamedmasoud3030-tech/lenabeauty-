import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Send } from "lucide-react";
import { PageHeader } from "../shared/components/PageHeader";
import { useToast } from "../shared/components/Toast";
import { clsx } from "clsx";
import {
  askGemini,
  clearGeminiKey,
  readGeminiKey,
  saveGeminiKey,
  type ChatTurn,
} from "../infrastructure/gemini/adminAssistant";

const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function errorCopy(code: string, t: (key: string) => string): string {
  if (code === "GEMINI_KEY_MISSING") return t("Add a Gemini key to start");
  if (code === "GEMINI_KEY_REJECTED") return t("Gemini rejected this key. Check it in Google AI Studio.");
  if (code === "GEMINI_UNREACHABLE") return t("Could not reach Gemini. Try again.");
  if (code === "GEMINI_EMPTY_REPLY") return t("The assistant returned an empty reply.");
  return t("Could not reach Gemini. Try again.");
}

export default function AssistantPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState(() => readGeminiKey());
  const [keyDraft, setKeyDraft] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const active = apiKey.length > 0;
  const systemInstruction = useMemo(
    () => (i18n.language === "ar"
      ? "أنت مساعد تشغيل لمدير مركز تجميل Lara Beauty. أجب بالعربية بوضوح واختصار. لا تحجز مواعيد، لا تغيّر سجلات، لا تقرأ ملفات العميلات، ولا تدّعي أنك نفّذت إجراءً في التطبيق. إذا طُلب منك ذلك، وضّح أن المديرة تنفّذه من شاشات التطبيق."
      : "You are the Lara Beauty admin assistant for a beauty-center manager. Answer clearly and briefly. You cannot book appointments, change records, read customer files, or claim you performed an action in the app. If asked to do those, say the manager must do it on the app screens."),
    [i18n.language],
  );

  function persistKey() {
    const next = keyDraft.trim();
    if (!next) return;
    saveGeminiKey(next);
    setApiKey(next);
    setKeyDraft("");
    showToast("success", t("Success"), t("Key saved"));
  }

  function removeKey() {
    clearGeminiKey();
    setApiKey("");
    setHistory([]);
    showToast("success", t("Success"), t("Key removed"));
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || !active) return;
    setDraft("");
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
      showToast("error", t("Error"), errorCopy(code, t));
      setHistory(history);
      setDraft(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        icon={<MessageCircle className="h-7 w-7" />}
        title={t("Admin assistant")}
        subtitle={t("Ask the assistant")}
      />
      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t("Answers operating questions. It does not book, change records, or read customer files.")}
      </p>

      {!active ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-lg font-bold">{t("Activate with a Gemini API key")}</h2>
          <p className="text-sm text-muted-foreground">{t("The key stays on this device. It is not saved on the server.")}</p>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("Gemini API key")}</span>
            <input
              className={fieldClass}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={persistKey}
            disabled={!keyDraft.trim()}
            className="min-h-11 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50"
          >
            {t("Save key")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm font-bold text-foreground">{t("Assistant is on")}</p>
          <button type="button" onClick={removeKey} className="min-h-11 rounded-xl border border-border px-3 text-xs font-bold">
            {t("Remove key")}
          </button>
        </div>
      )}

      {active ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="min-h-[280px] max-h-[480px] space-y-3 overflow-auto p-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Conversation is not saved.")}</p>
            ) : (
              history.map((turn, index) => (
                <div
                  key={`${turn.role}-${index}`}
                  className={clsx(
                    "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    turn.role === "user"
                      ? "ms-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {turn.text}
                </div>
              ))
            )}
            {sending ? <p className="text-xs font-bold text-muted-foreground">{t("Waiting for a reply...")}</p> : null}
          </div>
          <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border p-3">
            <label className="sr-only" htmlFor="assistant-draft">{t("Write a question")}</label>
            <input
              id="assistant-draft"
              className={fieldClass}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("Write a question")}
              disabled={sending}
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
        </div>
      ) : null}
    </div>
  );
}
