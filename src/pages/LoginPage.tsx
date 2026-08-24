import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Globe, Lock, Moon, Sun, User } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { AppLanguage, isValidLanguage, persistLanguage } from "../preferences";
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

const inputClass = "lb-input w-full min-h-12 rounded-2xl border border-input bg-background/85 py-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

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
      className="relative min-h-[100dvh] overflow-hidden bg-background px-4 py-[max(1rem,env(safe-area-inset-top))] text-foreground sm:px-6 sm:py-8"
      dir={isRtl ? "rtl" : "ltr"}
      aria-labelledby="login-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -end-24 h-72 w-72 rounded-full bg-primary/14 blur-3xl" />
        <div className="absolute -bottom-32 -start-24 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-md flex-col justify-center sm:min-h-[calc(100dvh-4rem)]">
        <div className="mb-3 flex items-center justify-end gap-2">
          <div className="inline-flex min-h-11 items-center overflow-hidden rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur-xl">
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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-sm backdrop-blur-xl transition hover:bg-muted"
            aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? t("Light mode") : t("Dark mode")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/94 shadow-2xl shadow-primary/10 backdrop-blur-2xl">
          <div className="px-6 pb-4 pt-7 text-center sm:px-8 sm:pt-8">
            <div className="mx-auto mb-3 h-16 w-16">
              <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
            </div>
            <h1 id="login-title" className="text-2xl font-bold tracking-tight sm:text-3xl">LenaBeauty</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("The daily operations system for one beauty center.")}
            </p>
          </div>

          <div className="px-6 pb-7 sm:px-8 sm:pb-8">
            {displayError ? (
              <div id="login-error" role="alert" aria-live="assertive" className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
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
                      {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              {resetSent ? (
                <p data-testid="password-reset-sent" className="rounded-2xl border border-success/25 bg-success/10 px-3 py-2 text-sm leading-relaxed text-success">
                  {t("If an account exists for that email, a reset link has been sent.")}
                </p>
              ) : null}

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

            <div className="mt-2 text-center">
              <button
                type="button"
                className="min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-2 transition hover:text-primary hover:underline"
                onClick={() => {
                  setMode((current) => current === "sign-in" ? "reset" : "sign-in");
                  setError("");
                  setResetSent(false);
                }}
              >
                {mode === "sign-in" ? t("Forgot password?") : t("Back to sign in")}
              </button>
            </div>

            <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
              {t("Accounts are created by your center administrator. There is no public sign-up.")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
