import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ToastProvider } from "../shared/components/Toast";
import { AdminAssistantPanel } from "../shared/components/AdminAssistantPanel";
import { MobileActionDock } from "../ui/layout/MobileActionDock";
import i18n from "../i18n";
import { GEMINI_KEY_STORAGE_KEY, GEMINI_MODEL, GEMINI_MODELS } from "../infrastructure/gemini/adminAssistant";
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

function mockGeminiOk(text = "OK") {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
    expect(screen.getByText(/staff cannot see it/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t("Write a question"))).not.toBeInTheDocument();

    const source = readFileSync(resolve(process.cwd(), "src/infrastructure/gemini/adminAssistant.ts"), "utf8");
    expect(source).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/);
    expect(source).not.toContain("VITE_");
    expect(source).toContain("localStorage");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("gemini-2.0-flash");
    expect(GEMINI_MODEL).toBe("gemini-2.5-flash");
  });

  it("does not activate until Gemini accepts the key", async () => {
    mockGeminiOk("OK");
    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "test-gemini-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));
    expect(await screen.findByLabelText(i18n.t("Write a question"))).toBeInTheDocument();
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("test-gemini-key");
    expect(screen.getByText(/does not book/i)).toBeInTheDocument();

    const panel = readFileSync(resolve(process.cwd(), "src/shared/components/AdminAssistantPanel.tsx"), "utf8");
    expect(panel).not.toContain("createAppointment");
    expect(panel).not.toContain("window.prompt");
  });

  it("activates a valid key even when the ping reply has no text", async () => {
    // Reasoning models can spend the whole token budget on thinking and return
    // a candidate with no parts. HTTP 200 still means the key works.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "test-gemini-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));

    expect(await screen.findByLabelText(i18n.t("Write a question"))).toBeInTheDocument();
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("test-gemini-key");
  });

  it("disables thinking tokens and leaves room for the verification reply", async () => {
    const fetchMock = mockGeminiOk("OK");
    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "test-gemini-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));
    await screen.findByLabelText(i18n.t("Write a question"));

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
      generationConfig: { maxOutputTokens: number; thinkingConfig?: { thinkingBudget: number } };
    };
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(64);
  });

  it("cleans quotes, spaces and bidi marks out of a pasted key", async () => {
    const fetchMock = mockGeminiOk("OK");
    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), {
      target: { value: '\u200f "AIzaSyTEST-key-value " ' },
    });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));
    await screen.findByLabelText(i18n.t("Write a question"));

    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBe("AIzaSyTEST-key-value");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("AIzaSyTEST-key-value");
  });

  it("explains an invalid key and shows the reason returned by Google", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: {
          status: "INVALID_ARGUMENT",
          message: "API key not valid. Please pass a valid API key.",
          details: [{ reason: "API_KEY_INVALID" }],
        },
      }),
    }));

    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/this key is not valid/i);
    expect(screen.getByText(/API key not valid/i)).toBeInTheDocument();
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBeNull();
  });

  it("names a website-restricted key instead of blaming the network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({
        error: {
          status: "PERMISSION_DENIED",
          message: "Requests from referer https://app.example are blocked.",
          details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }],
        },
      }),
    }));

    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "restricted-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/restricted to other websites/i);
  });

  it("falls back to the next model when the first one is retired", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: { status: "NOT_FOUND", message: "models/gemini-2.5-flash is not found" } }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "test-gemini-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));

    expect(await screen.findByLabelText(i18n.t("Write a question"))).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1][0])).toContain(GEMINI_MODELS[1]);
  });

  it("keeps the key form when Gemini rejects the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    wrapPanel();
    fireEvent.change(screen.getByLabelText(i18n.t("Gemini API key")), { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save key") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/rejected this key/i);
    expect(screen.queryByLabelText(i18n.t("Write a question"))).not.toBeInTheDocument();
    expect(localStorage.getItem(GEMINI_KEY_STORAGE_KEY)).toBeNull();
  });

  it("sends the typed question to Gemini and shows the reply", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "test-gemini-key");
    const fetchMock = mockGeminiOk("Open the appointments screen.");

    wrapPanel();
    fireEvent.change(await screen.findByLabelText(i18n.t("Write a question")), { target: { value: "How do I book?" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Send message") }));

    expect(await screen.findByText("How do I book?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Open the appointments screen.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-2.5-flash");
  });

  it("offers a live voice call after the key is saved", async () => {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, "test-gemini-key");
    wrapPanel();
    expect(await screen.findByRole("button", { name: i18n.t("Start live call") })).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Talk now. The assistant will answer by voice."))).toBeInTheDocument();

    const live = readFileSync(resolve(process.cwd(), "src/infrastructure/gemini/adminAssistantLive.ts"), "utf8");
    expect(live).toContain("BidiGenerateContent");
    expect(live).toContain("responseModalities");
    expect(live).not.toContain("VITE_");
    expect(live).not.toContain("createAppointment");
    expect(live).not.toContain("gemini-2.0-flash");
    expect(live).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/);
  });
});
