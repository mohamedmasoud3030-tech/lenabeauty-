import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { AlertCircle, Inbox, RefreshCw, Loader2 } from "lucide-react";
import { clsx } from "clsx";

/**
 * ScreenState — the app-wide, reusable pattern for the three data states:
 * loading / empty / error.
 *
 * Every screen that fetches data should render exactly one of these so users
 * never see a blank card, a dead space, or an untranslated spinner. Titles and
 * descriptions are i18n keys (Arabic + English provided app-wide).
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
      icon: <Loader2 className="h-6 w-6 animate-spin" />,
    },
    empty: {
      title: t("No data yet"),
      description: t("There is nothing to show here yet"),
      icon: <Inbox className="h-6 w-6" />,
    },
    error: {
      title: t("Failed to load data"),
      description: t("Something went wrong while loading. Try again."),
      icon: <AlertCircle className="h-6 w-6" />,
    },
  } as const;

  const resolvedTitle = title || defaults[state].title;
  const resolvedDescription = description || defaults[state].description;
  const resolvedIcon = icon || defaults[state].icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      role={state === "error" ? "alert" : "status"}
      className={clsx(
        "flex flex-col items-center justify-center text-center gap-4",
        compact ? "py-10 px-4" : "py-16 px-6 sm:py-20",
        className
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center rounded-2xl border",
          compact ? "h-12 w-12" : "h-16 w-16",
          state === "error"
            ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
            : "bg-primary/10 text-primary border-primary/10"
        )}
      >
        {resolvedIcon}
      </div>

      <div className="space-y-2 max-w-md">
        <h3 className={clsx("font-bold text-foreground", compact ? "text-sm" : "text-lg")}>
          {resolvedTitle}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{resolvedDescription}</p>
        {state === "error" && errorDetail && (
          <p className="text-xs text-muted-foreground/60 font-mono break-words bg-muted/40 rounded-lg p-2">
            {errorDetail}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary font-bold text-sm text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
        >
          {state === "error" ? <RefreshCw className="h-4 w-4" /> : null}
          {t(actionLabel)}
        </button>
      )}
    </motion.div>
  );
}

export default ScreenState;
