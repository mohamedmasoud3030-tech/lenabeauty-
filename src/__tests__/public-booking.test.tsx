import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicBookingPage from "../pages/public/PublicBookingPage";
import { ToastProvider } from "../shared/components/Toast";
import { ThemeProvider } from "../context/ThemeContext";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

/**
 * Public booking flow (#/book): the anonymous customer walks
 * service → specialist → time → details → confirmation, and the create call
 * carries exactly what the SECURITY DEFINER RPC expects. Server rules are
 * mocked as ok; their behavior is covered by the migration chain tests.
 */

function pickTomorrowSlot() {
  // The day strip defaults to TODAY, whose early slots are already in the
  // past — a real visitor scrolls to a coming day. Click tomorrow's chip
  // (labeled with its date number), then the first 10:00 slot.
  const day = new Date();
  day.setDate(day.getDate() + 1);
  const chip = screen
    .getAllByRole("button")
    .find((button) => {
      const spans = button.querySelectorAll("span");
      return spans.length === 2 && spans[1].textContent === String(day.getDate());
    });
  if (!chip) throw new Error("tomorrow chip not found on the day strip");
  fireEvent.click(chip);
  const slot = screen
    .getAllByRole("button", { name: /10:00/i })
    .find((button) => !((button as HTMLButtonElement).disabled));
  if (!slot) throw new Error("no enabled 10:00 slot on tomorrow");
  fireEvent.click(slot);
}

const service = { id: "s1", name: "Manicure", price: 8, durationMinutes: 45 };
const specialist = { id: "e1", name: "Layla" };

function renderPage(entry = "/book?center=center-1") {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <PublicBookingPage />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("public booking page", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.public, "getCenterInfo").mockResolvedValue({
      ok: true,
      data: { name: "Lena Beauty", currency: "OMR", phone: "90000000", address: "Muscat" },
    });
    vi.spyOn(useCases.public, "listServices").mockResolvedValue({ ok: true, data: [service] });
    vi.spyOn(useCases.public, "listStaff").mockResolvedValue({ ok: true, data: [specialist] });
    vi.spyOn(useCases.public, "listTakenSlots").mockResolvedValue({ ok: true, data: [] });
  });

  it("loads the catalog anonymously and shows the service step", async () => {
    renderPage();
    expect(await screen.findByText("Manicure")).toBeInTheDocument();
    expect(useCases.public.getCenterInfo).toHaveBeenCalledWith("center-1");
    expect(useCases.public.listServices).toHaveBeenCalledWith("center-1");
    expect(screen.queryByText("First available specialist")).not.toBeInTheDocument();
  });

  it("walks the full wizard and submits a booking with the server contract", async () => {
    const create = vi.spyOn(useCases.public, "createBooking").mockResolvedValue({
      ok: true,
      data: { appointmentId: "appt-123", customerId: "c1", status: "SCHEDULED" },
    });
    renderPage();

    fireEvent.click(await screen.findByText("Manicure"));
    fireEvent.click(await screen.findByText("Layla"));

    pickTomorrowSlot();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(await screen.findByLabelText("Your Name"), { target: { value: "Sara" } });
    fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "91234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Booking" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({
      centerId: "center-1",
      serviceId: "s1",
      employeeId: "e1",
      customerName: "Sara",
      customerPhone: "91234567",
    });
    expect(request.dateTime.getTime()).toBeGreaterThan(Date.now());

    expect(await screen.findByText("Your appointment is booked")).toBeInTheDocument();
    expect(screen.getByText("APPT-123")).toBeInTheDocument();
  });

  it("blocks submission when the server rejects the slot and surfaces the error", async () => {
    const create = vi.spyOn(useCases.public, "createBooking").mockResolvedValue({
      ok: false,
      error: Object.assign(new Error("This time slot is no longer available"), { code: "INFRASTRUCTURE_ERROR" }) as any,
    });
    renderPage();

    fireEvent.click(await screen.findByText("Manicure"));
    fireEvent.click(await screen.findByText("Layla"));
    pickTomorrowSlot();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(await screen.findByLabelText("Your Name"), { target: { value: "Sara" } });
    fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "91234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Booking" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/This time slot is no longer available/i)).toBeInTheDocument();
    expect(screen.queryByText("Your appointment is booked")).not.toBeInTheDocument();
  });

  it("rejects a short phone client-side before touching the server", async () => {
    const create = vi.spyOn(useCases.public, "createBooking");
    renderPage();

    fireEvent.click(await screen.findByText("Manicure"));
    fireEvent.click(await screen.findByText("Layla"));
    pickTomorrowSlot();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(await screen.findByLabelText("Your Name"), { target: { value: "Sara" } });
    fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Booking" }));

    await waitFor(() => expect(screen.getByText("Please enter a valid phone number")).toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
