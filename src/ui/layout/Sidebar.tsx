import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  Moon,
  Sun,
  Globe,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../../auth";
import { motion } from "motion/react";
import { SalonLogo } from "../../shared/components/LazyImage";
import { persistLanguage, persistTheme } from "../../preferences";
import { useOptionalModules } from "../../shared/hooks/useOptionalModules";
import { NAV_GROUPS, visibleDestinations, type NavDestination } from "../../app/navigation";

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const optionalModules = useOptionalModules();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const stored = localStorage.getItem("lenabeauty_logo");
    if (stored) setLogoUrl(stored);
  }, []);

  const navGroups = useMemo(() => {
    const visible = visibleDestinations({
      isAdmin: me?.role === "ADMIN",
      optionalModules,
    });

    return NAV_GROUPS
      .map((group) => ({
        titleKey: group.titleKey,
        items: visible.filter((destination) => destination.group === group.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [me?.role, optionalModules]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    persistTheme(next ? "dark" : "light");
  }

  function toggleLanguage() {
    const nextLang = i18n.language === "ar" ? "en" : "ar";
    void i18n.changeLanguage(nextLang);
    persistLanguage(nextLang);
    document.documentElement.lang = nextLang;
    document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
  }

  const roleLabel = me?.role === "ADMIN"
    ? t("Administrator")
    : me?.role === "MANAGER"
      ? t("Manager")
      : me?.role === "STAFF"
        ? t("Staff Member")
        : "";

  return (
    <aside className="relative flex h-full flex-col overflow-hidden border-border bg-card/98 backdrop-blur-xl lg:border-e lg:bg-card/95">
      <div aria-hidden="true" className="absolute left-1/2 top-2 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-border lg:hidden" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/8 to-transparent" />

      <div className="relative z-10 flex h-20 flex-col justify-center border-b border-border px-4 pt-2 sm:px-6 lg:pt-0">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <SalonLogo logoUrl={logoUrl} salonName="LenaBeauty" size="md" />
          ) : (
            <div className="h-10 w-10 flex-shrink-0">
              <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-base font-bold leading-none tracking-tight text-foreground">LenaBeauty</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-wide text-primary">
              {t("Salon operations")}
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ms-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:text-destructive lg:hidden"
              aria-label={t("Close")}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 hidden items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:flex">
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleLanguage} className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-primary" aria-label={t("Change Language")} title={t("Change Language")}>
            <Globe aria-hidden="true" className="h-4 w-4" />
          </button>
          <button type="button" onClick={toggleTheme} className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-primary" aria-label={t("Change Theme")} aria-pressed={isDark} title={t("Change Theme")}>
            {isDark ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav aria-label={t("Primary navigation")} className="relative z-10 flex-1 overflow-y-auto px-3 py-2 scrollbar-hide sm:px-4">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="mb-4">
            <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground/80">
              {t(group.titleKey)}
            </div>
            <ul className="space-y-1">
              {group.items.map(({ path, labelKey, icon: Icon }: NavDestination, index) => (
                <motion.li initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }} key={path}>
                  <NavLink
                    to={path}
                    onClick={onClose}
                    className={({ isActive }) => clsx(
                      "group flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                      isActive
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{t(labelKey)}</span>
                    </div>
                    <ChevronRight aria-hidden="true" className={clsx("h-4 w-4 opacity-40", i18n.language === "ar" && "rotate-180")} />
                  </NavLink>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative z-10 border-t border-border bg-card/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:pb-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {me?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-foreground">{me?.username}</div>
            {roleLabel ? (
              <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                {roleLabel}
              </div>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={() => void logout()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 text-sm font-bold text-destructive transition hover:bg-destructive hover:text-destructive-foreground">
          <LogOut className="h-4 w-4" />
          {t("Logout")}
        </button>
      </div>
    </aside>
  );
}
