import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BrandingSettingsPage from "../pages/BrandingSettingsPage";
import { ToastProvider } from "../shared/components/Toast";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

function renderPage() {
  return render(
    <ToastProvider>
      <BrandingSettingsPage />
    </ToastProvider>
  );
}

const updateMock = vi.fn();

function remoteSettings() {
  return {
    id: "center-1",
    name: "LenaBeauty",
    currency: "OMR",
    taxRate: 0,
    displayName: "LenaBeauty Remote",
    displayNameAr: "لينا بيوتي",
    brandPrimaryColor: "#8B5CF6",
    brandSecondaryColor: "#EC4899",
    brandAccentColor: "#06B6D4",
    brandEmail: "info@lenabeauty.om",
    brandTaxNumber: "OM123456789",
    brandRegistrationNumber: "CR/2024/123456",
    brandFooterText: "Powered by LenaBeauty",
    brandFooterTextAr: "مدعوم بواسطة لينا بيوتي",
  };
}

describe("branding persistence", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
    updateMock.mockReset();
    vi.spyOn(useCases.settings, "get").mockResolvedValue({ ok: true, data: remoteSettings() as any });
    vi.spyOn(useCases.settings, "update").mockImplementation(async (data: any) => {
      updateMock(data);
      return { ok: true, data: { ...remoteSettings(), ...data } as any };
    });
  });

  it("loads persisted branding from Supabase (remote is source of truth)", async () => {
    renderPage();
    const nameInputs = await screen.findAllByDisplayValue("LenaBeauty Remote");
    expect(nameInputs.length).toBeGreaterThan(0);
  });

  it("persists a changed branding field to Supabase on save", async () => {
    renderPage();
    const nameInput = (await screen.findAllByDisplayValue("LenaBeauty Remote"))[0];
    fireEvent.change(nameInput, { target: { value: "LenaBeauty Updated" } });
    fireEvent.click(screen.getByText("Save Settings"));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ displayName: "LenaBeauty Updated" }));
  });

  it("keeps localStorage as a cache but remote remains authoritative", async () => {
    renderPage();
    // Wait for remote load to settle and write nothing stale back.
    await screen.findByDisplayValue("LenaBeauty Remote");
    expect(localStorage.getItem("lenabeauty_branding")).toBeNull();
  });

  it("falls back to localStorage when Supabase settings are unavailable", async () => {
    vi.spyOn(useCases.settings, "get").mockResolvedValue({ ok: false, error: new Error("not found") as any });
    localStorage.setItem("lenabeauty_branding", JSON.stringify({ salonName: "Legacy Local", salonNameAr: "موروث" }));
    renderPage();
    expect(await screen.findByDisplayValue("Legacy Local")).toBeInTheDocument();
  });

  it("imports and persists the imported values rather than stale form state", async () => {
    const { container } = renderPage();
    await screen.findByDisplayValue("LenaBeauty Remote");
    const input = container.querySelector('input[accept=".json"]') as HTMLInputElement;
    const imported = {
      salonName: "Imported Salon",
      salonNameAr: "صالون مستورد",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      accentColor: "#778899",
    };
    const file = new File([JSON.stringify(imported)], "branding.json", { type: "application/json" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Imported Salon",
      brandPrimaryColor: "#112233",
    })));
    expect(await screen.findByDisplayValue("Imported Salon")).toBeInTheDocument();
  });

  it("surfaces a toast on repository failure", async () => {
    vi.spyOn(useCases.settings, "update").mockResolvedValue({ ok: false, error: new Error("boom") as any });
    renderPage();
    fireEvent.click(await screen.findByText("Save Settings"));
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });
});
