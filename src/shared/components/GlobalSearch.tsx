import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X, ArrowRight, Command } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";

interface SearchResult {
  id: string;
  title: string;
  category: string;
  path: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function GlobalSearch({ userRole }: { userRole?: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const allPages = useMemo<SearchResult[]>(() => [
    { id: "dashboard", title: t("Dashboard"), category: t("Navigation"), path: "/dashboard", icon: "📊" },
    { id: "pos", title: t("Sales & Invoices"), category: t("Navigation"), path: "/pos", icon: "🛒" },
    { id: "services", title: t("Services"), category: t("Navigation"), path: "/services", icon: "✂️" },
    { id: "appointments", title: t("Appointments"), category: t("Navigation"), path: "/appointments", icon: "📅" },
    { id: "customers", title: t("Customers"), category: t("Navigation"), path: "/customers", icon: "👥" },
    { id: "gift-cards", title: t("Gift Cards"), category: t("Navigation"), path: "/gift-cards", icon: "🎁" },
    { id: "packages", title: t("Packages"), category: t("Navigation"), path: "/packages", icon: "📦" },
    { id: "inventory", title: t("Inventory"), category: t("Navigation"), path: "/inventory", icon: "📦" },
    { id: "employees", title: t("Employees"), category: t("Navigation"), path: "/employees", icon: "👔", adminOnly: true },
    { id: "expenses", title: t("Expenses"), category: t("Navigation"), path: "/expenses", icon: "💰", adminOnly: true },
    { id: "attendance", title: t("Attendance"), category: t("Navigation"), path: "/attendance", icon: "🕒", adminOnly: true },
    { id: "advances", title: t("Advances"), category: t("Navigation"), path: "/advances", icon: "💵", adminOnly: true },
    { id: "payroll", title: t("Payroll"), category: t("Navigation"), path: "/payroll", icon: "🧾", adminOnly: true },
    { id: "staff-analytics", title: t("Staff Analytics"), category: t("Navigation"), path: "/staff-analytics", icon: "📊", adminOnly: true },
    { id: "reports", title: t("Reports"), category: t("Navigation"), path: "/reports", icon: "📈", adminOnly: true },
    { id: "settings", title: t("Settings"), category: t("Navigation"), path: "/settings", icon: "⚙️", adminOnly: true },
    { id: "notifications", title: t("Notifications"), category: t("Navigation"), path: "/notifications", icon: "🔔", adminOnly: true },
    { id: "payment-gateway", title: t("Payment Gateway"), category: t("Navigation"), path: "/payment-gateway", icon: "💳", adminOnly: true },
    { id: "customer-experience", title: t("Customer Experience"), category: t("Navigation"), path: "/customer-experience", icon: "✨", adminOnly: true },
    { id: "forecasting", title: t("Forecasting"), category: t("Navigation"), path: "/forecasting", icon: "📉", adminOnly: true },
    { id: "accounting", title: t("Accounting"), category: t("Navigation"), path: "/accounting", icon: "📚", adminOnly: true },
    { id: "advanced-automation", title: t("Advanced Automation"), category: t("Navigation"), path: "/advanced-automation", icon: "🤖", adminOnly: true },
  ], [t]);

  const visiblePages = useMemo(
    () => allPages.filter((page) => !page.adminOnly || userRole === "ADMIN"),
    [allPages, userRole],
  );

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(i18n.language);
    if (!normalized) return [];
    return visiblePages.filter((page) =>
      page.title.toLocaleLowerCase(i18n.language).includes(normalized) ||
      page.category.toLocaleLowerCase(i18n.language).includes(normalized)
    );
  }, [i18n.language, query, visiblePages]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, visiblePages]);

  // Focus the search on open, contain keyboard focus, and return focus to the
  // element that opened it when the dialog closes.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      const target = previouslyFocused.current;
      window.setTimeout(() => target?.focus(), 0);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((open) => !open);
        return;
      }

      if (!isOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panel.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      // Result navigation belongs to the combobox only; Enter on the close
      // button or another control must keep its native meaning.
      if (document.activeElement !== inputRef.current || results.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % results.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + results.length) % results.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          navigate(selected.path);
          setQuery("");
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, navigate, results, selectedIndex]);

  const handleSelect = (path: string) => {
    navigate(path);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t("Search")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="global-search-dialog"
        className="flex items-center justify-center md:justify-start gap-2 h-11 w-11 md:h-auto md:w-auto bg-muted/30 md:px-3 md:py-2 rounded-lg border border-border shadow-inner group hover:bg-muted/50 transition-all"
      >
        <Search aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4 text-muted-foreground group-hover:text-primary" />
        <span className="hidden md:inline text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          {t("Search")}...
        </span>
        <kbd className="hidden lg:inline-flex items-center gap-1 ms-auto px-2 py-1 rounded bg-muted text-[10px] font-bold text-muted-foreground">
          <Command aria-hidden="true" className="h-3 w-3" /> K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[var(--z-overlay)] bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              id="global-search-dialog"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={t("Search")}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 sm:top-1/2 left-1/2 -translate-x-1/2 sm:-translate-y-1/2 z-[var(--z-overlay-top)] w-[calc(100vw-1.5rem)] max-w-2xl px-0"
            >
              <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Search aria-hidden="true" className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-label={t("Search pages, actions...")}
                    aria-autocomplete="list"
                    aria-expanded={results.length > 0}
                    aria-controls="global-search-results"
                    aria-activedescendant={results[selectedIndex] ? `global-search-option-${results[selectedIndex].id}` : undefined}
                    placeholder={t("Search pages, actions...")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-base sm:text-lg font-bold text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={t("Close")}
                    className="h-11 w-11 shrink-0 flex items-center justify-center hover:bg-muted rounded-lg transition-colors"
                  >
                    <X aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                <div id="global-search-results" className="max-h-[400px] overflow-y-auto scrollbar-hide">
                  {results.length === 0 && query ? (
                    <div role="status" className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
                      <Search aria-hidden="true" className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-bold text-muted-foreground">
                        {t("No results found")} “{query}”
                      </p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="p-4 sm:p-6 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                        {t("Quick Navigation")}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {visiblePages.slice(0, 6).map((page) => (
                          <button
                            type="button"
                            key={page.id}
                            onClick={() => handleSelect(page.path)}
                            className="min-h-11 flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors text-start group"
                          >
                            <span aria-hidden="true" className="text-lg">{page.icon}</span>
                            <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {page.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div role="listbox" aria-label={t("Search")} className="p-2">
                      {results.map((result, index) => (
                        <motion.button
                          type="button"
                          role="option"
                          id={`global-search-option-${result.id}`}
                          aria-selected={selectedIndex === index}
                          tabIndex={-1}
                          key={result.id}
                          onClick={() => handleSelect(result.path)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          initial={{ opacity: 0, x: i18n.language === "ar" ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={clsx(
                            "w-full min-h-11 flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-start",
                            selectedIndex === index
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          )}
                        >
                          <span aria-hidden="true" className="text-lg">{result.icon}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold truncate">{result.title}</span>
                            <span className="block text-xs text-muted-foreground truncate">{result.category}</span>
                          </span>
                          {selectedIndex === index && (
                            <ArrowRight aria-hidden="true" className={clsx(
                              "h-4 w-4 flex-shrink-0 transition-transform",
                              i18n.language === "ar" && "rotate-180"
                            )} />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                <div aria-hidden="true" className="hidden sm:flex border-t border-border px-4 py-3 items-center justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-70">
                  <div className="flex items-center gap-2"><kbd className="px-2 py-1 rounded bg-muted text-[9px]">↑↓</kbd><span>{t("Navigate")}</span></div>
                  <div className="flex items-center gap-2"><kbd className="px-2 py-1 rounded bg-muted text-[9px]">Enter</kbd><span>{t("Select")}</span></div>
                  <div className="flex items-center gap-2"><kbd className="px-2 py-1 rounded bg-muted text-[9px]">Esc</kbd><span>{t("Close")}</span></div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
