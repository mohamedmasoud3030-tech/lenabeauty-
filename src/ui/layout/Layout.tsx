import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../auth";
import { Globe, LayoutGrid, LogOut, MessageCircle, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { GlobalSearch } from "../../shared/components/GlobalSearch";
import { EnvironmentBadge } from "../../shared/components/EnvironmentBadge";
import { ErrorBoundary } from "../../shared/components/ErrorBoundary";
import { getDisplayName, getInitials } from "../../shared/displayName";
import CenterSwitcher from "./CenterSwitcher";
import { useKeyboardInset, useScrollFieldIntoView } from "../../shared/hooks/useKeyboardInset";
import { SalonLogo } from "../../shared/components/LazyImage";
import { destinationLabelKey } from "../../app/navigation";
import { persistLanguage, persistTheme } from "../../preferences";
import { MobileActionDock } from "./MobileActionDock";
import { MobileNavigationSheet } from "./MobileNavigationSheet";
import { AdminAssistantPanel } from "../../shared/components/AdminAssistantPanel";
import { UserRole } from "../../domain/entities/Session";
import { useSalonIdentity } from "../../shared/hooks/useSalonIdentity";

export default function Layout() {
  const nav = useNavigate();
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const salon = useSalonIdentity();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { isOpen: isKeyboardOpen } = useKeyboardInset();
  useScrollFieldIntoView();

  useEffect(() => {
    if (!showUserMenu) return;
    const closeUserMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as Node | null;
        if (target && (userMenuRef.current?.contains(target) || userButtonRef.current?.contains(target))) return;
      }
      setShowUserMenu(false);
      if (event instanceof KeyboardEvent) {
        window.setTimeout(() => userButtonRef.current?.focus(), 0);
      }
    };
    document.addEventListener("mousedown", closeUserMenu);
    window.addEventListener("keydown", closeUserMenu);
    return () => {
      document.removeEventListener("mousedown", closeUserMenu);
      window.removeEventListener("keydown", closeUserMenu);
    };
  }, [showUserMenu]);

  useEffect(() => {
    if (!showMobileMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowMobileMenu(false);
      window.setTimeout(() => mobileMenuButtonRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showMobileMenu]);

  useEffect(() => {
    if (isKeyboardOpen) setShowMobileMenu(false);
  }, [isKeyboardOpen]);

  useEffect(() => {
    if (showMobileMenu) setShowAssistant(false);
  }, [showMobileMenu]);

  useEffect(() => {
    const currentLang = i18n.language || "ar";
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  const pageTitle = useMemo(() => {
    const key = destinationLabelKey(location.pathname);
    return t(key ?? "Dashboard");
  }, [location.pathname, t]);

  // The browser tab follows the salon's configured name — a tab that still
  // said the product name was one of the places a salon's identity leaked.
  useEffect(() => {
    document.title = `${pageTitle} — ${salon.name}`;
    return () => {
      document.title = salon.name;
    };
  }, [pageTitle, salon.name]);

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
  }

  function openNewAppointment() {
    nav("/appointments?new=1");
  }

  const isAdmin = me?.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <a className="skip-link print:hidden" href="#main-content">
        {t("Skip to main content")}
      </a>

      <div className="relative lg:grid lg:min-h-screen lg:grid-cols-[320px_1fr]">
        <div id="app-sidebar" className="hidden h-screen print:hidden lg:block">
          <Sidebar />
        </div>

        <div className="relative flex min-w-0 flex-col">
          <header className="sticky top-0 z-[var(--z-header)] flex h-14 items-center justify-between gap-2 border-b border-border bg-card/85 px-3 shadow-sm backdrop-blur-3xl sm:h-16 sm:px-6 lg:h-20 lg:px-10 print:hidden">
            <span id="current-page-title" className="sr-only">{pageTitle}</span>

            {/* Mobile header: the CURRENT section leads (the page title is
                what changes as the salon works), with the salon's business
                identity beside it — logo plus the name as a secondary line.
                A static name-only header hid where the user was. */}
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              {salon.logoUrl ? (
                <SalonLogo logoUrl={salon.logoUrl} salonName={salon.name} size="sm" />
              ) : (
                <img src="/lena-mark.svg" alt="" aria-hidden="true" className="h-9 w-9 shrink-0" />
              )}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[15px] font-extrabold tracking-tight text-foreground">{pageTitle}</p>
                <p className="truncate text-[11px] font-bold text-muted-foreground">{salon.name}</p>
              </div>
            </div>

            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-inner">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h2 className="truncate text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                {pageTitle}
              </h2>
            </div>

            <div className="ms-auto flex items-center gap-1 sm:gap-2">
              <div className="hidden items-center gap-2 lg:flex">
                <EnvironmentBadge compact />
                <CenterSwitcher />
                <GlobalSearch userRole={me?.role} />
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary lg:hidden"
                aria-label={t("Change Theme")}
                aria-pressed={isDark}
                title={t("Change Theme")}
              >
                {isDark ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
              </button>

              <div className="relative">
                <button
                  ref={userButtonRef}
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary shadow-inner transition hover:scale-105 active:scale-95 lg:text-sm"
                  aria-label={t("User menu")}
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                  aria-controls="user-menu"
                >
                  {getInitials(me, "·")}
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      id="user-menu"
                      ref={userMenuRef}
                      role="group"
                      aria-label={t("User menu")}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute end-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
                    >
                      <div className="border-b border-border p-3">
                        <p className="text-xs font-bold text-foreground">{getDisplayName(me, t("Unnamed"))}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {me?.role === "ADMIN" ? t("Administrator") : me?.role === "MANAGER" ? t("Manager") : me?.role === "STAFF" ? t("Staff Member") : ""}
                        </p>
                      </div>
                      {/* The language switch left the mobile header: it now
                          lives here, labelled with the language it switches
                          TO (same place as Settings/Logout). */}
                      <button
                        type="button"
                        onClick={() => { setShowUserMenu(false); toggleLanguage(); }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-foreground transition hover:bg-muted/50"
                      >
                        <Globe className="h-4 w-4" />
                        {i18n.language === "ar" ? "English" : "العربية"}
                      </button>
                      {me?.role === "ADMIN" && (
                        <button
                          type="button"
                          onClick={() => { setShowUserMenu(false); nav("/settings"); }}
                          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-foreground transition hover:bg-muted/50"
                        >
                          <Settings className="h-4 w-4" />
                          {t("Settings")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setShowUserMenu(false); void logout(); }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10"
                      >
                        <LogOut className="h-4 w-4" />
                        {t("Logout")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            aria-labelledby="current-page-title"
            className="relative z-10 min-w-0 flex-1 p-3 sm:p-6 lg:p-10"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              >
                <ErrorBoundary resetKey={location.pathname}>
                  <Outlet />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <MobileNavigationSheet open={showMobileMenu} onClose={() => setShowMobileMenu(false)} />

      <MobileActionDock
        userRole={me?.role}
        isKeyboardOpen={isKeyboardOpen}
        menuOpen={showMobileMenu}
        menuButtonRef={mobileMenuButtonRef}
        onOpenMenu={() => setShowMobileMenu(true)}
        onNewAppointment={openNewAppointment}
        showAssistant={isAdmin}
        assistantOpen={showAssistant}
        onToggleAssistant={() => setShowAssistant((open) => !open)}
      />

      {isAdmin ? (
        <button
          type="button"
          onClick={() => setShowAssistant((open) => !open)}
          aria-label={t("Admin assistant")}
          title={t("Admin assistant")}
          aria-haspopup="dialog"
          aria-expanded={showAssistant}
          aria-controls="admin-assistant-panel"
          className="pointer-events-auto fixed bottom-6 end-6 z-[var(--z-bottom-nav)] hidden h-11 w-11 place-items-center rounded-full border border-border bg-card text-primary shadow-lg print:hidden lg:grid"
        >
          <MessageCircle aria-hidden="true" className="h-5 w-5" />
        </button>
      ) : null}

      {isAdmin ? <AdminAssistantPanel open={showAssistant} onClose={() => setShowAssistant(false)} /> : null}
    </div>
  );
}
