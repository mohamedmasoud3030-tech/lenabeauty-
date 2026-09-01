import { Appointment, AppointmentStatus, VisitStage } from "./entities";

/**
 * Visit lifecycle — the operational model layered on top of the scheduling
 * contract (`appointments.status`).
 *
 * Appointments stay the scheduling source. The visit lifecycle refines a
 * SCHEDULED appointment with the operational stages a salon actually works
 * through: BOOKED → CONFIRMED → ARRIVED → IN_SERVICE → READY_FOR_CHECKOUT,
 * then terminal payment (COMPLETED) or cancellation/no-show.
 *
 * This module is pure and framework-free. The same transitions are enforced
 * server-side by `transition_visit_v1`; the client copy exists so the UI can
 * disable impossible actions before transport and stay deterministic.
 */

/** The unified lifecycle: an operational stage or a terminal appointment state. */
export type UnifiedVisitStage =
  | VisitStage
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

/** Terminal appointment states never carry an operational stage. */
export function isTerminalVisitStatus(
  status: AppointmentStatus | string,
): status is "COMPLETED" | "CANCELLED" | "NO_SHOW" {
  return (
    status === AppointmentStatus.COMPLETED ||
    status === AppointmentStatus.CANCELLED ||
    status === AppointmentStatus.NO_SHOW
  );
}

/**
 * The single effective stage for an appointment. A SCHEDULED appointment uses
 * its recorded stage (defaulting to BOOKED for pre-lifecycle rows); terminal
 * states surface as their status.
 */
export function effectiveVisitStage(
  appointment: Pick<Appointment, "status" | "visitStage">,
): UnifiedVisitStage {
  if (appointment.status === AppointmentStatus.COMPLETED) return AppointmentStatus.COMPLETED;
  if (appointment.status === AppointmentStatus.CANCELLED) return AppointmentStatus.CANCELLED;
  if (appointment.status === AppointmentStatus.NO_SHOW) return AppointmentStatus.NO_SHOW;
  return appointment.visitStage ?? VisitStage.BOOKED;
}

/**
 * Stage transitions the operator may perform. Forward motion only, with two
 * deliberate exceptions matching the salon workflow:
 *   - BOOKED → ARRIVED: the operator may mark arrival directly (confirm is
 *     optional in practice).
 *   - READY_FOR_CHECKOUT → IN_SERVICE: a finished visit may be reopened to add
 *     another service before checkout.
 */
const STAGE_TRANSITIONS: Record<VisitStage, VisitStage[]> = {
  [VisitStage.BOOKED]: [VisitStage.CONFIRMED, VisitStage.ARRIVED],
  [VisitStage.CONFIRMED]: [VisitStage.ARRIVED],
  [VisitStage.ARRIVED]: [VisitStage.IN_SERVICE],
  [VisitStage.IN_SERVICE]: [VisitStage.READY_FOR_CHECKOUT],
  [VisitStage.READY_FOR_CHECKOUT]: [VisitStage.IN_SERVICE],
};

/** Stages the operator can move to from a given operational stage. */
export function allowedVisitStages(
  appointment: Pick<Appointment, "status" | "visitStage">,
): VisitStage[] {
  if (appointment.status !== AppointmentStatus.SCHEDULED) return [];
  const current = appointment.visitStage ?? VisitStage.BOOKED;
  return STAGE_TRANSITIONS[current] ?? [];
}

/** True when moving `nextStage` from the appointment is a legal visit transition. */
export function canTransitionVisit(
  appointment: Pick<Appointment, "status" | "visitStage">,
  nextStage: VisitStage,
): boolean {
  return allowedVisitStages(appointment).includes(nextStage);
}

export interface VisitPrimaryAction {
  /** i18n key for the primary operator action. */
  labelKey: string;
  /** Stage the action moves the visit to (undefined for terminal actions). */
  nextStage?: VisitStage;
  /** Terminal status the action applies (COMPLETED via checkout, CANCELLED, NO_SHOW). */
  nextStatus?: AppointmentStatus;
  /** Whether the action hands off to the POS checkout with visit context. */
  checkout?: boolean;
}

/**
 * The single primary action for an appointment, keyed to its current stage.
 * This drives "primary action changes by state" instead of a wall of buttons.
 */
export function primaryVisitAction(
  appointment: Pick<Appointment, "status" | "visitStage">,
): VisitPrimaryAction | null {
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return { labelKey: "visit.action.rebook", checkout: false };
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return { labelKey: "visit.action.rebook", checkout: false };
  }
  if (appointment.status === AppointmentStatus.NO_SHOW) {
    return { labelKey: "visit.action.rebook", checkout: false };
  }
  const stage = appointment.visitStage ?? VisitStage.BOOKED;
  switch (stage) {
    case VisitStage.BOOKED:
      return { labelKey: "visit.action.arrived", nextStage: VisitStage.ARRIVED };
    case VisitStage.CONFIRMED:
      return { labelKey: "visit.action.arrived", nextStage: VisitStage.ARRIVED };
    case VisitStage.ARRIVED:
      return { labelKey: "visit.action.start", nextStage: VisitStage.IN_SERVICE };
    case VisitStage.IN_SERVICE:
      return { labelKey: "visit.action.finish", nextStage: VisitStage.READY_FOR_CHECKOUT };
    case VisitStage.READY_FOR_CHECKOUT:
      return { labelKey: "visit.action.checkout", checkout: true };
    default:
      return null;
  }
}

/**
 * The visit context contract handed to checkout so the operator never re-enters
 * what the booking already knows. Pure projection of a single appointment.
 */
export interface VisitContext {
  appointmentId: string;
  customerId: string;
  employeeId?: string;
  serviceId?: string;
  startedAt?: Date;
  completedAt?: Date;
  stage: UnifiedVisitStage;
  depositAmount: number;
  notes?: string;
  customerName?: string;
  serviceName?: string;
  employeeName?: string;
}

export function buildVisitContext(
  appointment: Appointment,
): VisitContext | null {
  if (!appointment?.id || !appointment?.customerId) return null;
  return {
    appointmentId: appointment.id,
    customerId: appointment.customerId,
    employeeId: appointment.employeeId,
    serviceId: appointment.serviceId,
    startedAt: appointment.startedAt,
    completedAt: appointment.completedAt,
    stage: effectiveVisitStage(appointment),
    depositAmount: Number(appointment.depositAmount ?? 0),
    notes: appointment.notes,
    customerName: appointment.customer?.name,
    serviceName: appointment.service?.name,
    employeeName: appointment.employee?.name,
  };
}
