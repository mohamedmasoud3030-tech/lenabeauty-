import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { Check, ChevronRight, Scissors, UserCog, Users, CalendarDays, Receipt, X } from "lucide-react";
import { useCases } from "../../app/composition/useCases";
import { UserRole } from "../../domain/entities/Session";
import { hasActivationEvent, recordActivationEvent } from "../activation/events";

/**
 * GettingStartedCard
 * ------------------
 * The single ordered path for a brand-new center.
 *
 * Steps follow the real data dependency: services → (team) → customers →
 * appointment → sale. ADMIN can create the team; STAFF cannot open /employees,
 * so that step is explained, not linked.
 *
 * Completion uses real repository counts. Failed reads hide the card.
 */

const DISMISS_KEY = "lenabeauty_getting_started_dismissed";

type StepId = "services" | "employees" | "customers" | "appointments" | "sales";

export interface SetupProgress {
  services: boolean;
  employees: boolean;
  customers: boolean;
  appointments: boolean;
  sales: boolean;
}

export interface GettingStartedCardProps {
  progress?: SetupProgress;
  viewerRole?: UserRole;
  onDismiss?: () => void;
}

const STEP_META: Record<StepId, { labelKey: string; descriptionKey: string; route: string | null; Icon: typeof Scissors }> = {
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

const ADMIN_STEPS: StepId[] = ["services", "employees", "customers", "appointments", "sales"];
const STAFF_STEPS: StepId[] = ["services", "employees", "customers", "appointments", "sales"];

function stepsFor(role?: UserRole): StepId[] {
  if (role === UserRole.STAFF || role === UserRole.MANAGER) return STAFF_STEPS;
  return ADMIN_STEPS;
}

export function GettingStartedCard({ progress: providedProgress, viewerRole, onDismiss }: GettingStartedCardProps) {
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
  const shownRecorded = useRef(false);

  const canManageTeam = viewerRole !== UserRole.STAFF && viewerRole !== UserRole.MANAGER;
  const stepOrder = stepsFor(viewerRole);

  useEffect(() => {
    if (providedProgress) {
      setProgress(providedProgress);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const now = new Date();
        const from = new Date(now.getFullYear() - 2, 0, 1);
        const [services, employees, customers, appointments] = await Promise.all([
          useCases.services.list(),
          useCases.employees.list(),
          useCases.customers.list(),
          useCases.appointments.list({ fromISO: from.toISOString(), toISO: now.toISOString() }),
        ]);
        if (!active) return;

        if (!services.ok || !employees.ok || !customers.ok) {
          setProgress(null);
          return;
        }

        setProgress({
          services: services.data.length > 0,
          employees: employees.data.length > 0,
          customers: customers.data.length > 0,
          appointments: appointments.ok && appointments.data.length > 0,
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

  const isSetUp = Boolean(progress?.services && progress.employees && progress.customers);

  useEffect(() => {
    if (!progress || dismissed || isSetUp || shownRecorded.current) return;
    if (!hasActivationEvent("guide_shown")) recordActivationEvent("guide_shown");
    shownRecorded.current = true;
  }, [progress, dismissed, isSetUp]);

  useEffect(() => {
    if (isSetUp && !hasActivationEvent("first_value_reached")) {
      recordActivationEvent("first_value_reached");
    }
  }, [isSetUp]);

  if (dismissed || !progress) return null;
  if (isSetUp) return null;

  const completedCount = stepOrder.filter((id) => progress[id]).length;
  const nextStep = stepOrder.find((id) => !progress[id]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      /* preference storage is best-effort */
    }
    recordActivationEvent("guide_dismissed");
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
            aria-valuemax={stepOrder.length}
            aria-label={t("Setup progress")}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedCount / stepOrder.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
            {completedCount}/{stepOrder.length}
          </span>
        </div>
      </div>

      <ol className="p-4 sm:p-6 space-y-2">
        {stepOrder.map((id, index) => {
          const meta = STEP_META[id];
          const done = progress[id];
          const isNext = id === nextStep;
          const { Icon } = meta;
          const teamBlocked = id === "employees" && !canManageTeam && !done;
          const description = teamBlocked
            ? t("Ask your administrator to add the team. You cannot open staff records.")
            : t(meta.descriptionKey);

          const body = (
            <>
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
                    {description}
                  </span>
                )}
              </span>

              {!teamBlocked && (
                <ChevronRight
                  aria-hidden="true"
                  className={clsx("h-4 w-4 shrink-0 text-muted-foreground", i18n.language === "ar" && "rotate-180")}
                />
              )}
            </>
          );

          return (
            <li key={id}>
              {teamBlocked ? (
                <div
                  className={clsx(
                    "w-full min-h-11 touch-target flex items-center gap-3 rounded-xl border p-3 text-start",
                    isNext ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  {body}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => meta.route && nav(meta.route)}
                  className={clsx(
                    "group w-full min-h-11 touch-target flex items-center gap-3 rounded-xl border p-3 text-start transition-all",
                    isNext
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border hover:bg-muted/40",
                    done && "opacity-60",
                  )}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </motion.section>
  );
}

export default GettingStartedCard;
