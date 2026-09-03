import { Activity, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { AppointmentReportRow } from "../../application/dto";
import { ScreenState } from "../../shared/components/ScreenState";

interface AppointmentsReportSectionProps {
  data: AppointmentReportRow[];
  error: string | null;
  onRetry: () => void;
  onBookAppointment: () => void;
  t: (key: string) => string;
}

export function AppointmentsReportSection({ data, error, onRetry, onBookAppointment, t }: AppointmentsReportSectionProps) {
  if (error) {
    return <ScreenState state="error" title={error === "BACKEND_METHOD_UNSUPPORTED" ? t("Appointments report requires backend") : t("Failed to load appointments report")} description={error === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : t("Something went wrong while loading. Try again.")} actionLabel={t("Retry")} onAction={onRetry} errorDetail={error === "BACKEND_METHOD_UNSUPPORTED" ? undefined : error} />;
  }
  if (data.length === 0) {
    return <ScreenState state="empty" icon={<Calendar className="h-6 w-6" />} title={t("No Appointments Data")} description={t("Book appointments to see analytics")} actionLabel={t("Book Appointment")} onAction={onBookAppointment} />;
  }

  const statusCounts = data.reduce<Record<string, number>>((acc, row) => {
    const status = (row.status || "SCHEDULED").toUpperCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const completed = statusCounts.COMPLETED || 0;
  const scheduled = statusCounts.SCHEDULED || 0;
  const cancelled = statusCounts.CANCELLED || 0;
  const noShow = statusCounts.NO_SHOW || 0;
  const completionRate = data.length ? Math.round((completed / data.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("Total"), data.length, <Activity className="h-5 w-5" />],
          [t("Completed"), completed, <CheckCircle2 className="h-5 w-5" />],
          [t("Scheduled"), scheduled, <Clock className="h-5 w-5" />],
          [t("Canceled"), cancelled, <XCircle className="h-5 w-5" />],
        ].map(([label, value, icon]) => <div key={String(label)} className="rounded-2xl border border-border bg-card/50 p-5 shadow-sm"><div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">{icon}</div><p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p><p className="text-3xl font-bold mt-1">{value}</p></div>)}
      </div>
      <section className="rounded-3xl border border-border bg-card/50 p-5 sm:p-7 shadow-xl">
        <h3 className="font-bold">{t("Appointment Status Distribution")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("Completion rate")}: {completionRate}%</p>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-success/10 p-3"><p className="text-[10px] font-bold text-muted-foreground">{t("Completed")}</p><p className="text-xl font-bold text-success">{completed}</p></div>
          <div className="rounded-xl bg-warning/10 p-3"><p className="text-[10px] font-bold text-muted-foreground">{t("Scheduled")}</p><p className="text-xl font-bold text-warning">{scheduled}</p></div>
          <div className="rounded-xl bg-destructive/10 p-3"><p className="text-[10px] font-bold text-muted-foreground">{t("Canceled")}</p><p className="text-xl font-bold text-destructive">{cancelled}</p></div>
          <div className="rounded-xl bg-primary/10 p-3"><p className="text-[10px] font-bold text-muted-foreground">{t("No-show")}</p><p className="text-xl font-bold text-primary">{noShow}</p></div>
        </div>
      </section>
    </div>
  );
}
