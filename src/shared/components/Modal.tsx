import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { useConfirm } from "./ConfirmDialog";

export type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action area kept above the mobile keyboard and bottom nav. */
  footer?: ReactNode;
  size?: ModalSize;
  /**
   * When provided, closing via backdrop/Escape/X prompts a confirmation so
   * unsaved user input is not lost. Pass a localized message.
   */
  confirmCloseMessage?: string;
  /** Disable backdrop click + Escape closing (e.g. during a required save). */
  disableClose?: boolean;
  /** Accessible name fallback when no title is supplied. */
  ariaLabel?: string;
  className?: string;
}

const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/** Elements that should remain focusable inside the trap. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  confirmCloseMessage,
  disableClose = false,
  ariaLabel,
  className,
}: ModalProps) {
  const { t } = useTranslation();
  const { confirm } = useConfirm();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const requestClose = useCallback(async () => {
    if (disableClose) return;
    if (confirmCloseMessage) {
      const ok = await confirm({
        message: confirmCloseMessage,
        type: "danger",
      });
      if (!ok) return;
    }
    onClose();
  }, [confirm, confirmCloseMessage, disableClose, onClose]);

  // Lock background scroll while the overlay is open and restore on close.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  // Focus management: focus the panel on open, restore the trigger on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Defer until the panel is painted.
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    }, 0);

    return () => {
      window.clearTimeout(id);
      const trigger = previouslyFocused.current;
      if (trigger && typeof trigger.focus === "function") {
        trigger.focus();
      }
    };
  }, [isOpen]);

  // Escape to close + focus trap.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableClose) {
        e.stopPropagation();
        void requestClose();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [isOpen, disableClose, requestClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className={clsx(
            "fixed inset-0 z-[var(--z-overlay)] flex items-stretch sm:items-center justify-center",
            "p-0 sm:p-4"
          )}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => void requestClose()}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Panel — full-height sheet on mobile, bounded centered dialog on desktop */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            aria-label={!title ? ariaLabel ?? t("Close") : undefined}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            tabIndex={-1}
            className={clsx(
              "relative z-10 flex flex-col w-full bg-card text-card-foreground shadow-2xl outline-none",
              "h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl",
              SIZE_MAX_WIDTH[size],
              className
            )}
          >
            {/* Sticky header — always visible, safe-area aware */}
            <div className="shrink-0 flex items-start gap-3 border-b border-border px-4 sm:px-5 py-3 sm:py-4 bg-card/95 backdrop-blur-sm rounded-t-2xl pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2
                      id={titleId}
                      className="text-base sm:text-lg font-bold text-foreground truncate"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      id={descId}
                      className="text-xs text-muted-foreground mt-0.5 truncate"
                    >
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void requestClose()}
                  disabled={disableClose}
                  aria-label={t("Close")}
                  className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
                {!title && <span id={titleId} className="sr-only">{ariaLabel ?? ""}</span>}
              </div>

            {/* Scrollable body — scrolling stays inside the overlay */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4">
              {children}
            </div>

            {/* Sticky footer — primary actions stay above keyboard + bottom nav */}
            {footer && (
              <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur-sm px-4 sm:px-5 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] rounded-b-2xl">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
