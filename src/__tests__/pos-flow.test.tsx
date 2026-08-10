import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useCases } from "../app/composition/useCases";
import PosInvoicesPage from "../pages/PosInvoicesPage";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

/**
 * Behavioral QA test for the POS operational flow (UI only):
 * عميل → POS → إضافة خدمة + منتج + باقة → checkout ناجح → إيصال مفهوم.
 */
describe("POS operational flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(useCases.services, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "s1", name: "قص شعر", price: 5, durationMinutes: 30, isActive: true }],
    } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "p1", name: "شامبو", price: 3, cost: 1, stockQuantity: 10 }],
    } as any);
    vi.spyOn(useCases.servicePackages, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "pkg1", name: "باقة كاملة", packagePrice: 20, isActive: true, items: [] }],
    } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "e1", name: "سارة", role: "STYLIST", isActive: true }],
    } as any);
    vi.spyOn(useCases.settings, "get").mockResolvedValue({ ok: true, data: { taxRate: 0 } } as any);
    vi.spyOn(useCases.giftCards, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("adds service + product + package, checks out and shows the receipt", async () => {
    await i18n.changeLanguage("ar");

    const checkoutSpy = vi.spyOn(useCases.invoices, "checkout").mockResolvedValue({
      ok: true,
      data: {
        invoice: {
          id: "inv-1",
          serialNumber: "INV-TEST-1",
          date: new Date("2026-08-10T10:00:00"),
          totalAmount: 28,
          discount: 0,
          tax: 0,
          paymentMethod: "cash",
          customerId: "c1",
        },
        total: 28,
        earned: 28,
      },
    } as any);
    vi.spyOn(useCases.invoices, "getForPrint").mockResolvedValue({
      ok: true,
      data: {
        invoice: { id: "inv-1", serialNumber: "INV-TEST-1", date: new Date("2026-08-10T10:00:00"), totalAmount: 28, discount: 0, tax: 0, paymentMethod: "cash", customerId: "c1" },
        items: [
          { id: "it1", type: "service", name: "قص شعر", price: 5, qty: 1 },
          { id: "it2", type: "product", name: "شامبو", price: 3, qty: 1 },
          { id: "it3", type: "package", name: "باقة كاملة", price: 20, qty: 1 },
        ],
        customer: { id: "c1", name: "أمل" },
        settings: { name: "لينا بيوتي", currency: "OMR" },
      },
    } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "c1", name: "أمل", phone: "90000000" }],
    } as any);

    render(
      <ToastProvider>
        <PosInvoicesPage />
      </ToastProvider>,
    );

    // 1) Catalog loads; add the service
    expect(await screen.findByText("قص شعر")).toBeInTheDocument();
    fireEvent.click(screen.getByText("قص شعر"));

    // 2) Switch to products and add one
    fireEvent.click(screen.getByText(i18n.t("Products")));
    fireEvent.click(await screen.findByText("شامبو"));

    // 3) Switch to packages and add one
    fireEvent.click(screen.getByText(i18n.t("Packages")));
    fireEvent.click(await screen.findByText("باقة كاملة"));

    // 4) Select an existing customer by search
    const custInput = screen.getByPlaceholderText(i18n.t("Search customer..."));
    fireEvent.change(custInput, { target: { value: "أمل" } });
    fireEvent.click(await screen.findByText("أمل"));

    // 5) Select the specialist (first combobox = employee)
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "e1" } });

    // 6) Complete the payment
    fireEvent.click(screen.getByText(i18n.t("Complete Payment")));

    // 7) Checkout called once with the exact mixed payload
    await waitFor(() => expect(checkoutSpy).toHaveBeenCalledTimes(1));
    const payload = checkoutSpy.mock.calls[0][0];
    expect(payload.customerId).toBe("c1");
    expect(payload.employeeId).toBe("e1");
    expect(payload.items).toEqual([
      { type: "service", serviceId: "s1", qty: 1, price: 5 },
      { type: "product", productId: "p1", qty: 1, price: 3 },
      { type: "package", packageId: "pkg1", qty: 1, price: 20 },
    ]);

    // 8) Receipt modal shows the invoice with the three items and the total
    expect((await screen.findAllByText("لينا بيوتي")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("قص شعر").length).toBeGreaterThan(0);
    expect(screen.getAllByText("شامبو").length).toBeGreaterThan(0);
    expect(screen.getAllByText("باقة كاملة").length).toBeGreaterThan(0);
  });
});
