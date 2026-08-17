import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCases } from "../app/composition/useCases";
import ReportsPage from "../pages/ReportsPage";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

/**
 * Regression tests for the "no blank screens" requirement on Reports:
 * loading / empty / error must each render a visible, translated state —
 * never `null`, never an empty card, never a dead space.
 */

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ReportsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("ReportsPage screen states", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("renders a translated loading state while the query is pending", async () => {
    vi.spyOn(useCases.reports, "getSales").mockReturnValue(new Promise(() => {}) as any);

    await i18n.changeLanguage("ar");
    renderPage();

    // Loading state is visible (not a blank screen)
    expect(await screen.findByText(i18n.t("Loading analytics..."))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("No Sales Data"))).not.toBeInTheDocument();
  });

  it("renders a translated EMPTY state (with CTA) when there are no sales", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: [] } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    expect(await screen.findByText(i18n.t("No Sales Data"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Start selling to see detailed analytics"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("New Invoice"))).toBeInTheDocument();
  });

  it("renders a translated ERROR state (with Retry) when the sales query fails", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({
      ok: false,
      error: Object.assign(new Error("query exploded"), { code: "QUERY_ERROR" }),
    } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    expect(await screen.findByText(i18n.t("Failed to load sales report"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Retry"))).toBeInTheDocument();
  });

  it("renders an EMPTY state for appointments when there are no rows", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.reports, "getAppointments").mockResolvedValue({ ok: true, data: [] } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    await screen.findByText(i18n.t("No Sales Data"));
    fireEvent.click(screen.getByText(i18n.t("Appointments")));

    expect(await screen.findByText(i18n.t("No Appointments Data"))).toBeInTheDocument();
  });

  it("renders an EMPTY state for inventory when there are no rows", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.reports, "getInventory").mockResolvedValue({ ok: true, data: [] } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    await screen.findByText(i18n.t("No Sales Data"));
    fireEvent.click(screen.getByText(i18n.t("Inventory")));

    expect(await screen.findByText(i18n.t("No Inventory Data"))).toBeInTheDocument();
  });

  it("does not silently hide sales beyond the first visible batch", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `inv-${index + 1}`,
      date: `2026-08-${String((index % 20) + 1).padStart(2, "0")}T10:00:00.000Z`,
      totalAmount: 10,
      discount: 0,
      customer: `Customer ${index + 1}`,
      items: [],
    }));
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: rows } as any);

    await i18n.changeLanguage("en");
    renderPage();

    expect(await screen.findByText("Showing 20 of 21")).toBeInTheDocument();
    expect(screen.queryByText("Customer 21")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findAllByText("Customer 21")).not.toHaveLength(0);
  });

  it("shows the date range filter inputs", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: [] } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    expect(await screen.findByLabelText(i18n.t("From date"))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t("To date"))).toBeInTheDocument();
  });

  it("lists sales transactions with drill-down to transaction details", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({
      ok: true,
      data: [
        {
          id: "inv-1",
          date: "2026-08-10T10:00:00.000Z",
          totalAmount: 15,
          discount: 1,
          customer: "أمل",
          items: [
            { id: "it-1", name: "قص شعر", type: "service", price: 15, qty: 1 },
          ],
        },
      ],
    } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    // Transactions section with the invoice row
    expect(await screen.findByText(i18n.t("Sales Transactions"))).toBeInTheDocument();
    expect(screen.getAllByText("أمل").length).toBeGreaterThan(0);

    // Drill-down opens an accessible transaction details dialog.
    const rowTrigger = screen.getByRole("button", { name: i18n.t("Details") });
    rowTrigger.focus();
    fireEvent.click(rowTrigger);
    const dialog = await screen.findByRole("dialog", { name: i18n.t("Transaction Details") });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(screen.getAllByText("قص شعر").length).toBeGreaterThan(0);
    // Discount is shown when > 0
    expect(screen.getByText("-1.000")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: i18n.t("Transaction Details") })).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(rowTrigger));
  });
});
