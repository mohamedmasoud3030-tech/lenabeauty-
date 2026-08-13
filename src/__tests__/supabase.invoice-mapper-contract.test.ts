import { describe, expect, it } from "vitest";
import { mapInvoice, mapInvoiceItem } from "../infrastructure/supabase/mappers";

const baseInvoice = {
  id: "10000000-0000-4000-8000-000000000001",
  customer_id: "10000000-0000-4000-8000-000000000002",
  employee_id: "10000000-0000-4000-8000-000000000003",
  serial_number: "INV-001",
  date: "2026-08-13T10:00:00.000Z",
  created_at: "2026-08-13T10:00:00.000Z",
  updated_at: "2026-08-13T10:00:00.000Z",
  payment_method: "CASH",
  status: "PAID",
};

describe("invoice mapper contract", () => {
  it("maps the canonical financial breakdown without losing OMR thousandths", () => {
    const invoice = mapInvoice({
      ...baseInvoice,
      subtotal_amount: "12.345",
      total_amount: "10.999",
      discount: "1.346",
      manual_discount: "0.100",
      tier_discount: "0.200",
      loyalty_discount: "0.300",
      gift_card_discount: "0.746",
      entitlement_redemption: "1.111",
      tax: "0.000",
      tax_rate: "0.000",
      amount_paid: "10.999",
      loyalty_points_used: 3,
    });

    expect(invoice.subtotalAmount).toBe(12.345);
    expect(invoice.totalAmount).toBe(10.999);
    expect(invoice.manualDiscount).toBe(0.1);
    expect(invoice.tierDiscount).toBe(0.2);
    expect(invoice.loyaltyDiscount).toBe(0.3);
    expect(invoice.giftCardDiscount).toBe(0.746);
    expect(invoice.entitlementRedemption).toBe(1.111);
    expect(invoice.amountPaid).toBe(10.999);
    expect(invoice.status).toBe("PAID");
  });

  it("preserves explicitly supported legacy aggregate financial rows", () => {
    const invoice = mapInvoice({
      ...baseInvoice,
      subtotal_amount: 0,
      total_amount: "7.500",
      discount: "0.500",
      loyalty_points_used: 0,
      amount_paid: "7.500",
    });
    expect(invoice.manualDiscount).toBe(0.5);
    expect(invoice.totalAmount).toBe(7.5);
    expect(invoice.amountPaid).toBe(7.5);
  });

  it("maps invoice item quantities and 3dp prices numerically", () => {
    const item = mapInvoiceItem({
      id: "10000000-0000-4000-8000-000000000010",
      invoice_id: baseInvoice.id,
      service_id: "10000000-0000-4000-8000-000000000011",
      price: "4.125",
      quantity: 2,
      created_at: "2026-08-13T10:00:00.000Z",
    });
    expect(item.price).toBe(4.125);
    expect(item.quantity).toBe(2);
  });
});
