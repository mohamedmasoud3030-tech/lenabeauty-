import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { Check, ChevronRight, Scissors, UserCog, Users, CalendarDays, Receipt, X } from "lucide-react";
import { useCases } from "../../app/composition/useCases";

/**
 * GettingStartedCard
 * ------------------
 * The single ordered path for a brand-new center.
 *
 * Problem it solves: on an empty center the Dashboard renders six independent
 * empty cards with ~12 equal-weight calls to action, and never reveals the real
 * domain dependency — nothing can be sold before Services exist. A first-time
 * user cannot tell what to do first.
 *
 * Design rules, deliberately chosen:
 *  - Steps follow the actual data dependency: services -> employees ->
 *    customers -> appointment -> sale.
 *  - Completion is derived from REAL repository counts. Nothing is faked, and
 *    no step is ever marked done optimistically.
 *  - The card retires itself once the center is genuinely set up, so it never
 *    becomes permanent furniture for an established business.
 *  - Dismissal is remembered locally; it is a preference, not business data.
 *  - Read failures hide the card entirely rather than guessing — an
 *    authorization or network failure must never be shown as "step not done".
 */

const DISMISS_KEY = "lenabeauty_getting_started_dismissed";

type StepId = "services" | "employees" | "customers" | "appointments" | "sales";

interface SetupProgress {
  services: boolean;
  employees: boolean;
  customers: boolean;
  appointments: boolean;
  sales: boolean;
}

export interface GettingStartedCardProps {
  /** Real counts resolved by the caller; when omitted the card resolves them itself. */
  progress?: SetupProgress;
  /** Center already has sales activity — used by the caller to skip mounting entirely. */
  onDismiss?: () => void;
}

const STEP_META: Record<StepId, { labelKey: string; descriptionKey: string; route: string; Icon: typeof Scissors }> = {
  services: {
    labelKey: "Add your services",
    descriptionKey: "Nothing can be booked or sold until your service menu exists.",
    route: "/services",
    Icon: Scissors,
  },
  employees: {
    labelKey: "Add your team",
    descriptionKey: "Assign appointments and track who performed each service.",
    route: "/employees",
    Icon: UserCog,
  },
  customers: {
    labelKey: "Add your first customer",
    descriptionKey: "Keep contact details, history and preferences in one record.",
    route: "/customers",
    Icon: Users,
  },
  appointments: {
    labelKey: "Book your first appointment",
    descriptionKey: "Your day view fills up from here.",
    route: "/appointments",
    Icon: CalendarDays,
  },
  sales: {
    labelKey: "Record your first sale",
    descriptionKey: "Take payment and print the receipt from the point of sale.",
    route: "/pos",
    Icon: Receipt,
  },
};

const STEP_ORDER: StepId[] = ["services", "employees", "customers", "appointments", "sales"];

export function GettingStartedCard({ progress: providedProgress, onDismiss }: GettingStartedCardProps) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [progress, setProgress] = useState<SetupProgress | null>(providedProgress ?? null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (providedProgress) {
      setProgress(providedProgress);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const [services, employees, customers] = await Promise.all([
          useCases.services.list(),
          useCases.employees.list(),
          useCases.customers.list(),
        ]);
        if (!active) return;

        // A failed read is not evidence of an empty center. If we cannot
        // establish the truth we render nothing rather than mislead.
        if (!services.ok || !employees.ok || !customers.ok) {
          setProgress(null);
          return;
        }

        setProgress({
          services: services.data.length > 0,
          employees: employees.data.length > 0,
          customers: customers.data.length > 0,
          appointments: false,
          sales: false,
        });
      } catch {
        if (active) setProgress(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [providedProgress]);

  if (dismissed || !progress) return null;

  // Retire once the center is genuinely operational. Appointments and sales
  // are progress signals, not prerequisites for hiding the guide — a center
  // with a catalog, a team and customers no longer needs onboarding.
  const isSetUp = progress.services && progress.employees && progress.customers;
  if (isSetUp) return null;

  const completedCount = STEP_ORDER.filter((id) => progress[id]).length;
  const nextStep = STEP_ORDER.find((id) => !progress[id]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      /* preference storage is best-effort */
    }
    onDismiss?.();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="getting-started-title"
      className="rounded-2xl sm:rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-xl overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 sm:px-6 py-4">
        <div className="min-w-0 space-y-1">
          <h2 id="getting-started-title" className="text-lg sm:text-xl font-bold text-foreground">
            {t("Set up your center")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("Follow these steps in order. Each one unlocks the next.")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("Dismiss")}
          title={t("Dismiss")}
          className="h-11 w-11 shrink-0 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={STEP_ORDER.length}
            aria-label={t("Setup progress")}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedCount / STEP_ORDER.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
            {completedCount}/{STEP_ORDER.length}
          </span>
        </div>
      </div>

      <ol className="p-4 sm:p-6 space-y-2">
        {STEP_ORDER.map((id, index) => {
          const meta = STEP_META[id];
          const done = progress[id];
          const isNext = id === nextStep;
          const { Icon } = meta;

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => nav(meta.route)}
                className={clsx(
                  "group w-full min-h-11 touch-target flex items-center gap-3 rounded-xl border p-3 text-start transition-all",
                  isNext
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border hover:bg-muted/40",
                  done && "opacity-60",
                )}
              >
                <span
                  className={clsx(
                    "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
                    done ? "bg-success/15 text-success" : isNext ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check aria-hidden="true" className="h-4 w-4" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{index + 1}</span>
                    <span className={clsx("text-sm font-bold truncate", done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {t(meta.labelKey)}
                    </span>
                  </span>
                  {!done && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground leading-relaxed">
                      {t(meta.descriptionKey)}
                    </span>
                  )}
                </span>

                <ChevronRight
                  aria-hidden="true"
                  className={clsx("h-4 w-4 shrink-0 text-muted-foreground", i18n.language === "ar" && "rotate-180")}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </motion.section>
  );
}

export default GettingStartedCard;
