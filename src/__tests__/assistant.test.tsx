import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ToastProvider } from "../shared/components/Toast";
import AssistantPage from "../pages/AssistantPage";
import i18n from "../i18n";
import { GEMINI_KEY_STORAGE_KEY } from "../infrastructure/gemini/adminAssistant";
import { NAV_DESTINATIONS } from "../app/navigation";

function wrap() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AssistantPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("admin Gemini assistant", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("stays admin-only in the registry and behind RequireAdmin", () => {
    const destination = NAV_DESTINATIONS.find((item) => item.path === "/assistant");
    expect(destination?.adminOnly).toBe(true);
    const routes = readFileSync(resolve(process.cwd(), "src/routes.tsx"), "utf8");
    const adminBlock = routes.slice(routes.indexOf('<Route element={<RequireAdmin />}>'));
    expect(adminBlock).toContain('path="/assistant"');
  });

  it("asks for a Gemini key before any chat, and keeps the key off the server", async () => {
    wrap();
    expect(await screen.findByText(i18n.t("Activate with a Gemini API key"))).toBeInTheDocument();
    expect(screen.getByText(/not saved on the server/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t("Write a question"))).not.toBeInTheDocument();

    const source = readFileSync(resolve(process.cwd(), "src/infrastructure/gemini/adminAssistant.ts"), "utf8");
    expect(source).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/);
    expect(source).not.toContain("VITE_");
    expect(source).toContain("localStorage");
    expect(source).not.toContain("supabase");
  });

  it("does not book or write records after a key is saved", async () => {
    wrap();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "test-gemini-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("test-gemini-key");
    expect(await screen.findByLabelText(i18n.t("Write a question"))).toBeInTheDocument();
    expect(screen.getByText(/does not book/i)).toBeInTheDocument();

    const page = readFileSync(resolve(process.cwd(), "src/pages/AssistantPage.tsx"), "utf8");
    expect(page).not.toContain("createAppointment");
    expect(page).not.toContain("window.prompt");
  });

  it("sends the typed question to Gemini and shows the reply", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "test-gemini-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Open the appointments screen." }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    wrap();
    fireEvent.change(await screen.findByLabelText(i18n.t("Write a question")), { target: { value: "How do I book?" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Send message") }));

    expect(await screen.findByText("How do I book?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Open the appointments screen.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(String(init.body)).not.toContain("createAppointment");
  });
});
