import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttendancePage from "../pages/AttendancePage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <AttendancePage />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

describe("Attendance dialog accessibility", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.attendance, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "employee-1", name: "سارة", role: "Staff", isActive: true }],
    } as any);
  });

  it("loads only the selected month and refreshes when it changes", async () => {
    renderPage();
    await waitFor(() => expect(useCases.attendance.list).toHaveBeenCalledTimes(1));
    const firstRange = vi.mocked(useCases.attendance.list).mock.calls[0][0];
    expect(firstRange?.fromISO).toBeTruthy();
    expect(firstRange?.toISO).toBeTruthy();

    fireEvent.change(screen.getByLabelText(i18n.t("Month")), { target: { value: "2026-07" } });
    await waitFor(() => expect(useCases.attendance.list).toHaveBeenCalledTimes(2));
    const changedRange = vi.mocked(useCases.attendance.list).mock.calls[1][0];
    expect(changedRange?.fromISO.startsWith("2026-06-30") || changedRange?.fromISO.startsWith("2026-07-01")).toBe(true);
  });

  it("keeps the attendance save action wired through the shared footer", async () => {
    const createSpy = vi.spyOn(useCases.attendance, "create").mockResolvedValue({
      ok: true,
      data: { id: "attendance-1" },
    } as any);
    renderPage();
    const trigger = await screen.findByRole("button", { name: "تسجيل حضور" });
    await waitFor(() => expect(useCases.employees.list).toHaveBeenCalled());
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "تسجيل حضور" });
    fireEvent.click(within(dialog).getByRole("button", { name: "تسجيل" }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  });

  it("uses the shared dialog focus, Escape, and trigger restoration contract", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: "تسجيل حضور" });
    await waitFor(() => expect(useCases.employees.list).toHaveBeenCalled());

    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "تسجيل حضور" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "تسجيل حضور" })).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
