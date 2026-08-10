import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useCases } from "../app/composition/useCases";
import ServicesPage from "../pages/ServicesPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

/**
 * Behavioral tests for the Catalog (Services) shared UX:
 * - Empty state is a visible translated ScreenState (no ghosted dead space).
 * - Enable/disable toggle calls the data layer with isActive flipped.
 */
describe("Services catalog UX", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  function renderPage() {
    return render(
      <ToastProvider>
        <ConfirmProvider>
          <ServicesPage />
        </ConfirmProvider>
      </ToastProvider>,
    );
  }

  it("renders a translated empty state with guidance when there are no services", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);

    renderPage();

    // Desktop table + mobile cards both render in the DOM; at least one
    // visible ScreenState empty block must exist.
    const empties = await screen.findAllByText(i18n.t("No Services Found"));
    expect(empties.length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t("Add your first service to start selling")).length).toBeGreaterThan(0);
  });

  it("disables a service through the toggle (with confirmation) and updates isActive", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.services, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "s1", name: "قص شعر", categoryId: "شعر", price: 5, durationMinutes: 30, isActive: true }],
    } as any);
    const updateSpy = vi.spyOn(useCases.services, "update").mockResolvedValue({
      ok: true,
      data: { id: "s1", name: "قص شعر", isActive: false },
    } as any);

    renderPage();

    const toggle = await screen.findByTitle(i18n.t("Disable"));
    fireEvent.click(toggle);

    // Confirmation dialog appears with the Arabic explanation
    expect(await screen.findByText(i18n.t("Disable Service"))).toBeInTheDocument();
    fireEvent.click(screen.getByText(i18n.t("Confirm")));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith("s1", { isActive: false }));
  });
});
