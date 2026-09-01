import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Menu,
  Moon,
  Package,
  ShoppingBag,
  Sparkles,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { AppLanguage, isValidLanguage, persistLanguage } from "../preferences";
import { useCases } from "../app/composition/useCases";
import { LENA_HOUSE_NAME, lenaHousePublicEntry } from "../lib/lena-house";

const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

const FEATURE_ITEMS = [
  { en: "Appointments", ar: "المواعيد", icon: CalendarDays },
  { en: "Point of Sale", ar: "نقطة البيع", icon: ShoppingBag },
  { en: "Customers", ar: "العملاء", icon: Users },
  { en: "Stock", ar: "المخزون", icon: Package },
  { en: "Staff", ar: "الموظفون", icon: User },
  { en: "Reports", ar: "التقارير", icon: BarChart3 },
];

const LOGIN_COPY = {
  en: {
    system: "BEAUTY CENTER SYSTEM",
    welcome: "Welcome Back",
    signInSubtitle: "Sign in to continue",
    resetTitle: "Reset password",
    resetSubtitle: "Enter your work email and we'll send you a reset link.",
    tagline: "Everything you need to run your beauty center with elegance.",
    footer: "Beauty, organized beautifully.",
    menuLabel: "LENA menu",
    parentEyebrow: "A LENA DIGITAL HOUSE PRODUCT",
    parentPrefix: "Designed and developed by",
    parentSubline: "Part of the LENA family of digital products.",
    parentMenuBody: "The parent digital house behind Lena Beauty and the LENA product family.",
    parentMenuCta: "Visit LENA Digital House",
  },
  ar: {
    system: "نظام إدارة مركز التجميل",
    welcome: "مرحبًا بعودتك",
    signInSubtitle: "سجّلي الدخول للمتابعة",
    resetTitle: "إعادة تعيين كلمة المرور",
    resetSubtitle: "أدخلي بريد العمل وسنرسل لك رابط إعادة التعيين.",
    tagline: "كل ما تحتاجينه لإدارة مركزك بجمال وسلاسة.",
    footer: "الجمال، بإدارة أجمل.",
    menuLabel: "قائمة LENA",
    parentEyebrow: "أحد منتجات LENA DIGITAL HOUSE",
    parentPrefix: "تم تصميم وتطوير LENA Beauty بواسطة",
    parentSubline: "جزء من عائلة LENA للمنتجات الرقمية.",
    parentMenuBody: "البيت الرقمي الأم وراء Lena Beauty وبقية عائلة منتجات LENA.",
    parentMenuCta: "زيارة LENA Digital House",
  },
} as const;

export function resolvePostLoginPath(from: unknown): string {
  const fallback = "/dashboard";
  if (typeof from !== "object" || from === null) return fallback;

  const candidate = from as { pathname?: unknown; search?: unknown; hash?: unknown };
  const pathname = typeof candidate.pathname === "string" ? candidate.pathname : "";
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname === "/" || pathname === "/login") {
    return fallback;
  }

  const search = typeof candidate.search === "string" ? candidate.search : "";
  const hash = typeof candidate.hash === "string" ? candidate.hash : "";
  return `${pathname}${search}${hash}`;
}

const inputClass =
  "lb-input w-full min-h-12 rounded-2xl border border-border/80 bg-white/92 py-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground shadow-sm focus:border-primary/55 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 dark:bg-card/88";

export default function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { login: authenticate } = useAuth();
  const { isInitialized, sessionState } = useAppContext();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [resetSent, setResetSent] = useState(false);
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);

  const isRtl = i18n.language === "ar";
  const copy = isRtl ? LOGIN_COPY.ar : LOGIN_COPY.en;
  const lenaHref = lenaHousePublicEntry(isRtl ? "ar" : "en");
  const hasInitializationError = isInitialized && sessionState.status === "error";
  const displayError = hasInitializationError
    ? t("An unexpected error occurred. Please try again.")
    : error;

  const switchLanguage = (code: AppLanguage) => {
    if (!isValidLanguage(code)) return;
    void i18n.changeLanguage(code);
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = code;
    persistLanguage(code);
  };

  const toggleLanguage = () => switchLanguage(isRtl ? "en" : "ar");

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setResetSent(false);
    setIsLoading(true);
    try {
      const result = await useCases.auth.requestPasswordReset(username);
      if (!result.ok) {
        setError(t("Login failed. Check your details."));
        return;
      }
      setResetSent(true);
    } catch {
      setError(t("Login failed. Check your details."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await authenticate(username, password);
      nav(resolvePostLoginPath((location.state as { from?: unknown } | null)?.from), { replace: true });
    } catch {
      setError(t("Login failed. Check your details."));
    } finally {
      setIsLoading(false);
    }
  };

  const brandLockup = (compact = false) => (
    <div className="flex flex-col items-center text-center">
      <div
        className={compact ? "h-24 w-24 sm:h-28 sm:w-28" : "h-40 w-40 xl:h-44 xl:w-44"}
        aria-hidden="true"
      >
        <img src="/lena-mark.svg" alt="" className="h-full w-full object-contain drop-shadow-[0_14px_30px_rgba(166,107,56,0.16)]" />
      </div>
      <div className={compact ? "-mt-1" : "-mt-2"}>
        <p
          className={`${compact ? "text-[2rem]" : "text-[2.65rem] xl:text-5xl"} font-serif tracking-[0.13em] text-foreground`}
          style={{ textShadow: "0 8px 28px rgba(106, 69, 130, 0.12)" }}
        >
          LENA
        </p>
        <p
          className={`${compact ? "mt-0.5 text-[10px]" : "mt-1.5 text-xs"} font-semibold tracking-[0.32em]`}
          style={{ color: "#B77A3F" }}
        >
          BEAUTY
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2" aria-hidden="true">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#C99455]/70" />
        <span className="text-[#C99455]">✦</span>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#C99455]/70" />
      </div>
    </div>
  );

  const controlClass =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/88 text-foreground shadow-[0_10px_28px_rgba(77,48,93,0.12)] backdrop-blur-xl transition hover:bg-white active:scale-95 dark:border-border dark:bg-card/90 dark:hover:bg-card";

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_16%_5%,rgba(218,160,94,0.16),transparent_26rem),radial-gradient(circle_at_3%_52%,rgba(232,190,217,0.32),transparent_27rem),radial-gradient(circle_at_94%_93%,rgba(181,145,215,0.25),transparent_30rem),linear-gradient(135deg,#fffdfb_0%,#fcf7fb_46%,#f7f1fb_100%)] px-3 py-[max(0.75rem,env(safe-area-inset-top))] text-foreground dark:bg-[radial-gradient(circle_at_16%_5%,rgba(218,160,94,0.08),transparent_24rem),radial-gradient(circle_at_92%_92%,rgba(126,84,165,0.12),transparent_28rem),linear-gradient(135deg,hsl(var(--background)),hsl(var(--background)))] sm:px-5 sm:py-5 lg:px-8 lg:py-7"
      dir={isRtl ? "rtl" : "ltr"}
      aria-labelledby="login-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -start-16 h-80 w-80 rounded-full border border-[#D7A25E]/20" />
        <div className="absolute -top-10 -start-4 h-64 w-64 rounded-full border border-primary/10" />
        <div className="absolute -bottom-48 -start-28 h-80 w-[42rem] rotate-[-8deg] rounded-[50%] border-t border-[#D4A15F]/35 bg-primary/[0.045] blur-[1px]" />
        <div className="absolute -bottom-52 -start-20 h-72 w-[48rem] rotate-[-5deg] rounded-[50%] border-t border-[#E5C58F]/50 bg-secondary/[0.035]" />
        <div className="absolute top-[18%] end-[7%] h-1.5 w-1.5 rounded-full bg-[#D29B52] shadow-[0_0_18px_5px_rgba(210,155,82,0.28)]" />
        <div className="absolute bottom-[14%] end-[19%] h-1 w-1 rounded-full bg-[#D29B52] shadow-[0_0_16px_4px_rgba(210,155,82,0.24)]" />
      </div>

      {/* Mobile-only: three compact controls — LENA menu, language and theme. */}
      <div
        className="absolute end-4 top-[max(0.9rem,env(safe-area-inset-top))] z-30 flex items-center gap-2 sm:hidden"
        dir="ltr"
      >
        <button
          type="button"
          onClick={() => setIsBrandMenuOpen((open) => !open)}
          className={controlClass}
          aria-label={`${copy.menuLabel} mobile`}
          aria-expanded={isBrandMenuOpen}
          aria-controls="lena-house-menu"
          title={copy.menuLabel}
        >
          {isBrandMenuOpen ? <X className="h-5 w-5 text-primary" aria-hidden="true" /> : <Menu className="h-5 w-5 text-primary" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={toggleLanguage}
          className={controlClass}
          aria-label={`${t("Change Language")}: ${isRtl ? "English" : "العربية"}`}
          title={isRtl ? "English" : "العربية"}
        >
          <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className={controlClass}
          aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
          aria-pressed={theme === "dark"}
          title={theme === "dark" ? t("Light mode") : t("Dark mode")}
        >
          {theme === "dark" ? <Sun className="h-5 w-5 text-[#C58A45]" /> : <Moon className="h-5 w-5 text-primary" />}
        </button>
      </div>

      {isBrandMenuOpen ? (
        <div
          id="lena-house-menu"
          className="absolute end-4 top-[calc(max(0.9rem,env(safe-area-inset-top))+3.5rem)] z-40 w-[min(20rem,calc(100vw-2rem))] rounded-[1.5rem] border border-white/90 bg-white/94 p-4 shadow-[0_22px_60px_rgba(76,46,91,0.18)] backdrop-blur-2xl dark:border-border dark:bg-card/95 sm:end-5 sm:top-20 lg:end-8"
          role="dialog"
          aria-label={copy.menuLabel}
        >
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/12 to-[#D5A15D]/15 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#B77A3F]">{copy.parentEyebrow}</p>
              <p className="mt-1 font-serif text-lg font-semibold text-foreground">{LENA_HOUSE_NAME}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.parentMenuBody}</p>
            </div>
          </div>
          <a
            href={lenaHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsBrandMenuOpen(false)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/8 px-3 text-sm font-semibold text-primary transition hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            {copy.parentMenuCta}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      ) : null}

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {/* Desktop / tablet keeps explicit language labels plus menu and theme controls. */}
        <div className="mb-4 hidden items-center justify-end gap-2 sm:flex" dir="ltr">
          <button
            type="button"
            onClick={() => setIsBrandMenuOpen((open) => !open)}
            className={controlClass}
            aria-label={`${copy.menuLabel} desktop`}
            aria-expanded={isBrandMenuOpen}
            aria-controls="lena-house-menu"
            title={copy.menuLabel}
          >
            {isBrandMenuOpen ? <X className="h-4 w-4 text-primary" aria-hidden="true" /> : <Menu className="h-4 w-4 text-primary" aria-hidden="true" />}
          </button>
          <div className="inline-flex min-h-11 items-center overflow-hidden rounded-full border border-border/75 bg-card/88 p-1 shadow-sm backdrop-blur-xl">
            <Globe className="mx-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {LANGUAGES.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => switchLanguage(language.code)}
                aria-label={`${t("Change Language")}: ${language.label}`}
                aria-pressed={i18n.language === language.code}
                className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${
                  i18n.language === language.code
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {language.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={controlClass}
            aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? t("Light mode") : t("Dark mode")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-[#C58A45]" /> : <Moon className="h-4 w-4 text-primary" />}
          </button>
        </div>

        <section className="grid overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/68 shadow-[0_26px_80px_rgba(80,48,95,0.15)] backdrop-blur-2xl dark:border-border dark:bg-card/75 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative hidden min-h-[720px] overflow-hidden border-e border-[#D6B783]/30 bg-[radial-gradient(circle_at_50%_15%,rgba(225,184,114,0.16),transparent_18rem),linear-gradient(160deg,rgba(255,252,248,0.96),rgba(252,244,250,0.92)_58%,rgba(242,232,250,0.9))] p-8 dark:border-border dark:bg-[linear-gradient(160deg,rgba(31,23,35,0.96),rgba(35,24,42,0.94))] lg:flex lg:flex-col lg:items-center lg:justify-center xl:p-10">
            <div aria-hidden="true" className="absolute -start-24 bottom-8 h-72 w-72 rounded-full border border-primary/10" />
            <div aria-hidden="true" className="absolute -start-10 bottom-20 h-56 w-56 rounded-full border border-[#D3A15D]/20" />
            <div aria-hidden="true" className="absolute -bottom-32 -start-24 h-56 w-[34rem] rotate-[-8deg] rounded-[50%] border-t border-[#D3A15D]/55 bg-primary/[0.055]" />
            <div aria-hidden="true" className="absolute -bottom-36 -start-16 h-52 w-[37rem] rotate-[-5deg] rounded-[50%] border-t border-[#E5C48C]/60 bg-secondary/[0.04]" />

            <div className="relative z-10 w-full max-w-md">
              {brandLockup(false)}
              <h2 className="mx-auto mt-7 max-w-sm text-center text-2xl font-semibold leading-snug text-foreground">
                {copy.tagline}
              </h2>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {FEATURE_ITEMS.map(({ en, ar, icon: Icon }) => (
                  <div
                    key={en}
                    className="group rounded-2xl border border-white/80 bg-white/72 p-4 text-center shadow-[0_10px_26px_rgba(88,58,106,0.07)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#D6A45D]/35 dark:border-border dark:bg-card/70"
                  >
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/8 text-primary transition group-hover:bg-primary/12">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-foreground">{isRtl ? ar : en}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="relative flex min-h-[100dvh] items-center justify-center px-3 pb-5 pt-20 sm:min-h-[720px] sm:p-7 lg:p-10">
            <div className="w-full max-w-xl">
              <div className="mb-4 lg:hidden">{brandLockup(true)}</div>

              <div className="rounded-[1.85rem] border border-white/90 bg-white/86 p-4 shadow-[0_20px_56px_rgba(80,50,100,0.12)] backdrop-blur-xl dark:border-border dark:bg-card/90 sm:p-7 lg:p-9">
                <div className="mb-6 text-center sm:text-start">
                  <div className="mb-1.5 flex items-center justify-center gap-2 sm:justify-start">
                    <h1 id="login-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
                      {mode === "sign-in" ? copy.welcome : copy.resetTitle}
                    </h1>
                    <Sparkles className="h-6 w-6 text-[#C58A45]" aria-hidden="true" />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {mode === "sign-in" ? copy.signInSubtitle : copy.resetSubtitle}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 sm:justify-start" aria-hidden="true">
                    <span className="h-px w-16 bg-gradient-to-r from-[#D5A25D]/80 to-transparent" />
                    <span className="text-xs text-[#C58A45]">✦</span>
                  </div>
                </div>

                {displayError ? (
                  <div
                    id="login-error"
                    role="alert"
                    aria-live="assertive"
                    className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive"
                  >
                    {displayError}
                  </div>
                ) : null}

                <form onSubmit={mode === "reset" ? handlePasswordReset : handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-username" className="mb-1.5 block text-sm font-semibold text-foreground">
                      {t("Work email")}
                    </label>
                    <div className="relative">
                      <User
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        style={{ insetInlineStart: "14px" }}
                      />
                      <input
                        id="login-username"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        placeholder="name@yourcenter.com"
                        aria-invalid={Boolean(displayError)}
                        aria-describedby={displayError ? "login-error" : undefined}
                        className={inputClass}
                        style={{ paddingInlineStart: "40px", paddingInlineEnd: "14px" }}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {mode === "sign-in" ? (
                    <div>
                      <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-foreground">
                        {t("Password")}
                      </label>
                      <div className="relative">
                        <Lock
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          style={{ insetInlineStart: "14px" }}
                        />
                        <input
                          id="login-password"
                          name="password"
                          autoComplete="current-password"
                          required
                          type={showPassword ? "text" : "password"}
                          placeholder={t("Password")}
                          aria-invalid={Boolean(displayError)}
                          aria-describedby={displayError ? "login-error" : undefined}
                          className={inputClass}
                          style={{ paddingInlineStart: "40px", paddingInlineEnd: "52px" }}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-primary"
                          style={{ insetInlineEnd: "2px" }}
                          aria-label={showPassword ? t("Hide password") : t("Show password")}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <EyeOff aria-hidden="true" className="h-4 w-4" />
                          ) : (
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {resetSent ? (
                    <p
                      data-testid="password-reset-sent"
                      className="rounded-2xl border border-success/25 bg-success/10 px-3 py-2 text-sm leading-relaxed text-success"
                    >
                      {t("If an account exists for that email, a reset link has been sent.")}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className="min-h-11 px-2 text-sm font-medium text-primary underline-offset-4 transition hover:underline"
                      onClick={() => {
                        setMode((current) => (current === "sign-in" ? "reset" : "sign-in"));
                        setError("");
                        setResetSent(false);
                      }}
                    >
                      {mode === "sign-in" ? t("Forgot password?") : t("Back to sign in")}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary via-primary to-secondary px-4 py-3 text-base font-bold text-primary-foreground shadow-[0_13px_30px_rgba(113,71,160,0.22)] transition hover:brightness-105 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-busy={isLoading}
                  >
                    {isLoading
                      ? t("Signing in...")
                      : mode === "reset"
                        ? t("Send reset link")
                        : t("Sign In")}
                  </button>
                </form>

                {mode === "sign-in" ? (
                  <div className="mt-5 lg:hidden">
                    <div className="mb-3 flex items-center gap-3" aria-hidden="true">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D7B77A]/50 to-transparent" />
                      <span className="text-[10px] text-muted-foreground">{copy.footer}</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D7B77A]/50 to-transparent" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {FEATURE_ITEMS.map(({ en, ar, icon: Icon }) => (
                        <div key={en} className="rounded-2xl border border-border/55 bg-card/45 px-2 py-3 text-center shadow-sm">
                          <Icon className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
                          <p className="mt-1.5 truncate text-[10px] font-medium text-muted-foreground">{isRtl ? ar : en}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {mode === "sign-in" ? (
                <div
                  className="mx-auto mt-4 max-w-lg rounded-2xl border border-[#D6B783]/35 bg-white/52 px-4 py-3 text-center shadow-[0_10px_28px_rgba(76,47,91,0.06)] backdrop-blur-lg dark:border-border dark:bg-card/45"
                  data-lena-house-endorsement
                >
                  <p className="text-[9px] font-bold tracking-[0.18em] text-[#B77A3F]">{copy.parentEyebrow}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {copy.parentPrefix}{" "}
                    <a
                      href={lenaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 font-semibold text-foreground underline-offset-4 outline-none transition hover:text-primary hover:underline focus-visible:ring-4 focus-visible:ring-primary/15"
                    >
                      {LENA_HOUSE_NAME}
                      <ArrowUpRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    </a>
                  </p>
                  <p className="-mt-1 text-[10px] leading-relaxed text-muted-foreground/80">{copy.parentSubline}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
