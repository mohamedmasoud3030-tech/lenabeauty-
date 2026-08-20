/**
 * WelcomeCompleted
 * ------------------
 * Shown for 7 days after a center completes the full setup guide
 * (services → team → customers → appointment → sale).
 *
 * Non-intrusive: one dismissible card, no modal, no repeated prompting.
 * Dismisses permanently on click, or automatically after 7 days.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, Receipt, X, Sparkles } from "lucide-react";
import { hasActivationEvent, recordActivationEvent } from "../activation/events";

const COMPLETED_KEY = "lenabeauty_welcome_completed_shown_at";
const DISMISS_KEY = "lenabeauty_welcome_completed_dismissed";

export function WelcomeCompleted() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY) === "true";
      if (dismissed) return;

      const shownAt = localStorage.getItem(COMPLETED_KEY);
      if (shownAt) {
        const elapsed = Date.now() - new Date(shownAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (elapsed > sevenDays) return;
      }

      // Only show when the center is actually set up.
      if (!hasActivationEvent("center_fully_setup")) return;

      setVisible(true);
      if (!shownAt) localStorage.setItem(COMPLETED_KEY, new Date().toISOString());
    } catch {
      // localStorage unavailable — fall back to showing once per session.
      if (hasActivationEvent("center_fully_setup")) setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      /* best-effort */
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="welcome-completed-title"
      className="relative rounded-2xl sm:rounded-3xl border border-success/30 bg-gradient-to-br from-success/10 via-card to-card shadow-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("Dismiss")}
        title={t("Dismiss")}
        className="absolute top-3 end-3 h-11 w-11 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <div className="p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 id="welcome-completed-title" className="text-lg sm:text-xl font-bold text-foreground">
              {t("Your center is set up!")}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("You're ready to run daily operations.")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
            {t("Dashboard, point of sale, appointments and customers are ready. Record your first sale to see live reports.")}
          </p>
          <button
            type="button"
            onClick={() => { dismiss(); nav("/pos"); }}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all touch-target"
          >
            <Receipt className="h-4 w-4" aria-hidden="true" />
            {t("Record your first sale")}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

export default WelcomeCompleted;
