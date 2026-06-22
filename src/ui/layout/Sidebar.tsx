import React from "react";
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  Users,
  UserCog,
  Boxes,
  Scissors,
  X,
  Settings,
  FileBarChart,
  Moon,
  Sun,
  Globe,
  LogOut,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Star
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../../auth";
import { AppContext } from "../../context/AppContext";
import { motion, AnimatePresence } from "motion/react";

type NavItem = {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  { to: "/", labelKey: "Home", Icon: LayoutDashboard },
  { to: "/pos", labelKey: "Sales & Invoices", Icon: Receipt },
  { to: "/services", labelKey: "Services", Icon: Scissors },
  { to: "/appointments", labelKey: "Appointments", Icon: CalendarDays },
  { to: "/customers", labelKey: "Customers", Icon: Users },
  { to: "/employees", labelKey: "Employees", Icon: UserCog, adminOnly: true },
  { to: "/inventory", labelKey: "Inventory", Icon: Boxes },
  { to: "/expenses", labelKey: "Expenses", Icon: Receipt, adminOnly: true },
  { to: "/reports", labelKey: "Reports", Icon: FileBarChart, adminOnly: true },
  { to: "/settings", labelKey: "Settings", Icon: Settings, adminOnly: true },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("lenabeauty_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("lenabeauty_theme", "light");
    }
  }

  function toggleLanguage() {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLang);
    localStorage.setItem("lenabeauty_lang", nextLang);
    document.documentElement.lang = nextLang;
    document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
  }

  return (
    <aside className="flex h-full flex-col border-e border-border bg-card/40 backdrop-blur-3xl relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 inset-x-0 w-full h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      <div className="flex h-20 sm:h-24 flex-col justify-center border-b border-border px-4 sm:px-8 relative z-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg sm:text-2xl shadow-xl shadow-primary/30 flex-shrink-0"
          >
            K
          </motion.div>
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-xl font-bold tracking-tighter text-foreground leading-none">Kanzy Spa</span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-primary font-bold mt-1">{t("Premium Center")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 relative z-10 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm group active:scale-95"
            title={t("Change Language")}
          >
            <Globe className="h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-12 transition-transform" />
          </button>
          <button
            onClick={toggleTheme}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm group active:scale-95"
            title={t("Change Theme")}
          >
            {isDark ? <Sun className="h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-90 transition-transform" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5 group-hover:-rotate-12 transition-transform" />}
          </button>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:hidden transition-all active:scale-95 ml-auto"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 scrollbar-hide relative z-10">
        <ul className="space-y-1.5 sm:space-y-2">
          {nav.map(({ to, labelKey, Icon, adminOnly }, idx) => {
            if (adminOnly && me?.role !== "ADMIN") return null;
            return (
              <motion.li 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                key={to}
              >
                <NavLink
                  to={to}
                  end={to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      "group flex items-center justify-between rounded-lg sm:rounded-2xl px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-bold transition-all duration-300 border border-transparent min-h-[44px]",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/30 border-primary/20 scale-[1.02]" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border"
                    )
                  }
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <Icon className={clsx("h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 flex-shrink-0")} />
                    <span className="truncate tracking-tight">{t(labelKey)}</span>
                  </div>
                  <ChevronRight className={clsx(
                    "h-4 w-4 opacity-0 transition-all group-hover:opacity-30 flex-shrink-0",
                    i18n.language === "ar" 
                      ? "rotate-180 translate-x-2 group-hover:translate-x-0" 
                      : "-translate-x-2 group-hover:translate-x-0"
                  )} />
                </NavLink>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-border p-4 sm:p-8 relative z-10 bg-card/50 space-y-4">
        <div className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-[1.5rem] bg-muted/30 p-3 sm:p-4 border border-border/50 shadow-inner group hover:bg-muted/50 transition-all">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-base sm:text-lg shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
            {me?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-bold truncate text-foreground leading-none">{me?.username}</span>
            {!!me?.role && (
              <span className="text-[9px] sm:text-[10px] text-primary uppercase font-bold tracking-widest mt-1 sm:mt-1.5 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 flex-shrink-0" />
                {me.role === "ADMIN" ? t("Admin") : me.role === "STAFF" ? t("Staff") : ""}
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl py-2.5 sm:py-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all border border-transparent hover:border-destructive/10 min-h-[44px]"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {t("Sign Out")}
        </button>

        <div className="hidden sm:flex items-center justify-center gap-4 opacity-20 mt-6">
          <Star className="h-3 w-3" />
          <div className="h-px w-8 bg-muted-foreground" />
          <span className="text-[8px] font-bold uppercase tracking-[0.3em]">v1.2.0</span>
          <div className="h-px w-8 bg-muted-foreground" />
          <Zap className="h-3 w-3" />
        </div>
      </div>
    </aside>
  );
}
