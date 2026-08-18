import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { useCases } from "../app/composition/useCases";

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
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        void check();
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError(result.error.message || t("Could not update password."));
        return;
      }
      await useCases.auth.logout();
      setDone(true);
    } catch (err) {
      setError((err as Error).message || t("Could not update password."));
    } finally {
      setSaving(false);
    }
  };

  const isRtl = i18n.language === "ar";

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-4"
      dir={isRtl ? "rtl" : "ltr"}
      aria-labelledby="reset-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-300 bg-white/90 p-8 shadow-lg">
        <h1 id="reset-title" className="text-xl font-bold text-stone-900">
          {t("Choose a new password")}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {t("Use the link from your email, then set a password only you know.")}
        </p>

        {!ready && <p className="mt-4 text-sm">{t("Loading...")}</p>}

        {ready && !hasSession && !done && (
          <p role="alert" className="mt-4 text-sm text-red-800">
            {t("This reset link is missing or has expired. Request a new one from the sign-in page.")}
          </p>
        )}

        {done && (
          <div className="mt-4 space-y-3">
            <p role="status" className="text-sm text-stone-800">
              {t("Your password was updated. Sign in with the new password.")}
            </p>
            <button
              type="button"
              className="min-h-11 w-full rounded-xl bg-amber-800 text-sm font-semibold text-white"
              onClick={() => nav("/login", { replace: true })}
            >
              {t("Back to sign in")}
            </button>
          </div>
        )}

        {ready && hasSession && !done && (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {error && (
              <p role="alert" className="text-sm text-red-800">
                {t(error)}
              </p>
            )}
            <label htmlFor="new-password" className="block text-xs font-semibold text-stone-800">
              {t("New Password")}
            </label>
            <div className="relative">
              <Lock aria-hidden className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" style={{ insetInlineStart: 12 }} />
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-stone-400 py-3 pe-3"
                style={{ paddingInlineStart: 36 }}
                dir="ltr"
              />
            </div>
            <label htmlFor="confirm-password" className="block text-xs font-semibold text-stone-800">
              {t("Confirm Password")}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-stone-400 px-3 py-3"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 w-full rounded-xl bg-amber-800 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? t("Saving...") : t("Update password")}
            </button>
          </form>
        )}

        <button
          type="button"
          className="mt-4 min-h-11 text-xs text-stone-600 underline"
          onClick={() => nav("/login")}
        >
          {t("Back to sign in")}
        </button>
      </div>
    </main>
  );
}
