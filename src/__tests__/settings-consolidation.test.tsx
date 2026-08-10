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
    vi.spyOn(useCases.settings, "getNotificationSettings").mockResolvedValue({ ok: false, error: new Error("not configured") } as any);
    vi.spyOn(useCases.settings, "getPaymentGatewaySettings").mockResolvedValue({ ok: false, error: new Error("not configured") } as any);
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

    fireEvent.click(screen.getByText(i18n.t("Branding")));
    expect(await screen.findByText("شعار الصالون")).toBeInTheDocument();
  });

  it("opens a deep-linked consolidated section without a contextless page", async () => {
    renderPage("/settings?tab=payments");

    await waitFor(() => {
      expect(screen.getByText(i18n.t("Gateway Configuration"))).toBeInTheDocument();
    });
  });
});
