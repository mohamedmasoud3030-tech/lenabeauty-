import { UserRole } from "./Session";

export interface Customer {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  notes?: string;
  totalSpent: number;
  loyaltyPoints: number;
  lastVisit?: Date;
  portalAccessToken?: string;
  portalAccessEnabled?: boolean;
  portalLastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone?: string;
  salary: number;
  baseSalary: number;
  commissionPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  username?: string;
  password?: string;
  monthCommissionTotal?: number;
}

export type ServicePricingMode = "FIXED" | "STARTING_FROM";

export interface Service {
  id: string;
  name: string;
  /** Actual service_categories.id. */
  categoryId: string;
  /** Human-readable category snapshot returned by the category relation. */
  categoryName?: string;
  /** Fixed selling price, or the minimum allowed final price for STARTING_FROM. */
  price: number;
  pricingMode: ServicePricingMode;
  durationMins?: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceCategory {
  id: string;
  name: string;
}

export enum AppointmentStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW"
}

export interface Appointment {
  id: string;
  customerId: string;
  employeeId?: string;
  serviceId?: string;
  dateTime: Date;
  /** Service duration captured when booked; catalog edits do not rewrite it. */
  durationMinutesSnapshot?: number;
  status: AppointmentStatus;
  /** Lightweight joined records used by the operational calendar. */
  customer?: { id: string; name: string; phone?: string };
  employee?: { id: string; name: string };
  service?: {
    id: string;
    name: string;
    categoryId?: string;
    price: number;
    durationMinutes: number;
    durationMins: number;
  };
  notes?: string;
  depositAmount?: number;
  noShowFeeAmount?: number;
  noShowFeeCharged?: number;
  noShowMarkedAt?: Date;
  noShowNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GiftCard {
  id: string;
  centerId: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  customerId?: string;
  note?: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  centerId: string;
  kind: "ISSUED" | "REDEEMED" | "ADJUSTED";
  amount: number;
  invoiceId?: string;
  note?: string;
  createdAt: Date;
}

/**
 * Purchase-specific entitlement (gift card or package) owned by a customer.
 * Every balance here is derived from `entitlement_ledger` by the database —
 * never a client-written number.
 */
export interface CustomerEntitlement {
  id: string;
  centerId: string;
  customerId?: string;
  kind: "GIFT_CARD" | "PACKAGE";
  giftCardId?: string;
  packageId?: string;
  sourceInvoiceId?: string;
  originalValue: number;
  remainingValue: number;
  status: "ACTIVE" | "PARTIALLY_REDEEMED" | "FULLY_REDEEMED" | "EXPIRED" | "REFUNDED" | "VOID";
  expiresAt?: Date;
  legacyFlag: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Remaining sessions per included service (PACKAGE entitlements only). */
  units?: PackageEntitlementUnit[];
  /** Purchase source invoice serial (joined for display). */
  sourceInvoiceSerial?: string;
  /** Instrument display name (joined for display). */
  instrumentName?: string;
  giftCardCode?: string;
  customerName?: string;
}

export interface PackageEntitlementUnit {
  id: string;
  centerId: string;
  entitlementId: string;
  serviceId: string;
  totalUnits: number;
  usedUnits: number;
  serviceName?: string;
  createdAt: Date;
}

export type EntitlementLedgerEntryType =
  | "ISSUE" | "FUND" | "REDEEM" | "REFUND" | "ADJUSTMENT" | "EXPIRY" | "VOID";

export interface EntitlementLedgerEntry {
  id: string;
  centerId: string;
  entitlementId: string;
  entryType: EntitlementLedgerEntryType;
  amount: number;
  units?: number;
  serviceId?: string;
  invoiceId?: string;
  actorId?: string;
  reason?: string;
  legacyFlag: boolean;
  createdAt: Date;
  actorName?: string;
  invoiceSerial?: string;
}

export interface ServicePackageItem {
  id: string;
  packageId: string;
  serviceId: string;
  quantity: number;
  createdAt: Date;
}

export interface ServicePackage {
  id: string;
  centerId: string;
  name: string;
  description?: string;
  packagePrice: number;
  isActive: boolean;
  items?: ServicePackageItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  stockQuantity: number;
  reorderLevel?: number;
  price: number;
  cost: number;
  /** Disabled products remain in history but cannot be sold. */
  isActive: boolean;
  /** Only inventory-tracked products decrement stock at checkout. */
  trackInventory: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId?: string;
  productId?: string;
  packageId?: string;
  giftCardId?: string;
  price: number;
  quantity: number;
  createdAt: Date;
}

export type InvoiceStatus = "PAID" | "VOID";

export interface Invoice {
  id: string;
  serialNumber?: string;
  date: Date;
  /** Sum of persisted invoice lines before discounts and tax. */
  subtotalAmount: number;
  totalAmount: number;
  /** Compatibility aggregate: manual + tier + gift-card discounts. */
  discount: number;
  manualDiscount: number;
  tierDiscount: number;
  loyaltyDiscount: number;
  giftCardDiscount: number;
  /** Value redeemed from customer entitlements (packages/gift cards by id). */
  entitlementRedemption: number;
  tax?: number;
  taxRate?: number;
  amountPaid: number;
  status: InvoiceStatus;
  loyaltyPointsUsed: number;
  paymentMethod: string;
  customerId: string;
  employeeId?: string;
  staffName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description?: string;
  date: Date;
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  userId?: string;
  createdAt: Date;
}

export interface CenterSettings {
  id: string;
  name: string;
  currency: string;
  taxRate: number;
  logoPath?: string;
  address?: string;
  phone?: string;
  cr?: string;
  postalCode?: string;
  // Center-scoped branding (persisted in Supabase, see branding migration).
  displayName?: string;
  displayNameAr?: string;
  brandEmail?: string;
  brandTaxNumber?: string;
  brandRegistrationNumber?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandAccentColor?: string;
  brandFooterText?: string;
  brandFooterTextAr?: string;
  brandLogoBase64?: string;
}

export interface NotificationSettingsEntity {
  id: string;
  centerId: string;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  whatsappSenderName?: string;
  smsSenderName?: string;
  whatsappTemplateBooking?: string;
  whatsappTemplateReminder?: string;
  smsTemplateReminder?: string;
  createdAt: Date;
  updatedAt: Date;
}


export interface CustomerReview {
  id: string;
  centerId: string;
  customerId: string;
  appointmentId?: string;
  rating: number;
  comment?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceFileImage {
  id: string;
  centerId: string;
  serviceFileId: string;
  imageKind: "BEFORE" | "AFTER" | "REFERENCE";
  imageUrl: string;
  sortOrder: number;
  createdAt: Date;
}

export interface ServiceFile {
  id: string;
  centerId: string;
  customerId: string;
  appointmentId?: string;
  serviceId?: string;
  title: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  images?: ServiceFileImage[];
}

export interface CustomerNotificationEvent {
  id: string;
  centerId: string;
  customerId: string;
  appointmentId?: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL" | "SYSTEM";
  direction: "OUTBOUND" | "INBOUND";
  templateKey?: string;
  messagePreview: string;
  deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "READ";
  sentAt?: Date;
  createdAt: Date;
}

export interface AccountingJournalEntry {
  id: string;
  centerId: string;
  entryDate: Date;
  entryType: "SALE" | "EXPENSE" | "PAYROLL" | "ADJUSTMENT" | "TRANSFER";
  referenceType?: string;
  referenceId?: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiBookingLead {
  id: string;
  centerId: string;
  customerName: string;
  customerPhone?: string;
  preferredServiceId?: string;
  preferredDate?: Date;
  sourceChannel: "WEB" | "WHATSAPP" | "INSTAGRAM" | "PHONE" | "OTHER";
  status: "NEW" | "QUALIFIED" | "BOOKED" | "CLOSED";
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentGatewaySettings {
  id: string;
  centerId: string;
  provider: "manual" | "thawani" | "paytabs" | "stripe";
  isEnabled: boolean;
  isSandbox: boolean;
  publicKey?: string;
  merchantIdentifier?: string;
  webhookSecretHint?: string;
  bookingDepositEnabled: boolean;
  bookingDepositType: "fixed" | "percentage";
  bookingDepositValue: number;
  successUrl?: string;
  cancelUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Staff operations (Phase 1) =====

export type AttendanceMethod = "MANUAL" | "BIOMETRIC" | "MOBILE";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY";
export type AdvanceStatus = "PENDING" | "APPROVED" | "REJECTED" | "DEDUCTED";

export interface AttendanceRecord {
  id: string;
  centerId: string;
  employeeId: string;
  employeeName?: string;
  date: Date;
  checkInTime?: string; // "HH:MM"
  checkOutTime?: string; // "HH:MM"
  method: AttendanceMethod;
  workHours: number;
  status: AttendanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeAdvance {
  id: string;
  centerId: string;
  employeeId: string;
  employeeName?: string;
  amount: number;
  reason: string;
  advanceDate: Date;
  status: AdvanceStatus;
  deductedInRunId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollRun {
  id: string;
  centerId: string;
  periodMonth: string; // "YYYY-MM"
  runDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollLineItem {
  id: string;
  centerId: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  baseSalary: number;
  commissionAmount: number;
  tipsAmount: number;
  advancesDeducted: number;
  netSalary: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
