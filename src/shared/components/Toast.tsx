import React, { createContext, useContext, useState, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { XCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function looksTechnical(value?: string): boolean {
  if (!value) return false;
  return /(Backend Required|BACKEND_METHOD_UNSUPPORTED|supabase|postgrest|PGRST\d*|\bRPC\b|schema cache|failed to fetch|networkerror|fetch failed)/i.test(value);
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: translate } = useTranslation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function sanitizeUserFacingToast(type: ToastType, title: string, message?: string) {
    if (type === "error" && (looksTechnical(title) || looksTechnical(message))) {
      return {
        title: translate("Error"),
        message: translate("An unexpected error occurred. Please try again."),
      };
    }

    return { title, message };
  }

  function showToast(type: ToastType, title: string, message?: string) {
    const safe = sanitizeUserFacingToast(type, title, message);
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title: safe.title, message: safe.message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 end-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              aria-live={t.type === "error" ? "assertive" : "polite"}
              aria-atomic="true"
              aria-labelledby={`toast-title-${t.id}`}
              aria-describedby={t.message ? `toast-message-${t.id}` : undefined}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`flex items-start gap-3 p-4 rounded-lg shadow-lg pointer-events-auto w-[calc(100vw-2rem)] max-w-sm sm:min-w-[300px] border ${
                t.type === "error"
                  ? "bg-card border-destructive/30 text-destructive"
                  : t.type === "success"
                  ? "bg-card border-success/30 text-success"
                  : t.type === "warning"
                  ? "bg-card border-warning/30 text-warning"
                  : "bg-card border-info/30 text-info"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {t.type === "error" && <XCircle className="w-5 h-5 text-destructive" />}
                {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-success" />}
                {t.type === "warning" && <AlertTriangle className="w-5 h-5 text-warning" />}
                {t.type === "info" && <Info className="w-5 h-5 text-info" />}
              </div>
              <div className="flex-1">
                <h4 id={`toast-title-${t.id}`} className="font-semibold text-sm">{t.title}</h4>
                {t.message && <p id={`toast-message-${t.id}`} className="text-sm mt-1 opacity-90">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label={translate("Close")}
                className="h-11 w-11 -m-2 shrink-0 flex items-center justify-center rounded-lg opacity-70 hover:opacity-100"
              >
                <XCircle aria-hidden="true" className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
