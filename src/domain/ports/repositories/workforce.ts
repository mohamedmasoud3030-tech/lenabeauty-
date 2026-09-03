import { AttendanceRecord, EmployeeAdvance, PayrollLineItem, PayrollRun } from "../../entities";
import { DomainError, Result } from "./shared";

export interface AttendanceRepository {
  list(range?: { fromISO: string; toISO: string }): Promise<Result<AttendanceRecord[], DomainError>>;
  listByEmployee(employeeId: string, range?: { fromISO: string; toISO: string }): Promise<Result<AttendanceRecord[], DomainError>>;
  create(data: Partial<AttendanceRecord>): Promise<Result<AttendanceRecord, DomainError>>;
  update(id: string, data: Partial<AttendanceRecord>): Promise<Result<AttendanceRecord, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface AdvanceRepository {
  list(range?: { fromISO: string; toISO: string }): Promise<Result<EmployeeAdvance[], DomainError>>;
  listByEmployee(employeeId: string, range?: { fromISO: string; toISO: string }): Promise<Result<EmployeeAdvance[], DomainError>>;
  create(data: Partial<EmployeeAdvance>): Promise<Result<EmployeeAdvance, DomainError>>;
  update(id: string, data: Partial<EmployeeAdvance>): Promise<Result<EmployeeAdvance, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface PayrollRepository {
  listRuns(): Promise<Result<PayrollRun[], DomainError>>;
  getRun(id: string): Promise<Result<{ run: PayrollRun; lines: PayrollLineItem[] }, DomainError>>;
  createRun(input: { periodMonth: string; notes?: string }): Promise<Result<{ run: PayrollRun; lines: PayrollLineItem[] }, DomainError>>;
  deleteRun(id: string): Promise<Result<void, DomainError>>;
}
