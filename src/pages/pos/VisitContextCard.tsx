import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Appointment, VisitStage } from "../../domain/entities";
import { effectiveVisitStage } from "../../domain/visit";
import { visitStageI18nKey } from "../../shared/visitStage";
import { formatSalonDateTime } from "../../shared/dateTime";
import { formatOMRAmount } from "../../shared/money";

/**
 * Visit → POS handoff banner. When POS is opened from an appointment, this
 * shows the live visit context (customer / service / employee / stage /
 * deposit) and the detach action; an unreadable appointment shows the
 * "unavailable" variant instead. A plain walk-in POS renders neither.
 */
export function VisitContextCard({
  appointment,
  error,
  onDetach,
}: {
  appointment: Appointment | null;
  error: string | null;
  onDetach: () => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <>
      {error && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-xs font-bold text-muted-foreground">{t("pos.visitContext.unavailable")}</p>
          </div>
          <button
            onClick={onDetach}
            className="h-9 px-3 rounded-lg bg-card border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all shrink-0 touch-target"
          >
            {t("pos.visitContext.detach")}
          </button>
        </div>
      )}

      {appointment && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("pos.visitContext.title")}</p>
            <p className="text-xs font-bold text-foreground truncate">{formatSalonDateTime(appointment.dateTime, i18n.language)}</p>
          </div>
        </div>
        <button
          onClick={onDetach}
          className="h-9 px-3 rounded-lg bg-card border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all shrink-0 touch-target"
        >
          {t("pos.visitContext.detach")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: t("pos.visitContext.customer"), value: appointment.customer?.name },
          { label: t("pos.visitContext.service"), value: appointment.service?.name },
          { label: t("pos.visitContext.employee"), value: appointment.employee?.name },
          { label: t("pos.visitContext.stage"), value: t(visitStageI18nKey(effectiveVisitStage(appointment) as VisitStage)) },
          ...((appointment.depositAmount ?? 0) > 0
            ? [{ label: t("pos.visitContext.deposit"), value: `${formatOMRAmount(appointment.depositAmount ?? 0)} ${t("OMR")}` }]
            : []),
        ].map((chip) => (
          <span key={chip.label} className="flex items-center gap-1 rounded-lg bg-card border border-border px-2 py-1 text-[10px] font-bold">
            <span className="text-muted-foreground uppercase tracking-wider">{chip.label}</span>
            <span className="text-foreground">{chip.value || "—"}</span>
          </span>
        ))}
        </div>
        </div>
      )}
    </>
  );
}
