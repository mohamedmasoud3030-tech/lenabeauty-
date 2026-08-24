import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { useCases } from "../app/composition/useCases";

const inputClass = "w-full min-h-12 rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function ResetPasswordPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const session = await useCases.auth.getSession();
      if (cancelled) return;
      setHasSession(session.ok && session.data.status === "authenticated");
      setReady(true);
    };
    void check();
    const unsub = useCases.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") void check();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("New password must be at least 8 characters."));
      return;
    }
    if (password !== confirm) {
      setError(t("Passwords do not match."));
      return;
    }
    setSaving(true);
    try {
      const result = await useCases.auth.updatePassword(password);
      if (!result.ok) {
        setError(t("Could not update password."));
        return;
      }
      await useCases.auth.logout();
      setDone(true);
    } catch {
      setError(t("Could not update password."));
    } finally {
      setSaving(false);
    }
  };

  const isRtl = i18n.language === "ar";

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground"
      dir={isRtl ? "rtl" : "ltr"}
      aria-labelledby="reset-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -end-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -start-24 h-80 w-80 rounded-full bg-secondary/12 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card/95 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-8">
        <div className="mb-5 h-14 w-14">
          <img src="/lena-mark.svg" alt="Lena Beauty" className="h-full w-full" />
        </div>
        <h1 id="reset-title" className="text-2xl font-bold tracking-tight text-foreground">
          {t("Choose a new password")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("Use the link from your email, then set a password only you know.")}
        </p>

        {!ready ? <p className="mt-4 text-sm text-muted-foreground">{t("Loading...")}</p> : null}

        {ready && !hasSession && !done ? (
          <p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t("This reset link is missing or has expired. Request a new one from the sign-in page.")}
          </p>
        ) : null}

        {done ? (
          <div className="mt-5 space-y-3">
            <p role="status" className="rounded-xl border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
              {t("Your password was updated. Sign in with the new password.")}
            </p>
            <button
              type="button"
              className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              onClick={() => nav("/login", { replace: true })}
            >
              {t("Back to sign in")}
            </button>
          </div>
        ) : null}

        {ready && hasSession && !done ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {error ? (
              <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t(error)}
              </p>
            ) : null}
            <label htmlFor="new-password" className="block text-sm font-semibold text-foreground">
              {t("New Password")}
            </label>
            <div className="relative">
              <Lock
                aria-hidden
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                style={{ insetInlineStart: 12 }}
              />
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                style={{ paddingInlineStart: 36 }}
                dir="ltr"
              />
            </div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-foreground">
              {t("Confirm Password")}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={inputClass}
              dir="ltr"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 w-full rounded-xl bg-gradient-to-r from-primary to-secondary px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-40"
            >
              {saving ? t("Saving...") : t("Update password")}
            </button>
          </form>
        ) : null}

        <button
          type="button"
          className="mt-4 min-h-11 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          onClick={() => nav("/login")}
        >
          {t("Back to sign in")}
        </button>
      </section>
    </main>
  );
}
