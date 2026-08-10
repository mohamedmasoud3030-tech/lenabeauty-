import { SalesReportRow, InvoicePrintData } from "../../application/dto";
import { mapInvoice, mapInvoiceItem } from "./mappers";

/**
 * Resilient mapping for sales report / invoice-print rows.
 *
 * Root cause this file fixes: the sales report previously mapped every invoice
 * row with strict mappers that threw on ANY missing field (e.g. an embed that
 * omitted invoice_id/created_at, a deleted service/product, or a legacy
 * package row). One malformed row crashed the entire report. These helpers
 * are intentionally defensive: an un-mappable row or item is SKIPPED (or given
 * a safe fallback name) and never takes the whole report down.
 */

export type PrintItemShape = InvoicePrintData["items"][number];

const FALLBACK_NAMES: Record<"service" | "product" | "package", string> = {
  service: "خدمة",
  product: "منتج",
  package: "باقة",
};

export function resolveItemType(item: {
  serviceId?: string;
  productId?: string;
  packageId?: string;
}): "service" | "product" | "package" {
  if (item.serviceId) return "service";
  if (item.productId) return "product";
  if (item.packageId) return "package";
  // Unknown/null refs (e.g. legacy rows): fall back to product, never crash.
  return "product";
}

function toSafeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function joinedNameFor(itemRow: Record<string, any>, type: "service" | "product" | "package"): unknown {
  if (type === "service") return itemRow.services?.name;
  if (type === "product") return itemRow.products?.name;
  return itemRow.service_packages?.name;
}

function mapItemRow(itemRow: unknown): SalesReportRow["items"][number] | null {
  if (!itemRow || typeof itemRow !== "object") return null;
  const row = itemRow as Record<string, any>;
  let item;
  try {
    item = mapInvoiceItem(row);
  } catch {
    return null;
  }
  const type = resolveItemType(item);
  const price = toSafeNumber(item.price, 0);
  const qty = toSafeNumber(item.quantity, 0);
  // Zero/negative lines are not legitimate sales. Legacy malformed package
  // expansion rows are excluded rather than presented as real transactions.
  if (price <= 0 || !Number.isInteger(qty) || qty <= 0) return null;
  const joinedName = joinedNameFor(row, type);
  const snapshotName = typeof row.item_name === "string" ? row.item_name : undefined;
  return {
    id: item.id,
    name: snapshotName?.trim() || (typeof joinedName === "string" && joinedName.trim().length > 0 ? joinedName : FALLBACK_NAMES[type]),
    type,
    price,
    qty,
  };
}

/** Maps raw invoice rows (with nested invoice_items) to SalesReportRow. */
export function mapSalesReportRows(rows: unknown[]): SalesReportRow[] {
  const out: SalesReportRow[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, any>;
    let invoice;
    try {
      invoice = mapInvoice(row);
    } catch {
      // Incomplete/invalid invoice row — skip it, keep the rest of the report.
      continue;
    }

    const items: SalesReportRow["items"] = [];
    for (const itemRow of Array.isArray(row.invoice_items) ? row.invoice_items : []) {
      const mapped = mapItemRow(itemRow);
      if (mapped) items.push(mapped);
    }

    out.push({
      id: invoice.id,
      date: invoice.date.toISOString(),
      totalAmount: toSafeNumber(invoice.totalAmount, 0),
      discount: toSafeNumber(invoice.discount, 0),
      customer: typeof row.customers?.name === "string" ? row.customers.name : undefined,
      items,
    });
  }
  return out;
}

/** Maps raw invoice_items rows to the print DTO shape (package-aware). */
export function mapInvoicePrintItems(itemRows: unknown[]): PrintItemShape[] {
  const out: PrintItemShape[] = [];
  for (const itemRow of itemRows) {
    const mapped = mapItemRow(itemRow);
    if (mapped) out.push(mapped);
  }
  return out;
}
