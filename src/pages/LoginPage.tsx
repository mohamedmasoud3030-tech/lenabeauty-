import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Moon,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  User,
  Users,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { AppLanguage, isValidLanguage, persistLanguage } from "../preferences";
import { useCases } from "../app/composition/useCases";

const LANGUAGES: { code: AppLanguage; label: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" },
];

const FEATURE_ITEMS = [
  { label: "Appointments", icon: CalendarDays },
  { label: "Point of Sale", icon: ShoppingBag },
  { label: "Customers", icon: Users },
  { label: "Stock", icon: Package },
  { label: "Staff", icon: User },
  { label: "Reports", icon: BarChart3 },
];

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
  "lb-input w-full min-h-12 rounded-2xl border border-border/80 bg-white/85 py-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground shadow-sm focus:border-primary/70 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 dark:bg-card/80";

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

  const isRtl = i18n.language === "ar";
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

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.14),transparent_32%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--background)))] px-3 py-[max(0.75rem,env(safe-area-inset-top))] text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-7"
      dir={isRtl ? "rtl" : "ltr"}
      aria-labelledby="login-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -start-20 h-80 w-80 rounded-full bg-pink-300/20 blur-3xl dark:bg-fuchsia-900/15" />
        <div className="absolute -bottom-32 -end-20 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-900/15" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-3 flex items-center justify-end gap-2 sm:mb-4">
          <div className="inline-flex min-h-11 items-center overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-xl">
            <Globe className="mx-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {LANGUAGES.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => switchLanguage(language.code)}
                aria-label={`${t("Change Language")}: ${language.label}`}
                aria-pressed={i18n.language === language.code}
                className={`min-h-11 px-3 text-sm font-semibold transition ${
                  i18n.language === language.code
                    ? "bg-primary/10 text-primary"
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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-card/80 text-foreground shadow-sm backdrop-blur-xl transition hover:bg-muted"
            aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? t("Light mode") : t("Dark mode")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
          </button>
        </div>

        <section className="grid overflow-hidden rounded-[2rem] border border-border/70 bg-card/82 shadow-[0_24px_70px_rgba(60,31,90,0.14)] backdrop-blur-2xl lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden overflow-hidden border-e border-border/60 bg-gradient-to-br from-pink-50/90 via-white/75 to-violet-50/90 p-8 dark:from-pink-950/15 dark:via-card/50 dark:to-violet-950/15 lg:flex lg:min-h-[720px] lg:flex-col">
            <div aria-hidden="true" className="absolute -top-16 -start-10 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-16 -end-10 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />

            <div className="relative z-10">
              <div className="mb-7 flex items-center gap-4">
                <div className="h-20 w-20 rounded-[1.75rem] border border-primary/10 bg-white/80 p-3 shadow-lg shadow-primary/10 dark:bg-card/85">
                  <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
                </div>
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">LenaBeauty</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">Beauty Center System</p>
                </div>
              </div>

              <h2 className="max-w-sm text-2xl font-bold leading-tight text-foreground">
                {t("Everything your team needs, in one beautiful place.")}
              </h2>

              <div className="mt-8 grid grid-cols-2 gap-4">
                {FEATURE_ITEMS.map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-3xl border border-border/60 bg-white/76 p-4 shadow-sm backdrop-blur-md dark:bg-card/65"
                  >
                    <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-foreground">{t(label)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 mt-auto flex items-center gap-4 rounded-3xl border border-border/60 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:bg-card/60">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("Your data is safe with us")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("Secure · Private · For your center only")}</p>
              </div>
            </div>
          </aside>

          <div className="flex min-h-[calc(100dvh-6rem)] items-center justify-center p-4 sm:p-6 lg:min-h-[720px] lg:p-8">
            <div className="w-full max-w-xl rounded-[1.75rem] border border-border/70 bg-background/76 p-5 shadow-xl shadow-primary/5 backdrop-blur-xl sm:p-7 lg:p-9">
              <div className="mb-6 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl border border-primary/10 bg-card/80 p-2 shadow-sm">
                    <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">LenaBeauty</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-primary/70">Beauty Center System</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <h1 id="login-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {mode === "sign-in" ? t("Welcome Back") : t("Reset password")}
                  </h1>
                  <Sparkles className="h-6 w-6 text-primary/70" aria-hidden="true" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {mode === "sign-in"
                    ? t("Sign in to your center account")
                    : t("Enter your work email and we'll send you a reset link.")}
                </p>
              </div>

              <div className="mb-6 flex items-start gap-3 rounded-3xl border border-primary/15 bg-primary/[0.045] p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-md shadow-primary/15">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-primary">{t("This is a team workspace")}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t("Only registered team members can sign in.")}
                  </p>
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
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("Use the work email registered by your administrator.")}
                  </p>
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
                        placeholder={t("Enter your password")}
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
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="mt-6 border-t border-border/60 pt-5">
                  <p className="mb-4 text-center text-xs font-medium text-muted-foreground">
                    {t("After signing in you can access:")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[CalendarDays, ShoppingBag, Package].map((Icon, index) => (
                      <div key={index} className="rounded-2xl border border-border/60 bg-card/55 p-3 text-center">
                        <Icon className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
                        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                          {index === 0
                            ? t("Today's appointments")
                            : index === 1
                              ? t("Sales & transactions")
                              : t("Stock alerts")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="mt-5 rounded-2xl border border-border/60 bg-card/45 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
                {t("Accounts are created by your center administrator. There is no public sign-up.")}
              </p>
            </div>
          </div>
        </section>

        <div className="px-2 py-4 text-center text-xs text-muted-foreground sm:py-5">
          <p className="font-medium text-foreground/75">{t("Made for beauty professionals, by LenaBeauty")}</p>
        </div>
      </div>
    </main>
  );
}
