/**
 * WelcomeCompleted — post-setup celebration card tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WelcomeCompleted } from "../shared/components/WelcomeCompleted";
import { recordActivationEvent } from "../shared/activation/events";
import i18n from "../i18n";

describe("WelcomeCompleted post-setup card", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders only after center_fully_setup is recorded", async () => {
    render(<MemoryRouter><WelcomeCompleted /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Your center is set up!")).not.toBeInTheDocument());
  });

  it("shows the completion card when setup is done", async () => {
    recordActivationEvent("center_fully_setup");
    render(<MemoryRouter><WelcomeCompleted /></MemoryRouter>);
    expect(await screen.findByText("Your center is set up!")).toBeInTheDocument();
    expect(screen.getByText("Record your first sale")).toBeInTheDocument();
  });

  it("dismisses permanently on close", async () => {
    recordActivationEvent("center_fully_setup");
    render(<MemoryRouter><WelcomeCompleted /></MemoryRouter>);
    const close = await screen.findByRole("button", { name: /Dismiss/i });
    close.click();
    await waitFor(() => expect(screen.queryByText("Your center is set up!")).not.toBeInTheDocument());
    // Re-render — should stay hidden
    render(<MemoryRouter><WelcomeCompleted /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("Your center is set up!")).not.toBeInTheDocument();
  });

  it("does not record personal data", () => {
    recordActivationEvent("center_fully_setup");
    const raw = localStorage.getItem("lenabeauty_activation_events") ?? "";
    expect(raw).not.toMatch(/@/);
    expect(raw).not.toMatch(/\+?\d{8,}/);
  });
});
