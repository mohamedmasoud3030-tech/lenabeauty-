/**
 * Support Operations role + tickets-tab tests.
 *
 * - /support is ADMIN/MANAGER only (STAFF refused) because the RPCs require
 *   has_center_role(ADMIN, MANAGER); the UI is never shown to a role whose
 *   RPCs would reject it.
 * - The Tickets tab lists tickets via the read RPC (not direct table read).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAdminOrManager } from "../route-guards";
import SupportOperationsPage from "../pages/SupportOperationsPage";
import { AppContext, AppProvider } from "../context/AppContext";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";
import { UserRole, SessionState } from "../domain/entities/Session";
import React from "react";

function renderWithRole(role: UserRole | undefined, initialEntry = "/support") {
  const sessionState: SessionState = role
    ? { status: "authenticated", session: { user: { id: "u1", username: "op", role } } }
    : { status: "anonymous" };
  const mockCtx = {
    isInitialized: true,
    sessionState,
    user: role ? { id: "u1", username: "op", role } : null,
    refresh: vi.fn(),
    applyAuthenticatedSession: vi.fn(),
    logout: vi.fn(),
  } as any;

  return render(
    <AppContext.Provider value={mockCtx}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<RequireAdminOrManager />}>
              <Route path="/support" element={<SupportOperationsPage />} />
            </Route>
            <Route path="/dashboard" element={<div>dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AppContext.Provider>,
  );
}

describe("Support Operations role boundary", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.tenant, "getActiveCenterId").mockReturnValue("c1");
    vi.spyOn(useCases.help, "listTickets").mockResolvedValue({
      ok: true,
      data: [{ id: "t1", centerId: "c1", createdById: "u1", urgency: "normal", status: "NEW", expectedBehavior: "X", actualBehavior: "Y", createdAt: new Date() }],
    } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.admin, "search").mockResolvedValue({ ok: true, data: { customers: [], employees: [], invoices: [] } } as any);
  });

  it("STAFF is redirected away (never shown a UI whose RPCs reject it)", async () => {
    renderWithRole(UserRole.STAFF);
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Support Operations")).not.toBeInTheDocument();
  });

  it("MANAGER can open the page and sees the read-only investigation tabs", async () => {
    renderWithRole(UserRole.MANAGER);
    expect(await screen.findByText("Support Operations")).toBeInTheDocument();
    expect(screen.getByText("Global Search")).toBeInTheDocument();
  });

  it("ADMIN sees the employee management tab", async () => {
    renderWithRole(UserRole.ADMIN);
    expect(await screen.findByText("Support Operations")).toBeInTheDocument();
    expect(screen.getByText("Employee Management")).toBeInTheDocument();
  });
});

describe("Support Tickets tab", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.tenant, "getActiveCenterId").mockReturnValue("c1");
    vi.spyOn(useCases.help, "listTickets").mockResolvedValue({
      ok: true,
      data: [{ id: "t1", centerId: "c1", createdById: "u1", urgency: "high", status: "NEW", expectedBehavior: "Sale should record", actualBehavior: "It errored", createdAt: new Date() }],
    } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.admin, "search").mockResolvedValue({ ok: true, data: { customers: [], employees: [], invoices: [] } } as any);
  });

  it("lists tickets via the read RPC when the tab is opened", async () => {
    renderWithRole(UserRole.ADMIN);
    fireEvent.click(await screen.findByText("Support Tickets"));
    expect(await screen.findByText("Sale should record")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });
});
