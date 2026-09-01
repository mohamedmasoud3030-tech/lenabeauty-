import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, afterAll } from "vitest";
import ActionCenterPage from "../pages/ActionCenterPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

/**
 * Slice F — Action Center: a deterministic operational view. Verifies that the
 * attention list derives from real repository data (rebooking due, visits ready
 * for checkout, expiry) and that an empty center is honest — no fabricated
 * scores or placeholder rows.
 */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function completedVisit(id: string, customerId: string, when: Date) {
  return {
    id, customerId, employeeId: "e1", serviceId: "s1", dateTime: when,
    status: "COMPLETED", createdAt: when, updatedAt: when,
    service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
    employee: { id: "e1", name: "Sara" },
  };
}

describe("Action Center (Slice F)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.recipes, "getForService").mockResolvedValue({ ok: true, data: null } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/action-center"]}>
        <ToastProvider>
          <ActionCenterPage />
        </ToastProvider>
      </MemoryRouter>,
    );
  }

  it("derives due-for-rebooking, ready-for-checkout and expiry from real data", async () => {
    vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [
        { id: "c1", name: "Amal", phone: "90000000", totalSpent: 90, loyaltyPoints: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
        { id: "c2", name: "Noor", phone: "91111111", totalSpent: 10, loyaltyPoints: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
      ],
    } as any);
    // Amal last visited 31 days ago over a ~30-day cadence → DUE_FOR_REBOOK.
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({
      ok: true,
      data: [
        completedVisit("a1", "c1", daysAgo(91)),
        completedVisit("a2", "c1", daysAgo(61)),
        completedVisit("a3", "c1", daysAgo(31)),
        {
          id: "a4", customerId: "c2", employeeId: "e1", serviceId: "s1",
          dateTime: new Date(), status: "SCHEDULED", visitStage: "READY_FOR_CHECKOUT",
          createdAt: new Date(), updatedAt: new Date(),
          service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
        },
      ],
    } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.entitlements, "list").mockResolvedValue({
      ok: true,
      data: [{
        id: "ent-1", centerId: "center", kind: "GIFT_CARD", customerId: "c1",
        customerName: "Amal", instrumentName: "Gift Card", remainingValue: 10,
        originalValue: 10, status: "ACTIVE", legacyFlag: false,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        createdAt: new Date(), updatedAt: new Date(),
      }],
    } as any);

    renderPage();

    expect(await screen.findByText(i18n.t("actionCenter.rebooking"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("retention.status.DUE_FOR_REBOOK"))).toBeInTheDocument();
    expect(screen.getAllByText("Amal").length).toBeGreaterThan(0);

    expect(screen.getByText(i18n.t("actionCenter.readyForCheckout"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("actionCenter.checkout"))).toBeInTheDocument();

    expect(screen.getByText(i18n.t("actionCenter.expiry"))).toBeInTheDocument();
  });

  it("is honest when nothing needs attention", async () => {
    vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "c1", name: "Amal", phone: "90000000", totalSpent: 0, loyaltyPoints: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") }],
    } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.entitlements, "list").mockResolvedValue({ ok: true, data: [] } as any);

    renderPage();

    expect(await screen.findByText(i18n.t("actionCenter.allClear"))).toBeInTheDocument();
  });
});
