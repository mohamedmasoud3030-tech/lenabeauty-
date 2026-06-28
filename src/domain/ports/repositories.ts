import {
  Customer, Employee, Service, ServiceCategory,
  Appointment, Product, Invoice, Expense, ActivityLog, CenterSettings, GiftCard, GiftCardTransaction, ServicePackage
} from "../entities";
import { User, SessionState } from "../entities/Session";

export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export interface AuthError extends Error {
  code: "AUTH_NOT_CONFIGURED" | "UNAUTHORIZED" | "INVALID_CREDENTIALS" | "INFRASTRUCTURE_ERROR";
}

export interface DomainError extends Error {
  code: "NOT_FOUND" | "VALIDATION_ERROR" | "INFRASTRUCTURE_ERROR" | "BACKEND_METHOD_UNSUPPORTED";
}

export interface AuthRepository {
  login(username: string, password: string): Promise<Result<SessionState, AuthError>>;
  logout(): Promise<Result<void, AuthError>>;
  getSession(): Promise<Result<SessionState, AuthError>>;
  getMyCenters(): Promise<Result<{ id: string, name: string }[], AuthError>>;
}

export interface CustomerRepository {
  list(query?: string): Promise<Result<Customer[], DomainError>>;
  getById(id: string): Promise<Result<Customer, DomainError>>;
  create(data: Partial<Customer>): Promise<Result<Customer, DomainError>>;
  update(id: string, data: Partial<Customer>): Promise<Result<Customer, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
  getHistory(id: string): Promise<Result<{ appointments: Appointment[], invoices: Invoice[] }, DomainError>>;
}

export interface EmployeeRepository {
  list(): Promise<Result<Employee[], DomainError>>;
  create(data: Partial<Employee>): Promise<Result<Employee, DomainError>>;
  update(id: string, data: Partial<Employee>): Promise<Result<Employee, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface ServiceRepository {
  list(): Promise<Result<Service[], DomainError>>;
  create(data: Partial<Service>): Promise<Result<Service, DomainError>>;
  update(id: string, data: Partial<Service>): Promise<Result<Service, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface AppointmentRepository {
  list(range: { fromISO: string, toISO: string }): Promise<Result<Appointment[], DomainError>>;
  create(data: Partial<Appointment>): Promise<Result<Appointment, DomainError>>;
  update(id: string, data: Partial<Appointment>): Promise<Result<Appointment, DomainError>>;
  markNoShow(id: string, input?: { chargeNoShowFee?: boolean; note?: string }): Promise<Result<{ appointment: Appointment; chargedAmount: number }, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface ProductRepository {
  list(): Promise<Result<Product[], DomainError>>;
  listFull(): Promise<Result<Product[], DomainError>>;
  create(data: Partial<Product>): Promise<Result<Product, DomainError>>;
  update(id: string, data: Partial<Product>): Promise<Result<Product, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface ExpenseRepository {
  list(): Promise<Result<Expense[], DomainError>>;
  create(data: Partial<Expense>): Promise<Result<Expense, DomainError>>;
  update(id: string, data: Partial<Expense>): Promise<Result<Expense, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

import { CheckoutPayload, InvoicePrintData, DashboardSummary, PnlData, ChartData, SalesReportRow, AppointmentReportRow, InventoryReportRow, BackupPayload } from "../../application/dto";

export interface InvoiceRepository {
  checkout(payload: CheckoutPayload): Promise<Result<{ invoice: Invoice, total: number, earned: number }, DomainError>>;
  getForPrint(id: string): Promise<Result<InvoicePrintData, DomainError>>;
}

export interface GiftCardRepository {
  list(): Promise<Result<GiftCard[], DomainError>>;
  issue(input: { code: string; initialBalance: number; customerId?: string; note?: string; expiresAtISO?: string }): Promise<Result<GiftCard, DomainError>>;
  getTransactions(giftCardId: string): Promise<Result<GiftCardTransaction[], DomainError>>;
}

export interface ServicePackageRepository {
  list(): Promise<Result<ServicePackage[], DomainError>>;
  create(input: { name: string; description?: string; packagePrice: number; items: { serviceId: string; quantity: number }[] }): Promise<Result<ServicePackage, DomainError>>;
}

export interface SettingsRepository {
  get(): Promise<Result<CenterSettings, DomainError>>;
  update(data: Partial<CenterSettings>): Promise<Result<CenterSettings, DomainError>>;
  uploadLogo(file: File): Promise<Result<{ logoPath: string }, DomainError>>;
  backup(): Promise<Result<{ message: string }, DomainError>>;
  exportData(): Promise<Result<any, DomainError>>;
  restore(data: BackupPayload): Promise<Result<void, DomainError>>;
}

export interface DashboardRepository {
  getSummary(): Promise<Result<DashboardSummary, DomainError>>;
  getPnlMonth(): Promise<Result<PnlData, DomainError>>;
  getRevenueLast7Days(): Promise<Result<ChartData[], DomainError>>;
}

export interface ReportRepository {
  getSales(from: string, to: string): Promise<Result<SalesReportRow[], DomainError>>;
  getAppointments(from: string, to: string): Promise<Result<AppointmentReportRow[], DomainError>>;
  getInventory(): Promise<Result<InventoryReportRow[], DomainError>>;
}

export interface PublicService { id: string; name: string; price: number; durationMinutes: number; }
export interface PublicStaff { id: string; name: string; }
export interface PublicCenterInfo { name: string; currency: string; phone?: string; address?: string; }
export interface BookingInput {
  serviceId: string;
  employeeId?: string;
  customerName: string;
  customerPhone: string;
  dateTimeISO: string;
  notes?: string;
}

export interface BookingRepository {
  listServices(): Promise<Result<PublicService[], DomainError>>;
  listStaff(): Promise<Result<PublicStaff[], DomainError>>;
  getCenterInfo(): Promise<Result<PublicCenterInfo, DomainError>>;
  getTakenSlots(dayISO: string): Promise<Result<{ dateTimeISO: string; employeeId?: string }[], DomainError>>;
  createBooking(input: BookingInput): Promise<Result<{ appointmentId: string }, DomainError>>;
}
