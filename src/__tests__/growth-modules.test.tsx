import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import AccountingPage from "../pages/AccountingPage";
import ForecastingPage from "../pages/ForecastingPage";
import CustomerExperiencePage from "../pages/CustomerExperiencePage";
import AdvancedAutomationPage from "../pages/AdvancedAutomationPage";
import i18n from "../i18n";

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-location">{location.pathname + location.search}</span>;
}

function wrap(ui: ReactNode) {
  return render(
    <MemoryRouter>
      <LocationProbe />
      <ToastProvider>
        <ConfirmProvider>{ui}</ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("growth modules — operator-ready surfaces", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  it("accounting records a manual journal entry through the shared dialog", async () => {
    vi.spyOn(useCases.accounting, "listJournalEntries").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.dashboard, "getPnlMonth").mockResolvedValue({ ok: true, data: { revenue: 10, expenses: 2, profit: 8, baseSalaries: 0, commissions: 0 } } as any);
    const createSpy = vi.spyOn(useCases.accounting, "createJournalEntry").mockResolvedValue({ ok: true, data: { id: "j1" } } as any);

    wrap(<AccountingPage />);
    expect(await screen.findByRole("button", { name: i18n.t("Add journal entry") })).toBeInTheDocument();
    expect(screen.getByText(/not posted here automatically/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Add journal entry") }));
    const dialog = await screen.findByRole("dialog", { name: i18n.t("Add journal entry") });
    fireEvent.change(dialog.querySelector("input") as HTMLInputElement, { target: { value: "Rent adjustment" } });
    const amount = dialog.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "12.5" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save Journal Entry") }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][0].amount).toBe(12.5);
    expect(createSpy.mock.calls[0][0].description).toBe("Rent adjustment");
  });

  it("forecasting names the 30-day run-rate and does not invent a promise", async () => {
    vi.spyOn(useCases.forecasts, "getInventoryForecast").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.forecasts, "getFinancialForecast").mockResolvedValue({
      ok: true,
      data: { projectedMonthlyRevenue: 30, projectedMonthlyExpenses: 10, projectedMonthlyProfit: 20, revenueRunRateDaily: 1 },
    } as any);

    wrap(<ForecastingPage />);
    expect(await screen.findByText(/run-rate, not a promise/i)).toBeInTheDocument();
    expect(screen.getByText("30.000")).toBeInTheDocument();
  });

  it("customer experience records a review without URL-only photo fields", async () => {
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [{ id: "c1", name: "Amina" }] } as any);
    vi.spyOn(useCases.customerExperience, "listReviews").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customerExperience, "listServiceFiles").mockResolvedValue({ ok: true, data: [] } as any);
    const reviewSpy = vi.spyOn(useCases.customerExperience, "createReview").mockResolvedValue({ ok: true, data: { id: "r1" } } as any);

    wrap(<CustomerExperiencePage />);
    expect(await screen.findByText(i18n.t("Save Review"), {}, { timeout: 4000 })).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save Review") }));
    await waitFor(() => expect(reviewSpy).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(reviewSpy.mock.calls[0][0].customerId).toBe("c1");
    expect(reviewSpy.mock.calls[0][0].isPublished).toBe(false);
  });

  it("booking requests save a lead without claiming AI or desktop", async () => {
    vi.spyOn(useCases.advanced, "listAiBookingLeads").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);
    const saveSpy = vi.spyOn(useCases.advanced, "createAiBookingLead").mockResolvedValue({ ok: true, data: { id: "l1" } } as any);

    wrap(<AdvancedAutomationPage />);
    expect(await screen.findByRole("heading", { name: i18n.t("Booking requests") })).toBeInTheDocument();
    expect(screen.getByText(/does not book automatically/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: i18n.t("Guest name") }), { target: { value: "Nora" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save request") }));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0].customerName).toBe("Nora");
  });

  it("opens the schedule with the guest name and phone", async () => {
    vi.spyOn(useCases.advanced, "listAiBookingLeads").mockResolvedValue({
      ok: true,
      data: [{ id: "l1", customerName: "Nora", customerPhone: "96891111111", status: "NEW", sourceChannel: "PHONE" }],
    } as any);
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);
    const statusSpy = vi.spyOn(useCases.advanced, "updateAiBookingLeadStatus").mockResolvedValue({ ok: true, data: {} } as any);

    wrap(<AdvancedAutomationPage />);
    const bookButtons = await screen.findAllByRole("button", { name: i18n.t("Mark as booked") });
    fireEvent.click(bookButtons[0]);
    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith("l1", "BOOKED"));
    await waitFor(() => {
      const href = screen.getByTestId("current-location").textContent || "";
      expect(href).toContain("/appointments?new=1");
      expect(href).toContain("guest=Nora");
      expect(href).toContain("phone=96891111111");
    });
  });

  it("source contracts: no browser prompts, no fake AI, OMR not 2dp, photos are files", () => {
    const accounting = readFileSync(resolve(process.cwd(), "src/pages/AccountingPage.tsx"), "utf8");
    const forecast = readFileSync(resolve(process.cwd(), "src/pages/ForecastingPage.tsx"), "utf8");
    const experience = readFileSync(resolve(process.cwd(), "src/pages/CustomerExperiencePage.tsx"), "utf8");
    const automation = readFileSync(resolve(process.cwd(), "src/pages/AdvancedAutomationPage.tsx"), "utf8");
    const nav = readFileSync(resolve(process.cwd(), "src/app/navigation.ts"), "utf8");

    for (const source of [accounting, forecast, experience, automation]) {
      expect(source).not.toContain("window.prompt");
      expect(source).toContain("PageHeader");
      expect(source).toContain("ListState");
    }
    expect(accounting).not.toContain("toFixed(2)");
    expect(forecast).toContain("last 30 days");
    expect(experience).toContain('type="file"');
    expect(automation).not.toContain("Tauri");
    expect(automation).not.toMatch(/\bAI\b/);
    expect(nav).not.toMatch(/path: \"\/accounting\"[^\n]*deferred: true/);
  });
});
