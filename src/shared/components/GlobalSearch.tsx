import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight, Command, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";

interface SearchResult {
  id: string;
  title: string;
  category: string;
  path: string;
  icon: React.ReactNode;
}

export function GlobalSearch() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allPages: SearchResult[] = [
    { id: "dashboard", title: t("Dashboard"), category: t("Navigation"), path: "/", icon: "📊" },
    { id: "pos", title: t("Sales & Invoices"), category: t("Navigation"), path: "/pos", icon: "🛒" },
    { id: "services", title: t("Services"), category: t("Navigation"), path: "/services", icon: "✂️" },
    { id: "appointments", title: t("Appointments"), category: t("Navigation"), path: "/appointments", icon: "📅" },
    { id: "customers", title: t("Customers"), category: t("Navigation"), path: "/customers", icon: "👥" },
    { id: "gift-cards", title: t("Gift Cards"), category: t("Navigation"), path: "/gift-cards", icon: "🎁" },
    { id: "packages", title: t("Packages"), category: t("Navigation"), path: "/packages", icon: "📦" },
    { id: "employees", title: t("Employees"), category: t("Navigation"), path: "/employees", icon: "👔" },
    { id: "inventory", title: t("Inventory"), category: t("Navigation"), path: "/inventory", icon: "📦" },
    { id: "expenses", title: t("Expenses"), category: t("Navigation"), path: "/expenses", icon: "💰" },
    { id: "reports", title: t("Reports"), category: t("Navigation"), path: "/reports", icon: "📈" },
    { id: "settings", title: t("Settings"), category: t("Navigation"), path: "/settings", icon: "⚙️" },
    { id: "notifications", title: t("Notifications"), category: t("Navigation"), path: "/notifications", icon: "🔔" },
    { id: "payment-gateway", title: t("Payment Gateway"), category: t("Navigation"), path: "/payment-gateway", icon: "💳" },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Escape to close
      if (e.key === "Escape") {
        setIsOpen(false);
      }
      // Arrow keys to navigate
      if (isOpen && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) {
            navigate(selected.path);
            setIsOpen(false);
            setQuery("");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate]);

  // Filter results based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const filtered = allPages.filter((page) =>
      page.title.toLowerCase().includes(query.toLowerCase()) ||
      page.category.toLowerCase().includes(query.toLowerCase())
    );

    setResults(filtered);
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Search Trigger Button - Hidden on mobile, shown on desktop */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        aria-label={t("Search")}
        className="flex items-center justify-center md:justify-start gap-2 h-10 w-10 md:h-auto md:w-auto bg-muted/30 md:px-3 md:py-2 rounded-lg border border-border shadow-inner group hover:bg-muted/50 transition-all"
      >
        <Search className="h-5 w-5 md:h-4 md:w-4 text-muted-foreground group-hover:text-primary" />
        <span className="hidden md:inline text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          {t("Search")}...
        </span>
        <kbd className="hidden lg:inline-flex items-center gap-1 ml-auto px-2 py-1 rounded bg-muted text-[10px] font-bold text-muted-foreground">
          <Command className="h-3 w-3" />
          K
        </kbd>
      </button>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Search Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 sm:top-1/2 left-1/2 -translate-x-1/2 sm:-translate-y-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-2xl px-0"
            >
              <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-4">
                  <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={t("Search pages, actions...")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-lg font-bold text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                  {results.length === 0 && query ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      <Search className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-bold text-muted-foreground">
                        {t("No results found")} "{query}"
                      </p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="p-6 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        {t("Quick Navigation")}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {allPages.slice(0, 6).map((page, idx) => (
                          <button
                            key={page.id}
                            onClick={() => handleSelect(page.path)}
                            className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors text-start group"
                          >
                            <span className="text-lg">{page.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                {page.title}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2">
                      {results.map((result, idx) => (
                        <motion.button
                          key={result.id}
                          onClick={() => handleSelect(result.path)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={clsx(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-start",
                            selectedIndex === idx
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          )}
                        >
                          <span className="text-lg">{result.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{result.title}</p>
                            <p className="text-[10px] text-muted-foreground opacity-60 truncate">
                              {result.category}
                            </p>
                          </div>
                          {selectedIndex === idx && (
                            <ArrowRight className={clsx(
                              "h-4 w-4 flex-shrink-0 transition-transform",
                              i18n.language === "ar" && "rotate-180"
                            )} />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-border px-4 py-3 flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-muted text-[9px]">↑↓</kbd>
                    <span>{t("Navigate")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-muted text-[9px]">Enter</kbd>
                    <span>{t("Select")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-muted text-[9px]">Esc</kbd>
                    <span>{t("Close")}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
