import { EmployeeRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Employee } from "../../../domain/entities";
import { createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { Json } from ".././database.types";
import { mapEmployee } from ".././mappers";
import { requiredText, nonNegativeNumber, percentField } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor, toJson } from "./shared";

export class SupabaseEmployeeAdapter implements EmployeeRepository {
  async list(): Promise<Result<Employee[], DomainError>> {
    const centerRes = getCenterIdFor("Employee.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      // The RPC returns full compensation fields only to a center ADMIN. Other
      // operational roles receive the identity fields needed by POS/calendar.
      const { data, error } = await getSupabaseClient().rpc('list_employees_v1', {
        p_center_id: centerRes.data,
      });
      if (error) return { ok: false, error: createQueryError("Employee.list", error.message) };
      const rows = (data as { employees?: unknown[] } | null)?.employees;
      if (!Array.isArray(rows)) {
        return { ok: false, error: createQueryError("Employee.list", "Invalid employee list response") };
      }
      return { ok: true, data: rows.map(mapEmployee) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Employee>): Promise<Result<Employee, DomainError>> {
    const centerRes = getCenterIdFor("Employee.create");
    if (!centerRes.ok) return centerRes as any;

    const nameR = requiredText(data.name);
    const salaryR = nonNegativeNumber(data.salary ?? data.baseSalary);
    const commissionR = percentField(data.commissionPercentage);
    const boundary = validatePayload([
      { field: "name", result: nameR },
      { field: "salary", result: salaryR },
      { field: "commission", result: commissionR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const employeePayload = {
        name: okValue(nameR),
        phone: data.phone ?? null,
        role: data.role ?? "Staff",
        salary: okValue(salaryR),
        baseSalary: okValue(salaryR),
        commissionPercentage: okValue(commissionR),
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      const { data: result, error } = await getSupabaseClient().rpc('admin_create_employee_v1', {
        p_center_id: centerRes.data,
        p_employee: toJson(employeePayload),
      });

      if (error) return { ok: false, error: createQueryError("Employee.create", error.message) };
      const row = (result as { employee?: unknown } | null)?.employee;
      if (!row) return { ok: false, error: createQueryError("Employee.create", "No data returned") };
      return { ok: true, data: mapEmployee(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Employee>): Promise<Result<Employee, DomainError>> {
    const centerRes = getCenterIdFor("Employee.update");
    if (!centerRes.ok) return centerRes as any;

    const nameR = data.name !== undefined ? requiredText(data.name) : null;
    const salaryR = data.salary !== undefined ? nonNegativeNumber(data.salary) : null;
    const baseSalaryR = data.baseSalary !== undefined ? nonNegativeNumber(data.baseSalary) : null;
    const commissionR = data.commissionPercentage !== undefined ? percentField(data.commissionPercentage) : null;
    const boundary = validatePayload([
      ...(nameR ? [{ field: "name", result: nameR }] : []),
      ...(salaryR ? [{ field: "salary", result: salaryR }] : []),
      ...(baseSalaryR ? [{ field: "baseSalary", result: baseSalaryR }] : []),
      ...(commissionR ? [{ field: "commission", result: commissionR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const patch: Record<string, Json | undefined> = {};
      if (data.name !== undefined) patch.name = okValue(nameR);
      if (data.phone !== undefined) patch.phone = data.phone;
      if (data.role !== undefined) patch.role = data.role;
      if (data.salary !== undefined) patch.salary = okValue(salaryR);
      if (data.baseSalary !== undefined) patch.baseSalary = okValue(baseSalaryR);
      if (data.commissionPercentage !== undefined) patch.commissionPercentage = okValue(commissionR);
      if (data.isActive !== undefined) patch.isActive = data.isActive;

      const { data: result, error } = await getSupabaseClient().rpc('admin_update_employee_v1', {
        p_center_id: centerRes.data,
        p_employee_id: id,
        p_patch: toJson(patch),
      });

      if (error) return { ok: false, error: createQueryError("Employee.update", error.message) };
      const row = (result as { employee?: unknown } | null)?.employee;
      if (!row) return { ok: false, error: createQueryError("Employee.update", "No data returned") };
      return { ok: true, data: mapEmployee(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Employee.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient().rpc('admin_delete_employee_v1', {
        p_center_id: centerRes.data,
        p_employee_id: id,
      });
      if (error) return { ok: false, error: createQueryError("Employee.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.delete", (e as Error).message) };
    }
  }
}
