import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoicePrintLayout } from "../shared/components/InvoicePrintLayout";
import i18n from "../i18n";

const receipt = {
  invoice: {
    id: "invoice-1234567890",
    serialNumber: "INV-DEMO-42",
    date: new Date("2026-08-10T10:15:00.000Z"),
    subtotalAmount: 12.5,
    totalAmount: 12.075,
    discount: 0.5,
    manualDiscount: 0.5,
    tierDiscount: 0,
    loyaltyDiscount: 0,
    giftCardDiscount: 0,
    tax: 0.075,
    taxRate: 5,
    amountPaid: 12.075,
    status: "PAID",
    loyaltyPointsUsed: 0,
    paymentMethod: "cash",
    customerId: "customer-1",
    employeeId: "employee-1",
    staffName: "سارة",
    createdAt: new Date("2026-08-10T10:15:00.000Z"),
    updatedAt: new Date("2026-08-10T10:15:00.000Z"),
  },
  items: [{ id: "item-1", type: "service", name: "قص الشعر", price: 6.25, qty: 2 }],
  customer: { id: "customer-1", name: "أمل", phone: "90000000" },
  settings: {
    id: "center-1",
    name: "LenaBeauty",
    displayNameAr: "لينا بيوتي",
    address: "مسقط، عمان",
    phone: "90000001",
    currency: "OMR",
    taxRate: 5,
    brandTaxNumber: "VAT-DEMO",
    brandFooterTextAr: "شكرًا لزيارتكم",
  },
} as any;

describe("thermal invoice print layout", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("ar");
    vi.spyOn(window, "print").mockImplementation(() => {});
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("renders the complete 80mm receipt from persisted invoice data", () => {
    render(<InvoicePrintLayout data={receipt} />);

    expect(screen.getAllByText("لينا بيوتي").length).toBeGreaterThan(0);
    expect(screen.getByText(/INV-DEMO-42/)).toBeInTheDocument();
    expect(screen.getByText("أمل")).toBeInTheDocument();
    expect(screen.getByText(/سارة/)).toBeInTheDocument();
    expect(screen.getByText("قص الشعر")).toBeInTheDocument();
    expect(screen.getByText("6.250 OMR × 2")).toBeInTheDocument();
    expect(screen.getByText("12.075 OMR")).toBeInTheDocument();
    expect(screen.getByText(/نقداً/)).toBeInTheDocument();
    expect(document.querySelector("#invoice-print-container")).toHaveAttribute("dir", "rtl");
  });

  it("prints the current receipt without opening a popup", () => {
    render(<InvoicePrintLayout data={receipt} />);
    fireEvent.click(screen.getByRole("button", { name: /طباعة الفاتورة/ }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("reuses the same receipt from customer sales history", () => {
    const customers = readFileSync(resolve(process.cwd(), "src/pages/CustomersPage.tsx"), "utf8");
    expect(customers).toContain("<InvoicePrintLayout data={printData}");
    expect(customers).not.toContain('id="print-area"');
  });
});
