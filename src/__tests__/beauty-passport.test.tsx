import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterAll } from "vitest";
import CustomersPage from "../pages/CustomersPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <CustomersPage />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

/**
 * Behavioral test for the Beauty Passport: the customer profile composes real
 * history (appointments + invoices), the loyalty/wallet projection and the
 * retention signal into one view — no fabricated cards.
 */
describe("Beauty Passport (customers)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{
        id: "c1",
        name: "Amal",
        phone: "90000000",
        totalSpent: 60,
        loyaltyPoints: 120,
        createdAt: new Date("2026-01-15T10:00:00"),
        updatedAt: new Date("2026-01-15T10:00:00"),
      }],
    } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("composes the passport from real history, entitlements, and service files", async () => {
    vi.spyOn(useCases.customers, "getById").mockResolvedValue({
      ok: true,
      data: {
        id: "c1",
        name: "Amal",
        phone: "90000000",
        totalSpent: 60,
        loyaltyPoints: 120,
        createdAt: new Date("2026-01-15T10:00:00"),
        updatedAt: new Date("2026-01-15T10:00:00"),
      },
    } as any);
    vi.spyOn(useCases.customers, "getHistory").mockResolvedValue({
      ok: true,
      data: {
        appointments: [
          {
            id: "a1",
            customerId: "c1",
            employeeId: "e1",
            serviceId: "s1",
            dateTime: new Date("2026-08-01T10:00:00"),
            status: "COMPLETED",
            createdAt: new Date(),
            updatedAt: new Date(),
            customer: { id: "c1", name: "Amal", phone: "90000000" },
            service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
            employee: { id: "e1", name: "Sara" },
          },
          {
            id: "a2",
            customerId: "c1",
            employeeId: "e1",
            serviceId: "s1",
            dateTime: new Date("2026-09-05T10:00:00"),
            status: "SCHEDULED",
            visitStage: "BOOKED",
            createdAt: new Date(),
            updatedAt: new Date(),
            customer: { id: "c1", name: "Amal", phone: "90000000" },
            service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
            employee: { id: "e1", name: "Sara" },
          },
        ],
        invoices: [
          {
            id: "inv-1",
            customerId: "c1",
            totalAmount: 30,
            subtotalAmount: 30,
            discount: 0,
            manualDiscount: 0,
            tierDiscount: 0,
            loyaltyDiscount: 0,
            giftCardDiscount: 0,
            entitlementRedemption: 0,
            amountPaid: 30,
            loyaltyPointsUsed: 0,
            paymentMethod: "cash",
            date: new Date("2026-08-01T10:30:00"),
            status: "PAID",
            appointmentId: "a1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    } as any);
    vi.spyOn(useCases.entitlements, "listForCustomer").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customerExperience, "listServiceFiles").mockResolvedValue({ ok: true, data: [] } as any);

    renderPage();

    // Open the passport through the desktop History action.
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("History") }));

    // Passport title and customer identity are present.
    expect(await screen.findByText(i18n.t("passport.title"))).toBeInTheDocument();
    expect(screen.getAllByText("Amal").length).toBeGreaterThan(0);

    // Composed relationship snapshot (lifetime spend from the real record).
    expect(screen.getByText(i18n.t("passport.snapshot"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("passport.lifetimeSpend"))).toBeInTheDocument();

    // The timeline merges the paid invoice into the completed visit.
    expect(screen.getByText(i18n.t("passport.timeline"))).toBeInTheDocument();
    expect(screen.getAllByText("Haircut").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sara").length).toBeGreaterThan(0);

    // Wallet summary and retention sections are present (truthful empty state).
    expect(screen.getByText(i18n.t("passport.wallet"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("passport.retention"))).toBeInTheDocument();
  });
});
