import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../context/ThemeContext";
import RateInvoicePage from "../pages/public/RateInvoicePage";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

/**
 * Receipt rating page (#/rate?invoice=…). Possession of the invoice id
 * (printed on the paper) is the credential — the customer experiences the
 * service, so the customer rates it. Clean star tap submits immediately; a
 * typed comment switches to the explicit submit button.
 */

const lookupFixture = {
  centerId: "ctr-1",
  centerName: "Lena Salon",
  invoiceId: "inv-123",
  date: new Date("2026-09-10T14:00:00"),
  totalAmount: 25,
  appointmentId: "a1",
  serviceName: "Haircut",
  employeeName: "Sara",
  existingRating: null,
};

function renderPage(entry = "/rate?invoice=inv-123") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <RateInvoicePage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
  vi.spyOn(useCases.public, "getCenterInfo").mockResolvedValue({
    ok: true,
    data: { name: "Lena Salon", currency: "OMR", phone: null, address: null },
  });
});

afterAll(async () => {
  await i18n.changeLanguage("ar");
});

describe("rate invoice page", () => {
  it("shows the visit summary from the receipt lookup and saves a clean tap instantly", async () => {
    vi.spyOn(useCases.public, "lookupInvoiceRating").mockResolvedValue({ ok: true, data: lookupFixture });
    const rate = vi.spyOn(useCases.public, "rateFromInvoice").mockResolvedValue({
      ok: true,
      data: { id: "r1", appointmentId: "a1", rating: 4, comment: null, isPublished: true, createdAtISO: "" },
    });

    renderPage();

    expect(await screen.findByText("Your visit")).toBeInTheDocument();
    // The header swaps to the center's own name once the lookup resolves.
    expect(screen.getByText("Lena Salon")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("25.000 OMR")).toBeInTheDocument();

    // No comment typed: tapping a star submits immediately (the 2-second rating).
    fireEvent.click(screen.getByRole("button", { name: "Rating 4" }));

    await waitFor(() => expect(rate).toHaveBeenCalledTimes(1));
    expect(rate.mock.calls[0][0]).toBe("inv-123");
    expect(rate.mock.calls[0][1]).toBe(4);
    expect(await screen.findByText("Thanks for your feedback!")).toBeInTheDocument();
    expect(screen.getByText("You can change your rating any time.")).toBeInTheDocument();
  });

  it("a typed comment requires the explicit submit button", async () => {
    vi.spyOn(useCases.public, "lookupInvoiceRating").mockResolvedValue({ ok: true, data: lookupFixture });
    const rate = vi.spyOn(useCases.public, "rateFromInvoice").mockResolvedValue({
      ok: true,
      data: { id: "r1", appointmentId: "a1", rating: 3, comment: "Great", isPublished: true, createdAtISO: "" },
    });

    renderPage();
    await screen.findByText("Your visit");

    fireEvent.change(screen.getByLabelText("Optional comment"), { target: { value: "Great" } });
    fireEvent.click(screen.getByRole("button", { name: "Rating 3" }));
    // Selection only — nothing submitted while a comment is pending.
    expect(rate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    await waitFor(() => expect(rate).toHaveBeenCalledTimes(1));
    expect(rate.mock.calls[0][0]).toBe("inv-123");
    expect(rate.mock.calls[0][1]).toBe(3);
    expect(rate.mock.calls[0][2]).toBe("Great");
  });

  it("pre-selects the existing rating when the customer already rated this visit", async () => {
    vi.spyOn(useCases.public, "lookupInvoiceRating").mockResolvedValue({
      ok: true,
      data: { ...lookupFixture, existingRating: 5 },
    });
    renderPage();
    await screen.findByText("Your visit");
    expect(screen.getByRole("button", { name: "Rating 5" })).toHaveAttribute("aria-pressed", "true");
  });

  it("maps the server invoice_not_found code to the friendly reprint message", async () => {
    vi.spyOn(useCases.public, "lookupInvoiceRating").mockResolvedValue({
      ok: false,
      error: Object.assign(new Error("invoice_not_found"), { code: "INFRASTRUCTURE_ERROR" }) as any,
    });
    renderPage();
    expect(await screen.findByText("We couldn't find this visit. Please ask the salon to reprint the receipt.")).toBeInTheDocument();
  });

  it("a missing invoice parameter is treated as an unknown visit", async () => {
    vi.spyOn(useCases.public, "lookupInvoiceRating");
    renderPage("/rate");
    expect(await screen.findByText("We couldn't find this visit. Please ask the salon to reprint the receipt.")).toBeInTheDocument();
    expect(useCases.public.lookupInvoiceRating).not.toHaveBeenCalled();
  });
});
