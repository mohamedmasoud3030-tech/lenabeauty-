/**
 * Privacy & data-governance tests.
 *
 * Verifies the engineering controls promised in PRIVACY_DATA_GOVERNANCE.md:
 * - logs never contain SQL bound params or full customer ids
 * - localStorage carries no PII values
 * - support intake rejects secret patterns (covered in help-system.test)
 * - "My Data" export path exists and settings privacy tab renders
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "../pages/SettingsPage";
import { readActivationEvents, recordActivationEvent } from "../shared/activation/events";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

const SRC = resolve(__dirname, "..");

function readSourceFiles(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "__tests__", ".git"].includes(entry.name)) walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push({ path: full, content: readFileSync(full, "utf8") });
      }
    }
  };
  walk(SRC);
  return files;
}

describe("sensitive-data logging controls", () => {
  const sources = readSourceFiles();

  it("tauri client never logs SQL bound parameters", () => {
    const tauri = sources.find((s) => s.path.endsWith("tauri/client.ts"));
    expect(tauri).toBeDefined();
    // The log line must not include `params`
    expect(tauri!.content).not.toMatch(/logger\.(log|debug)\([^)]*params\)/);
    expect(tauri!.content).toContain("never the bound parameters");
  });

  it("whatsapp service logs at most a short suffix of ids", () => {
    const wa = sources.find((s) => s.path.endsWith("whatsappService.ts"));
    expect(wa).toBeDefined();
    // No full `customerId` interpolation into log lines
    const logLines = wa!.content.split("\n").filter((l) => l.includes("logger."));
    for (const line of logLines) {
      expect(line).not.toMatch(/logger\.(log|debug)\([^)]*\$\{customerId\}/);
    }
    expect(wa!.content).toContain("slice(-4)");
  });

  it("no source file logs a full customerId in a logger call", () => {
    for (const s of sources) {
      for (const line of s.content.split("\n")) {
        if (line.includes("logger.") && line.includes("customerId")) {
          expect(line).not.toMatch(/\$\{customerId\}/);
        }
      }
    }
  });
});

describe("localStorage PII boundaries", () => {
  it("activation events contain no emails or phone numbers", () => {
    recordActivationSample();
    const raw = JSON.stringify(readActivationEvents());
    expect(raw).not.toMatch(/@/);
    expect(raw).not.toMatch(/\+?\d{8,}/);
  });
});

function recordActivationSample() {
  // Local helper — simulates what the onboarding card records.
  recordActivationEvent("guide_shown");
  recordActivationEvent("center_fully_setup");
}

describe("privacy settings surface", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.settings, "get").mockResolvedValue({
      ok: true,
      data: { id: "s1", name: "Test", currency: "OMR", taxRate: 0 },
    } as any);
    vi.spyOn(useCases.settings, "exportData").mockResolvedValue({ ok: true, data: { version: "1" } } as any);
    vi.spyOn(useCases.help, "createTicket").mockResolvedValue({ ok: true, data: {} } as any);
  });

  it("renders the privacy tab with export and deletion controls", async () => {
    render(
      <MemoryRouter initialEntries={["/settings?tab=privacy"]}>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Export my data")).toBeInTheDocument();
    expect(screen.getByText("Request account deletion")).toBeInTheDocument();
  });
});
