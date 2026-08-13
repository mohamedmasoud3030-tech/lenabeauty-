import {
  Customer, Employee, Service, ServiceCategory,
  Appointment, Product, Invoice, Expense, ActivityLog, CenterSettings, GiftCard, GiftCardTransaction, ServicePackage,
  CustomerEntitlement, EntitlementLedgerEntry,
  NotificationSettingsEntity, PaymentGatewaySettings, CustomerReview, ServiceFile, AccountingJournalEntry, AiBookingLead,
  AttendanceRecord, EmployeeAdvance, PayrollRun, PayrollLineItem
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
  rotatePortalToken(id: string): Promise<Result<{ customerId: string; portalAccessToken: string }, DomainError>>;
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
  /**
   * Execute the appointment's service atomically: creates the invoice +
   * payment(s), consumes package sessions, accrues commission and material
   * usage, then marks the appointment COMPLETED. Never leaves a COMPLETED
   * appointment without its checkout.
   */
  complete(id: string, input: CompleteAppointmentInput): Promise<Result<{ appointment: Appointment; checkout: CheckoutResult }, DomainError>>;
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

import { CheckoutPayload, InvoicePrintData, DashboardSummary, PnlData, ChartData, SalesReportRow, AppointmentReportRow, InventoryReportRow, BackupPayload, ClientPortalSession, ClientPortalProfile, CreateCustomerReviewInput, CreateServiceFileInput, CreateJournalEntryInput, CreateAiBookingLeadInput, InventoryForecastRow, FinancialForecastSummary, EntitlementSummary, CompleteAppointmentInput } from "../../application/dto";

export interface CheckoutResult {
  invoice: Invoice;
  total: number;
  earned: number;
  giftCardRedeemed?: number;
  entitlementRedeemed?: number;
  giftCardsIssued?: { code: string; gift_card_id: string; value: number }[];
  packageEntitlements?: string[];
  /** Gratuity collected (never commissioned). */
  tips?: number;
  /** Cost of materials consumed (service BOM). */
  cogs?: number;
  /** Service commission accrued on net paid service revenue. */
  commission?: number;
  /** Split tenders recorded for this invoice. */
  payments?: { id: string; amount: number; method: string; tip: number; status: string }[];
}

export interface InvoiceRepository {
  checkout(payload: CheckoutPayload): Promise<Result<CheckoutResult, DomainError>>;
  getForPrint(id: string): Promise<Result<InvoicePrintData, DomainError>>;
}

export interface GiftCardRepository {
  list(): Promise<Result<GiftCard[], DomainError>>;
  /**
   * Sell a gift card through the atomic checkout pipeline so the payment
   * collection and the deferred obligation are recorded together.
   */
  issue(input: { code: string; initialBalance: number; customerId: string; employeeId: string; paymentMethod: "cash" | "card" | "transfer"; note?: string; expiresAtISO?: string }): Promise<Result<GiftCard, DomainError>>;
  getTransactions(giftCardId: string): Promise<Result<GiftCardTransaction[], DomainError>>;
}

export interface EntitlementRepository {
  /** Customer-owned entitlements (packages + gift cards) with remaining sessions. */
  listForCustomer(customerId: string): Promise<Result<CustomerEntitlement[], DomainError>>;
  /** All entitlements for the active center (search by customer/code/instrument). */
  list(query?: string): Promise<Result<CustomerEntitlement[], DomainError>>;
  /** Immutable ledger history for one entitlement. */
  listLedger(entitlementId: string): Promise<Result<EntitlementLedgerEntry[], DomainError>>;
  /** Governed refund of unused remaining value (audited reason + actor). */
  refund(input: { entitlementId: string; amount: number; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; refunded: number; remainingAfter: number }, DomainError>>;
  /** Governed void of an untouched instrument (audited reason + actor). */
  voidEntitlement(input: { entitlementId: string; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; status: string }, DomainError>>;
  /** Governed expiry marker — never recognizes breakage automatically. */
  expire(input: { entitlementId: string; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; status: string }, DomainError>>;
  /** Financial summary separating cash collected / earned revenue / deferred liability / redemptions. */
  getSummary(): Promise<Result<EntitlementSummary, DomainError>>;
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
  getNotificationSettings(): Promise<Result<NotificationSettingsEntity, DomainError>>;
  updateNotificationSettings(data: Partial<NotificationSettingsEntity>): Promise<Result<NotificationSettingsEntity, DomainError>>;
  getPaymentGatewaySettings(): Promise<Result<PaymentGatewaySettings, DomainError>>;
  updatePaymentGatewaySettings(data: Partial<PaymentGatewaySettings>): Promise<Result<PaymentGatewaySettings, DomainError>>;
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


export interface CustomerExperienceRepository {
  listReviews(): Promise<Result<CustomerReview[], DomainError>>;
  createReview(input: CreateCustomerReviewInput): Promise<Result<CustomerReview, DomainError>>;
  listServiceFiles(customerId?: string): Promise<Result<ServiceFile[], DomainError>>;
  createServiceFile(input: CreateServiceFileInput): Promise<Result<ServiceFile, DomainError>>;
}

export interface ForecastRepository {
  getInventoryForecast(): Promise<Result<InventoryForecastRow[], DomainError>>;
  getFinancialForecast(): Promise<Result<FinancialForecastSummary, DomainError>>;
}

export interface AccountingRepository {
  listJournalEntries(): Promise<Result<AccountingJournalEntry[], DomainError>>;
  createJournalEntry(input: CreateJournalEntryInput): Promise<Result<AccountingJournalEntry, DomainError>>;
}

export interface AdvancedRepository {
  listAiBookingLeads(): Promise<Result<AiBookingLead[], DomainError>>;
  createAiBookingLead(input: CreateAiBookingLeadInput): Promise<Result<AiBookingLead, DomainError>>;
}

export interface BookingRepository {
  listServices(): Promise<Result<PublicService[], DomainError>>;
  listStaff(): Promise<Result<PublicStaff[], DomainError>>;
  getCenterInfo(): Promise<Result<PublicCenterInfo, DomainError>>;
  getTakenSlots(dayISO: string): Promise<Result<{ dateTimeISO: string; employeeId?: string }[], DomainError>>;
  createBooking(input: BookingInput): Promise<Result<{ appointmentId: string }, DomainError>>;
  cancelBooking(input: { appointmentId: string; phone: string; token: string; reason?: string }): Promise<Result<{ appointment: Appointment }, DomainError>>;
  rescheduleBooking(input: { appointmentId: string; phone: string; token: string; newDateTimeISO: string; newEmployeeId?: string; reason?: string }): Promise<Result<{ appointment: Appointment }, DomainError>>;
  clientPortalLogin(phone: string, token: string): Promise<Result<ClientPortalSession, DomainError>>;
  getClientPortalProfile(customerId: string, phone: string, token: string): Promise<Result<ClientPortalProfile, DomainError>>;
}

// ===== Staff operations (Phase 1) =====

export interface AttendanceRepository {
  list(range?: { fromISO: string; toISO: string }): Promise<Result<AttendanceRecord[], DomainError>>;
  listByEmployee(employeeId: string, range?: { fromISO: string; toISO: string }): Promise<Result<AttendanceRecord[], DomainError>>;
  create(data: Partial<AttendanceRecord>): Promise<Result<AttendanceRecord, DomainError>>;
  update(id: string, data: Partial<AttendanceRecord>): Promise<Result<AttendanceRecord, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface AdvanceRepository {
  list(): Promise<Result<EmployeeAdvance[], DomainError>>;
  listByEmployee(employeeId: string): Promise<Result<EmployeeAdvance[], DomainError>>;
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
