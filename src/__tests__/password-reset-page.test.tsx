import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import { AppProvider } from "../context/AppContext";
import { AuthProvider } from "../auth";
import { ThemeProvider } from "../context/ThemeContext";
import { useCases } from "../app/composition/useCases";
import * as env from "../config/env";
import i18n from "../i18n";

function bootAuthMocks() {
  vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});
  (env.config as any).centerId = "center-1";
  (env.config as any).branchMode = "single";
  vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
  vi.spyOn(useCases.auth, "onAuthStateChange").mockReturnValue(() => {});
  vi.spyOn(useCases.auth, "getMyCenters").mockResolvedValue({
    ok: true,
    data: [{ id: "center-1", name: "Lena Beauty", role: "ADMIN" }],
  });
}

describe("password reset UI", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("en");
  });

  it("requests a reset without revealing whether the email exists", async () => {
    const request = vi.spyOn(useCases.auth, "requestPasswordReset").mockResolvedValue({ ok: true, data: undefined });

    render(
      <ThemeProvider>
        <AppProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={["/login"]}>
              <LoginPage />
            </MemoryRouter>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "staff@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("staff@example.com"));
    expect(await screen.findByTestId("password-reset-sent")).toHaveTextContent(
      "If an account exists for that email, a reset link has been sent.",
    );
  });

  it("refuses a missing recovery session", async () => {
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("This reset link is missing or has expired. Request a new one from the sign-in page."),
    ).toBeInTheDocument();
  });
});
