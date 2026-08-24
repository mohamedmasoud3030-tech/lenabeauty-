import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { AlertCircle, Inbox, RefreshCw, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface ScreenStateProps {
  state: "loading" | "empty" | "error";
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  errorDetail?: string;
  compact?: boolean;
  className?: string;
}

function looksTechnical(value?: string): boolean {
  if (!value) return false;
  return /(BACKEND_METHOD_UNSUPPORTED|supabase|postgrest|PGRST\d*|\bRPC\b|schema cache|failed to fetch|networkerror|fetch failed)/i.test(value);
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

  const requestedTitle = title || defaults[state].title;
  const requestedDescription = description || defaults[state].description;
  const resolvedTitle = state === "error" && looksTechnical(requestedTitle)
    ? defaults.error.title
    : requestedTitle;
  const resolvedDescription = state === "error" && looksTechnical(requestedDescription)
    ? defaults.error.description
    : requestedDescription;
  const safeErrorDetail = state === "error" && !looksTechnical(errorDetail) ? errorDetail : undefined;
  const resolvedIcon = icon || defaults[state].icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role={state === "error" ? "alert" : "status"}
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "py-6 px-3 gap-2 sm:py-8 sm:gap-3"
          : "py-10 px-4 gap-3 sm:py-16 sm:px-6 sm:gap-4",
        className
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center rounded-xl border",
          compact ? "h-10 w-10 sm:h-12 sm:w-12" : "h-12 w-12 sm:h-16 sm:w-16",
          state === "error"
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : "bg-primary/10 text-primary border-primary/10"
        )}
      >
        {resolvedIcon}
      </div>

      <div className="space-y-1 sm:space-y-2 max-w-xs sm:max-w-md">
        <h3 className={clsx(
          "font-bold text-foreground",
          compact ? "text-sm" : "text-base sm:text-lg"
        )}>
          {resolvedTitle}
        </h3>
        <p className={clsx(
          "text-muted-foreground leading-relaxed",
          compact ? "text-xs sm:text-sm" : "text-sm"
        )}>
          {resolvedDescription}
        </p>
        {safeErrorDetail && (
          <p className="text-xs text-muted-foreground/70 break-words bg-muted/40 rounded-lg p-2 max-h-20 overflow-auto">
            {safeErrorDetail}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={clsx(
            "inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20",
            "hover:bg-primary/90 active:scale-95 transition-all touch-target",
            compact
              ? "h-11 px-5 rounded-xl text-sm"
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
