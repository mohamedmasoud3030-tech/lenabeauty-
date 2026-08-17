import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("Customers dialog accessibility", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("keeps the customer create action wired through the shared dialog", async () => {
    const createSpy = vi.spyOn(useCases.customers, "create").mockResolvedValue({
      ok: true,
      data: { id: "customer-1", name: "Amina" },
    } as any);
    renderPage();
    const trigger = (await screen.findAllByRole("button", { name: i18n.t("Add Customer") }))[0];
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: i18n.t("Add Customer") });
    fireEvent.change(within(dialog).getByPlaceholderText(i18n.t("Enter customer name")), { target: { value: "Amina" } });
    fireEvent.change(within(dialog).getByPlaceholderText("968XXXXXXXX"), { target: { value: "96890000000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("Create Customer") }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  });

  it("uses the shared dialog focus, Escape, and trigger restoration contract", async () => {
    renderPage();
    const triggers = await screen.findAllByRole("button", { name: i18n.t("Add Customer") });
    const trigger = triggers[0];
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: i18n.t("Add Customer") });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: i18n.t("Add Customer") })).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
