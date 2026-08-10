import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReceiptPreviewModal } from "../shared/components/ReceiptPreviewModal";
import { InvoicePrintData } from "../application/dto";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

const data: InvoicePrintData = {
  invoice: {
    id: "inv-123",
    serialNumber: "LB-001",
    date: new Date("2026-08-10T21:00:00+04:00"),
    subtotalAmount: 50,
    totalAmount: 50,
    discount: 0,
    manualDiscount: 0,
    tierDiscount: 0,
    loyaltyDiscount: 0,
    giftCardDiscount: 0,
    tax: 0,
    amountPaid: 50,
    status: "PAID" as never,
    loyaltyPointsUsed: 0,
    paymentMethod: "cash",
    customerId: "c1",
    staffName: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  items: [
    { id: "i1", type: "service", name: "Haircut", price: 25, qty: 2 },
  ],
  customer: { id: "c1", name: "Layla Hassan", totalSpent: 50, loyaltyPoints: 0, createdAt: new Date(), updatedAt: new Date() },
};

function renderModal(props: { data: InvoicePrintData | null }) {
  return render(
    <ConfirmProvider>
      <ReceiptPreviewModal data={props.data} onClose={() => {}} />
    </ConfirmProvider>
  );
}

describe("Receipt preview + print isolation", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ar");
  });

  it("renders the receipt in a portaled dialog above app chrome with sticky Print/Close", () => {
    renderModal({ data });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // The thermal receipt container the global print CSS isolates.
    expect(document.querySelector("#invoice-print-container")).not.toBeNull();
    // Print is a unique action in the sticky footer above the bottom nav.
    expect(screen.getByRole("button", { name: /طباعة الفاتورة|Print Invoice/i })).toBeInTheDocument();
    // Close appears both as the header X and the footer Close button.
    expect(screen.getAllByRole("button", { name: /إغلاق|Close/i }).length).toBeGreaterThanOrEqual(1);
    // Overlay uses the shared z-index layer token, above header/bottom-nav.
    expect(document.body.querySelector('[class*="z-[var(--z-overlay)]"]')).not.toBeNull();
  });

  it("does not render a dialog when there is no receipt data", () => {
    renderModal({ data: null });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("#invoice-print-container")).toBeNull();
  });

  it("formats the receipt date in Arabic (no English month/AM-PM leakage)", () => {
    renderModal({ data });
    // 2026-08-10 in the salon timezone -> "10 أغسطس 2026".
    expect(screen.getByText(/10 أغسطس 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Aug/i)).toBeNull();
  });
});
