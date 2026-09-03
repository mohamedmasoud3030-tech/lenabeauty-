import { Employee } from "../../entities";
import { DomainError, Result } from "./shared";

export interface EmployeeRepository {
  list(): Promise<Result<Employee[], DomainError>>;
  create(data: Partial<Employee>): Promise<Result<Employee, DomainError>>;
  update(id: string, data: Partial<Employee>): Promise<Result<Employee, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}
