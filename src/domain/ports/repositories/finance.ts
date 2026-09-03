import { AccountingJournalEntry, CustomerEntitlement, EntitlementLedgerEntry, Expense, GiftCard, GiftCardTransaction, Invoice, ServicePackage } from "../../entities";
import { CheckoutPayload, CreateJournalEntryInput, EntitlementSummary, InvoicePrintData } from "../../../application/dto";
import { DomainError, Result } from "./shared";

export interface ExpenseRepository {
  list(): Promise<Result<Expense[], DomainError>>;
  create(data: Partial<Expense>): Promise<Result<Expense, DomainError>>;
  update(id: string, data: Partial<Expense>): Promise<Result<Expense, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface InvoiceRepository {
  checkout(payload: CheckoutPayload): Promise<Result<{ invoice: Invoice; total: number; earned: number; giftCardRedeemed?: number; entitlementRedeemed?: number; giftCardsIssued?: { code: string; gift_card_id: string; value: number }[]; packageEntitlements?: string[] }, DomainError>>;
  getForPrint(id: string): Promise<Result<InvoicePrintData, DomainError>>;
}

export interface GiftCardRepository {
  list(): Promise<Result<GiftCard[], DomainError>>;
  issue(input: { code: string; initialBalance: number; customerId: string; employeeId: string; paymentMethod: "cash" | "card" | "transfer"; note?: string; expiresAtISO?: string }): Promise<Result<GiftCard, DomainError>>;
  getTransactions(giftCardId: string): Promise<Result<GiftCardTransaction[], DomainError>>;
}

export interface EntitlementRepository {
  listForCustomer(customerId: string): Promise<Result<CustomerEntitlement[], DomainError>>;
  list(query?: string): Promise<Result<CustomerEntitlement[], DomainError>>;
  listLedger(entitlementId: string): Promise<Result<EntitlementLedgerEntry[], DomainError>>;
  refund(input: { entitlementId: string; amount: number; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; refunded: number; remainingAfter: number }, DomainError>>;
  voidEntitlement(input: { entitlementId: string; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; status: string }, DomainError>>;
  expire(input: { entitlementId: string; reason: string; actorEmployeeId: string }): Promise<Result<{ entitlementId: string; status: string }, DomainError>>;
  getSummary(): Promise<Result<EntitlementSummary, DomainError>>;
}

export interface ServicePackageRepository {
  list(): Promise<Result<ServicePackage[], DomainError>>;
  create(input: { name: string; description?: string; packagePrice: number; items: { serviceId: string; quantity: number }[] }): Promise<Result<ServicePackage, DomainError>>;
}

export interface AccountingRepository {
  listJournalEntries(): Promise<Result<AccountingJournalEntry[], DomainError>>;
  createJournalEntry(input: CreateJournalEntryInput): Promise<Result<AccountingJournalEntry, DomainError>>;
}
