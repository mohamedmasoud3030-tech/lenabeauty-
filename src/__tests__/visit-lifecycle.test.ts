import { describe, expect, it } from "vitest";
import { AppointmentStatus, VisitStage } from "../domain/entities";
import {
  allowedVisitStages,
  buildVisitContext,
  canTransitionVisit,
  effectiveVisitStage,
  primaryVisitAction,
} from "../domain/visit";
import type { Appointment } from "../domain/entities";

function appt(status: AppointmentStatus, visitStage?: VisitStage): Pick<Appointment, "status" | "visitStage"> {
  return { status, visitStage };
}

describe("Visit lifecycle", () => {
  it("derives the effective stage from status + visit stage", () => {
    expect(effectiveVisitStage(appt(AppointmentStatus.SCHEDULED))).toBe(VisitStage.BOOKED);
    expect(effectiveVisitStage(appt(AppointmentStatus.SCHEDULED, VisitStage.ARRIVED))).toBe(VisitStage.ARRIVED);
    expect(effectiveVisitStage(appt(AppointmentStatus.COMPLETED, VisitStage.READY_FOR_CHECKOUT))).toBe(AppointmentStatus.COMPLETED);
    expect(effectiveVisitStage(appt(AppointmentStatus.CANCELLED))).toBe(AppointmentStatus.CANCELLED);
    expect(effectiveVisitStage(appt(AppointmentStatus.NO_SHOW))).toBe(AppointmentStatus.NO_SHOW);
  });

  it("booked → arrived, arrived → in service, in service → ready for checkout", () => {
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.BOOKED), VisitStage.ARRIVED)).toBe(true);
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.ARRIVED), VisitStage.IN_SERVICE)).toBe(true);
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.IN_SERVICE), VisitStage.READY_FOR_CHECKOUT)).toBe(true);
  });

  it("allows confirm from booked but not skipping stages", () => {
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.BOOKED), VisitStage.CONFIRMED)).toBe(true);
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.BOOKED), VisitStage.IN_SERVICE)).toBe(false);
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.ARRIVED), VisitStage.READY_FOR_CHECKOUT)).toBe(false);
  });

  it("a finished visit can be reopened to add another service", () => {
    expect(canTransitionVisit(appt(AppointmentStatus.SCHEDULED, VisitStage.READY_FOR_CHECKOUT), VisitStage.IN_SERVICE)).toBe(true);
  });

  it("terminal appointments have no further transitions", () => {
    for (const status of [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]) {
      expect(allowedVisitStages(appt(status, VisitStage.IN_SERVICE))).toEqual([]);
    }
  });

  it("primary action follows state", () => {
    expect(primaryVisitAction(appt(AppointmentStatus.SCHEDULED, VisitStage.BOOKED))?.nextStage).toBe(VisitStage.ARRIVED);
    expect(primaryVisitAction(appt(AppointmentStatus.SCHEDULED, VisitStage.ARRIVED))?.nextStage).toBe(VisitStage.IN_SERVICE);
    expect(primaryVisitAction(appt(AppointmentStatus.SCHEDULED, VisitStage.IN_SERVICE))?.nextStage).toBe(VisitStage.READY_FOR_CHECKOUT);
    expect(primaryVisitAction(appt(AppointmentStatus.SCHEDULED, VisitStage.READY_FOR_CHECKOUT))?.checkout).toBe(true);
    expect(primaryVisitAction(appt(AppointmentStatus.COMPLETED))?.labelKey).toBe("visit.action.rebook");
  });

  it("builds the checkout visit context without losing the booking reference", () => {
    const a: Appointment = {
      id: "appt-1",
      customerId: "cust-1",
      employeeId: "emp-1",
      serviceId: "svc-1",
      dateTime: new Date("2026-09-01T10:00:00Z"),
      status: AppointmentStatus.SCHEDULED,
      visitStage: VisitStage.READY_FOR_CHECKOUT,
      depositAmount: 5,
      customer: { id: "cust-1", name: "Sara" },
      employee: { id: "emp-1", name: "Mona" },
      service: { id: "svc-1", name: "Hair coloring", categoryId: "c", price: 22, durationMinutes: 60, durationMins: 60 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ctx = buildVisitContext(a);
    expect(ctx?.appointmentId).toBe("appt-1");
    expect(ctx?.customerId).toBe("cust-1");
    expect(ctx?.employeeId).toBe("emp-1");
    expect(ctx?.serviceId).toBe("svc-1");
    expect(ctx?.depositAmount).toBe(5);
    expect(ctx?.stage).toBe(VisitStage.READY_FOR_CHECKOUT);
  });
});
