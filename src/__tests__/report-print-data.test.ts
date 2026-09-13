import { describe, expect, it } from "vitest";
import type { AppointmentReportRow, InventoryReportRow, SalesReportRow } from "../application/dto";
import {
  buildAppointmentsPrintModel,
  buildInventoryPrintModel,
  buildReportCsv,
  buildSalesPrintModel,
} from "../pages/reports/reportPrint";

// Identity translator: labels become the raw keys, so assertions pin the
// structure and the (real) numbers without depending on the dictionary.
const t = (key: string) => key;
const formatDay = (date: string) => date;

const sales: SalesReportRow[] = [
  {
    date: "2026-09-12T10:00:00", id: "i1", totalAmount: 100, discount: 10, customer: "A",
    items: [{ id: "s1", name: "صبغ", type: "service", price: 50, qty: 2 }],
    prepaidAmount: 0, redeemedAmount: 0, earnedRevenue: 95,
  },
  {
    date: "2026-09-12T11:00:00", id: "i2", totalAmount: 50, discount: 0,
    items: [{ id: "s2", name: "سويت", type: "service", price: 25, qty: 2 }],
    prepaidAmount: 0, redeemedAmount: 0, earnedRevenue: 50,
  },
  {
    date: "2026-09-13T09:00:00", id: "i3", totalAmount: 120, discount: 20, customer: "A, B",
    items: [
      { id: "s1", name: "صبغ", type: "service", price: 50, qty: 2 },
      { id: "s3", name: "ماسك", type: "product", price: 60, qty: 1 },
    ],
    prepaidAmount: 30, redeemedAmount: 0, earnedRevenue: 90,
  },
];

const appointments: AppointmentReportRow[] = [
  { dateTime: "2026-09-12T09:00:00", id: "a1", status: "COMPLETED", customer: { name: "ن" }, service: { name: "صبغ" }, employee: { name: "أمل" } },
  { dateTime: "2026-09-12T10:00:00", id: "a2", status: "COMPLETED", employee: { name: "أمل" } },
  { dateTime: "2026-09-12T11:00:00", id: "a3", status: "CANCELLED", employee: { name: "سارة" } },
  { dateTime: "2026-09-13T09:00:00", id: "a4", status: "COMPLETED", employee: { name: "سارة" } },
  { dateTime: "2026-09-13T10:00:00", id: "a5", status: "NO_SHOW", employee: { name: "أمل" } },
  { dateTime: "2026-09-13T11:00:00", id: "a6", status: "SCHEDULED", employee: { name: "سارة" } },
];

const inventory: InventoryReportRow[] = [
  { id: "p1", name: "صبغة Kerasys", cost: 10, price: 20, stockQuantity: 5, reorderLevel: 3 },
  { id: "p2", name: "ماسك", cost: 2, price: 5, stockQuantity: 1, reorderLevel: 5 },
];

describe("sales print model", () => {
  it("aggregates KPIs exactly like the on-screen section", () => {
    const model = buildSalesPrintModel(sales, t, formatDay, "period");
    expect(model.title).toBe("Sales Report");
    const kpis = Object.fromEntries(model.kpis.map((k) => [k.label, k.value]));
    expect(kpis["Total Revenue"]).toBe("270.000");
    expect(kpis["Total Transactions"]).toBe("3");
    expect(kpis["Average Ticket"]).toBe("90.000");
    // 2026-09-12 (100 + 50) beats 2026-09-13 (120).
    expect(kpis["Peak Day"]).toBe("150.000");
    expect(model.kpis.find((k) => k.label === "Peak Day")?.sub).toBe("2026-09-12");
  });

  it("groups daily performance and totals the footer row", () => {
    const model = buildSalesPrintModel(sales, t, formatDay, "period");
    const daily = model.tables?.[0];
    expect(daily?.heading).toBe("Daily Performance");
    expect(daily?.rows).toHaveLength(2);
    expect(daily?.rows[0]).toEqual([
      { text: "2026-09-12" },
      { text: "2", align: "end" },
      { text: "150.000", align: "end" },
      { text: "10.000", align: "end" },
    ]);
    expect(daily?.footerRow?.[2]).toMatchObject({ text: "270.000" });
  });

  it("ranks top services by earned amount and keeps financial facts consistent", () => {
    const model = buildSalesPrintModel(sales, t, formatDay, "period");
    expect(model.lists?.[0].items.map((i) => i.label)).toEqual(["صبغ", "ماسك", "سويت"]);
    expect(model.lists?.[0].items[0].value).toContain("200.000");
    const facts = Object.fromEntries(
      (model.tables?.[1].rows ?? []).map((row) => [row[0].text, row[1].text]),
    );
    expect(facts["Cash Collected"]).toBe("270.000");
    expect(facts["Earned Service Revenue"]).toBe("235.000");
    expect(facts["Prepaid Sales (Period)"]).toBe("30.000");
    expect(facts["Entitlement Redemptions"]).toBe("0.000");
  });
});

describe("appointments print model", () => {
  it("computes attendance from the same status rules as the screen", () => {
    const model = buildAppointmentsPrintModel(appointments, t, formatDay, "period");
    const kpis = Object.fromEntries(model.kpis.map((k) => [k.label, k.value]));
    expect(kpis["Total"]).toBe("6");
    expect(kpis["Completed"]).toBe("3");
    expect(kpis["Attendance Rate"]).toBe("50%");
    // No-show KPI folds cancellations in, like the mockup spec.
    expect(kpis["No-show"]).toBe("2");
  });

  it("aggregates by day and ranks employees by volume", () => {
    const model = buildAppointmentsPrintModel(appointments, t, formatDay, "period");
    const byDay = model.tables?.[0];
    expect(byDay?.rows).toHaveLength(2);
    expect(byDay?.rows[0][1].text).toBe("3"); // 2026-09-12
    expect(byDay?.rows[0][3]).toMatchObject({ text: "67%", barPct: 67 });
    expect(byDay?.footerRow?.[3]).toMatchObject({ text: "50%" });
    expect(model.lists?.[0].items.map((i) => i.label)).toEqual(["أمل", "سارة"]);
  });
});

describe("inventory print model", () => {
  it("flags low stock with the shared domain rule and values stock", () => {
    const model = buildInventoryPrintModel(inventory, t, "period");
    const kpis = Object.fromEntries(model.kpis.map((k) => [k.label, k.value]));
    expect(kpis["Items"]).toBe("2");
    expect(kpis["Low Stock"]).toBe("1");
    expect(kpis["Stock Value (Cost)"]).toContain("52.000");
    expect(kpis["Retail Value"]).toContain("105.000");
    const rows = model.tables?.[0].rows ?? [];
    expect(rows[0][5]).toMatchObject({ text: "In Stock", flag: "ok" });
    expect(rows[1][5]).toMatchObject({ text: "Low Stock", flag: "low" });
  });
});

describe("report CSV export", () => {
  it("starts with a BOM and quotes values that contain commas", () => {
    const csv = buildReportCsv("sales", sales, t);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Date,Invoice,Customer,Items,Discount,Total");
    expect(csv).toContain('"A, B"');
    expect(csv).toContain("2026-09-12,i1,A,1,10.000,100.000,95.000,0.000,0.000");
  });

  it("exports appointments with the same columns as the print sheet", () => {
    const csv = buildReportCsv("appointments", appointments, t);
    expect(csv).toContain("Date,Status,Customer,Service,Employee");
    expect(csv).toContain("2026-09-12T09:00:00,COMPLETED,ن,صبغ,أمل");
  });

  it("exports inventory with machine-readable money via the OMR contract", () => {
    const csv = buildReportCsv("inventory", inventory, t);
    expect(csv).toContain("Description,Cost,Price,Stock,Reorder Level,Status");
    expect(csv).toContain("صبغة Kerasys,10.000,20.000,5,3,In Stock");
    expect(csv).toContain("ماسك,2.000,5.000,1,5,Low Stock");
  });
});
