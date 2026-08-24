import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Globe, Lock, Moon, Sun, User } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { AppLanguage, isValidLanguage, persistLanguage } from "../preferences";
import { EnvironmentBadge } from "../shared/components/EnvironmentBadge";
import { useCases } from "../app/composition/useCases";

const LANGUAGES: { code: AppLanguage; label: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" },
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

const inputClass = "lb-input w-full min-h-12 rounded-xl border border-input bg-background/80 py-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

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
      // Keep infrastructure/configuration vocabulary out of the customer-facing
      // surface. Technical detail remains available to application logging.
      setError(t("Login failed. Check your details."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground"
      dir={isRtl ? "rtl" : "ltr"}
      aria-labelledby="login-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -end-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -start-24 h-80 w-80 rounded-full bg-secondary/12 blur-3xl" />
        <div className="absolute inset-x-0 top-1/3 mx-auto h-56 max-w-2xl rounded-full bg-accent/40 blur-3xl" />
      </div>

      <div className="absolute top-4 end-4 z-20 flex items-center gap-2">
        <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-border bg-card/85 shadow-sm backdrop-blur-xl">
          <Globe className="mx-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => switchLanguage(language.code)}
              aria-label={`${t("Change Language")}: ${language.label}`}
              aria-pressed={i18n.language === language.code}
              className={`min-h-11 px-3 text-xs font-semibold transition ${
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/85 text-foreground shadow-sm backdrop-blur-xl transition hover:bg-muted"
          aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
          aria-pressed={theme === "dark"}
          title={theme === "dark" ? t("Light mode") : t("Dark mode")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
        </button>
      </div>

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card/92 shadow-2xl shadow-primary/10 backdrop-blur-2xl">
        <div className="px-6 pb-5 pt-9 text-center sm:px-8">
          <div className="mx-auto mb-4 h-16 w-16 sm:h-20 sm:w-20">
            <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
          </div>
          <h1 id="login-title" className="text-2xl font-bold tracking-tight sm:text-3xl">LenaBeauty</h1>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {t("The daily operations system for one beauty center.")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("Appointments, point of sale, customers, stock and staff — in one place.")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("For the center's team. This is not a customer booking site.")}
          </p>
          <EnvironmentBadge className="mt-3" />
        </div>

        <div className="px-6 pb-8 sm:px-8">
          {displayError ? (
            <div id="login-error" role="alert" aria-live="assertive" className="mb-5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
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
                  placeholder={t("Work email")}
                  aria-invalid={Boolean(displayError)}
                  aria-describedby={displayError ? "login-error login-email-hint" : "login-email-hint"}
                  className={inputClass}
                  style={{ paddingInlineStart: "40px", paddingInlineEnd: "14px" }}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  dir="ltr"
                />
              </div>
              <p id="login-email-hint" className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("Use the work email your administrator registered for you.")}
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
                    className="absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary"
                    style={{ insetInlineEnd: "2px" }}
                    aria-label={showPassword ? t("Hide password") : t("Show password")}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            {resetSent ? (
              <p data-testid="password-reset-sent" className="rounded-xl border border-success/25 bg-success/10 px-3 py-2 text-sm leading-relaxed text-success">
                {t("If an account exists for that email, a reset link has been sent.")}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              aria-busy={isLoading}
            >
              {isLoading
                ? t("Signing in...")
                : mode === "reset"
                  ? t("Send reset link")
                  : t("Sign In")}
            </button>
          </form>

          <div className="mt-2 text-center">
            <button
              type="button"
              className="min-h-11 px-3 text-xs font-medium text-muted-foreground underline-offset-2 transition hover:text-primary hover:underline"
              onClick={() => {
                setMode((current) => current === "sign-in" ? "reset" : "sign-in");
                setError("");
                setResetSent(false);
              }}
            >
              {mode === "sign-in" ? t("Forgot password?") : t("Back to sign in")}
            </button>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border border-border bg-muted/45 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <p>{t("After signing in you land on today's work: appointments, sales and stock alerts.")}</p>
            <p>{t("Accounts are created by your center administrator. There is no public sign-up.")}</p>
            <p>{t("Your data stays in your center's database and is visible only to its team.")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
