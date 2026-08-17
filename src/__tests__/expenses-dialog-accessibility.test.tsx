import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpensesPage from "../pages/ExpensesPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <ExpensesPage />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

describe("Expenses dialog accessibility", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.expenses, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("keeps the expense save action wired through the shared footer", async () => {
    const createSpy = vi.spyOn(useCases.expenses, "create").mockResolvedValue({
      ok: true,
      data: { id: "expense-1" },
    } as any);
    renderPage();
    const trigger = await screen.findByRole("button", { name: i18n.t("Add Expense") });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: i18n.t("Add Expense") });
    fireEvent.change(within(dialog).getByPlaceholderText(i18n.t("e.g., Electricity Bill")), { target: { value: "Electricity" } });
    const amount = dialog.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "25" } });
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("Save Expense") }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  });

  it("uses the shared dialog focus, Escape, and trigger restoration contract", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: i18n.t("Add Expense") });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: i18n.t("Add Expense") });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: i18n.t("Add Expense") })).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
