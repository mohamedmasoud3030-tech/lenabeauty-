import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "../pages/SettingsPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

const centerSettings = {
  id: "center-1",
  name: "LenaBeauty",
  address: "Muscat",
  phone: "90000000",
  cr: "CR-1",
  postalCode: "100",
  currency: "OMR",
  logoPath: null,
  taxRate: 0,
};

describe("Settings consolidation", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.settings, "get").mockResolvedValue({ ok: true, data: centerSettings } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    const notFound = Object.assign(new Error("not configured"), { code: "NOT_FOUND" });
    vi.spyOn(useCases.settings, "getNotificationSettings").mockResolvedValue({ ok: false, error: notFound } as any);
    vi.spyOn(useCases.settings, "getPaymentGatewaySettings").mockResolvedValue({ ok: false, error: notFound } as any);
  });

  function renderPage(initialEntry = "/settings") {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ToastProvider>
          <ConfirmProvider>
            <SettingsPage />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
  }

  it("keeps branding, notifications, and payments inside Settings and hides developer tools", async () => {
    renderPage();

    expect(await screen.findByText(i18n.t("Center Profile"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Branding"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Notifications"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Payment Gateway"))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("Developer Tools"))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t("User Management"))).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(i18n.t("Branding")));
    expect(await screen.findByText("شعار الصالون")).toBeInTheDocument();
  });

  it("presents export truthfully and contains the unsafe restore surface", async () => {
    renderPage();
    fireEvent.click(await screen.findByText(i18n.t("Data Export")));

    expect(await screen.findByText(i18n.t("Operational JSON Export"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Restore is unavailable"))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("Restore Backup Now"))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t("Auto-Backup"))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t("SQL Format"))).not.toBeInTheDocument();
  });

  it("shows a retryable error instead of an endless settings spinner", async () => {
    vi.mocked(useCases.settings.get).mockResolvedValueOnce({ ok: false, error: new Error("network unavailable") } as any);
    renderPage();

    expect(await screen.findByText(i18n.t("Failed to load settings"))).toBeInTheDocument();
    expect(screen.getByText("network unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("Retry") })).toBeInTheDocument();
  });

  it("shows and recovers from a payment-settings load failure", async () => {
    vi.mocked(useCases.settings.getPaymentGatewaySettings).mockResolvedValueOnce({
      ok: false,
      error: Object.assign(new Error("gateway unavailable"), { code: "QUERY_ERROR" }),
    } as any);
    renderPage("/settings?tab=payments");

    expect(await screen.findByText(i18n.t("Failed to load payment settings"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Retry") }));
    expect(await screen.findByText(i18n.t("Gateway Configuration"))).toBeInTheDocument();
    expect(useCases.settings.getPaymentGatewaySettings).toHaveBeenCalledTimes(2);
  });

  it("shows and recovers from a notification-settings load failure", async () => {
    vi.mocked(useCases.settings.getNotificationSettings).mockResolvedValueOnce({
      ok: false,
      error: Object.assign(new Error("notifications unavailable"), { code: "QUERY_ERROR" }),
    } as any);
    renderPage("/settings?tab=notifications");

    expect(await screen.findByText(i18n.t("Failed to load notification settings"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Retry") }));
    expect(await screen.findByText(i18n.t("Reminder Automation"))).toBeInTheDocument();
    expect(useCases.settings.getNotificationSettings).toHaveBeenCalledTimes(2);
  });

  it("opens a deep-linked consolidated section without a contextless page", async () => {
    renderPage("/settings?tab=payments");

    await waitFor(() => {
      expect(screen.getByText(i18n.t("Gateway Configuration"))).toBeInTheDocument();
    });
  });
});
