import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdvancesPage from "../pages/AdvancesPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <AdvancesPage />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

describe("Advances dialog accessibility", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.advances, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "employee-1", name: "سارة", role: "Staff", isActive: true }],
    } as any);
  });

  it("keeps the advance request action wired through the shared footer", async () => {
    const createSpy = vi.spyOn(useCases.advances, "create").mockResolvedValue({
      ok: true,
      data: { id: "advance-1" },
    } as any);
    renderPage();
    const trigger = await screen.findByRole("button", { name: "طلب سلفة جديدة" });
    await waitFor(() => expect(useCases.employees.list).toHaveBeenCalled());
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "طلب سلفة جديدة" });
    fireEvent.change(within(dialog).getByPlaceholderText("أدخل المبلغ"), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "إرسال الطلب" }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  });

  it("uses the shared dialog focus, Escape, and trigger restoration contract", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: "طلب سلفة جديدة" });
    await waitFor(() => expect(useCases.employees.list).toHaveBeenCalled());

    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "طلب سلفة جديدة" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "طلب سلفة جديدة" })).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
