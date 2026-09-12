import { PRODUCT_NAME } from "../../config/brand";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CalendarDays, Globe, Sparkles } from "lucide-react";
import { persistLanguage, type AppLanguage, isValidLanguage } from "../../preferences";

/**
 * Shared chrome for the anonymous surfaces (#/book, #/portal).
 *
 * These routes render OUTSIDE the authenticated Layout, so the global
 * lang/dir side-effects that Layout owns must be re-asserted here — otherwise
 * a deep link straight into /book would render LTR with an English document
 * language even when the stored preference is Arabic.
 */
export function usePublicDirection() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const current = i18n.language || "ar";
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);
}

export function PublicShell({
  centerName,
  highlight,
  children,
}: {
  centerName: string;
  highlight: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();

  function toggleLanguage() {
    const next = (i18n.language === "ar" ? "en" : "ar") as AppLanguage;
    if (!isValidLanguage(next)) return;
    void i18n.changeLanguage(next);
    persistLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{centerName}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{highlight}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/portal"
              className="hidden min-h-11 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-bold text-muted-foreground transition hover:text-foreground sm:flex"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {t("Client Portal")}
            </Link>
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground transition hover:text-primary"
              aria-label={t("Change Language")}
            >
              <Globe className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-8 pt-2 text-center">
        <p className="text-[11px] font-medium text-muted-foreground/70">
          {t("Powered by")} {PRODUCT_NAME}
        </p>
      </footer>
    </div>
  );
}