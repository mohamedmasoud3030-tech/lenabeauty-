import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, X } from "lucide-react";

type NoticeKind = "admin-only" | "not-found";

interface NavigationNoticeState {
  navigationNotice?: unknown;
  attemptedPath?: unknown;
}

/**
 * NavigationNotice
 * ----------------
 * Explains why the user ended up here instead of where they asked to go.
 *
 * Both redirect paths — `RequireAdmin` refusing a non-admin and the
 * unknown-route fallback — previously dropped the user on the Dashboard with
 * no message, which is indistinguishable from a broken link or a bug.
 *
 * This only reports a redirect that already happened; it is not an
 * authorization control. The route guard is the boundary.
 *
 * The notice is cleared from history state once shown, so a refresh or a later
 * Back navigation does not resurrect a stale message.
 */
export function NavigationNotice() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{ kind: NoticeKind; path: string } | null>(null);

  useEffect(() => {
    const state = location.state as NavigationNoticeState | null;
    const kind = state?.navigationNotice;
    if (kind !== "admin-only" && kind !== "not-found") return;

    const path = typeof state?.attemptedPath === "string" ? state.attemptedPath : "";
    setNotice({ kind, path });

    // Consume the state so refresh/back does not replay the message.
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  if (!notice) return null;

  const message =
    notice.kind === "admin-only"
      ? t("That page is available to administrators only. You were returned to the dashboard.")
      : t("That page does not exist. You were returned to the dashboard.");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-warning"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-bold">{message}</p>
        {notice.path && (
          <p className="mt-0.5 text-xs opacity-80 break-all" dir="ltr">
            {notice.path}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label={t("Dismiss")}
        className="h-11 w-11 shrink-0 -my-1.5 flex items-center justify-center rounded-lg hover:bg-warning/15 transition-colors"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export default NavigationNotice;
