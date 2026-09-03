import { AnimatePresence, motion } from "motion/react";
import { Calendar as CalendarIcon, CheckCircle2, ChevronRight, Clock, MoreVertical, Plus, Scissors, User, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { ScreenState } from "../../shared/components/ScreenState";
import { formatSalonDate, formatSalonWeekdayLong } from "../../shared/dateTime";
import { AppointmentStatus } from "../../domain/entities";
import {
  Appt,
  SLOT_MINS,
  fmtDayHeader,
  fmtTime,
  paymentStateLabel,
  startOfDay,
  statusClass,
} from "./helpers";

interface Props {
  mode: "day" | "week";
  days: Date[];
  apptsByDay: Map<string, Appt[]>;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void | Promise<void>;
  slots: number[];
  slotToDate: (day: Date, slotIdx: number) => Date;
  onNewAppointment: (date?: Date) => void;
  onOpenAppointment: (appt: Appt) => void;
  isRtl: boolean;
}

export function AppointmentsSchedule({
  mode,
  days,
  apptsByDay,
  loading,
  loadError,
  onRetry,
  slots,
  slotToDate,
  onNewAppointment,
  onOpenAppointment,
  isRtl,
}: Props) {
  const { t, i18n } = useTranslation();
  const visibleCount = Array.from(apptsByDay.values()).flat().length;

  const state = loading ? "loading" : loadError ? "error" : visibleCount === 0 ? "empty" : null;
  const statePanel = state ? (
    <ScreenState
      state={state}
      icon={state === "empty" ? <CalendarIcon className="h-6 w-6" /> : undefined}
      title={state === "loading" ? t("Loading appointments...") : state === "error" ? t("Failed to load appointments") : t("No Appointments")}
      description={state === "error" ? t("Something went wrong while loading. Try again.") : state === "empty" ? t("Book an appointment to get started") : undefined}
      actionLabel={state === "error" ? "Retry" : state === "empty" ? "New Appointment" : undefined}
      onAction={state === "error" ? onRetry : state === "empty" ? () => onNewAppointment() : undefined}
      errorDetail={state === "error" ? loadError ?? undefined : undefined}
      compact
    />
  ) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-0">
      <div className="hidden lg:block overflow-hidden rounded-[3rem] border border-border bg-card shadow-2xl">
        {statePanel ? (
          <div className="min-h-[400px]">{statePanel}</div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[1200px]">
              <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: `120px repeat(${days.length}, 1fr)` }}>
                <div className="p-8 flex items-center justify-center"><Clock className="h-6 w-6 text-muted-foreground/40" /></div>
                {days.map((day) => (
                  <div key={day.toISOString()} className="border-r border-border/50 p-8 text-center space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{formatSalonWeekdayLong(day, i18n.language)}</div>
                    <div className="text-2xl font-bold text-foreground">{formatSalonDate(day, i18n.language)}</div>
                  </div>
                ))}
              </div>

              <div className="max-h-[75vh] overflow-y-auto overflow-x-hidden relative scrollbar-hide">
                <div className="grid" style={{ gridTemplateColumns: `120px repeat(${days.length}, 1fr)`, gridTemplateRows: `repeat(${slots.length}, 80px)` }}>
                  {slots.map((slotIdx) => {
                    const time = slotToDate(days[0], slotIdx);
                    return (
                      <div key={`time-${slotIdx}`} className="flex items-start justify-center border-b border-border/30 py-4 text-xs font-bold text-muted-foreground/60">
                        {time.getMinutes() === 0 ? fmtTime(time) : ""}
                      </div>
                    );
                  })}

                  {days.map((day) => {
                    const dayKey = startOfDay(day).toISOString();
                    const dayAppts = apptsByDay.get(dayKey) ?? [];
                    return (
                      <div key={dayKey} className="relative border-r border-border/30 group/day">
                        {slots.map((slotIdx) => (
                          <button
                            key={`${dayKey}-${slotIdx}`}
                            onClick={() => onNewAppointment(slotToDate(day, slotIdx))}
                            className="h-[80px] w-full border-b border-border/30 transition-all hover:bg-primary/[0.02] flex items-center justify-center group/slot"
                          >
                            <Plus className="h-4 w-4 text-primary opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                          </button>
                        ))}

                        <div className="pointer-events-none absolute inset-0 p-2">
                          <AnimatePresence>
                            {dayAppts.map((appt) => {
                              const dateTime = new Date(appt.dateTime);
                              const minutes = dateTime.getHours() * 60 + dateTime.getMinutes();
                              const row = minutes / SLOT_MINS;
                              const span = (appt.service?.durationMins ?? 30) / SLOT_MINS;
                              return (
                                <motion.button
                                  type="button"
                                  layoutId={appt.id}
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  key={appt.id}
                                  style={{ position: "absolute", top: row * 80 + 8, right: 8, left: 8, height: span * 80 - 16 }}
                                  className={clsx("pointer-events-auto flex flex-col justify-between rounded-[1.5rem] border p-4 shadow-lg transition-all hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer group/appt text-start", statusClass(appt.status))}
                                  onClick={(event) => { event.stopPropagation(); onOpenAppointment(appt); }}
                                >
                                  <div className="space-y-1.5 min-w-0 w-full">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="truncate text-sm font-bold leading-tight">{appt.customer?.name}</div>
                                      <MoreVertical className="h-4 w-4 opacity-0 group-hover/appt:opacity-100 transition-opacity shrink-0" />
                                    </div>
                                    <div className="truncate text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                                      <Scissors className="h-3 w-3" />{appt.service?.name}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] font-bold mt-2 w-full">
                                    <div className="flex items-center gap-2 bg-white/20 px-2 py-1 rounded-lg"><Clock className="h-3 w-3" /><span>{fmtTime(dateTime)}</span></div>
                                    <span className="rounded-lg bg-white/20 px-2 py-1">{t(appt.status)}</span>
                                    <span className="rounded-lg bg-muted/60 px-2 py-1">{paymentStateLabel(appt, t)}</span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="lg:hidden space-y-4">
        {statePanel ? (
          <div className="rounded-2xl border border-border bg-card/50">{statePanel}</div>
        ) : (
          days.filter((day) => {
            if (mode === "day" || (typeof window !== "undefined" && window.innerWidth >= 1024)) return true;
            const key = startOfDay(day).toISOString();
            return startOfDay(new Date()).toISOString() === key || (apptsByDay.get(key)?.length ?? 0) > 0;
          }).map((day) => {
            const dayKey = startOfDay(day).toISOString();
            const dayAppts = [...(apptsByDay.get(dayKey) ?? [])].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
            const isToday = startOfDay(new Date()).toISOString() === dayKey;
            return (
              <div key={`mobile-${dayKey}`} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className={clsx("font-bold uppercase tracking-wider", isToday ? "text-primary text-sm" : "text-muted-foreground text-xs")}>{fmtDayHeader(day)}</h3>
                    {isToday && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">{t("Today")}</span>}
                  </div>
                  <button onClick={() => onNewAppointment(slotToDate(day, 18))} className="h-10 px-3 text-xs font-bold text-primary flex items-center gap-1.5 hover:bg-primary/10 rounded-lg transition-all">
                    <Plus className="h-4 w-4" /><span className="hidden sm:inline">{t("Add")}</span>
                  </button>
                </div>

                {dayAppts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-6 text-center"><p className="text-xs font-bold text-muted-foreground">{t("No appointments for this day")}</p></div>
                ) : (
                  <div className={isToday ? "relative" : "space-y-2"}>
                    {dayAppts.map((appt, index) => {
                      const dateTime = new Date(appt.dateTime);
                      if (!isToday) {
                        return (
                          <motion.button key={`m-${appt.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => onOpenAppointment(appt)} className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 text-start shadow-sm hover:shadow-md hover:border-primary/30 transition-all touch-target">
                            <div className={clsx("h-10 w-14 rounded-lg flex items-center justify-center text-xs font-bold", statusClass(appt.status))}>{fmtTime(dateTime)}</div>
                            <div className="flex-1 min-w-0"><p className="font-bold text-foreground truncate">{appt.customer?.name}</p><p className="text-[10px] text-muted-foreground truncate">{appt.service?.name}</p></div>
                            <ChevronRight className={clsx("h-4 w-4 text-muted-foreground shrink-0", isRtl && "rotate-180")} />
                          </motion.button>
                        );
                      }

                      return (
                        <div key={`m-${appt.id}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={clsx("h-10 w-10 rounded-xl flex items-center justify-center text-[10px] font-bold shadow-sm z-10", statusClass(appt.status))}>
                              {appt.status === AppointmentStatus.SCHEDULED ? <Clock className="h-4 w-4" /> : appt.status === AppointmentStatus.COMPLETED ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>
                            {index < dayAppts.length - 1 && <div className="w-0.5 flex-1 bg-border/50 my-1" />}
                          </div>
                          <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: index * 0.05 } }} onClick={() => onOpenAppointment(appt)} className="flex-1 min-h-[72px] bg-card border border-border rounded-xl p-3 mb-3 text-start shadow-sm hover:shadow-md hover:border-primary/30 transition-all touch-target">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1"><p className="font-bold text-foreground truncate">{appt.customer?.name}</p><p className="text-[10px] text-muted-foreground truncate">{appt.service?.name}</p></div>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <span className={clsx("px-2 py-1 rounded-lg text-[9px] font-bold shrink-0", statusClass(appt.status))}>{t(appt.status)}</span>
                                <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[9px] font-bold shrink-0">{paymentStateLabel(appt, t)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" />{fmtTime(dateTime)}</span>
                              <span className="flex items-center gap-1 min-w-0 truncate"><User className="h-3 w-3 text-primary shrink-0" />{appt.employee?.name || "—"}</span>
                              <span className="ms-auto shrink-0 text-[9px] font-bold text-primary">{appt.status === AppointmentStatus.SCHEDULED ? t("Next: Check in") : t("Open appointment")}</span>
                            </div>
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
