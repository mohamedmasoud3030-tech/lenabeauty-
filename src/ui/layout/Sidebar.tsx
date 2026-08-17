import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
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
  Gift,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../../auth";
import { motion } from "motion/react";
import { SalonLogo } from "../../shared/components/LazyImage";
import { persistLanguage, persistTheme } from "../../preferences";
import { useCases } from "../../app/composition/useCases";

type NavItem = {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

type NavGroup = {
  titleKey: string;
  items: NavItem[];
};

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { me, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [optionalModules, setOptionalModules] = useState({ giftCards: false, packages: false });

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const stored = localStorage.getItem("lenabeauty_logo");
    if (stored) setLogoUrl(stored);

    let active = true;
    void Promise.all([
      useCases.giftCards.list().catch(() => ({ ok: false as const })),
      useCases.servicePackages.list().catch(() => ({ ok: false as const })),
    ]).then(([giftCards, packages]) => {
      if (!active) return;
      setOptionalModules({
        giftCards: giftCards.ok && Array.isArray(giftCards.data) && giftCards.data.length > 0,
        packages: packages.ok && Array.isArray(packages.data) && packages.data.length > 0,
      });
    });

    return () => { active = false; };
  }, []);

  const navGroups = useMemo<NavGroup[]>(() => {
    const businessItems: NavItem[] = [
      { to: "/customers", labelKey: "Customers", Icon: Users },
      ...(optionalModules.giftCards ? [{ to: "/gift-cards", labelKey: "Gift Cards", Icon: Gift }] : []),
      { to: "/services", labelKey: "Services", Icon: Scissors },
      ...(optionalModules.packages ? [{ to: "/packages", labelKey: "Packages", Icon: Boxes }] : []),
      { to: "/inventory", labelKey: "Inventory", Icon: Boxes },
      { to: "/employees", labelKey: "Employees", Icon: UserCog, adminOnly: true },
    ];

    return [
      {
        titleKey: "Daily Operations",
        items: [
          { to: "/dashboard", labelKey: "Dashboard", Icon: LayoutDashboard },
          { to: "/appointments", labelKey: "Appointments", Icon: CalendarDays },
          { to: "/pos", labelKey: "POS", Icon: Receipt },
        ],
      },
      { titleKey: "Business", items: businessItems },
      {
        titleKey: "Management",
        items: [
          { to: "/reports", labelKey: "Reports", Icon: FileBarChart, adminOnly: true },
          { to: "/expenses", labelKey: "Expenses", Icon: Receipt, adminOnly: true },
          { to: "/attendance", labelKey: "Attendance", Icon: CalendarDays, adminOnly: true },
          { to: "/advances", labelKey: "Advances", Icon: Receipt, adminOnly: true },
          { to: "/payroll", labelKey: "Payroll", Icon: FileBarChart, adminOnly: true },
          { to: "/staff-analytics", labelKey: "Staff Analytics", Icon: UserCog, adminOnly: true },
          { to: "/settings", labelKey: "Settings", Icon: Settings, adminOnly: true },
        ],
      },
    ];
  }, [optionalModules]);

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

  return (
    <aside className="flex h-full flex-col border-e border-border bg-card/95 backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none" />

      <div className="flex h-20 flex-col justify-center border-b border-border px-4 sm:px-6 relative z-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <SalonLogo logoUrl={logoUrl} salonName="LenaBeauty" size="md" />
          ) : (
            <div className="h-10 w-10 flex-shrink-0">
              <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-foreground leading-none">LenaBeauty</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mt-1">
              {t("Salon operations")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 sm:px-6 py-3 relative z-10 gap-2">
        <div className="flex items-center gap-2">
          <button onClick={toggleLanguage} className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-primary" aria-label={t("Change Language")} title={t("Change Language")}>
            <Globe aria-hidden="true" className="h-4 w-4" />
          </button>
          <button onClick={toggleTheme} className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-primary" aria-label={t("Change Theme")} aria-pressed={isDark} title={t("Change Theme")}>
            {isDark ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
        {onClose && (
          <button onClick={onClose} className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive lg:hidden ms-auto" aria-label={t("Close")}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav aria-label={t("Primary navigation")} className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 scrollbar-hide relative z-10">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.adminOnly || me?.role === "ADMIN");
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.titleKey} className="mb-4">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                {t(group.titleKey)}
              </div>
              <ul className="space-y-1">
                {visibleItems.map(({ to, labelKey, Icon }, idx) => (
                  <motion.li initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} key={to}>
                    <NavLink
                      to={to}
                      onClick={onClose}
                      className={({ isActive }) => clsx(
                        "group flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                        isActive
                          ? "border-primary/20 bg-primary text-primary-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">{t(labelKey)}</span>
                      </div>
                      <ChevronRight className={clsx("h-4 w-4 opacity-40", i18n.language === "ar" && "rotate-180")} />
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 relative z-10 bg-card/60">
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            {me?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-foreground">{me?.username}</div>
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-success font-bold mt-0.5">
              <ShieldCheck className="h-3 w-3" />
              {me?.role}
            </div>
          </div>
        </div>
        <button onClick={() => void logout()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground">
          <LogOut className="h-4 w-4" />
          {t("Logout")}
        </button>
      </div>
    </aside>
  );
}
