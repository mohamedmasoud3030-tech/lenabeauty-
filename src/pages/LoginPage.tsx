import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useTranslation } from "react-i18next";
import { Lock, User, Eye, EyeOff, Sparkles, Sun, Moon, Globe } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

const LANGUAGES = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" },
];

export default function LoginPage() {
  const nav = useNavigate();
  const { login: authenticate } = useAuth();
  const { isInitialized, sessionState } = useAppContext();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isRtl = i18n.language === "ar";
  const initError =
    isInitialized && sessionState.status === "error"
      ? sessionState.error.message
      : null;

  const switchLanguage = (code: string) => {
    i18n.changeLanguage(code);
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = code;
    localStorage.setItem("spa-lang", code);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await authenticate(username, password);
      nav("/", { replace: true });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "AUTH_NOT_CONFIGURED") {
        setError(t("Authentication not configured yet. Database setup required."));
      } else {
        setError(e.message || String(err) || t("Login failed. Check your details."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── Theme-aware gradient ─── */
  const bgGradient =
    theme === "dark"
      ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)"
      : "linear-gradient(135deg, #fdf6ec 0%, #fef3c7 50%, #fde68a 100%)";

  const cardBg =
    theme === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.75)";

  const cardBorder =
    theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(217,119,6,0.25)";

  const textPrimary = theme === "dark" ? "#f1f5f9" : "#1c1917";
  const textMuted   = theme === "dark" ? "rgba(241,245,249,0.45)" : "rgba(28,25,23,0.45)";

  const inputBg     = theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.90)";
  const inputBorder = theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(217,119,6,0.30)";
  const inputFocus  = "rgba(217,119,6,0.75)";
  const iconColor   = theme === "dark" ? "rgba(255,255,255,0.30)" : "rgba(120,80,0,0.35)";

  const blob1Color = theme === "dark" ? "#7c3aed" : "#d97706";
  const blob2Color = theme === "dark" ? "#0ea5e9" : "#a16207";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-500"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ background: bgGradient }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -end-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${blob1Color}, transparent)` }}
          animate={{ scale: [1, 1.15, 1], rotate: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -start-40 w-80 h-80 rounded-full opacity-15"
          style={{ background: `radial-gradient(circle, ${blob2Color}, transparent)` }}
          animate={{ scale: [1, 1.2, 1], rotate: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* Top-right controls: theme + language */}
      <motion.div
        className="absolute top-4 end-4 flex items-center gap-2 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        {/* Language switcher */}
        <div className="flex items-center rounded-xl overflow-hidden border"
          style={{ borderColor: cardBorder, background: cardBg, backdropFilter: "blur(12px)" }}
        >
          <Globe className="w-3.5 h-3.5 mx-2" style={{ color: textMuted }} />
          {LANGUAGES.map((lang, idx) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className="px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={{
                color: i18n.language === lang.code ? "#d97706" : textMuted,
                fontWeight: i18n.language === lang.code ? 700 : 400,
                borderLeft: idx > 0 ? `1px solid ${cardBorder}` : "none",
                background: i18n.language === lang.code
                  ? (theme === "dark" ? "rgba(217,119,6,0.15)" : "rgba(217,119,6,0.12)")
                  : "transparent",
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <motion.button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl flex items-center justify-center border transition-colors duration-200"
          style={{ borderColor: cardBorder, background: cardBg, backdropFilter: "blur(12px)", color: textPrimary }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          <AnimatePresence mode="wait">
            {theme === "dark" ? (
              <motion.span key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Sun className="w-4 h-4 text-amber-400" />
              </motion.span>
            ) : (
              <motion.span key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Moon className="w-4 h-4 text-amber-700" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Card */}
      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div
          className="rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            background: cardBg,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: cardBorder,
          }}
        >
          {/* Header */}
          <div className="text-center pt-10 pb-6 px-8">
            <motion.div
              className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-5 shadow-lg"
              style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            >
              <Sparkles className="w-9 h-9 text-white" />
            </motion.div>

            <motion.h1
              className="text-2xl font-bold tracking-wide"
              style={{ color: textPrimary }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              {isRtl ? "مرحباً بعودتك" : "Welcome Back"}
            </motion.h1>
            <motion.p
              className="mt-1 text-sm"
              style={{ color: textMuted }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              {isRtl ? "سجّل دخولك للمتابعة" : t("Enter credentials to continue")}
            </motion.p>
          </div>

          {/* Form */}
          <div className="px-8 pb-10">
            {/* Error banner */}
            <AnimatePresence>
              {(initError || error) && (
                <motion.div
                  className="mb-5 rounded-xl px-4 py-3 text-sm text-center"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.30)",
                    color: "#fca5a5",
                  }}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {initError ? t(initError) : t(error)}
                  {initError && (
                    <div className="mt-1 text-xs opacity-70">
                      {t("Supabase production login is disabled until configured.")}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <motion.div
                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="relative group">
                  <User
                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200 group-focus-within:text-amber-500"
                    style={{
                      color: iconColor,
                      insetInlineStart: "14px",
                    } as React.CSSProperties}
                  />
                  <input
                    autoFocus
                    placeholder={t("Username")}
                    className="w-full py-3 text-sm rounded-xl outline-none transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: textPrimary,
                      paddingInlineStart: "40px",
                      paddingInlineEnd: "14px",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = inputFocus)}
                    onBlur={e => (e.currentTarget.style.borderColor = inputBorder)}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    dir="ltr"
                    disabled={!!initError}
                  />
                </div>
              </motion.div>

              {/* Password */}
              <motion.div
                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="relative group">
                  <Lock
                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200 group-focus-within:text-amber-500"
                    style={{ color: iconColor, insetInlineStart: "14px" } as React.CSSProperties}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t("Password")}
                    className="w-full py-3 text-sm rounded-xl outline-none transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: textPrimary,
                      paddingInlineStart: "40px",
                      paddingInlineEnd: "40px",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = inputFocus)}
                    onBlur={e => (e.currentTarget.style.borderColor = inputBorder)}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    dir="ltr"
                    disabled={!!initError}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute top-1/2 -translate-y-1/2 transition-colors duration-150 hover:text-amber-500"
                    style={{ color: iconColor, insetInlineEnd: "12px" } as React.CSSProperties}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>

              {/* Submit */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <motion.button
                  type="submit"
                  disabled={!!initError || isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}
                  whileHover={!initError && !isLoading ? { scale: 1.02, filter: "brightness(1.08)" } : {}}
                  whileTap={!initError && !isLoading ? { scale: 0.97 } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.span
                        key="loading"
                        className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                        />
                        {isRtl ? "جاري التحقق..." : "Signing in..."}
                      </motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {t("Sign In")}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            </form>

            {/* Footer */}
            <motion.p
              className="text-center text-xs mt-6"
              style={{ color: textMuted }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              {isRtl ? "نظام إدارة السبا — النسخة 1.1" : "Spa Management System — v1.1"}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
