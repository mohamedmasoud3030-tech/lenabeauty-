import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EmployeesPage from "../pages/EmployeesPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

// Employees page is admin-gated; mock an ADMIN session.
vi.mock("../auth", () => ({
  useAuth: () => ({
    me: { id: "u1", username: "admin", role: "ADMIN", name: "Admin" },
    logout: vi.fn(),
  }),
}));

const employee = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "e1",
  name: "Layla Hassan",
  role: "STYLIST",
  phone: "",
  salary: 300,
  baseSalary: 300,
  commissionPercentage: 10,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  monthCommissionTotal: 50,
  ...over,
});

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <EmployeesPage />
      </ConfirmProvider>
    </ToastProvider>
  );
}

async function settled() {
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /Add Employee/i }).length).toBeGreaterThan(0)
  );
}

describe("Employees modal CRUD (portaled overlay)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] });
    vi.spyOn(useCases.employees, "create").mockResolvedValue({ ok: true, data: employee() });
  });

  it("does not render the create form permanently (form is closed by default)", async () => {
    renderPage();
    await settled();
    expect(screen.queryAllByPlaceholderText(/Employee Name/i).length).toBe(0);
  });

  it("opens the create form in a portaled dialog above app chrome", async () => {
    renderPage();
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /Add Employee/i })[0]);
    expect(await screen.findByPlaceholderText(/Employee Name/i)).toBeInTheDocument();
    // The dialog is rendered (single portal instance) above header/bottom-nav.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("creates an employee from the modal and closes it on success", async () => {
    const create = vi.spyOn(useCases.employees, "create");
    renderPage();
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /Add Employee/i })[0]);
    const nameInput = await screen.findByPlaceholderText(/Employee Name/i);
    fireEvent.change(nameInput, { target: { value: "Fatima Ali" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Employee/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByPlaceholderText(/Employee Name/i)).toBeNull());
  });

  it("opens the edit modal prefilled with the employee name", async () => {
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [employee()] });
    vi.spyOn(useCases.employees, "update").mockResolvedValue({ ok: true, data: employee() });
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Layla Hassan/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);
    expect(await screen.findByDisplayValue("Layla Hassan")).toBeInTheDocument();
    expect(screen.getByText(/Edit Employee/i)).toBeInTheDocument();
  });

  it("does not present unimplemented commission values or mutate legacy commission fields", async () => {
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [employee()] });
    const update = vi.spyOn(useCases.employees, "update").mockResolvedValue({ ok: true, data: employee() });
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Layla Hassan/i).length).toBeGreaterThan(0));
    expect(screen.queryByText("Month Commission")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Team Commission")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);
    expect(await screen.findByDisplayValue("Layla Hassan")).toBeInTheDocument();
    expect(screen.queryByText("Commission (%)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save Employee/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty("commissionPercentage");
    expect(update.mock.calls[0][1]).not.toHaveProperty("monthCommissionTotal");
  });

  it("deactivates without deleting payroll or attendance history", async () => {
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [employee()] });
    const update = vi.spyOn(useCases.employees, "update").mockResolvedValue({ ok: true, data: employee({ isActive: false }) });
    const hardDelete = vi.spyOn(useCases.employees, "delete");
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Layla Hassan/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /^Deactivate$/i })[0]);
    expect(await screen.findByText(/without deleting payroll or attendance history/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("e1", { isActive: false }));
    expect(hardDelete).not.toHaveBeenCalled();
  });
});
