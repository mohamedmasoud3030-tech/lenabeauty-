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
  ShieldCheck,
  Zap,
  Star,
  Clock,
  Wallet,
  BarChart3,
  Palette,
  Bell,
  CreditCard,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../../auth";
import { motion, AnimatePresence } from "motion/react";
import { SalonLogo } from "../../shared/components/LazyImage";
import { persistLanguage, persistTheme } from "../../preferences";

type NavItem = {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

type NavGroup = {
  titleKey: string;
  items: NavItem[];
  collapsible?: boolean;
};

const navGroups: NavGroup[] = [
  {
    titleKey: "Main",
    items: [
      { to: "/dashboard", labelKey: "Dashboard", Icon: LayoutDashboard },
      { to: "/pos", labelKey: "Sales & Invoices", Icon: Receipt },
      { to: "/appointments", labelKey: "Appointments", Icon: CalendarDays },
      { to: "/customers", labelKey: "Customers", Icon: Users },
    ],
  },
  {
    titleKey: "Operations",
    items: [
      { to: "/services", labelKey: "Services", Icon: Scissors },
      { to: "/inventory", labelKey: "Inventory", Icon: Boxes },
      { to: "/expenses", labelKey: "Expenses", Icon: CreditCard, adminOnly: true },
    ],
  },
  {
    titleKey: "Staff",
    collapsible: true,
    items: [
      { to: "/employees", labelKey: "Employees", Icon: UserCog, adminOnly: true },
      { to: "/attendance", labelKey: "Attendance", Icon: Clock, adminOnly: true },
      { to: "/advances", labelKey: "Advances", Icon: Wallet, adminOnly: true },
      { to: "/payroll", labelKey: "Payroll", Icon: CreditCard, adminOnly: true },
      { to: "/staff-analytics", labelKey: "Staff Analytics", Icon: BarChart3, adminOnly: true },
    ],
  },
  {
    titleKey: "Reports & Settings",
    collapsible: true,
    items: [
      { to: "/reports", labelKey: "Reports", Icon: FileBarChart, adminOnly: true },
      { to: "/branding", labelKey: "Branding", Icon: Palette, adminOnly: true },
      { to: "/notifications", labelKey: "Notifications", Icon: Bell, adminOnly: true },
      { to: "/settings", labelKey: "Settings", Icon: Settings, adminOnly: true },
    ],
  },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    // Load salon logo from localStorage (set by BrandingSettingsPage)
    const stored = localStorage.getItem("lenabeauty_logo");
    if (stored) setLogoUrl(stored);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      persistTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      persistTheme("light");
    }
  }

  function toggleLanguage() {
    const nextLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(nextLang);
    persistLanguage(nextLang);
    document.documentElement.lang = nextLang;
    document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
  }

  function toggleGroup(titleKey: string) {
    setCollapsedGroups((prev) => ({ ...prev, [titleKey]: !prev[titleKey] }));
  }

  return (
    <aside className="flex h-full flex-col border-e border-border bg-card/40 backdrop-blur-3xl relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 inset-x-0 w-full h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Header - LenaBeauty Branding */}
      <div className="flex h-20 sm:h-24 flex-col justify-center border-b border-border px-4 sm:px-6 relative z-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <SalonLogo logoUrl={logoUrl} salonName="LenaBeauty" size="md" />
          ) : (
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-xl shadow-pink-500/30 flex-shrink-0"
            >
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
            </motion.div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-none">
              LenaBeauty
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-primary font-bold mt-1">
              {t("Premium Center")}
            </span>
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 relative z-10 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm group active:scale-95"
            title={t("Change Language")}
          >
            <Globe className="h-4 w-4 group-hover:rotate-12 transition-transform" />
          </button>
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm group active:scale-95"
            title={t("Change Theme")}
          >
            {isDark ? (
              <Sun className="h-4 w-4 group-hover:rotate-90 transition-transform" />
            ) : (
              <Moon className="h-4 w-4 group-hover:-rotate-12 transition-transform" />
            )}
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:hidden transition-all active:scale-95 ms-auto"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 scrollbar-hide relative z-10">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || me?.role === "ADMIN"
          );
          if (visibleItems.length === 0) return null;
          const isCollapsed = collapsedGroups[group.titleKey];

          return (
            <div key={group.titleKey} className="mb-3">
              {/* Group Header */}
              <button
                onClick={() => group.collapsible && toggleGroup(group.titleKey)}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-1.5 mb-1",
                  group.collapsible && "cursor-pointer hover:text-foreground",
                  "text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
                )}
              >
                <span>{t(group.titleKey)}</span>
                {group.collapsible && (
                  <ChevronDown
                    className={clsx(
                      "h-3 w-3 transition-transform duration-200",
                      isCollapsed ? "-rotate-90" : "rotate-0"
                    )}
                  />
                )}
              </button>

              {/* Group Items */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-1"
                  >
                    {visibleItems.map(({ to, labelKey, Icon }, idx) => (
                      <motion.li
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        key={to}
                      >
                        <NavLink
                          to={to}
                          onClick={onClose}
                          className={({ isActive }) =>
                            clsx(
                              "group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 border border-transparent min-h-[44px]",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 border-primary/20"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border/50"
                            )
                          }
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                            <span className="truncate">{t(labelKey)}</span>
                          </div>
                          <ChevronRight
                            className={clsx(
                              "h-3 w-3 opacity-0 transition-all group-hover:opacity-40 flex-shrink-0",
                              i18n.language === "ar"
                                ? "rotate-180"
                                : ""
                            )}
                          />
                        </NavLink>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-border p-4 sm:p-5 relative z-10 bg-card/50 space-y-3">
        {/* User Info */}
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 border border-border/50 group hover:bg-muted/50 transition-all">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-bold text-sm shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
            {me?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate text-foreground leading-none">
              {me?.username}
            </span>
            {!!me?.role && (
              <span className="text-[9px] text-primary uppercase font-bold tracking-widest mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 flex-shrink-0" />
                {me.role === "ADMIN" ? t("Admin") : t("Staff")}
              </span>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all border border-transparent hover:border-destructive/10 min-h-[44px]"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {t("Sign Out")}
        </button>

        {/* Version */}
        <div className="hidden sm:flex items-center justify-center gap-3 opacity-20">
          <Star className="h-2.5 w-2.5" />
          <div className="h-px w-6 bg-muted-foreground" />
          <span className="text-[8px] font-bold uppercase tracking-[0.3em]">v2.0.0</span>
          <div className="h-px w-6 bg-muted-foreground" />
          <Zap className="h-2.5 w-2.5" />
        </div>
      </div>
    </aside>
  );
}
