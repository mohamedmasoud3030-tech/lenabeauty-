import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    screen.getByText(i18n.t("Appointments")).click();

    expect(await screen.findByText(i18n.t("No Appointments Data"))).toBeInTheDocument();
  });

  it("renders an EMPTY state for inventory when there are no rows", async () => {
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.reports, "getInventory").mockResolvedValue({ ok: true, data: [] } as any);

    await i18n.changeLanguage("ar");
    renderPage();

    await screen.findByText(i18n.t("No Sales Data"));
    screen.getByText(i18n.t("Inventory")).click();

    expect(await screen.findByText(i18n.t("No Inventory Data"))).toBeInTheDocument();
  });
});
