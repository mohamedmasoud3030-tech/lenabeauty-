import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCases } from "../app/composition/useCases";
import PosInvoicesPage from "../pages/PosInvoicesPage";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

function renderPos(initialEntries: string[] = ["/pos"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <PosInvoicesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

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

  it("shows a retryable error when the initial catalog load fails", async () => {
    await i18n.changeLanguage("ar");
    vi.mocked(useCases.services.list).mockResolvedValueOnce({ ok: false, error: new Error("catalog offline") } as any);

    renderPos();

    expect(await screen.findByText(i18n.t("Failed to load point of sale"))).toBeInTheDocument();
    expect(screen.getByText("catalog offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("Retry") })).toBeInTheDocument();
  });

  it("keeps the newest customer search result when responses arrive out of order", async () => {
    await i18n.changeLanguage("ar");
    let resolveFirst!: (value: any) => void;
    let resolveSecond!: (value: any) => void;
    vi.spyOn(useCases.customers, "list")
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    renderPos();
    await screen.findByText("قص شعر");
    const input = screen.getByPlaceholderText(i18n.t("Search customer..."));
    fireEvent.change(input, { target: { value: "Am" } });
    fireEvent.change(input, { target: { value: "Amal" } });
    await waitFor(() => expect(useCases.customers.list).toHaveBeenCalledTimes(2));

    await act(async () => resolveSecond({ ok: true, data: [{ id: "new", name: "Newest Customer" }] }));
    expect(await screen.findByText("Newest Customer")).toBeInTheDocument();
    await act(async () => resolveFirst({ ok: true, data: [{ id: "old", name: "Stale Customer" }] }));

    expect(screen.queryByText("Stale Customer")).not.toBeInTheDocument();
    expect(screen.getByText("Newest Customer")).toBeInTheDocument();
  });

  it("blocks repeated keyboard checkout while the committed receipt is still loading", async () => {
    await i18n.changeLanguage("ar");
    const checkoutSpy = vi.spyOn(useCases.invoices, "checkout").mockResolvedValue({
      ok: true,
      data: {
        invoice: {
          id: "inv-guard",
          serialNumber: "INV-GUARD",
          date: new Date("2026-08-10T10:00:00"),
          totalAmount: 5,
          discount: 0,
          tax: 0,
          paymentMethod: "cash",
          customerId: "c1",
        },
        total: 5,
        earned: 5,
      },
    } as any);
    let resolvePrint!: (value: any) => void;
    vi.spyOn(useCases.invoices, "getForPrint").mockImplementation(
      () => new Promise((resolve) => { resolvePrint = resolve; }),
    );
    vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "c1", name: "أمل", phone: "90000000" }],
    } as any);

    renderPos();

    fireEvent.click(await screen.findByText("قص شعر"));
    const customerInput = screen.getByPlaceholderText(i18n.t("Search customer..."));
    fireEvent.change(customerInput, { target: { value: "أمل" } });
    fireEvent.click(await screen.findByText("أمل"));
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "e1" } });

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(checkoutSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useCases.invoices.getForPrint).toHaveBeenCalledTimes(1));

    // The checkout RPC has returned, but print loading is still pending. A
    // stale keyboard-listener closure used to start a second payment here.
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    await act(async () => { await Promise.resolve(); });
    expect(checkoutSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePrint({
        ok: true,
        data: {
          invoice: { id: "inv-guard", serialNumber: "INV-GUARD", date: new Date(), totalAmount: 5, discount: 0, tax: 0, paymentMethod: "cash", customerId: "c1" },
          items: [{ id: "it1", type: "service", name: "قص شعر", price: 5, qty: 1 }],
          customer: { id: "c1", name: "أمل" },
          settings: { name: "لينا بيوتي", currency: "OMR" },
        },
      });
    });
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

    renderPos();

    // 1) Catalog loads and the manual-tender boundary is explicit.
    expect(await screen.findByText("قص شعر")).toBeInTheDocument();
    expect(screen.getByText(i18n.t("The selected payment method confirms manual collection outside the app; no card is charged here"))).toBeInTheDocument();
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
    fireEvent.click(screen.getByText(i18n.t("Record completed sale")));

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

    // 8) Successful payment refreshes the catalog so product stock is not stale.
    await waitFor(() => expect(useCases.products.list).toHaveBeenCalledTimes(2));

    // 9) Receipt modal shows the invoice with the three items and the total
    expect((await screen.findAllByText("لينا بيوتي")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("قص شعر").length).toBeGreaterThan(0);
    expect(screen.getAllByText("شامبو").length).toBeGreaterThan(0);
    expect(screen.getAllByText("باقة كاملة").length).toBeGreaterThan(0);
  });

  it("prepares the sale from a visit opened via /pos?appointment=<id> and links checkout to it", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.appointments, "getById").mockResolvedValue({
      ok: true,
      data: {
        id: "a1",
        customerId: "c1",
        employeeId: "e1",
        serviceId: "s1",
        dateTime: new Date("2026-08-10T11:00:00"),
        status: "SCHEDULED",
        visitStage: "READY_FOR_CHECKOUT",
        createdAt: new Date(),
        updatedAt: new Date(),
        customer: { id: "c1", name: "أمل", phone: "90000000" },
        service: { id: "s1", name: "قص شعر", durationMinutes: 30, price: 5 },
        employee: { id: "e1", name: "سارة" },
      },
    } as any);
    vi.spyOn(useCases.customers, "getById").mockResolvedValue({
      ok: true,
      data: { id: "c1", name: "أمل", phone: "90000000", totalSpent: 100, loyaltyPoints: 50, createdAt: new Date(), updatedAt: new Date() },
    } as any);
    vi.spyOn(useCases.entitlements, "listForCustomer").mockResolvedValue({ ok: true, data: [] } as any);
    const checkoutSpy = vi.spyOn(useCases.invoices, "checkout").mockResolvedValue({
      ok: true,
      data: {
        invoice: {
          id: "inv-visit",
          serialNumber: "INV-VISIT",
          date: new Date("2026-08-10T11:30:00"),
          totalAmount: 5,
          discount: 0,
          tax: 0,
          paymentMethod: "cash",
          customerId: "c1",
        },
        total: 5,
        earned: 5,
      },
    } as any);
    vi.spyOn(useCases.invoices, "getForPrint").mockResolvedValue({
      ok: true,
      data: {
        invoice: { id: "inv-visit", serialNumber: "INV-VISIT", date: new Date("2026-08-10T11:30:00"), totalAmount: 5, discount: 0, tax: 0, paymentMethod: "cash", customerId: "c1" },
        items: [{ id: "it1", type: "service", name: "قص شعر", price: 5, qty: 1 }],
        customer: { id: "c1", name: "أمل" },
        settings: { name: "لينا بيوتي", currency: "OMR" },
      },
    } as any);

    renderPos(["/pos?appointment=a1"]);

    // Visit context surface: customer, service, employee and stage are visible.
    expect(await screen.findByText(i18n.t("pos.visitContext.title"))).toBeInTheDocument();
    expect(screen.getAllByText("أمل").length).toBeGreaterThan(0);
    expect(screen.getAllByText("سارة").length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t("visit.stage.READY_FOR_CHECKOUT"))).toBeInTheDocument();

    // The booked service is prefilled into the cart from the catalog.
    await waitFor(() => expect(screen.getAllByText("قص شعر").length).toBeGreaterThan(0));

    // Checkout links the visit through the server-authoritative payload.
    fireEvent.click(screen.getByText(i18n.t("Record completed sale")));
    await waitFor(() => expect(checkoutSpy).toHaveBeenCalledTimes(1));
    const payload = checkoutSpy.mock.calls[0][0];
    expect(payload.customerId).toBe("c1");
    expect(payload.employeeId).toBe("e1");
    expect(payload.appointmentId).toBe("a1");
    expect(payload.items).toEqual([{ type: "service", serviceId: "s1", qty: 1, price: 5 }]);
  });
});
