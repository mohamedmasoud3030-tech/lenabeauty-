import { RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Keeps an already-open client on one coherent application version. The
 * service worker waits until the operator accepts the reload instead of
 * activating new chunks underneath a live POS session.
 */
export function PwaUpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("[PWA] Service worker registration failed", {
        name: error instanceof Error ? error.name : "Error",
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[var(--z-toast)] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl lg:bottom-4"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">{t("A new version is available")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("Update when you are ready to reload the app")}</p>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            {t("Update now")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label={t("Later")}
          className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="mx-auto h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
