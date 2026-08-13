import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useCases } from "../app/composition/useCases";
import AppointmentsPage from "../pages/AppointmentsPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

/**
 * Behavioral tests for the operational Appointments flow (UI only):
 * - Status filter chips (القادم / المكتمل / الملغي) are visible.
 * - «عميل جديد → حجز موعد» inline flow: when the customer search finds
 *   nothing, the dialog offers to create the customer without leaving it.
 */
describe("Appointments operational UX", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
    vi.restoreAllMocks();
    vi.spyOn(useCases.services, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "s1", name: "قص شعر", categoryId: "شعر", price: 5, durationMinutes: 30, isActive: true }],
    } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "e1", name: "سارة", role: "STYLIST", isActive: true }],
    } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  function renderPage() {
    return render(
      <ToastProvider>
        <ConfirmProvider>
          <AppointmentsPage />
        </ConfirmProvider>
      </ToastProvider>,
    );
  }

  it("defaults to day mode on a small portrait phone", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 360 });
    await i18n.changeLanguage("ar");
    renderPage();
    const dayBtn = await screen.findByRole("button", { name: i18n.t("Day") });
    expect(dayBtn.className).toContain("text-primary");
    const weekBtn = screen.getByRole("button", { name: i18n.t("Week") });
    expect(weekBtn.className).not.toContain("shadow-md");
  });

  it("shows status filter chips separating upcoming / completed / canceled", async () => {
    await i18n.changeLanguage("ar");
    renderPage();

    expect((await screen.findAllByText(i18n.t("Upcoming"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t("Completed")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t("Canceled")).length).toBeGreaterThan(0);
  });

  it("creates a new customer inline from the booking dialog when search has no results", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    const createSpy = vi.spyOn(useCases.customers, "create").mockResolvedValue({
      ok: true,
      data: { id: "c-new", name: "سارة", createdAt: new Date(), updatedAt: new Date() },
    } as any);

    renderPage();
    fireEvent.click(await screen.findByText(i18n.t("New Appointment")));

    const searchInput = await screen.findByPlaceholderText(i18n.t("Search by name or phone..."));
    fireEvent.change(searchInput, { target: { value: "سارة" } });

    // No results → inline create prompt appears
    const createButton = await screen.findByText(`${i18n.t("Create customer")}: سارة`, undefined, { timeout: 2000 });
    expect(createButton).toBeInTheDocument();

    fireEvent.click(createButton);

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith({ name: "سارة" }));
    // The created customer is now selected inside the dialog
    await waitFor(() => expect(screen.getAllByText("سارة").length).toBeGreaterThan(0));
  });

  it("completes a scheduled appointment from the edit dialog", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({
      ok: true,
      data: [
        {
          id: "a1",
          customerId: "c1",
          employeeId: "e1",
          serviceId: "s1",
          dateTime: new Date(),
          status: "SCHEDULED",
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: { id: "c1", name: "أمل", phone: "90000000" },
          service: { id: "s1", name: "قص شعر", durationMinutes: 30, price: 5 },
          employee: { id: "e1", name: "سارة" },
        },
      ],
    } as any);
    const updateSpy = vi.spyOn(useCases.appointments, "update").mockResolvedValue({ ok: true, data: {} } as any);

    renderPage();

    // Scheduled appointment card is visible; open it (desktop grid + mobile card both render)
    const cards = await screen.findAllByText("قص شعر");
    fireEvent.click(cards[0]);

    // Explicit Arabic quick actions exist
    expect(screen.getByText(i18n.t("Complete Appointment"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Cancel Appointment"))).toBeInTheDocument();

    fireEvent.click(screen.getByText(i18n.t("Complete Appointment")));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith("a1", { status: "COMPLETED" }));
  });

  it("cancels a scheduled appointment from the edit dialog", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({
      ok: true,
      data: [
        {
          id: "a2",
          customerId: "c1",
          employeeId: "e1",
          serviceId: "s1",
          dateTime: new Date(),
          status: "SCHEDULED",
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: { id: "c1", name: "أمل", phone: "90000000" },
          service: { id: "s1", name: "قص شعر", durationMinutes: 30, price: 5 },
          employee: { id: "e1", name: "سارة" },
        },
      ],
    } as any);
    const updateSpy = vi.spyOn(useCases.appointments, "update").mockResolvedValue({ ok: true, data: {} } as any);

    renderPage();

    const cards = await screen.findAllByText("قص شعر");
    fireEvent.click(cards[0]);
    fireEvent.click(screen.getByText(i18n.t("Cancel Appointment")));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith("a2", { status: "CANCELLED" }));
  });
});
