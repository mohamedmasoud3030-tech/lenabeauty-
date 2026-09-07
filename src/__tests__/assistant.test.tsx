import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ToastProvider } from "../shared/components/Toast";
import { AdminAssistantPanel } from "../shared/components/AdminAssistantPanel";
import { MobileActionDock } from "../ui/layout/MobileActionDock";
import i18n from "../i18n";
import { GEMINI_KEY_STORAGE_KEY } from "../infrastructure/gemini/adminAssistant";
import { NAV_DESTINATIONS } from "../app/navigation";

function wrapPanel(open = true) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AdminAssistantPanel open={open} onClose={() => {}} />
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

  it("is not a navigation page and stays off staff chrome", () => {
    expect(NAV_DESTINATIONS.some((item) => item.path === "/assistant")).toBe(false);
    const routes = readFileSync(resolve(process.cwd(), "src/routes.tsx"), "utf8");
    expect(routes).not.toContain('path="/assistant"');
    const dock = readFileSync(resolve(process.cwd(), "src/ui/layout/MobileActionDock.tsx"), "utf8");
    expect(dock).toContain("showAssistant");
    expect(dock).toContain("MessageCircle");
    const layout = readFileSync(resolve(process.cwd(), "src/ui/layout/Layout.tsx"), "utf8");
    expect(layout).toContain("AdminAssistantPanel");
    expect(layout).toContain("UserRole.ADMIN");
  });

  it("opens from the bottom dock for admin and stays closed without the icon for others", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <MobileActionDock
          menuOpen={false}
          menuButtonRef={{ current: null }}
          isKeyboardOpen={false}
          onOpenMenu={() => {}}
          onNewAppointment={() => {}}
          showAssistant
          onToggleAssistant={onToggle}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Admin assistant") }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MobileActionDock
          menuOpen={false}
          menuButtonRef={{ current: null }}
          isKeyboardOpen={false}
          onOpenMenu={() => {}}
          onNewAppointment={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: i18n.t("Admin assistant") })).not.toBeInTheDocument();
  });

  it("asks for a Gemini key in the floating panel before any chat", async () => {
    wrapPanel(true);
    expect(await screen.findByRole("dialog", { name: i18n.t("Admin assistant") })).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Activate with a Gemini API key"))).toBeInTheDocument();
    expect(screen.getByText(/not saved on the server/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t("Write a question"))).not.toBeInTheDocument();

    const source = readFileSync(resolve(process.cwd(), "src/infrastructure/gemini/adminAssistant.ts"), "utf8");
    expect(source).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/);
    expect(source).not.toContain("VITE_");
    expect(source).toContain("localStorage");
    expect(source).not.toContain("supabase");
  });

  it("does not book or write records after a key is saved", async () => {
    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "test-gemini-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("test-gemini-key");
    expect(await screen.findByLabelText(i18n.t("Write a question"))).toBeInTheDocument();
    expect(screen.getByText(/does not book/i)).toBeInTheDocument();

    const panel = readFileSync(resolve(process.cwd(), "src/shared/components/AdminAssistantPanel.tsx"), "utf8");
    expect(panel).not.toContain("createAppointment");
    expect(panel).not.toContain("window.prompt");
  });

  it("sends the typed question to Gemini and shows the reply", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "test-gemini-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Open the appointments screen." }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    wrapPanel();
    fireEvent.change(await screen.findByLabelText(i18n.t("Write a question")), { target: { value: "How do I book?" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Send message") }));

    expect(await screen.findByText("How do I book?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Open the appointments screen.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
