import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { AlertCircle, Inbox, RefreshCw, Loader2 } from "lucide-react";
import { clsx } from "clsx";

/**
 * ScreenState — the app-wide, reusable pattern for the three data states:
 * loading / empty / error.
 *
 * Mobile-optimized: smaller padding, touch-friendly retry button,
 * lighter visual weight for better mobile UX.
 */
interface ScreenStateProps {
  state: "loading" | "empty" | "error";
  /** lucide icon override (defaults: Loader2 / Inbox / AlertCircle) */
  icon?: ReactNode;
  /** i18n key — defaults differ per state */
  title?: string;
  /** i18n key */
  description?: string;
  /** i18n key for the primary action button */
  actionLabel?: string;
  onAction?: () => void;
  /** error details (raw message) shown under the description when state=error */
  errorDetail?: string;
  compact?: boolean;
  className?: string;
}

export function ScreenState({
  state,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  errorDetail,
  compact = false,
  className,
}: ScreenStateProps) {
  const { t } = useTranslation();

  const defaults = {
    loading: {
      title: t("Loading"),
      description: t("Please wait a moment"),
      icon: <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />,
    },
    empty: {
      title: t("No data yet"),
      description: t("There is nothing to show here yet"),
      icon: <Inbox className="h-5 w-5 sm:h-6 sm:w-6" />,
    },
    error: {
      title: t("Failed to load data"),
      description: t("Something went wrong while loading. Try again."),
      icon: <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
    },
  } as const;

  const resolvedTitle = title || defaults[state].title;
  const resolvedDescription = description || defaults[state].description;
  const resolvedIcon = icon || defaults[state].icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role={state === "error" ? "alert" : "status"}
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        // Mobile: tighter spacing, desktop: more breathing room
        compact 
          ? "py-6 px-3 gap-2 sm:py-8 sm:gap-3" 
          : "py-10 px-4 gap-3 sm:py-16 sm:px-6 sm:gap-4",
        className
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center rounded-xl border",
          // Mobile: smaller icons
          compact ? "h-10 w-10 sm:h-12 sm:w-12" : "h-12 w-12 sm:h-16 sm:w-16",
          state === "error"
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : "bg-primary/10 text-primary border-primary/10"
        )}
      >
        {resolvedIcon}
      </div>

      <div className={clsx("space-y-1 sm:space-y-2 max-w-xs sm:max-w-md")}>
        <h3 className={clsx(
          "font-bold text-foreground",
          compact ? "text-xs sm:text-sm" : "text-sm sm:text-lg"
        )}>
          {resolvedTitle}
        </h3>
        <p className={clsx(
          "text-muted-foreground leading-relaxed",
          compact ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm"
        )}>
          {resolvedDescription}
        </p>
        {state === "error" && errorDetail && (
          <p className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono break-words bg-muted/40 rounded-lg p-2 max-h-16 overflow-auto">
            {errorDetail}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={clsx(
            "inline-flex items-center gap-2 font-bold shadow-lg shadow-primary/20",
            "hover:brightness-110 active:scale-95 transition-all touch-target",
            // Mobile: smaller button
            compact 
              ? "h-10 px-4 rounded-lg text-xs sm:h-11 sm:px-6 sm:rounded-xl sm:text-sm" 
              : "h-11 px-6 rounded-xl text-sm"
          )}
        >
          {state === "error" ? <RefreshCw className="h-4 w-4" /> : null}
          {t(actionLabel)}
        </button>
      )}
    </motion.div>
  );
}

export default ScreenState;
