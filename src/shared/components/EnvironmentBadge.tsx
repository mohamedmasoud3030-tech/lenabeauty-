import { Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { config } from "../../config/env";

/**
 * Keep non-production disclosure truthful without exposing internal deployment
 * vocabulary to normal users. Production renders nothing; staging/development
 * simply identifies the records as sample data.
 */
export function EnvironmentBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();

  if (config.environment === "production") return null;

  return (
    <span
      role="status"
      title={t("Sample data")}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 font-semibold text-primary",
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
        className,
      )}
    >
      <Database aria-hidden="true" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>{t("Sample data")}</span>
    </span>
  );
}

export default EnvironmentBadge;
