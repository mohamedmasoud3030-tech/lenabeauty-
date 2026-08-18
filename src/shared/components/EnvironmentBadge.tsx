import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { config } from "../../config/env";

/**
 * EnvironmentBadge
 * ----------------
 * Truthful disclosure of the active data environment.
 *
 * The optimized web build defaults to the Lena Demo/Staging Supabase project
 * (see `src/config/env.ts`), so records created there are NOT production data.
 * Leaving that invisible contradicts the project's "no fake operating mode"
 * doctrine: a first-time user must be able to tell whether what they enter is
 * real before they enter it.
 *
 * Production renders nothing — a correctly configured production deployment
 * needs no caveat, and an always-on badge would train users to ignore it.
 */
export function EnvironmentBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();

  if (config.environment === "production") return null;

  const label = config.environment === "development"
    ? t("Development environment")
    : t("Trial environment");

  return (
    <span
      role="status"
      title={t("Trial environment — data here is for testing")}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 font-bold text-warning",
        compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>{compact ? label : t("Trial environment — data here is for testing")}</span>
    </span>
  );
}

export default EnvironmentBadge;
