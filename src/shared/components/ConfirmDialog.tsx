import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "status";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const isOpen = Boolean(state?.open);

  const confirm = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  };

  const handleCancel = () => {
    if (state) {
      state.resolve(false);
      setState(null);
    }
  };

  const handleConfirm = () => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      const safestAction = panel?.querySelector<HTMLElement>("[data-confirm-cancel]");
      (safestAction ?? panel)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      const target = previouslyFocused.current;
      window.setTimeout(() => target?.focus(), 0);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {state && state.open && (
            <div className="fixed inset-0 z-[var(--z-overlay-top)] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-secondary/30 dark:bg-black/80 backdrop-blur-xs"
            />

            {/* Dialog Card */}
            <motion.div
              ref={panelRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-desc"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-card border border-border p-6 rounded-3xl shadow-xl z-10 space-y-6 focus:outline-none"
              tabIndex={-1}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${
                    state.options.type === "danger" 
                      ? "bg-destructive/10 text-destructive" 
                      : "bg-primary/10 text-primary"
                  }`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 id="confirm-title" className="text-base font-bold text-foreground">
                      {state.options.title || t("Are you sure?")}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="h-11 w-11 -m-2 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground transition-all cursor-pointer"
                  aria-label={t("Close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Message */}
              <p id="confirm-desc" className="text-sm text-muted-foreground leading-relaxed">
                {state.options.message}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  data-confirm-cancel
                  onClick={handleCancel}
                  className="min-h-11 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border bg-transparent hover:bg-muted hover:text-foreground transition-all min-w-[90px] cursor-pointer"
                >
                  {state.options.cancelText || t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`min-h-11 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-wider text-primary-foreground min-w-[90px] transition-all shadow-md cursor-pointer ${
                    state.options.type === "danger"
                      ? "bg-destructive hover:bg-destructive/90 shadow-destructive/10"
                      : "bg-primary hover:bg-primary/90 shadow-primary/10"
                  }`}
                >
                  {state.options.confirmText || t("Confirm")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}
