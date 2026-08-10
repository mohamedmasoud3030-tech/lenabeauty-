import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import i18n from "../i18n";

// A child that always throws during render with a sensitive-looking message
// that must NEVER reach the user-facing DOM.
function Bomb() {
  throw new Error("SECRET_internal_db_row_42 username is undefined");
}

describe("ErrorBoundary sanitization", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    // Silence React/logger console noise from the intentional throw.
    vi.spyOn(console, "error").mockImplementation(() => {});
    await i18n.changeLanguage("en");
  });

  it("shows a localized message and never exposes the raw error text", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    // The raw JS expression / internal detail must not leak to the UI.
    expect(screen.queryByText(/SECRET_internal_db_row_42/i)).toBeNull();
    expect(screen.queryByText(/username is undefined/i)).toBeNull();
  });

  it("provides one retry action and one navigation recovery action (no duplicates)", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Back to Dashboard/i })
    ).toBeInTheDocument();
  });

  it("shows a non-sensitive report id for support", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Report ID/i)).toBeInTheDocument();
    // A hex report id should be rendered, not the error message.
    expect(screen.queryByText(/SECRET_internal_db_row_42/i)).toBeNull();
  });

  it("recovers when the resetKey changes (navigation away clears the error)", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/employees">
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

    // Navigating to another route resets the boundary and renders children.
    rerender(
      <ErrorBoundary resetKey="/dashboard">
        <div data-testid="recovered">ok</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("recovered")).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
  });
});
