import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import { ReportPrintSheet, type ReportSheetModel } from "../shared/components/ReportPrintSheet";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("premium printing — invoices", () => {
  it("invoice layout offers A4 premium, A4 luxe and refined thermal formats", () => {
    const layout = read("src/shared/components/InvoicePrintLayout.tsx");
    for (const format of ["a4-premium", "a4-luxe", "thermal-80", "thermal-58"]) {
      expect(layout, `missing format ${format}`).toContain(format);
    }
    expect(layout).toContain('id="invoice-print-container"');
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
});

describe("premium printing — reports", () => {
  it("report sheet prints A4 with repeating table headers and the fixed credit", () => {
    const sheet = read("src/shared/components/ReportPrintSheet.tsx");
    expect(sheet).toContain('id="print-area"');
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
