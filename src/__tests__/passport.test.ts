import { describe, expect, it } from "vitest";
import { AppointmentStatus, VisitStage } from "../domain/entities";
import {
  composeBeautyPassport,
  composeVisitTimeline,
} from "../domain/passport";
import type { Appointment, Invoice, ServiceFile } from "../domain/entities";

const appt = (partial: Partial<Appointment>): Appointment => ({
  id: "a1",
  customerId: "c1",
  dateTime: new Date("2026-07-14T12:00:00Z"),
  status: AppointmentStatus.COMPLETED,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...partial,
});

const invoice = (partial: Partial<Invoice>): Invoice => ({
  id: "inv1",
  date: new Date("2026-07-14T13:00:00Z"),
  subtotalAmount: 8,
  totalAmount: 8,
  discount: 0,
  manualDiscount: 0,
  tierDiscount: 0,
  loyaltyDiscount: 0,
  giftCardDiscount: 0,
  entitlementRedemption: 0,
  amountPaid: 8,
  status: "PAID",
  loyaltyPointsUsed: 0,
  paymentMethod: "cash",
  customerId: "c1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...partial,
});

describe("Beauty Passport", () => {
  it("composes a chronological visit timeline from appointments + invoices", () => {
    const files: ServiceFile[] = [
      {
        id: "sf1",
        centerId: "c",
        customerId: "c1",
        appointmentId: "a1",
        title: "Before/after",
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [
          { id: "img1", centerId: "c", serviceFileId: "sf1", imageKind: "BEFORE", imageUrl: "https://x/b.jpg", sortOrder: 0, createdAt: new Date() },
        ],
      },
    ];
    const timeline = composeVisitTimeline({
      appointments: [
        appt({
          id: "a1",
          dateTime: new Date("2026-07-14T12:00:00Z"),
          status: AppointmentStatus.COMPLETED,
          service: { id: "s1", name: "Haircut", categoryId: "c", price: 8, durationMinutes: 30, durationMins: 30 },
          employee: { id: "e1", name: "Mona" },
        }),
        appt({
          id: "a2",
          dateTime: new Date("2026-08-31T12:00:00Z"),
          status: AppointmentStatus.COMPLETED,
          visitStage: VisitStage.READY_FOR_CHECKOUT,
          service: { id: "s2", name: "Hair coloring + cut", categoryId: "c", price: 22, durationMinutes: 60, durationMins: 60 },
        }),
      ],
      invoices: [
        invoice({ id: "inv1", appointmentId: "a1", totalAmount: 8 }),
        invoice({ id: "inv2", appointmentId: "a2", totalAmount: 22 }),
      ],
      serviceFiles: files,
    });
    expect(timeline).toHaveLength(2);
    // Chronological order.
    expect(timeline[0].appointmentId).toBe("a1");
    expect(timeline[1].appointmentId).toBe("a2");
    expect(timeline[1].amount).toBe(22);
    expect(timeline[1].serviceName).toBe("Hair coloring + cut");
    expect(timeline[0].images).toEqual(["https://x/b.jpg"]);
  });

  it("keeps paid invoices that have no appointment reference", () => {
    const timeline = composeVisitTimeline({
      appointments: [],
      invoices: [invoice({ id: "inv-walkin", totalAmount: 5 })],
    });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].invoiceId).toBe("inv-walkin");
  });

  it("summarizes operational facts", () => {
    const passport = composeBeautyPassport({
      appointments: [
        appt({ id: "a1", dateTime: new Date("2026-07-14T12:00:00Z"), status: AppointmentStatus.COMPLETED, service: { id: "s1", name: "Haircut", categoryId: "c", price: 8, durationMinutes: 30, durationMins: 30 }, employee: { id: "e1", name: "Mona" } }),
        appt({ id: "a2", dateTime: new Date("2026-08-31T12:00:00Z"), status: AppointmentStatus.COMPLETED, service: { id: "s1", name: "Haircut", categoryId: "c", price: 8, durationMinutes: 30, durationMins: 30 }, employee: { id: "e1", name: "Mona" } }),
      ],
      invoices: [
        invoice({ id: "inv1", appointmentId: "a1", totalAmount: 8 }),
        invoice({ id: "inv2", appointmentId: "a2", totalAmount: 8 }),
      ],
      lifetimeSpend: 16,
    });
    expect(passport.summary.totalVisits).toBe(2);
    expect(passport.summary.mostUsedServiceName).toBe("Haircut");
    expect(passport.summary.preferredEmployeeName).toBe("Mona");
    expect(passport.summary.averageVisitValue).toBeCloseTo(8, 3);
    expect(passport.summary.lifetimeSpend).toBe(16);
  });
});
