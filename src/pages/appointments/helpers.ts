import i18n from "i18next";
import { formatSalonDayHeader, formatSalonTime } from "../../shared/dateTime";
import { visitStageI18nKey, visitActionI18nKey } from "../../shared/visitStage";
import { AppointmentStatus, Appointment, VisitStage } from "../../domain/entities";

/** Page-local shapes for the appointment calendar surface. */
export type Customer = { id: string; name: string; phone: string | null };
export type Service = { id: string; name: string; category: string; durationMins: number; price: number };
export type Employee = { id: string; name: string };

export type Appt = Appointment & {
  customer: Customer;
  employee: Employee;
  service: Service;
};

/** Calendar slot granularity shared by the day and week grids. */
export const SLOT_MINS = 30;

export function visitStageLabel(stage: VisitStage, t: (k: string) => string): string {
  return t(visitStageI18nKey(stage));
}

/** i18n label for the primary advance action from a stage. */
export function visitActionLabel(stage: VisitStage, t: (k: string) => string): string {
  return t(visitActionI18nKey(stage));
}

export function mapService(s: any): Service {
  return {
    id: s.id || "",
    name: s.name || "",
    category: s.category || s.categoryId || "",
    durationMins: s.durationMins || s.durationMinutes || 30,
    price: s.price || 0,
  };
}

export function mapEmployee(e: any): Employee {
  return {
    id: e.id || "",
    name: e.name || "",
  };
}

export function mapCustomer(c: any): Customer {
  return {
    id: c.id || "",
    name: c.name || "",
    phone: c.phone || null,
  };
}

export function mapAppt(a: any): Appt {
  const service = mapService(a.service || {});
  if (Number.isInteger(a.durationMinutesSnapshot) && a.durationMinutesSnapshot > 0) {
    service.durationMins = a.durationMinutesSnapshot;
  }
  return {
    ...a,
    customer: mapCustomer(a.customer || {}),
    employee: mapEmployee(a.employee || {}),
    service,
  };
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 1) % 7;
  return addDays(x, -diff);
}

export function fmtDayHeader(d: Date) {
  return formatSalonDayHeader(d, i18n.language);
}

export function fmtTime(d: Date) {
  return formatSalonTime(d, i18n.language);
}

export function statusClass(s: AppointmentStatus | string) {
  switch (s) {
    case AppointmentStatus.SCHEDULED: return "bg-warning/10 text-warning border-warning/20";
    case "CONFIRMED": return "bg-info/10 text-info border-info/20";
    case AppointmentStatus.COMPLETED: return "bg-success/10 text-success border-success/20";
    case AppointmentStatus.CANCELLED: return "bg-destructive/10 text-destructive border-destructive/20";
    case AppointmentStatus.NO_SHOW: return "bg-warning/10 text-warning border-warning/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function paymentStateLabel(appt: Appt, t: (key: string) => string) {
  // The current appointment contract has no paid/unpaid field. Keep the
  // distinction explicit and truthful instead of guessing from a deposit.
  return (appt.depositAmount ?? 0) > 0
    ? t("Deposit configured")
    : t("Payment at checkout");
}
