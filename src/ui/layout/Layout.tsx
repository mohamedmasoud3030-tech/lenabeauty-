import { Outlet, useLocation, NavLink, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../auth";
import { Menu, Bell, ChevronRight, LayoutGrid, LayoutDashboard, CalendarDays, Receipt, Users, Settings, LogOut, MoreHorizontal, Scissors, Package, Gift, BarChart3, Settings2, DollarSign } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { GlobalSearch } from "../../shared/components/GlobalSearch";
import { ErrorBoundary } from "../../shared/components/ErrorBoundary";
import { getDisplayName, getInitials } from "../../shared/displayName";
import CenterSwitcher from "./CenterSwitcher";
import { useKeyboardInset, useScrollFieldIntoView } from "../../shared/hooks/useKeyboardInset";

export default function Layout() {
  const nav = useNavigate();
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { isOpen: isKeyboardOpen } = useKeyboardInset();
  useScrollFieldIntoView();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close more menu on click/tap outside (touch-first: mousedown alone misses taps).
  useEffect(() => {
    const handlePointerOutside = (e: Event) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (moreMenuRef.current?.contains(target) || moreButtonRef.current?.contains(target)) return;
      setShowMoreMenu(false);
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handlePointerOutside);
      document.addEventListener("touchstart", handlePointerOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handlePointerOutside);
      document.removeEventListener("touchstart", handlePointerOutside);
    };
  }, [showMoreMenu]);

  useEffect(() => {
    if (isKeyboardOpen) setShowMoreMenu(false);
  }, [isKeyboardOpen]);

  // Dynamically sync language and direction on document element
  useEffect(() => {
    const currentLang = i18n.language || 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setShowSidebar(false);
    setShowMoreMenu(false);
  }, [location.pathname]);

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    const map: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/pos": "POS",
      "/appointments": "Appointments",
      "/customers": "Customers",
      "/gift-cards": "Gift Cards",
      "/customer-experience": "Customer Experience",
      "/services": "Services",
      "/inventory": "Inventory",
      "/packages": "Packages",
      "/employees": "Employees",
      "/attendance": "Attendance",
      "/advances": "Advances",
      "/payroll": "Payroll",
      "/staff-analytics": "Staff Analytics",
      "/reports": "Reports",
      "/expenses": "Expenses",
      "/branding": "Branding",
      "/settings": "Settings",
      "/notifications": "Notifications",
      "/payment-gateway": "Payment Gateway",
      "/accounting": "Accounting",
      "/advanced-automation": "Advanced Automation",
    };
    const key = map[path];
    return key ? t(key) : t("Dashboard");
  }, [location.pathname, t]);

  const isRtl = i18n.language === "ar";

  // Mobile bottom navigation - 5 key daily functions
  const bottomNavItems = [
    { to: "/dashboard", labelKey: "Home", Icon: LayoutDashboard },
    { to: "/appointments", labelKey: "Appointments", Icon: CalendarDays },
    { to: "/pos", labelKey: "POS", Icon: Receipt },
    { to: "/customers", labelKey: "Customers", Icon: Users },
    { labelKey: "More", Icon: MoreHorizontal, action: () => setShowMoreMenu(!showMoreMenu) },
  ];

  // More menu items
  const moreMenuItems = [
    { to: "/services", labelKey: "Services", Icon: Scissors },
    { to: "/inventory", labelKey: "Inventory", Icon: Package },
    { to: "/gift-cards", labelKey: "Gift Cards", Icon: Gift },
    { to: "/reports", labelKey: "Reports", Icon: BarChart3 },
    { to: "/employees", labelKey: "Employees", Icon: Users },
    { to: "/settings", labelKey: "Settings", Icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[320px_1fr] relative">
        
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[var(--z-bottom-nav)] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setShowSidebar(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar Container */}
        <div className={clsx(
          "fixed inset-y-0 z-[var(--z-sidebar)] w-[80%] max-w-[320px] transform transition-all duration-300 ease-[0.23,1,0.32,1] lg:static lg:translate-x-0 shadow-2xl lg:shadow-none print:hidden start-0",
          showSidebar
            ? "translate-x-0"
            : (isRtl ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0")
        )}>
          <Sidebar onClose={() => setShowSidebar(false)} />
        </div>

        <div className="flex min-w-0 flex-col relative">
          {/* Header */}
          <header className="sticky top-0 z-[var(--z-header)] flex h-14 sm:h-16 lg:h-20 items-center justify-between border-b border-border bg-card/60 px-3 sm:px-6 lg:px-10 backdrop-blur-3xl shadow-sm print:hidden gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setShowSidebar(true)}
                aria-label={t("Open menu")}
                className="lg:hidden h-11 w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-inner flex-shrink-0">
                  <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground leading-tight truncate">
                    {pageTitle}
                  </h2>
                </div>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-3 ml-auto">
              <CenterSwitcher />
              <GlobalSearch />

              <button onClick={() => nav("/settings?tab=notifications")} className="h-11 w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm relative group active:scale-95" title={t("Notifications")}>
                <Bell className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-primary border-2 border-card shadow-sm" />
              </button>
              
              <div className="hidden sm:block h-8 w-px bg-border" />
              
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="hidden sm:flex h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-primary/10 border border-primary/20 items-center justify-center text-primary font-bold text-sm shadow-inner hover:scale-105 transition-transform active:scale-95"
                >
                  {getInitials(me, "·")}
                </button>
                
                {/* User Menu Dropdown */}
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full mt-2 end-0 w-48 rounded-lg bg-card border border-border shadow-xl z-50"
                    >
                      <div className="p-3 border-b border-border">
                        <p className="text-xs font-bold text-foreground">{getDisplayName(me, t("Unnamed"))}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
                          {me?.role === "ADMIN" ? t("Administrator") : me?.role === "STAFF" ? t("Staff Member") : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => { setShowUserMenu(false); nav("/settings"); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-foreground hover:bg-muted/50 transition-all"
                      >
                        <Settings className="h-4 w-4" />
                        {t("Settings")}
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-500/10 transition-all"
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

          {/* Main Content */}
          <main className="min-w-0 flex-1 p-3 sm:p-6 lg:p-10 relative z-10">
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

      {/* Mobile Bottom Navigation — hidden while the keyboard is open so it never covers fields */}
      <div
        className={clsx(
          "lg:hidden fixed bottom-0 inset-x-0 z-[var(--z-bottom-nav)] bg-card/95 backdrop-blur-3xl border-t border-border shadow-[0_-4px_20px_rgb(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] print:hidden safe-area-bottom transition-transform duration-200",
          isKeyboardOpen && "translate-y-full pointer-events-none",
        )}
        aria-hidden={isKeyboardOpen}
      >
        <nav className="flex items-stretch justify-around h-[64px] px-1">
          {bottomNavItems.map(({ to, labelKey, Icon, action }) => (
            action ? (
              <button
                key="more"
                type="button"
                onClick={action}
                ref={moreButtonRef}
                className={clsx(
                  "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 touch-target relative",
                  showMoreMenu ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={clsx(
                  "flex items-center justify-center h-9 w-14 rounded-xl transition-all duration-300",
                  showMoreMenu ? "bg-primary/15" : "bg-transparent"
                )}>
                  <Icon className={clsx("h-5 w-5", showMoreMenu && "stroke-[2.5]")} />
                </div>
                <span className={clsx(
                  "text-[10px] font-bold tracking-wide leading-tight",
                  showMoreMenu && "text-primary"
                )}>
                  {t(labelKey)}
                </span>
              </button>
            ) : (
              <NavLink
                key={to}
                to={to!}
                end={to === "/dashboard"}
                className={({ isActive }) =>
                  clsx(
                    "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 touch-target",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={clsx(
                      "flex items-center justify-center h-9 w-14 rounded-xl transition-all duration-300",
                      isActive ? "bg-primary/15 scale-105" : "bg-transparent scale-100"
                    )}>
                      <Icon className={clsx("h-5 w-5", isActive && "stroke-[2.5]")} />
                    </div>
                    <span className={clsx(
                      "text-[10px] font-bold tracking-wide leading-tight",
                      isActive && "text-primary"
                    )}>
                      {t(labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            )
          ))}
        </nav>

        {/* More Menu Dropup */}
        <AnimatePresence>
          {showMoreMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black/40"
                onClick={() => setShowMoreMenu(false)}
              />
              <motion.div
                ref={moreMenuRef}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute bottom-full mb-2 inset-x-2 z-50 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-1 p-2">
                  {moreMenuItems.map(({ to, labelKey, Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        clsx(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all touch-target min-h-[72px]",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[10px] font-bold text-center leading-tight">{t(labelKey)}</span>
                    </NavLink>
                  ))}
                </div>
                <div className="border-t border-border p-2">
                  <button
                    onClick={() => { setShowSidebar(true); setShowMoreMenu(false); }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all"
                  >
                    <Menu className="h-4 w-4" />
                    {t("All Menu Items")}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
