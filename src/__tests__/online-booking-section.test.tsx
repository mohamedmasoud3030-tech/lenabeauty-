import { afterEach, beforeEach, describe, expect, it, vi, afterAll } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import OnlineBookingSection from "../pages/settings/OnlineBookingSection";
import i18n from "../i18n";

/**
 * Settings → Online Booking: the two shareable links (public booking page and
 * client portal), clipboard copy with the 2s "copied" flash, and the silent
 * fallback when the browser blocks the clipboard.
 */

const bookingLink = () => `${window.location.origin}${window.location.pathname}#/book`;
const portalLink = () => `${window.location.origin}${window.location.pathname}#/portal`;

describe("OnlineBookingSection", () => {
  const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    // jsdom has no clipboard API — install the mock the component expects.
    Object.defineProperty(navigator, "clipboard", {
      value: clipboardMock,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { clipboard?: unknown }).clipboard;
    clipboardMock.writeText.mockReset();
    clipboardMock.writeText.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  const writeText = () => clipboardMock.writeText;

  it("shows both shareable links (booking + portal) built from the current origin", () => {
    render(<OnlineBookingSection />);
    expect(screen.getByText("Public booking link")).toBeInTheDocument();
    expect(screen.getByText("Client portal")).toBeInTheDocument();
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(bookingLink());
    expect(inputs[1]).toHaveValue(portalLink());
  });

  it("copy writes the right link to the clipboard, flashes the check, then resets", async () => {
    vi.useFakeTimers();
    render(<OnlineBookingSection />);

    const bookingCopy = screen.getByRole("button", { name: "Copy booking link" });
    const portalCopy = screen.getByRole("button", { name: "Copy portal link" });
    expect(bookingCopy.querySelector(".lucide-copy")).toBeTruthy();

    fireEvent.click(bookingCopy);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText()).toHaveBeenCalledWith(bookingLink());
    expect(bookingCopy.querySelector(".lucide-check")).toBeTruthy();

    // The flash expires after 2s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(bookingCopy.querySelector(".lucide-copy")).toBeTruthy();

    // The portal button is independent.
    fireEvent.click(portalCopy);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText()).toHaveBeenLastCalledWith(portalLink());
    expect(portalCopy.querySelector(".lucide-check")).toBeTruthy();
    expect(bookingCopy.querySelector(".lucide-copy")).toBeTruthy();
  });

  it("a blocked clipboard fails silently and keeps the manual fallback", async () => {
    vi.useFakeTimers();
    writeText().mockRejectedValue(new Error("clipboard blocked"));
    render(<OnlineBookingSection />);

    const bookingCopy = screen.getByRole("button", { name: "Copy booking link" });
    let threw = false;
    try {
      fireEvent.click(bookingCopy);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);

    // No "copied" flash — the link stays on screen, selectable.
    expect(bookingCopy.querySelector(".lucide-check")).toBeNull();
    expect(bookingCopy.querySelector(".lucide-copy")).toBeTruthy();
  });
});
