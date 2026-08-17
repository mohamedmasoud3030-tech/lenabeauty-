import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AppProvider, useAppContext } from "../context/AppContext";
import { AuthProvider, useAuth } from "../auth";
import { RequireAuth } from "../route-guards";
import { UserRole } from "../domain/entities/Session";
import { useCases } from "../app/composition/useCases";
import * as env from "../config/env";

function ActiveRoleHarness() {
  const { user } = useAppContext();
  return <div data-testid="active-role">{user?.role ?? "none"}</div>;
}

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
    // Bootstrap requires a verifiable center membership — an empty/error
    // membership result now fails safe to Login (see AppContext).
    (env.config as any).centerId = "center-1";
    (env.config as any).branchMode = "single";
    vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
    vi.spyOn(useCases.auth, "onAuthStateChange").mockReturnValue(() => {});
    vi.spyOn(useCases.auth, "getMyCenters").mockResolvedValue({ ok: true, data: [{ id: "center-1", name: "Lena Beauty", role: "ADMIN" }] });
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

  it("uses the active center membership role when Auth metadata is stale", async () => {
    vi.mocked(useCases.auth.getMyCenters).mockResolvedValue({
      ok: true,
      data: [{ id: "center-1", name: "Lena Beauty", role: "STAFF" }],
    });
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
              <Route path="/dashboard" element={<ActiveRoleHarness />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </AppProvider>,
    );

    screen.getByTestId("login").click();
    await waitFor(() => expect(screen.getByTestId("active-role")).toHaveTextContent("STAFF"));
  });
});
