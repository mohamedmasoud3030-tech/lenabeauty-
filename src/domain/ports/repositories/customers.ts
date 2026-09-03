import { Appointment, Customer, Invoice } from "../../entities";
import { DomainError, Result } from "./shared";

export interface CustomerRepository {
  list(query?: string): Promise<Result<Customer[], DomainError>>;
  getById(id: string): Promise<Result<Customer, DomainError>>;
  create(data: Partial<Customer>): Promise<Result<Customer, DomainError>>;
  update(id: string, data: Partial<Customer>): Promise<Result<Customer, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
  getHistory(id: string): Promise<Result<{ appointments: Appointment[]; invoices: Invoice[] }, DomainError>>;
}
