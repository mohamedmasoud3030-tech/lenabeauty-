import { Dispatch, SetStateAction, useMemo } from "react";
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, Sparkles, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../shared/components/PageHeader";
import { AppointmentStatus } from "../../domain/entities";
import { Appt, addDays } from "./helpers";

interface Props {
  appts: Appt[];
  mode: "day" | "week";
  setMode: Dispatch<SetStateAction<"day" | "week">>;
  setAnchor: Dispatch<SetStateAction<Date>>;
  statusFilter: "ALL" | AppointmentStatus;
  setStatusFilter: Dispatch<SetStateAction<"ALL" | AppointmentStatus>>;
  onNewAppointment: () => void;
}

export function AppointmentsOverview({
  appts,
  mode,
  setMode,
  setAnchor,
  statusFilter,
  setStatusFilter,
  onNewAppointment,
}: Props) {
  const { t, i18n } = useTranslation();
  const stats = useMemo(() => ({
    total: appts.length,
    scheduled: appts.filter((a) => a.status === AppointmentStatus.SCHEDULED).length,
    completed: appts.filter((a) => a.status === AppointmentStatus.COMPLETED).length,
    cancelled: appts.filter((a) => a.status === AppointmentStatus.CANCELLED).length,
    noShow: appts.filter((a) => a.status === AppointmentStatus.NO_SHOW).length,
    protected: appts.filter((a) => (a.depositAmount ?? 0) > 0 || (a.noShowFeeAmount ?? 0) > 0).length,
  }), [appts]);

  return (
    <>
      <PageHeader
        icon={<CalendarDays className="h-7 w-7 sm:h-8 sm:w-8" />}
        title={t("Appointments")}
        subtitle={t("Manage your spa schedule")}
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2 bg-muted/50 p-1.5 rounded-[1.5rem] border border-border shadow-inner w-full justify-center sm:justify-start">
              <button
                onClick={() => setAnchor(new Date())}
                className="min-h-11 px-4 sm:px-5 py-2.5 text-xs font-bold text-foreground hover:bg-card rounded-xl transition-all shadow-sm"
              >
                {t("Today")}
              </button>
              <div className="flex items-center border-x border-border/50 px-1 sm:px-2 gap-1 sm:gap-2">
                <button
                  onClick={() => setAnchor((d) => mode === "day" ? addDays(d, -1) : addDays(d, -7))}
                  className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                  title={t("Previous")}
                >
                  {i18n.language === "ar" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => setAnchor((d) => mode === "day" ? addDays(d, 1) : addDays(d, 7))}
                  className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                  title={t("Next")}
                >
                  {i18n.language === "ar" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMode("day")}
                  className={clsx(
                    "min-h-11 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                    mode === "day" ? "bg-card text-primary shadow-md" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("Day")}
                </button>
                <button
                  onClick={() => setMode("week")}
                  className={clsx(
                    "min-h-11 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                    mode === "week" ? "bg-card text-primary shadow-md" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("Week")}
                </button>
              </div>
            </div>
            <button
              onClick={onNewAppointment}
              className="h-13 min-h-[52px] px-6 sm:px-8 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
              {t("New Appointment")}
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { id: "ALL", label: t("All") },
          { id: AppointmentStatus.SCHEDULED, label: t("Upcoming") },
          { id: AppointmentStatus.COMPLETED, label: t("Completed") },
          { id: AppointmentStatus.CANCELLED, label: t("Canceled") },
          { id: AppointmentStatus.NO_SHOW, label: t("No-show") },
        ] as { id: "ALL" | AppointmentStatus; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className={clsx(
              "min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
              statusFilter === id
                ? "bg-primary text-primary-foreground border-primary/20 shadow-md"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:overflow-visible sm:pb-0 sm:gap-4">
        {[
          { label: t("Total"), value: stats.total, color: "text-primary", bg: "bg-primary/10", icon: CalendarDays },
          { label: t("Scheduled"), value: stats.scheduled, color: "text-warning", bg: "bg-warning/10", icon: Clock },
          { label: t("Completed"), value: stats.completed, color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
          { label: t("No-Show"), value: stats.noShow, color: "text-warning", bg: "bg-warning/10", icon: Bell },
          { label: t("Protected Appointments"), value: stats.protected, color: "text-info", bg: "bg-info/10", icon: Sparkles },
          { label: t("Cancelled"), value: stats.cancelled, color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
        ].map(({ label, value, color, bg, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="min-w-[132px] shrink-0 sm:min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
