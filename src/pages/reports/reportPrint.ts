/**
 * Print/CSV builders for the reports page. Every number mirrors the on-screen
 * sections (same grouping, same financial classification), so the printed
 * sheet and the CSV always agree with what the operator sees.
 */
import type { AppointmentReportRow, EntitlementSummary, InventoryReportRow, SalesReportRow } from "../../application/dto";
import { isLowStock } from "../../domain/inventory";
import { formatOMRAmount, formatOMRPlain } from "../../shared/money";
import type { ReportCell, ReportSheetModel } from "../../shared/components/ReportPrintSheet";

type TFunc = (key: string, values?: Record<string, unknown>) => string;

const sum = (values: number[]) => values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

const cell = (text: string, extra?: Partial<ReportCell>): ReportCell => ({ text, ...extra });

/* ── Sales ─────────────────────────────────────────────────────────────── */

export function buildSalesPrintModel(
  rows: SalesReportRow[],
  t: TFunc,
  formatDay: (date: string) => string,
  docNo: string,
): ReportSheetModel {
  const totalSales = sum(rows.map((row) => row.totalAmount));
  const totalDiscount = sum(rows.map((row) => row.discount));
  const earnedRevenue = sum(rows.map((row) => row.earnedRevenue));
  const prepaid = sum(rows.map((row) => row.prepaidAmount));
  const redeemed = sum(rows.map((row) => row.redeemedAmount));
  const averageTicket = rows.length ? totalSales / rows.length : 0;

  const byDay = new Map<string, { count: number; total: number; discount: number }>();
  for (const row of rows) {
    const date = row.date.split("T")[0];
    const agg = byDay.get(date) ?? { count: 0, total: 0, discount: 0 };
    agg.count += 1;
    agg.total += row.totalAmount;
    agg.discount += row.discount;
    byDay.set(date, agg);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const bestDay = [...days].sort((a, b) => b[1].total - a[1].total)[0];

  const itemSales = new Map<string, number>();
  for (const row of rows) {
    for (const item of row.items || []) {
      itemSales.set(item.name, (itemSales.get(item.name) || 0) + (item.price * item.qty));
    }
  }
  const topItems = [...itemSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    title: t("Sales Report"),
    docNo,
    kpis: [
      { label: t("Total Revenue"), value: formatOMRAmount(totalSales), sub: t("OMR") },
      { label: t("Total Transactions"), value: String(rows.length) },
      { label: t("Average Ticket"), value: formatOMRAmount(averageTicket), sub: t("OMR") },
      {
        label: t("Peak Day"),
        value: bestDay ? formatOMRAmount(bestDay[1].total) : "0.000",
        sub: bestDay ? formatDay(bestDay[0]) : undefined,
      },
    ],
    tables: [
      {
        heading: t("Daily Performance"),
        columns: [
          { label: t("Date") },
          { label: t("Invoices"), align: "end" },
          { label: t("Total Sales"), align: "end" },
          { label: t("Discount"), align: "end" },
        ],
        rows: days.map(([date, agg]) => [
          cell(formatDay(date)),
          cell(String(agg.count), { align: "end" }),
          cell(formatOMRAmount(agg.total), { align: "end" }),
          cell(formatOMRAmount(agg.discount), { align: "end" }),
        ]),
        footerRow: [
          cell(t("Total"), { bold: true }),
          cell(String(rows.length), { align: "end", bold: true }),
          cell(formatOMRAmount(totalSales), { align: "end", bold: true }),
          cell(formatOMRAmount(totalDiscount), { align: "end", bold: true }),
        ],
      },
      {
        heading: t("Financial Facts"),
        columns: [
          { label: t("Description") },
          { label: t("Total"), align: "end" },
        ],
        rows: [
          [cell(t("Cash Collected")), cell(formatOMRAmount(totalSales), { align: "end" })],
          [cell(t("Earned Service Revenue")), cell(formatOMRAmount(earnedRevenue), { align: "end" })],
          [cell(t("Prepaid Sales (Period)")), cell(formatOMRAmount(prepaid), { align: "end" })],
          [cell(t("Entitlement Redemptions")), cell(formatOMRAmount(redeemed), { align: "end" })],
        ],
      },
    ],
    lists: [
      {
        heading: t("Top Services"),
        ranked: true,
        items: topItems.map(([name, amount]) => ({ label: name, value: `${formatOMRAmount(amount)} ${t("OMR")}` })),
      },
    ],
  };
}

/* ── Appointments ──────────────────────────────────────────────────────── */

export function buildAppointmentsPrintModel(
  rows: AppointmentReportRow[],
  t: TFunc,
  formatDay: (date: string) => string,
  docNo: string,
): ReportSheetModel {
  const statusCounts: Record<string, number> = {};
  for (const row of rows) {
    const status = (row.status || "SCHEDULED").toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const completed = statusCounts.COMPLETED || 0;
  const cancelled = statusCounts.CANCELLED || 0;
  const noShow = statusCounts.NO_SHOW || 0;
  const attendanceRate = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  const byDay = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const date = row.dateTime.split("T")[0];
    const agg = byDay.get(date) ?? { total: 0, completed: 0 };
    agg.total += 1;
    if ((row.status || "").toUpperCase() === "COMPLETED") agg.completed += 1;
    byDay.set(date, agg);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const byEmployee = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const name = row.employee?.name || t("Unnamed");
    const agg = byEmployee.get(name) ?? { total: 0, completed: 0 };
    agg.total += 1;
    if ((row.status || "").toUpperCase() === "COMPLETED") agg.completed += 1;
    byEmployee.set(name, agg);
  }
  const employees = [...byEmployee.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);

  return {
    title: t("Appointments Report"),
    docNo,
    kpis: [
      { label: t("Total"), value: String(rows.length) },
      { label: t("Completed"), value: String(completed) },
      { label: t("Attendance Rate"), value: `${attendanceRate}%`, accent: true },
      { label: t("No-show"), value: String(noShow + cancelled), sub: t("Cancelled") },
    ],
    tables: [
      {
        heading: t("By Day"),
        columns: [
          { label: t("Date") },
          { label: t("Appointments"), align: "end" },
          { label: t("Completed"), align: "end" },
          { label: t("Attendance Rate"), align: "center" },
        ],
        rows: days.map(([date, agg]) => {
          const pct = agg.total ? Math.round((agg.completed / agg.total) * 100) : 0;
          return [
            cell(formatDay(date)),
            cell(String(agg.total), { align: "end" }),
            cell(String(agg.completed), { align: "end" }),
            cell(`${pct}%`, { align: "center", barPct: pct }),
          ];
        }),
        footerRow: [
          cell(t("Total"), { bold: true }),
          cell(String(rows.length), { align: "end", bold: true }),
          cell(String(completed), { align: "end", bold: true }),
          cell(`${attendanceRate}%`, { align: "center", bold: true }),
        ],
      },
    ],
    lists: [
      {
        heading: t("By Employee"),
        items: employees.map(([name, agg]) => ({
          label: name,
          value: `${agg.total} · ${Math.round((agg.completed / Math.max(agg.total, 1)) * 100)}%`,
        })),
      },
    ],
  };
}

/* ── Inventory ─────────────────────────────────────────────────────────── */

export function buildInventoryPrintModel(
  rows: InventoryReportRow[],
  t: TFunc,
  docNo: string,
): ReportSheetModel {
  const lowStockCount = rows.filter((row) => isLowStock({ stockQuantity: row.stockQuantity, reorderLevel: row.reorderLevel })).length;
  const stockValue = sum(rows.map((row) => row.stockQuantity * row.cost));
  const retailValue = sum(rows.map((row) => row.stockQuantity * row.price));

  return {
    title: t("Inventory Report"),
    docNo,
    kpis: [
      { label: t("Items"), value: String(rows.length) },
      { label: t("Low Stock"), value: String(lowStockCount), accent: true },
      { label: t("Stock Value (Cost)"), value: `${formatOMRAmount(stockValue)} ${t("OMR")}` },
      { label: t("Retail Value"), value: `${formatOMRAmount(retailValue)} ${t("OMR")}` },
    ],
    tables: [
      {
        heading: t("Inventory Status"),
        columns: [
          { label: t("Description") },
          { label: t("Cost"), align: "end" },
          { label: t("Price"), align: "end" },
          { label: t("Stock"), align: "end" },
          { label: t("Reorder Level"), align: "end" },
          { label: t("Status"), align: "center" },
        ],
        rows: rows.map((row) => {
          const low = isLowStock({ stockQuantity: row.stockQuantity, reorderLevel: row.reorderLevel });
          return [
            cell(row.name),
            cell(formatOMRAmount(row.cost), { align: "end" }),
            cell(formatOMRAmount(row.price), { align: "end" }),
            cell(String(row.stockQuantity), { align: "end", bold: low }),
            cell(row.reorderLevel !== undefined ? String(row.reorderLevel) : "—", { align: "end" }),
            cell(low ? t("Low Stock") : t("In Stock"), { align: "center", flag: low ? "low" : "ok" }),
          ];
        }),
      },
    ],
  };
}

/* ── CSV export ────────────────────────────────────────────────────────── */

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  // BOM so Excel opens the Arabic headers in the right encoding.
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export type ReportTabId = "sales" | "appointments" | "inventory";

export function buildReportCsv(
  tab: ReportTabId,
  data: SalesReportRow[] | AppointmentReportRow[] | InventoryReportRow[],
  t: TFunc,
): string {
  if (tab === "sales") {
    const rows = data as SalesReportRow[];
    return toCsv(
      [t("Date"), t("Invoice"), t("Customer"), t("Items"), t("Discount"), t("Total"), t("Earned Service Revenue"), "Prepaid", t("Entitlement Redemptions")],
      rows.map((row) => [
        row.date.split("T")[0],
        row.id,
        row.customer || "",
        row.items?.length ?? 0,
        formatOMRPlain(row.discount),
        formatOMRPlain(row.totalAmount),
        formatOMRPlain(row.earnedRevenue),
        formatOMRPlain(row.prepaidAmount),
        formatOMRPlain(row.redeemedAmount),
      ]),
    );
  }
  if (tab === "appointments") {
    const rows = data as AppointmentReportRow[];
    return toCsv(
      [t("Date"), t("Status"), t("Customer"), t("Service"), t("Employee")],
      rows.map((row) => [
        row.dateTime,
        row.status,
        row.customer?.name || "",
        row.service?.name || "",
        row.employee?.name || "",
      ]),
    );
  }
  const rows = data as InventoryReportRow[];
  return toCsv(
    [t("Description"), t("Cost"), t("Price"), t("Stock"), t("Reorder Level"), t("Status")],
    rows.map((row) => [
      row.name,
      formatOMRPlain(row.cost),
      formatOMRPlain(row.price),
      row.stockQuantity,
      row.reorderLevel ?? "",
      isLowStock({ stockQuantity: row.stockQuantity, reorderLevel: row.reorderLevel }) ? t("Low Stock") : t("In Stock"),
    ]),
  );
}
