import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterAll } from "vitest";
import CustomersPage from "../pages/CustomersPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

/**
 * Slice E — Retention Engine: the passport derives the retention status and the
 * next-best operational action from real visit history. No fabricated
 * predictions: the badge, cadence, rebooking window and action all come from
 * `src/domain/retention.ts`.
 */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function completedVisit(id: string, when: Date) {
  return {
    id,
    customerId: "c1",
    employeeId: "e1",
    serviceId: "s1",
    dateTime: when,
    status: "COMPLETED",
    createdAt: when,
    updatedAt: when,
    customer: { id: "c1", name: "Amal", phone: "90000000" },
    service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
    employee: { id: "e1", name: "Sara" },
  };
}

describe("Retention Engine (passport)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{
        id: "c1", name: "Amal", phone: "90000000", totalSpent: 90, loyaltyPoints: 0,
        createdAt: new Date("2026-01-01T10:00:00"), updatedAt: new Date("2026-01-01T10:00:00"),
      }],
    } as any);
    vi.spyOn(useCases.customers, "getById").mockResolvedValue({
      ok: true,
      data: {
        id: "c1", name: "Amal", phone: "90000000", totalSpent: 90, loyaltyPoints: 0,
        createdAt: new Date("2026-01-01T10:00:00"), updatedAt: new Date("2026-01-01T10:00:00"),
      },
    } as any);
    vi.spyOn(useCases.entitlements, "listForCustomer").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customerExperience, "listServiceFiles").mockResolvedValue({ ok: true, data: [] } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  function mockHistory(appointments: any[]) {
    vi.spyOn(useCases.customers, "getHistory").mockResolvedValue({
      ok: true,
      data: { appointments, invoices: [] },
    } as any);
  }

  function renderPage() {
    return render(
      <ToastProvider>
        <ConfirmProvider>
          <CustomersPage />
        </ConfirmProvider>
      </ToastProvider>,
    );
  }

  it("flags a customer past their usual cadence as due for rebooking", async () => {
    // Three visits ~30 days apart; the last one 31 days ago → DUE_FOR_REBOOK.
    mockHistory([
      completedVisit("a1", daysAgo(91)),
      completedVisit("a2", daysAgo(61)),
      completedVisit("a3", daysAgo(31)),
    ]);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("History") }));

    expect(await screen.findByText(i18n.t("retention.status.DUE_FOR_REBOOK"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("retention.action.rebook"))).toBeInTheDocument();
    // The rebooking window is derived from the observed gaps, never invented.
    expect(screen.getByText(i18n.t("retention.rebookingWindow"))).toBeInTheDocument();
  });

  it("classifies a long-absent customer as a win-back to contact", async () => {
    mockHistory([
      completedVisit("a1", daysAgo(130)),
      completedVisit("a2", daysAgo(100)),
    ]);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("History") }));

    expect(await screen.findByText(i18n.t("retention.status.WINBACK"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("retention.action.contact"))).toBeInTheDocument();
  });

  it("treats a single visit as a new relationship (book the next visit)", async () => {
    mockHistory([completedVisit("a1", daysAgo(5))]);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("History") }));

    expect(await screen.findByText(i18n.t("retention.status.NEW"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("retention.action.bookNext"))).toBeInTheDocument();
  });
});
