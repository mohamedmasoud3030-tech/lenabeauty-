import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../ui/layout/Sidebar";
import i18n from "../i18n";
import { UserRole } from "../domain/entities/Session";
import { useCases } from "../app/composition/useCases";

vi.mock("../auth", () => ({
  useAuth: () => ({
    me: { id: "u1", username: "admin@salon.com", role: UserRole.ADMIN, name: "Admin" },
    logout: vi.fn(),
  }),
}));

describe("Sidebar client-trial navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(useCases.giftCards, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.servicePackages, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  async function renderSidebar() {
    await i18n.changeLanguage("ar");
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
  }

  it("keeps daily navigation compact while exposing every supported admin workforce route", async () => {
    await renderSidebar();

    for (const label of [
      "Dashboard", "Action Center", "Appointments", "POS", "Customers", "Services",
      "Inventory", "Employees", "Reports", "Expenses", "Accounting", "Attendance",
      "Advances", "Payroll", "Staff Analytics", "Settings",
      "Customer Experience", "Forecasting", "Booking requests", "Admin assistant",
    ]) {
      expect(screen.getByText(i18n.t(label))).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(screen.queryByText(i18n.t("Gift Cards"))).not.toBeInTheDocument();
      expect(screen.queryByText(i18n.t("Packages"))).not.toBeInTheDocument();
    });

    expect(screen.queryByText(i18n.t("Branding"))).not.toBeInTheDocument();
  });

  it("shows optional gift-card and package links only when real rows exist", async () => {
    vi.mocked(useCases.giftCards.list).mockResolvedValue({ ok: true, data: [{ id: "gift-1" }] } as any);
    vi.mocked(useCases.servicePackages.list).mockResolvedValue({ ok: true, data: [{ id: "package-1" }] } as any);

    await renderSidebar();

    expect(await screen.findByText(i18n.t("Gift Cards"))).toBeInTheDocument();
    expect(await screen.findByText(i18n.t("Packages"))).toBeInTheDocument();
  });
});
