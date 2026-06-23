import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AppProvider } from "../context/AppContext";
import { AuthProvider, useAuth } from "../auth";
import { RequireAuth } from "../route-guards";
import { UserRole } from "../domain/entities/Session";
import { useCases } from "../app/composition/useCases";
import * as env from "../config/env";

function LoginHarness() {
  const { login } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => void login("admin@example.com", "secret").then(() => navigate("/dashboard", { replace: true }))}
      data-testid="login"
    >
      login
    </button>
  );
}

describe("auth flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});
    vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
    vi.spyOn(useCases.auth, "getMyCenters").mockResolvedValue({ ok: true, data: [] });
  });

  it("allows protected route access immediately after a successful login", async () => {
    vi.spyOn(useCases.auth, "login").mockResolvedValue({
      ok: true,
      data: {
        status: "authenticated",
        session: {
          user: {
            id: "user-1",
            username: "admin@example.com",
            role: UserRole.ADMIN,
            name: "Admin",
          },
        },
      },
    });

    render(
      <AppProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginHarness />} />
              <Route element={<RequireAuth />}>
                <Route path="/dashboard" element={<div>Protected dashboard</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </AppProvider>,
    );

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    screen.getByTestId("login").click();

    await waitFor(() => expect(useCases.auth.login).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Protected dashboard")).toBeInTheDocument());
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});
