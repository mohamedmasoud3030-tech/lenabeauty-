import { describe, expect, it } from "vitest";
import { mapSalesReportRows, mapInvoicePrintItems, resolveItemType } from "../infrastructure/supabase/salesReportMapper";

/**
 * Regression tests for the sales-report mapper resilience fixes:
 * the report must NEVER crash on incomplete invoice/item data — it skips
 * what it cannot map and keeps the rest.
 */
describe("mapSalesReportRows (resilience)", () => {
  it("maps complete invoice rows with service/product items", () => {
    const rows = [
      {
        id: "inv-1",
        customer_id: "c-1",
        total_amount: 25,
        discount: 0,
        payment_method: "CASH",
        date: "2026-08-01T10:00:00Z",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
        customers: { name: "أمل" },
        invoice_items: [
          {
            id: "it-1",
            invoice_id: "inv-1",
            service_id: "s-1",
            product_id: null,
            price: 15,
            quantity: 1,
            created_at: "2026-08-01T10:00:00Z",
            services: { name: "قص شعر" },
            products: null,
          },
          {
            id: "it-2",
            invoice_id: "inv-1",
            service_id: null,
            product_id: "p-1",
            price: 10,
            quantity: 1,
            created_at: "2026-08-01T10:00:00Z",
            services: null,
            products: { name: "شامبو" },
          },
        ],
      },
    ];

    const result = mapSalesReportRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].customer).toBe("أمل");
    expect(result[0].totalAmount).toBe(25);
    expect(result[0].items).toEqual([
      { id: "it-1", name: "قص شعر", type: "service", price: 15, qty: 1 },
      { id: "it-2", name: "شامبو", type: "product", price: 10, qty: 1 },
    ]);
  });

  it("does NOT crash when item rows are missing invoice_id/created_at (the original bug)", () => {
    const rows = [
      {
        id: "inv-1",
        customer_id: "c-1",
        total_amount: 30,
        discount: 0,
        payment_method: "CARD",
        date: "2026-08-02T10:00:00Z",
        created_at: "2026-08-02T10:00:00Z",
        updated_at: "2026-08-02T10:00:00Z",
        customers: null,
        invoice_items: [
          {
            id: "it-1",
            // invoice_id and created_at intentionally absent (old embed shape)
            service_id: "s-1",
            price: 30,
            quantity: 1,
            services: { name: "صبغ" },
          },
        ],
      },
    ];

    const result = mapSalesReportRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].totalAmount).toBe(30);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0]).toMatchObject({ id: "it-1", name: "صبغ", type: "service", price: 30, qty: 1 });
  });

  it("skips a broken item row instead of failing the whole report", () => {
    const rows = [
      {
        id: "inv-1",
        customer_id: "c-1",
        total_amount: 45,
        discount: 0,
        payment_method: "TRANSFER",
        date: "2026-08-03T10:00:00Z",
        created_at: "2026-08-03T10:00:00Z",
        updated_at: "2026-08-03T10:00:00Z",
        invoice_items: [
          null,
          { id: "it-ok", invoice_id: "inv-1", product_id: "p-1", price: 45, quantity: 1, products: { name: "كريم" } },
          { invoice_id: "inv-1", price: 5, quantity: 1 }, // no id -> unmappable
        ],
      },
    ];

    const result = mapSalesReportRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].name).toBe("كريم");
  });

  it("skips invoice rows with invalid dates instead of crashing", () => {
    const rows = [
      {
        id: "inv-bad",
        customer_id: "c-1",
        total_amount: 10,
        payment_method: "CASH",
        date: "not-a-date",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
      },
      {
        id: "inv-good",
        customer_id: "c-1",
        total_amount: 20,
        payment_method: "CASH",
        date: "2026-08-04T10:00:00Z",
        created_at: "2026-08-04T10:00:00Z",
        updated_at: "2026-08-04T10:00:00Z",
      },
    ];

    const result = mapSalesReportRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("inv-good");
  });

  it("maps package items with their real price and package name", () => {
    const rows = [
      {
        id: "inv-1",
        customer_id: "c-1",
        total_amount: 50,
        discount: 0,
        payment_method: "CASH",
        date: "2026-08-05T10:00:00Z",
        created_at: "2026-08-05T10:00:00Z",
        updated_at: "2026-08-05T10:00:00Z",
        invoice_items: [
          {
            id: "it-1",
            invoice_id: "inv-1",
            service_id: null,
            product_id: null,
            package_id: "pkg-1",
            price: 50,
            quantity: 1,
            created_at: "2026-08-05T10:00:00Z",
            service_packages: { name: "باقة العناية الكاملة" },
          },
        ],
      },
    ];

    const result = mapSalesReportRows(rows);
    expect(result[0].items[0]).toEqual({
      id: "it-1",
      name: "باقة العناية الكاملة",
      type: "package",
      price: 50,
      qty: 1,
    });
  });

  it("excludes legacy zero-priced expansion rows from operational sales items", () => {
    const rows = [{
      id: "inv-1",
      customer_id: "c-1",
      total_amount: 50,
      discount: 0,
      payment_method: "cash",
      date: "2026-08-06T10:00:00Z",
      created_at: "2026-08-06T10:00:00Z",
      updated_at: "2026-08-06T10:00:00Z",
      invoice_items: [
        { id: "legacy-zero", invoice_id: "inv-1", service_id: "s-1", price: 0, quantity: 1, services: { name: "خدمة باقة قديمة" } },
        { id: "real", invoice_id: "inv-1", package_id: "pkg-1", item_name: "باقة", price: 50, quantity: 1 },
      ],
    }];

    const result = mapSalesReportRows(rows);
    expect(result[0].items).toEqual([{ id: "real", name: "باقة", type: "package", price: 50, qty: 1 }]);
  });

  it("falls back to a safe type/name for legacy rows with no references", () => {
    const rows = [
      {
        id: "inv-1",
        customer_id: "c-1",
        total_amount: 5,
        discount: 0,
        payment_method: "CASH",
        date: "2026-08-06T10:00:00Z",
        created_at: "2026-08-06T10:00:00Z",
        updated_at: "2026-08-06T10:00:00Z",
        invoice_items: [
          { id: "it-1", invoice_id: "inv-1", price: 5, quantity: 2, created_at: "2026-08-06T10:00:00Z" },
        ],
      },
    ];

    const result = mapSalesReportRows(rows);
    expect(result[0].items[0].type).toBe("product");
    expect(result[0].items[0].name).toBeTruthy();
    expect(result[0].items[0].qty).toBe(2);
  });
});

describe("mapInvoicePrintItems", () => {
  it("keeps only mappable items and resolves package rows", () => {
    const items = mapInvoicePrintItems([
      null,
      { id: "a", invoice_id: "i", service_id: "s", price: 10, quantity: 1, services: { name: "قص" } },
      { id: "b", invoice_id: "i", package_id: "p", price: 40, quantity: 1, service_packages: { name: "باقة" } },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: "service", name: "قص", price: 10 });
    expect(items[1]).toMatchObject({ type: "package", name: "باقة", price: 40 });
  });
});

describe("resolveItemType", () => {
  it("prefers service > product > package", () => {
    expect(resolveItemType({ serviceId: "s", productId: "p" })).toBe("service");
    expect(resolveItemType({ productId: "p", packageId: "pkg" })).toBe("product");
    expect(resolveItemType({ packageId: "pkg" })).toBe("package");
    expect(resolveItemType({})).toBe("product");
  });
});
