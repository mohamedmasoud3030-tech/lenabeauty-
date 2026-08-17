import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentGatewaySettingsPage from "../pages/PaymentGatewaySettingsPage";
import { ToastProvider } from "../shared/components/Toast";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

describe("payment gateway product scope", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.settings, "getPaymentGatewaySettings").mockResolvedValue({
      ok: true,
      data: {
        provider: "stripe",
        isEnabled: true,
        isSandbox: false,
        bookingDepositEnabled: false,
        bookingDepositType: "fixed",
        bookingDepositValue: 0,
      },
    } as any);
    vi.spyOn(useCases.settings, "updatePaymentGatewaySettings").mockResolvedValue({
      ok: true,
      data: {},
    } as any);
  });

  it("never presents stored metadata as a connected live gateway", async () => {
    render(
      <ToastProvider>
        <PaymentGatewaySettingsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Provider settings are stored for preparation only; no live gateway is connected")).toBeInTheDocument();
    expect(screen.queryByText("Gateway Enabled")).not.toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Payment Gateway Settings" }));
    await waitFor(() => expect(useCases.settings.updatePaymentGatewaySettings).toHaveBeenCalled());
    expect(vi.mocked(useCases.settings.updatePaymentGatewaySettings).mock.calls[0][0]).toEqual(
      expect.objectContaining({ isEnabled: false, isSandbox: true }),
    );
  });
});
