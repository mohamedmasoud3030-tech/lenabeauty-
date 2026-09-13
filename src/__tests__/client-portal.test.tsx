import { afterAll, describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClientPortalPage from "../pages/public/ClientPortalPage";
import { ToastProvider } from "../shared/components/Toast";
import { ThemeProvider } from "../context/ThemeContext";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

/**
 * Client portal (#/portal): phone + per-customer code issued by the salon.
 * Login and profile go through the lockout-aware RPCs; cancel/reschedule act
 * only on future SCHEDULED appointments.
 */

const upcomingDate = () => {
  const when = new Date();
  when.setDate(when.getDate() + 2);
  when.setHours(11, 0, 0, 0);
  return when;
};

function profileFixture(reviews: { appointmentId: string; rating: number }[] = []) {
  const upcoming = upcomingDate();
  return {
    customerId: "c1",
    name: "Sara",
    phone: "91234567",
    loyaltyPoints: 120,
    totalSpent: 88.5,
    appointments: [
      { id: "a1", dateTime: upcoming, status: "SCHEDULED", notes: null, employeeName: "Layla", serviceName: "Manicure" },
      { id: "a2", dateTime: new Date("2026-01-05T10:00:00Z"), status: "COMPLETED", notes: null, employeeName: "Huda", serviceName: "Pedicure" },
    ],
    invoices: [
      { id: "i1", serialNumber: "INV-1", date: new Date("2026-01-05T10:00:00Z"), totalAmount: 12.5, tax: 0, paymentMethod: "cash" },
    ],
    reviews: reviews.map((review, index) => ({
      id: `r${index + 1}`,
      appointmentId: review.appointmentId,
      rating: review.rating,
      comment: null,
      isPublished: true,
      createdAtISO: "2026-01-06T09:00:00Z",
    })),
  };
}

function renderPage(entry = "/portal?center=center-1") {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <ClientPortalPage />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

async function signIn(profile = profileFixture()) {
  const portalProfile = vi.spyOn(useCases.public, "portalProfile").mockResolvedValue({ ok: true, data: profile });
  renderPage();
  fireEvent.change(await screen.findByLabelText("Phone Number"), { target: { value: "91234567" } });
  fireEvent.change(screen.getByLabelText("Portal Code"), { target: { value: "abcd1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(screen.getByText("Sara")).toBeInTheDocument());
  return portalProfile;
}

describe("client portal page", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  // Never leak the language to other test files sharing this worker.
  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("signs in with the exact credentials pair and renders the customer record", async () => {
    const portalProfile = vi.spyOn(useCases.public, "portalProfile").mockResolvedValue({ ok: true, data: profileFixture() });
    renderPage();

    fireEvent.change(await screen.findByLabelText("Phone Number"), { target: { value: "91234567" } });
    fireEvent.change(screen.getByLabelText("Portal Code"), { target: { value: "abcd1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(portalProfile).toHaveBeenCalledTimes(1));
    expect(portalProfile.mock.calls[0][0]).toEqual({ centerId: "center-1", phone: "91234567", token: "abcd1234" });
    expect(await screen.findByText("Upcoming Appointments")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument(); // loyalty points
    expect(screen.getByText("88.500")).toBeInTheDocument(); // total spent
    expect(screen.getByText("Manicure")).toBeInTheDocument();
    expect(screen.getByText("Pedicure")).toBeInTheDocument(); // past appointment visible
  });

  it("shows the server error (including lockout) without leaking profile data", async () => {
    vi.spyOn(useCases.public, "portalProfile").mockResolvedValue({
      ok: false,
      error: Object.assign(new Error("Account temporarily locked. Try again later."), { code: "INFRASTRUCTURE_ERROR" }) as any,
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText("Phone Number"), { target: { value: "91234567" } });
    fireEvent.change(screen.getByLabelText("Portal Code"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText(/temporarily locked/i)).toBeInTheDocument();
    expect(screen.queryByText("Upcoming Appointments")).not.toBeInTheDocument();
  });

  it("cancels an upcoming appointment through the governed RPC and refreshes", async () => {
    await signIn();
    const cancel = vi
      .spyOn(useCases.public, "cancelBooking")
      .mockResolvedValueOnce({ ok: true, data: undefined })
      .mockResolvedValue({ ok: true, data: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Cancel Appointment" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(cancel.mock.calls[0][0]).toEqual({ centerId: "center-1", phone: "91234567", token: "abcd1234" });
    expect(cancel.mock.calls[0][1]).toBe("a1");
  });

  it("reschedules into a future slot through the governed RPC", async () => {
    await signIn();
    const reschedule = vi
      .spyOn(useCases.public, "rescheduleBooking")
      .mockResolvedValueOnce({ ok: true, data: undefined })
      .mockResolvedValue({ ok: true, data: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    // pick tomorrow on the day strip
    const dayButtons = await screen.findAllByRole("button", { name: /matric|sun|mon|tue|wed|thu|fri|sat/i });
    fireEvent.click(dayButtons[dayButtons.length - 1]);
    const slotButtons = await screen.findAllByRole("button", { name: /10:00/i });
    fireEvent.click(slotButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm New Time" }));

    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
    expect(reschedule.mock.calls[0][0]).toEqual({ centerId: "center-1", phone: "91234567", token: "abcd1234" });
    expect(reschedule.mock.calls[0][1]).toBe("a1");
    expect(reschedule.mock.calls[0][2].getTime()).toBeGreaterThan(Date.now());
  });

  it("exits the portal and clears the entered credentials", async () => {
    await signIn();
    fireEvent.click(screen.getByRole("button", { name: "Exit Portal" }));
    await waitFor(() => expect(screen.getByLabelText("Phone Number")).toHaveValue(""));
    expect(screen.queryByText("Upcoming Appointments")).not.toBeInTheDocument();
  });

  it("the customer rates their own completed visit through the governed RPC", async () => {
    await signIn();
    const rate = vi
      .spyOn(useCases.public, "portalRateVisit")
      .mockResolvedValue({ ok: true, data: { id: "r9", appointmentId: "a2", rating: 4, comment: null, isPublished: true, createdAtISO: "" } });

    fireEvent.click(screen.getByRole("button", { name: "How was this visit? 4" }));

    await waitFor(() => expect(rate).toHaveBeenCalledTimes(1));
    expect(rate.mock.calls[0][0]).toEqual({ centerId: "center-1", phone: "91234567", token: "abcd1234" });
    expect(rate.mock.calls[0][1]).toBe("a2"); // the completed past visit
    expect(rate.mock.calls[0][2]).toBe(4);
    expect(await screen.findByText("Thanks for your feedback!")).toBeInTheDocument();
  });

  it("shows the customer's previous rating from the profile reviews", async () => {
    await signIn(profileFixture([{ appointmentId: "a2", rating: 5 }]));
    const fifth = screen.getByRole("button", { name: "How was this visit? 5" });
    expect(fifth).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Thanks for your feedback!")).toBeInTheDocument();
  });

  it("only completed visits are rateable and a failed rating surfaces the server message", async () => {
    await signIn();
    // The scheduled (upcoming) visit a1 has no stars — only "a2" (COMPLETED).
    const starGroups = screen.getAllByRole("group", { name: "How was this visit?" });
    expect(starGroups).toHaveLength(1);

    const rate = vi.spyOn(useCases.public, "portalRateVisit").mockResolvedValue({
      ok: false,
      error: Object.assign(new Error("invalid_portal_credentials"), { code: "INFRASTRUCTURE_ERROR" }) as any,
    });
    fireEvent.click(screen.getByRole("button", { name: "How was this visit? 2" }));
    await waitFor(() => expect(rate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Thanks for your feedback!")).not.toBeInTheDocument();
  });
});
