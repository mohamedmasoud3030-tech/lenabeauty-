import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ServicesPage from "../pages/ServicesPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <ServicesPage />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function priceInput() {
  return document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
}

describe("Services form validation", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] });
    vi.spyOn(useCases.services, "create").mockResolvedValue({
      ok: true,
      data: { id: "1", name: "Cut", categoryId: "cat-1", categoryName: "Hair", price: 10, pricingMode: "FIXED", durationMinutes: 30, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    });
  });

  it("shows an inline required error when the name is empty and does not submit", async () => {
    const create = vi.spyOn(useCases.services, "create");
    renderPage();
    await screen.findByText(/Total Services/i);
    fireEvent.click(screen.getByRole("button", { name: /Add Service/i }));
    expect(screen.getAllByText("This field is required.").length).toBeGreaterThan(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("shows an inline error for an empty category", async () => {
    renderPage();
    await screen.findByText(/Total Services/i);
    fireEvent.change(screen.getByPlaceholderText(/Swedish Massage/i), { target: { value: "Massage" } });
    fireEvent.change(screen.getByPlaceholderText(/Massage \/ Nails \/ Hair/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /Add Service/i }));
    expect(screen.getAllByText("This field is required.").length).toBeGreaterThan(0);
  });

  it("rejects invalid (non-numeric) price text with a clear message", async () => {
    const create = vi.spyOn(useCases.services, "create");
    renderPage();
    await screen.findByText(/Total Services/i);
    fireEvent.change(screen.getByPlaceholderText(/Swedish Massage/i), { target: { value: "Massage" } });
    fireEvent.change(screen.getByPlaceholderText(/Massage \/ Nails \/ Hair/i), { target: { value: "Hair" } });
    fireEvent.change(priceInput(), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Service/i }));
    expect(screen.getByText("Enter a valid number.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a negative price with a clear message", async () => {
    const create = vi.spyOn(useCases.services, "create");
    renderPage();
    await screen.findByText(/Total Services/i);
    fireEvent.change(screen.getByPlaceholderText(/Swedish Massage/i), { target: { value: "Massage" } });
    fireEvent.change(screen.getByPlaceholderText(/Massage \/ Nails \/ Hair/i), { target: { value: "Hair" } });
    fireEvent.change(priceInput(), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Service/i }));
    expect(screen.getByText("Value cannot be negative.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a zero price so checkout can never create a zero-valued line", async () => {
    const create = vi.spyOn(useCases.services, "create");
    renderPage();
    await screen.findByText(/Total Services/i);
    fireEvent.change(screen.getByPlaceholderText(/Swedish Massage/i), { target: { value: "Consultation" } });
    fireEvent.change(screen.getByPlaceholderText(/Massage \/ Nails \/ Hair/i), { target: { value: "Hair" } });
    fireEvent.change(priceInput(), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Service/i }));
    expect(screen.getByText("Value must be greater than zero.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("submits a valid service successfully", async () => {
    const create = vi.spyOn(useCases.services, "create");
    renderPage();
    await screen.findByText(/Total Services/i);
    fireEvent.change(screen.getByPlaceholderText(/Swedish Massage/i), { target: { value: "Haircut" } });
    fireEvent.change(screen.getByPlaceholderText(/Massage \/ Nails \/ Hair/i), { target: { value: "Hair" } });
    fireEvent.change(priceInput(), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Service/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ price: 25, name: "Haircut", durationMinutes: 30 }));
  });
});
