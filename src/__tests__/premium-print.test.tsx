import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";
import { ReportPrintSheet, type ReportSheetModel } from "../shared/components/ReportPrintSheet";
import { ReceiptPreviewModal } from "../shared/components/ReceiptPreviewModal";
import type { InvoicePrintData } from "../application/dto";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("premium printing — invoices", () => {
  it("invoice layout offers A4 premium, A4 luxe and refined thermal formats", () => {
    const layout = read("src/shared/components/InvoicePrintLayout.tsx");
    for (const format of ["a4-premium", "a4-luxe", "thermal-80", "thermal-58"]) {
      expect(layout, `missing format ${format}`).toContain(format);
    }
    // The print anchor is conditional so the off-screen PDF capture copy can
    // share the DOM without duplicating #invoice-print-container.
    expect(layout).toContain("invoice-print-container");
    expect(layout).toContain("printAnchor");
    // Brand contract: the receipt stays signed by the salon (product mark
    // fallback) and every format carries the fixed developer credit.
    expect(layout).toContain("aria-label={salonName}");
    expect(layout).toMatch(/receiptLogo\s*\?[\s\S]*?\/lena-mark\.svg/);
    expect(layout).toContain("getFooterText");
    expect(layout).toContain("Simple Tax Invoice");
  });

  it("receipt modal exposes the print-format picker and drives the sheet from it", () => {
    const modal = read("src/shared/components/ReceiptPreviewModal.tsx");
    expect(modal).toContain("Print format");
    for (const format of ["a4-premium", "a4-luxe", "thermal-80", "thermal-58"]) {
      expect(modal).toContain(format);
    }
    expect(modal).toContain("format={format}");
  });

  const receipt: InvoicePrintData = {
    invoice: {
      id: "invoice-0000000042",
      serialNumber: "INV-DEMO-42",
      date: new Date("2026-09-13T07:24:00.000Z"),
      subtotalAmount: 81,
      totalAmount: 79.8,
      manualDiscount: 5,
      tierDiscount: 0,
      loyaltyDiscount: 0,
      giftCardDiscount: 0,
      tax: 3.8,
      taxRate: 5,
      paymentMethod: "card",
    } as any,
    items: [{ id: "item-1", type: "service", name: "صبغ شعر احترافي", price: 14, qty: 2 }],
    customer: { id: "c1", name: "نورة الحارثية", phone: "90000001" } as any,
    settings: { name: "Lara Beauty", address: "مسقط", phone: "90000001", currency: "OMR" } as any,
  };

  it("switching the print format re-renders the sheet live (luxe skin / thermal mono)", async () => {
    await i18n.changeLanguage("en");
    const { unmount } = render(
      <ToastProvider>
        <MemoryRouter>
          <ReceiptPreviewModal data={receipt} onClose={() => {}} />
        </MemoryRouter>
      </ToastProvider>,
    );
    // The modal portals to document.body, so query there.
    expect(document.querySelector(".lb-a4")).toBeTruthy();
    expect(document.querySelector(".lb-luxe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "A4 Luxe" }));
    expect(document.querySelector(".lb-luxe")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Thermal 80mm" }));
    expect(document.querySelector(".lb-luxe")).toBeNull();
    expect(document.querySelector(".font-mono")).toBeTruthy();
    expect(screen.getByText(/INV-DEMO-42/)).toBeInTheDocument();
    unmount();
  });
});

describe("premium printing — PDF export", () => {
  it("both surfaces expose a one-click PDF export driven by an off-screen full-size source", () => {
    const modal = read("src/shared/components/ReceiptPreviewModal.tsx");
    const page = read("src/pages/ReportsPage.tsx");
    for (const source of [modal, page]) {
      expect(source).toContain("Export PDF");
      expect(source).toContain("exportElementToPdf");
      expect(source).toContain("lb-pdf-source");
    }
    // The shared helper is the only place that touches html2pdf.js, and it
    // must load it lazily so the bundle stays light.
    const helper = read("src/shared/print/pdfExport.ts");
    expect(helper).toContain('import("html2pdf.js")');
    expect(helper).toContain("exportElementToPdf");
    // The capture copy must never own the print anchor, and the PDF source
    // must escape the narrow-viewport preview zoom.
    expect(modal).toContain("printAnchor={false}");
    expect(read("src/shared/components/ReportPrintSheet.tsx")).toContain("sourceOnly");
    const css = read("src/lena-brand.css");
    expect(css).toContain(".lb-pdf-source");
    expect(css).toContain("zoom: 1 !important");
  });
});

describe("premium printing — reports", () => {
  it("report sheet prints A4 with repeating table headers and the fixed credit", () => {
    const sheet = read("src/shared/components/ReportPrintSheet.tsx");
    // The anchor is conditional on `sourceOnly` so the PDF capture copy can
    // coexist with the live preview without duplicating #print-area.
    expect(sheet).toContain("print-area");
    expect(sheet).toContain("!sourceOnly");
    expect(sheet).toContain("size: A4");
    expect(sheet).toContain("getFooterText");
    // Repeating headers on every printed page come from the print stylesheet.
    expect(read("src/lena-brand.css")).toContain("table-header-group");
  });

  it("reports page wires the A4 print preview and CSV export", () => {
    const page = read("src/pages/ReportsPage.tsx");
    expect(page).toContain("ReportPrintSheet");
    expect(page).toContain("Print preview");
    expect(page).toContain("Export CSV");
    expect(page).toContain("window.print()");
    expect(page).toContain("buildReportCsv");
  });

  it("global print CSS is format-agnostic (no hard-coded thermal width)", () => {
    const css = read("src/index.css");
    expect(css).not.toContain("width: 80mm !important");
    expect(css).toContain("#print-area.lb-sheet");
  });

  it("renders KPIs, tables and the fixed developer credit in Arabic", async () => {
    await i18n.changeLanguage("ar");
    const model: ReportSheetModel = {
      title: "تقرير المبيعات",
      docNo: "1 — 2 سبتمبر",
      kpis: [{ label: "إجمالي الإيرادات", value: "1,234.567", sub: "OMR" }],
      tables: [
        {
          heading: "الأداء اليومي",
          columns: [
            { label: "اليوم" },
            { label: "الإجمالي" },
          ],
          rows: [[{ text: "13/09" }, { text: "100.000" }]],
          footerRow: [
            { text: "الإجمالي" },
            { text: "100.000" },
          ],
        },
      ],
    };
    render(
      <MemoryRouter>
        <ReportPrintSheet model={model} />
      </MemoryRouter>,
    );
    expect(screen.getByText("1,234.567")).toBeInTheDocument();
    expect(screen.getByText("13/09")).toBeInTheDocument();
    // The developer attribution is fixed and identical on every deployment.
    expect(screen.getByText("بتقنية LENA Digital House")).toBeInTheDocument();
  });
});
