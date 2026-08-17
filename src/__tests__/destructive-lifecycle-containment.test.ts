import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(resolve(process.cwd(), "src/pages", file), "utf8");

describe("destructive lifecycle containment", () => {
  it("does not expose hard delete paths for retained master records", () => {
    expect(source("CustomersPage.tsx")).not.toContain("useCases.customers.delete");
    expect(source("EmployeesPage.tsx")).not.toContain("useCases.employees.delete");
    expect(source("ServicesPage.tsx")).not.toContain("useCases.services.delete");
    expect(source("InventoryPage.tsx")).not.toContain("useCases.products.delete");
    expect(source("ExpensesPage.tsx")).not.toContain("useCases.expenses.delete");
    expect(source("AttendancePage.tsx")).not.toContain("useCases.attendance.delete");
    expect(source("AdvancesPage.tsx")).not.toContain("useCases.advances.delete");
  });

  it("uses activation state for employees, services, and products", () => {
    expect(source("EmployeesPage.tsx")).toContain("handleToggleActive");
    expect(source("EmployeesPage.tsx")).toContain("{ isActive: nextActive }");
    expect(source("ServicesPage.tsx")).toContain("onToggleActive");
    expect(source("InventoryPage.tsx")).toContain("onToggleActive");
  });
});
