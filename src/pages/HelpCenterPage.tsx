/**
 * HelpCenterPage — self-service help and support intake.
 *
 * Task-based bilingual articles, search, category filters, deep links
 * (/?help=slug), and a safe support-ticket form that captures route,
 * version, environment, role, error reference, and expected/actual
 * behavior. Never collects secrets or private customer data.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  Search, BookOpen, LifeBuoy, ChevronRight, ChevronLeft,
  HelpCircle, AlertTriangle, Send, ShieldAlert,
} from "lucide-react";
import { clsx } from "clsx";
import {
  HELP_ARTICLES,
  HELP_CATEGORY_LABELS,
  getHelpArticle,
  searchHelpArticles,
  type HelpCategory,
} from "../shared/help/articles";
import { useAuth } from "../auth";
import { useToast } from "../shared/components/Toast";
import { useCases } from "../app/composition/useCases";
import { config } from "../config/env";

type View = "list" | "article" | "contact";

const SECRET_PATTERN = /(password|passwd|token|secret|api[_-]?key|card\s*number|pwd)/i;

export default function HelpCenterPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const nav = useNavigate();
  const { me } = useAuth();
  const lang: "ar" | "en" = i18n.language === "ar" ? "ar" : "en";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "all">("all");
  const [view, setView] = useState<View>("list");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);

  // Deep link: /?help=slug opens that article directly.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get("help");
    if (slug) {
      const article = getHelpArticle(slug);
      if (article) {
        setActiveSlug(slug);
        setView("article");
      }
    }
  }, [location.search]);

  const filtered = useMemo(() => {
    const searched = searchHelpArticles(query, lang);
    if (category === "all") return searched;
    return searched.filter((a) => a.category === category);
  }, [query, category, lang]);

  const activeArticle = activeSlug ? getHelpArticle(activeSlug) : undefined;

  function openArticle(slug: string) {
    setActiveSlug(slug);
    setView("article");
    nav(`?help=${slug}`, { replace: true });
    window.scrollTo({ top: 0 });
  }

  function backToList() {
    setView("list");
    setActiveSlug(null);
    nav(".", { replace: true });
  }

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <LifeBuoy className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("Help Center")}</h1>
          <p className="text-sm text-muted-foreground">{t("Find answers or report a problem safely")}</p>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-2">
        <button type="button"
          onClick={backToList}
          className={clsx(
            "px-4 py-2.5 rounded-xl text-sm font-bold transition-all touch-target",
            view !== "article" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {t("Articles")}
        </button>
        <button type="button"
          onClick={() => setShowContact(true)}
          className={clsx(
            "px-4 py-2.5 rounded-xl text-sm font-bold transition-all touch-target",
            showContact ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {t("Contact support")}
        </button>
      </div>

      {(() => {
        if (showContact) {
          return (
            <motion.div key="contact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <SupportIntakeForm
                role={me?.role}
                onDone={() => { setShowContact(false); setView("list"); }}
              />
            </motion.div>
          );
        }
        if (view === "article" && activeArticle) {
          return (
            <motion.div key="article" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ArticleView
                slug={activeArticle.slug}
                lang={lang}
                onBack={backToList}
                onRelated={openArticle}
              />
            </motion.div>
          );
        }
        return (
          <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {/* Search */}
            <div className="relative">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search help articles...")}
                aria-label={t("Search help articles")}
                className="w-full rounded-xl border border-border bg-card ps-10 pe-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 mt-4 scrollbar-hide" aria-label={t("Categories")}>
              <button type="button"
                onClick={() => setCategory("all")}
                className={clsx(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors min-h-[40px] touch-target",
                  category === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                {t("All")}
              </button>
              {Object.entries(HELP_CATEGORY_LABELS).map(([key, label]) => (
                <button type="button"
                  key={key}
                  onClick={() => setCategory(key as HelpCategory)}
                  className={clsx(
                    "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors min-h-[40px] touch-target",
                    category === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {label[lang]}
                </button>
              ))}
            </div>

            {/* Article list */}
            <div className="mt-4 grid gap-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t("No articles match your search.")}</p>
                </div>
              ) : (
                filtered.map((article) => (
                  <button type="button"
                    key={article.slug}
                    onClick={() => openArticle(article.slug)}
                    className="group w-full min-h-11 text-start rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md touch-target"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{article.title[lang]}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                          {HELP_CATEGORY_LABELS[article.category][lang]}
                          {article.audience === "admin" && ` · ${t("Admin only")}`}
                        </p>
                      </div>
                      <ChevronRight
                        className={clsx("h-4 w-4 text-muted-foreground shrink-0", lang === "ar" && "rotate-180")}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
}

/* ==================================================================== *
 *  ARTICLE VIEW
 * ==================================================================== */
function ArticleView({
  slug,
  lang,
  onBack,
  onRelated,
}: Readonly<{
  slug: string;
  lang: "ar" | "en";
  onBack: () => void;
  onRelated: (slug: string) => void;
}>) {
  const { t } = useTranslation();
  const article = getHelpArticle(slug);
  if (!article) return null;

  const related = HELP_ARTICLES.filter(
    (a) => a.slug !== slug && a.category === article.category,
  ).slice(0, 3);

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 sm:px-6 py-4 bg-muted/20 flex items-center gap-3">
        <button type="button"
          onClick={onBack}
          className="h-11 w-11 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-all touch-target"
          aria-label={t("Back to articles")}
        >
          <ChevronLeft className={clsx("h-4 w-4", lang === "ar" && "rotate-180")} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {HELP_CATEGORY_LABELS[article.category][lang]}
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{article.title[lang]}</h2>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-3">
        {article.body[lang].map((paragraph, paragraphIndex) => (
          <p key={`${article.slug}-${lang}-${paragraphIndex}`} className="text-sm text-foreground/90 leading-relaxed">
            {paragraph}
          </p>
        ))}

        <div className="pt-3 border-t border-border/60">
          <p className="text-xs font-bold text-muted-foreground mb-2">{t("Related articles")}</p>
          <div className="flex flex-wrap gap-2">
            {related.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("No related articles")}</p>
            ) : (
              related.map((r) => (
                <button type="button"
                  key={r.slug}
                  onClick={() => onRelated(r.slug)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-all touch-target"
                >
                  {r.title[lang]}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ==================================================================== *
 *  SUPPORT INTAKE FORM
 * ==================================================================== */
function SupportIntakeForm({ role, onDone }: Readonly<{ role?: string; onDone: () => void }>) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const location = useLocation();
  const lang: "ar" | "en" = i18n.language === "ar" ? "ar" : "en";

  const route = `${location.pathname}${location.search}`.trim() || "/dashboard";
  const [errorReference, setErrorReference] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high">("normal");
  const [sending, setSending] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const appVersion = "1.0.0"; // keep in sync with package.json (test-enforced)

  function validate(): string | null {
    if (SECRET_PATTERN.test(errorReference) || SECRET_PATTERN.test(expected) || SECRET_PATTERN.test(actual)) {
      return t("Do not include passwords, tokens, or payment details.");
    }
    if (expected.trim().length < 2 && actual.trim().length < 2) {
      return t("Describe the expected or actual behavior.");
    }
    if (expected.trim().length > 2000 || actual.trim().length > 2000) {
      return t("Keep your description under 2000 characters.");
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSending(true);
    try {
      const res = await useCases.help.createTicket({
        route,
        appVersion,
        environment: config.environment,
        role,
        errorReference: errorReference.trim() || undefined,
        expectedBehavior: expected.trim() || undefined,
        actualBehavior: actual.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        urgency,
      });
      if (res.ok) {
        showToast("success", t("Ticket submitted"), t("We will review it and get back to you."));
        onDone();
      } else {
        showToast("error", t("Error"), res.error.message || t("Could not submit ticket"));
      }
    } catch (e: any) {
      showToast("error", t("Error"), e?.message || t("Could not submit ticket"));
    } finally {
      setSending(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden space-y-5 p-4 sm:p-6" noValidate>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Send className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">{t("Report a problem")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("Only safe diagnostic context is captured — never passwords or payment details.")}
          </p>
        </div>
      </div>

      {/* Auto-captured context (read-only display) */}
      <div className="rounded-xl bg-muted/30 border border-border/60 p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("Page")}</p>
          <p className="font-bold text-foreground truncate mt-0.5" dir="ltr">{route}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("Version")}</p>
          <p className="font-bold text-foreground mt-0.5" dir="ltr">{appVersion}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("Role")}</p>
          <p className="font-bold text-foreground mt-0.5">{role ?? "—"}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("Environment")}</p>
          <p className="font-bold text-foreground mt-0.5" dir="ltr">{config.environment}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("Language")}</p>
          <p className="font-bold text-foreground mt-0.5">{lang === "ar" ? "العربية" : "English"}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="help-error-ref" className={labelCls}>{t("Error reference (optional)")}</label>
          <input
            id="help-error-ref"
            className={inputCls}
            placeholder="A1B2C3D4"
            value={errorReference}
            onChange={(e) => setErrorReference(e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="help-urgency" className={labelCls}>{t("Urgency")}</label>
          <select
            id="help-urgency"
            className={inputCls}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as "low" | "normal" | "high")}
          >
            <option value="low">{t("Low")}</option>
            <option value="normal">{t("Normal")}</option>
            <option value="high">{t("High")}</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="help-expected" className={labelCls}>{t("What did you expect?")}</label>
        <textarea
          id="help-expected"
          rows={3}
          className={inputCls}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="help-actual" className={labelCls}>{t("What happened instead?")}</label>
        <textarea
          id="help-actual"
          rows={3}
          className={inputCls}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="help-email" className={labelCls}>{t("Contact email (optional)")}</label>
        <input
          id="help-email"
          type="email"
          className={inputCls}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          dir="ltr"
          autoComplete="email"
        />
      </div>

      {validationError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onDone}
          className="h-11 px-5 rounded-xl border border-border text-sm font-bold hover:bg-muted/30 transition-all touch-target"
        >
          {t("Cancel")}
        </button>
        <button
          type="submit"
          disabled={sending}
          className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-target"
        >
          {sending ? t("Sending...") : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("Submit ticket")}
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {t("For security or payment concerns choose High urgency — the owner is notified first.")}
      </p>
    </form>
  );
}
