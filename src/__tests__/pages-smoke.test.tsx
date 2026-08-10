import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../context/AppContext";
import { AuthProvider } from "../auth";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import { ToastProvider } from "../shared/components/Toast";
import { ThemeProvider } from "../context/ThemeContext";
import { useCases } from "../app/composition/useCases";
import * as env from "../config/env";
import i18n from "../i18n";
import { UserRole } from "../domain/entities/Session";

/**
 * Practical smoke tests: Login bootstraps to a usable form and the Dashboard
 * renders with real empty/error states (no blank screen) when revenue data is
 * unavailable — the mobile-critical path.
 */

function bootAuthMocks() {
  vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});
  (env.config as any).centerId = "center-1";
  (env.config as any).branchMode = "single";
  vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
  vi.spyOn(useCases.auth, "getMyCenters").mockResolvedValue({ ok: true, data: [{ id: "center-1", name: "Lena Beauty" }] });
}

describe("Login page smoke", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    bootAuthMocks();
  });

  it("bootstraps anonymously and renders the login form in Arabic", async () => {
    await i18n.changeLanguage("ar");

    render(
      <ThemeProvider>
        <AppProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={["/login"]}>
              <LoginPage />
            </MemoryRouter>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByPlaceholderText(i18n.t("Username"))).toBeInTheDocument());
    expect(screen.getByPlaceholderText(i18n.t("Password"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Sign In"))).toBeInTheDocument();
    // The form must be usable (not disabled) even after a failed bootstrap.
    expect(screen.getByPlaceholderText(i18n.t("Username"))).not.toBeDisabled();
  });
});

describe("Dashboard page smoke (empty revenue state)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders visible empty states instead of dead space when there is no revenue data", async () => {
    vi.spyOn(useCases.dashboard, "getSummary").mockResolvedValue({
      ok: true,
      data: {
        customers: 3,
        appointments: 0,
        sales: 0,
        revenue: 0,
        canViewRevenue: false,
        lowStockCount: 0,
      },
    } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.dashboard, "getPnlMonth").mockRejectedValue(new Error("no access"));
    vi.spyOn(useCases.dashboard, "getRevenueLast7Days").mockRejectedValue(new Error("no access"));

    await i18n.changeLanguage("ar");

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(await screen.findByText(i18n.t("No Revenue Data"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("No Financial Data"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("No Activity Yet"))).toBeInTheDocument();
  });

  it("renders the revenue chart when 7-day data exists (no fabricated fallback days)", async () => {
    vi.spyOn(useCases.dashboard, "getSummary").mockResolvedValue({
      ok: true,
      data: {
        customers: 1,
        appointments: 1,
        sales: 2,
        revenue: 12,
        canViewRevenue: true,
        todayRevenue: 5,
        lowStockCount: 0,
        currency: "OMR",
      },
    } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.expenses, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.dashboard, "getPnlMonth").mockResolvedValue({
      ok: true,
      data: { revenue: 100, baseSalaries: 30, commissions: 10, expenses: 20, profit: 40 },
    } as any);
    vi.spyOn(useCases.dashboard, "getRevenueLast7Days").mockResolvedValue({
      ok: true,
      data: [
        { date: "2026-08-04", revenue: 2 },
        { date: "2026-08-05", revenue: 3 },
        { date: "2026-08-06", revenue: 0 },
        { date: "2026-08-07", revenue: 4 },
        { date: "2026-08-08", revenue: 1 },
        { date: "2026-08-09", revenue: 2 },
        { date: "2026-08-10", revenue: 5 },
      ],
    } as any);

    await i18n.changeLanguage("en");

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText("No Revenue Data")).not.toBeInTheDocument();
    });
    // Total label shows the real sum of the 7-day data (17), not a fake "0".
    await waitFor(() => {
      expect(screen.getByText("17.00 OMR")).toBeInTheDocument();
    });
  });
});
