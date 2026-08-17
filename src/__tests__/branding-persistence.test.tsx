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

  it("surfaces a toast on repository failure", async () => {
    vi.spyOn(useCases.settings, "update").mockResolvedValue({ ok: false, error: new Error("boom") as any });
    renderPage();
    fireEvent.click(await screen.findByText("Save Settings"));
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("import persists the validated imported values atomically (not the stale pre-import state)", async () => {
    const { container } = renderPage();
    await screen.findByDisplayValue("LenaBeauty Remote");

    const imported = {
      salonName: "Imported Salon",
      salonNameAr: "صالون مستورد",
      address: "Imported Address",
      primaryColor: "red; } body { display: none; }", // CSS payload must be normalized
      secondaryColor: "#112233",
      accentColor: "url(https://attacker.invalid)",
    };
    const file = new File([JSON.stringify(imported)], "branding.json", { type: "application/json" });
    const importInput = container.querySelector('input[accept=".json"]') as HTMLInputElement;
    fireEvent.change(importInput, { target: { files: [file] } });

    // The import flow persists the validated snapshot DIRECTLY. The old code
    // called setSettings(imported) then handleSave(), and handleSave read the
    // previous render's state closure — so Supabase received the OLD values.
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Imported Salon",
        brandPrimaryColor: "#8B5CF6", // malicious payload replaced by the default
        brandSecondaryColor: "#112233",
        brandAccentColor: "#F3E8FF", // malicious payload replaced by the default
      }),
    );
    // The UI reflects the imported (validated) snapshot too.
    expect(await screen.findByDisplayValue("Imported Salon")).toBeInTheDocument();
    // The old values must never be persisted.
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ displayName: "LenaBeauty Remote" }));
  });

  it("refuses to save when a free-text color is not strict #RRGGBB", async () => {
    const { container } = renderPage();
    await screen.findByDisplayValue("LenaBeauty Remote");

    // The primary color text input (next to the color picker).
    const colorText = container.querySelectorAll('input[type="text"].font-mono')[0] as HTMLInputElement;
    fireEvent.change(colorText, { target: { value: "red; } body { display:none }" } });
    fireEvent.click(screen.getByText("Save Settings"));

    expect(await screen.findByText("Brand colors must be in #RRGGBB format")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
    // Nothing invalid may reach the cache either.
    expect(localStorage.getItem("lenabeauty_branding")).toBeNull();
  });

  it("save still works when colors are valid #RRGGBB", async () => {
    const { container } = renderPage();
    await screen.findByDisplayValue("LenaBeauty Remote");

    const colorText = container.querySelectorAll('input[type="text"].font-mono')[0] as HTMLInputElement;
    fireEvent.change(colorText, { target: { value: "#123456" } });
    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ brandPrimaryColor: "#123456" }));
  });
});
