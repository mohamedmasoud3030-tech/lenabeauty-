import { useTranslation } from "react-i18next";
import { config } from "../../config/env";

/**
 * Keep the runtime environment discoverable for diagnostics without turning
 * every screen into a staging banner. The operational UI should look like the
 * product; environment disclosure belongs to diagnostics/settings, not the
 * login form or daily chrome.
 */
export function EnvironmentBadge(_props: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();

  if (config.environment === "production") return null;

  return (
    <span className="sr-only" role="status">
      {t("Trial environment — data here is for testing")}
    </span>
  );
}

export default EnvironmentBadge;
