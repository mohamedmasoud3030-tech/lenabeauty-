import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SettingsPage from "../pages/SettingsPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";
import { MemoryRouter } from "react-router-dom";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <ToastProvider>
        <ConfirmProvider>
          <SettingsPage />
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function makeSettings(taxRate: number) {
  return {
    id: "center-1",
    name: "LenaBeauty",
    currency: "OMR",
    taxRate,
    address: "",
    phone: "",
    cr: "",
    postalCode: "",
  };
}

const updateMock = vi.fn();

describe("VAT settings UI", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    updateMock.mockReset();
    vi.spyOn(useCases.settings, "get").mockResolvedValue({ ok: true, data: makeSettings(5) as any });
    vi.spyOn(useCases.settings, "update").mockImplementation(async (data: any) => {
      updateMock(data);
      return { ok: true, data: { ...makeSettings(data.taxRate ?? 0), ...data } as any };
    });
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] });
  });

  it("shows the saved VAT rate after reload", async () => {
    renderPage();
    const spin = await screen.findByPlaceholderText("0");
    await waitFor(() => expect(spin).toHaveValue("5"));
  });

  it("shows an error for invalid (non-numeric) text", async () => {
    renderPage();
    const spin = await screen.findByPlaceholderText("0");
    fireEvent.change(spin, { target: { value: "abc" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(await screen.findByText("Enter a valid number.")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("shows an error for a negative rate and does not save", async () => {
    renderPage();
    const spin = await screen.findByPlaceholderText("0");
    fireEvent.change(spin, { target: { value: "-5" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(await screen.findByText("Value cannot be negative.")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("shows an error for an over-maximum rate", async () => {
    renderPage();
    const spin = await screen.findByPlaceholderText("0");
    fireEvent.change(spin, { target: { value: "150" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(await screen.findByText("Value exceeds the allowed maximum.")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("persists a valid VAT rate to Supabase", async () => {
    renderPage();
    const spin = await screen.findByPlaceholderText("0");
    fireEvent.change(spin, { target: { value: "5" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ taxRate: 5 }));
  });

  it("shows a toast when the repository update fails", async () => {
    vi.spyOn(useCases.settings, "update").mockResolvedValue({ ok: false, error: new Error("boom") as any });
    renderPage();
    const spin = await screen.findByPlaceholderText("0");
    fireEvent.change(spin, { target: { value: "10" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });
});
