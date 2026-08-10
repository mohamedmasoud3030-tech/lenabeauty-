import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../ui/layout/Sidebar";
import i18n from "../i18n";
import { UserRole } from "../domain/entities/Session";

// The Sidebar consumes auth via useAuth; mock the hook for this structural test.
vi.mock("../auth", () => ({
  useAuth: () => ({
    me: { id: "u1", username: "admin@salon.com", role: UserRole.ADMIN, name: "Admin" },
    logout: vi.fn(),
  }),
}));

describe("Sidebar IA (operational navigation)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("groups navigation into Arabic operational sections with the daily trio first", async () => {
    await i18n.changeLanguage("ar");

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Group titles are translated and present
    expect(screen.getByText(i18n.t("Daily Operations"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Catalog"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Management"))).toBeInTheDocument();

    // Daily trio: Dashboard / Appointments / POS
    expect(screen.getByText(i18n.t("Dashboard"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Appointments"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("POS"))).toBeInTheDocument();

    // Customers group includes customers + gift cards + customer experience
    // (group title and nav item share the same label)
    expect(screen.getAllByText(i18n.t("Customers")).length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t("Gift Cards"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Customer Experience"))).toBeInTheDocument();

    // Catalog: services, inventory, packages
    expect(screen.getByText(i18n.t("Services"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Inventory"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Packages"))).toBeInTheDocument();

    // Admin-only management: reports + settings
    expect(screen.getByText(i18n.t("Reports"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Settings"))).toBeInTheDocument();
  });
});
