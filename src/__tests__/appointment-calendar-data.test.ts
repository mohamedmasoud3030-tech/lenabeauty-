import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mapAppointment } from "../infrastructure/supabase/mappers";

describe("appointment calendar data", () => {
  it("maps the joined customer, employee, service, and duration snapshot", () => {
    const appointment = mapAppointment({
      id: "appointment-1",
      customer_id: "customer-1",
      employee_id: "employee-1",
      service_id: "service-1",
      date_time: "2026-08-11T06:00:00.000Z",
      duration_minutes_snapshot: 60,
      status: "SCHEDULED",
      created_at: "2026-08-10T10:00:00.000Z",
      updated_at: "2026-08-10T10:00:00.000Z",
      customers: { id: "customer-1", name: "أمل", phone: "90000000" },
      employees: { id: "employee-1", name: "سارة" },
      services: {
        id: "service-1",
        name: "قص الشعر",
        category_id: "category-1",
        price: "8.000",
        duration_minutes: 90,
      },
    });

    expect(appointment.durationMinutesSnapshot).toBe(60);
    expect(appointment.customer).toEqual({ id: "customer-1", name: "أمل", phone: "90000000" });
    expect(appointment.employee).toEqual({ id: "employee-1", name: "سارة" });
    expect(appointment.service).toMatchObject({
      id: "service-1",
      name: "قص الشعر",
      price: 8,
      durationMinutes: 90,
    });
  });

  it("requests calendar relations and treats its upper instant as exclusive", () => {
    const adapter = readFileSync(
      resolve(process.cwd(), "src/infrastructure/supabase/repositories/appointments.ts"),
      "utf8",
    );

    expect(adapter).toContain("customers (id, name, phone)");
    expect(adapter).toContain("employees (id, name)");
    expect(adapter).toContain("services (id, name, category_id, price, duration_minutes)");
    expect(adapter).toContain(".lt('date_time', range.toISO)");
    expect(adapter).not.toContain(".lte('date_time', range.toISO)");
  });
});
