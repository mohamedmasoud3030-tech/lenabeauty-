import { Outlet, useLocation, NavLink, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../auth";
import { Menu, Bell, ChevronRight, LayoutGrid, Sparkles, Zap, Star, LayoutDashboard, CalendarDays, Receipt, Users, Settings, LogOut } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { GlobalSearch } from "../../shared/components/GlobalSearch";

export default function Layout() {
  const nav = useNavigate();
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

  // Dynamically sync language and direction on document element
  useEffect(() => {
    const currentLang = i18n.language || 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setShowSidebar(false);
  }, [location.pathname]);

  const pageTitle = useMemo(() => {
    const path = location.pathname.substring(1);
    if (!path) return t("Dashboard");
    return t(path.charAt(0).toUpperCase() + path.slice(1));
  }, [location.pathname, t]);

  const isRtl = i18n.language === "ar";

  const bottomNavItems = [
    { to: "/", labelKey: "Home", Icon: LayoutDashboard },
    { to: "/appointments", labelKey: "Appointments", Icon: CalendarDays },
    { to: "/pos", labelKey: "POS", Icon: Receipt },
    { to: "/customers", labelKey: "Customers", Icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground pb-[80px] lg:pb-0">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[320px_1fr] relative">
        
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setShowSidebar(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar Container */}
        <div className={clsx(
          "fixed inset-y-0 z-50 w-[80%] max-w-[320px] transform transition-all duration-300 ease-[0.23,1,0.32,1] lg:static lg:translate-x-0 shadow-2xl lg:shadow-none print:hidden start-0",
          showSidebar 
            ? "translate-x-0" 
            : (isRtl ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0")
        )}>
          <Sidebar onClose={() => setShowSidebar(false)} />
        </div>

        <div className="flex min-w-0 flex-col relative">
          {/* Immersive Background Elements */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden print:hidden">
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
          </div>

          {/* Header */}
          <header className="sticky top-0 z-30 flex h-14 sm:h-16 lg:h-20 items-center justify-between border-b border-border bg-card/60 px-3 sm:px-6 lg:px-10 backdrop-blur-3xl shadow-sm print:hidden gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setShowSidebar(true)}
                className="lg:hidden h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
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
              <GlobalSearch />

              <button className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm relative group active:scale-95" title={t("Notifications")}>
                <Bell className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-primary border-2 border-card shadow-sm" />
              </button>
              
              <div className="hidden sm:block h-8 w-px bg-border" />
              
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="hidden sm:flex h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-primary/10 border border-primary/20 items-center justify-center text-primary font-bold text-sm shadow-inner hover:scale-105 transition-transform active:scale-95"
                >
                  {me?.username?.[0]?.toUpperCase()}
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
                        <p className="text-xs font-bold text-foreground">{me?.username}</p>
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
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer - Desktop Only */}
          <footer className="h-auto py-4 sm:py-6 border-t border-border/50 hidden sm:flex flex-col sm:flex-row items-center justify-between gap-3 px-6 sm:px-10 bg-card/20 backdrop-blur-sm print:hidden">
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1.5 font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                <Zap className="h-3 w-3" />
                {t("System Online")}
              </div>
              <div className="flex items-center gap-1.5 font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                <Star className="h-3 w-3" />
                {t("Premium Build")}
              </div>
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-30">
              &copy; {new Date().getFullYear()} LenaBeauty &bull; {t("All Rights Reserved")}
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Improved */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-3xl border-t border-border shadow-[0_-8px_30px_rgb(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] print:hidden">
        <nav className="flex items-stretch justify-around h-[80px] px-1">
          {bottomNavItems.map(({ to, labelKey, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-200 min-h-[44px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    "flex items-center justify-center h-10 w-16 rounded-lg transition-all duration-300",
                    isActive ? "bg-primary/15 scale-110" : "bg-transparent scale-100"
                  )}>
                    <Icon className={clsx("h-6 w-6", isActive && "fill-primary/20 stroke-[2px]")} />
                  </div>
                  <span className={clsx(
                    "text-[9px] font-bold tracking-wider leading-tight",
                    isActive && "text-primary"
                  )}>
                    {t(labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <button 
            onClick={() => setShowSidebar(true)}
            className="flex flex-col items-center justify-center flex-1 gap-1 text-muted-foreground hover:text-foreground transition-all duration-200 min-h-[44px]"
          >
            <div className="flex items-center justify-center h-10 w-16 rounded-lg bg-transparent hover:bg-muted/30 transition-all">
              <Menu className="h-6 w-6" />
            </div>
            <span className="text-[9px] font-bold tracking-wider leading-tight">{t("Menu")}</span>
          </button>
        </nav>
      </div>

    </div>
  );
}
