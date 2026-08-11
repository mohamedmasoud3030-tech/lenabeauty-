import { Appointment, Customer, Employee, Expense, Invoice, Product, Service, CenterSettings, AttendanceRecord, EmployeeAdvance, PayrollRun, PayrollLineItem } from "../../domain/entities";

export type PaymentMethod = "cash" | "card" | "transfer";

export interface ServiceCheckoutItem {
  type: "service";
  serviceId: string;
  qty: number;
  price: number;
}

export interface ProductCheckoutItem {
  type: "product";
  productId: string;
  qty: number;
  price: number;
}

export interface PackageCheckoutItem {
  type: "package";
  packageId: string;
  qty: number;
  price: number;
}

/**
 * A gift-card SALE line: the checkout records the payment collection and the
 * deferred entitlement obligation atomically. `price` is the card value,
 * `code` the new card code (>= 4 chars), `qty` must be 1.
 */
export interface GiftCardCheckoutItem {
  type: "gift_card";
  code: string;
  price: number;
  qty: number;
  note?: string;
  expiresAtISO?: string;
}

export type CheckoutItem = ServiceCheckoutItem | ProductCheckoutItem | PackageCheckoutItem | GiftCardCheckoutItem;

/**
 * Entitlement redemption applied to a checkout (server-capped, atomic):
 *  - "value": monetary credit from a gift-card entitlement (customer-owned)
 *  - "units": package sessions for the included service on this invoice
 */
export interface EntitlementRedemptionInput {
  entitlementId: string;
  type: "value" | "units";
  amount?: number;
  serviceId?: string;
  units?: number;
}

export interface CheckoutPayload {
  customerId: string;
  /** Required by the operational checkout contract for traceability. */
  employeeId: string;
  discountAmount?: number;
  useLoyaltyPoints?: boolean;
  giftCardCode?: string;
  paymentMethod: PaymentMethod;
  items: CheckoutItem[];
  /** Optional customer-owned entitlement redemptions (packages / gift cards). */
  entitlementRedemptions?: EntitlementRedemptionInput[];
}

export interface InvoicePrintData {
  invoice: Invoice;
  items: {
    id: string;
    type: "service" | "product" | "package" | "gift_card";
    name: string;
    price: number;
    qty: number;
  }[];
  customer?: Customer;
  settings?: CenterSettings;
}

export interface DashboardSummary {
  customers: number;
  appointments: number;
  sales: number;
  revenue: number;
  canViewRevenue?: boolean;
  todayRevenue?: number;
  todayAppointments?: number;
  newCustomersThisMonth?: number;
  lowStockCount?: number;
  currency?: string;
}

export interface PnlData {
  revenue: number;
  baseSalaries: number;
  commissions: number;
  expenses: number;
  profit: number;
}

export interface ChartData {
  date: string;
  revenue: number;
}

export interface SalesReportRow {
  date: string;
  id: string;
  totalAmount: number;
  discount: number;
  customer?: string;
  items: { id: string, name: string, type: "service" | "product" | "package" | "gift_card", price: number, qty: number }[];
  /**
   * Financial classification (OMR, 3 decimals):
   *  - prepaidAmount: gift-card/package sale value on this invoice — NOT
   *    earned revenue, it is a deferred obligation.
   *  - redeemedAmount: entitlement value consumed on this invoice (gift card
   *    + package redemptions) — recognized service revenue.
   *  - earnedRevenue: service/product revenue recognized for this invoice =
   *    totalAmount − prepaidAmount + redeemedAmount.
   */
  prepaidAmount: number;
  redeemedAmount: number;
  earnedRevenue: number;
}

export interface AppointmentReportRow {
  dateTime: string;
  id: string;
  status: string;
  customer?: { name: string; };
  service?: { name: string; };
  employee?: { name: string; };
}

export interface InventoryReportRow {
  id: string;
  name: string;
  cost: number;
  price: number;
  stockQuantity: number;
}

export function validateCheckoutPayload(payload: any): string[] {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object") return ["Payload is required"];
  if (typeof payload.customerId !== "string" || !payload.customerId.trim()) {
    errors.push("Customer details are missing");
  }
  if (typeof payload.employeeId !== "string" || !payload.employeeId.trim()) {
    errors.push("Employee details are missing");
  }
  if (!["cash", "card", "transfer"].includes(payload.paymentMethod)) {
    errors.push("Unsupported payment method");
  }
  if (payload.discountAmount !== undefined &&
      (typeof payload.discountAmount !== "number" || !Number.isFinite(payload.discountAmount) || payload.discountAmount < 0)) {
    errors.push("Discount must be a non-negative finite amount");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push("Cart must not be empty");
    return errors;
  }
  payload.items.forEach((item: any, idx: number) => {
    const slot = idx + 1;
    if (!item || !["service", "product", "package", "gift_card"].includes(item.type)) {
      errors.push(`Item at slot ${slot} has invalid type`);
      return;
    }
    if (item.type === "gift_card") {
      if (typeof item.code !== "string" || item.code.trim().length < 4) {
        errors.push(`Item at slot ${slot} must have a gift card code of at least 4 characters`);
      }
      if (item.qty !== 1) {
        errors.push(`Item at slot ${slot} gift card quantity must be 1`);
      }
      if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0) {
        errors.push(`Item at slot ${slot} must have a positive finite gift card value`);
      }
      return;
    }
    const reference = item.type === "service" ? item.serviceId : item.type === "product" ? item.productId : item.packageId;
    if (typeof reference !== "string" || !reference.trim()) {
      errors.push(`Item at slot ${slot} is missing its catalog reference`);
    }
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      errors.push(`Item at slot ${slot} must have a positive whole quantity`);
    }
    if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0) {
      errors.push(`Item at slot ${slot} must have a positive finite price`);
    }
  });
  if (payload.entitlementRedemptions !== undefined) {
    if (!Array.isArray(payload.entitlementRedemptions)) {
      errors.push("Entitlement redemptions must be an array");
    } else {
      const seen = new Set<string>();
      payload.entitlementRedemptions.forEach((r: any, idx: number) => {
        const slot = idx + 1;
        if (!r || typeof r !== "object" || typeof r.entitlementId !== "string" || !r.entitlementId.trim()) {
          errors.push(`Entitlement redemption ${slot} is missing its entitlement id`);
          return;
        }
        if (seen.has(r.entitlementId)) {
          errors.push(`Entitlement redemption ${slot} duplicates entitlement ${r.entitlementId}`);
        }
        seen.add(r.entitlementId);
        if (r.type !== "value" && r.type !== "units") {
          errors.push(`Entitlement redemption ${slot} has invalid type`);
          return;
        }
        if (r.type === "value" && (typeof r.amount !== "number" || !Number.isFinite(r.amount) || r.amount <= 0)) {
          errors.push(`Entitlement redemption ${slot} must have a positive finite amount`);
        }
        if (r.type === "units") {
          if (typeof r.serviceId !== "string" || !r.serviceId.trim()) {
            errors.push(`Entitlement redemption ${slot} is missing its service reference`);
          }
          if (!Number.isInteger(r.units) || (r.units ?? 0) <= 0) {
            errors.push(`Entitlement redemption ${slot} must have a positive whole unit count`);
          }
        }
      });
    }
  }
  return errors;
}

export interface BackupPayload {
  version: string;
  timestamp: string;
  data: {
    customers?: Customer[];
    employees?: Employee[];
    services?: Service[];
    appointments?: Appointment[];
    products?: Product[];
    expenses?: Expense[];
    settings?: CenterSettings;
    invoices?: Invoice[];
    attendance?: AttendanceRecord[];
    advances?: EmployeeAdvance[];
    payrollRuns?: PayrollRun[];
    payrollLines?: PayrollLineItem[];
  };
}

export function validateBackupPayload(payload: any): payload is BackupPayload {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.version !== "string") return false;
  if (!payload.data || typeof payload.data !== "object") return false;
  return true;
}


/**
 * Selling a gift card: the payment method and acting employee are required so
 * the sale flows through the checkout payment pipeline (invoice + payment +
 * deferred entitlement), never as an unbooked card.
 */
export interface IssueGiftCardInput {
  code: string;
  initialBalance: number;
  customerId: string;
  employeeId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  expiresAtISO?: string;
}

export type EntitlementStatus =
  | "ACTIVE"
  | "PARTIALLY_REDEEMED"
  | "FULLY_REDEEMED"
  | "EXPIRED"
  | "REFUNDED"
  | "VOID";

export interface EntitlementSummary {
  /** Cash actually collected from payments in the period. */
  cashCollected: number;
  /** Earned service/product revenue in the period (redemptions included). */
  earnedRevenue: number;
  /** Outstanding prepaid obligation (gift cards + packages, ledger-derived). */
  deferredLiability: number;
  /** Value redeemed from entitlements in the period. */
  redemptions: number;
  /** Gift-card/package sale value booked as deferred in the period. */
  prepaidSales: number;
}

export interface CreateServicePackageInput {
  name: string;
  description?: string;
  packagePrice: number;
  items: { serviceId: string; quantity: number }[];
}

export interface NotificationSettingsInput {
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  whatsappSenderName?: string;
  smsSenderName?: string;
  whatsappTemplateBooking?: string;
  whatsappTemplateReminder?: string;
  smsTemplateReminder?: string;
}

export interface PaymentGatewaySettingsInput {
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
}

export interface ClientPortalSession {
  customerId: string;
  name: string;
  phone?: string;
  loyaltyPoints: number;
  totalSpent: number;
  lastVisitISO?: string;
  portalLastLoginAtISO?: string;
}


export interface PortalReviewDto {
  id: string;
  appointmentId?: string;
  rating: number;
  comment?: string;
  isPublished: boolean;
  createdAtISO: string;
}

export interface PortalServiceFileImageDto {
  id: string;
  imageKind: "BEFORE" | "AFTER" | "REFERENCE";
  imageUrl: string;
  sortOrder: number;
  createdAtISO: string;
}

export interface PortalServiceFileDto {
  id: string;
  appointmentId?: string;
  serviceId?: string;
  title: string;
  note?: string;
  createdAtISO: string;
  images: PortalServiceFileImageDto[];
}

export interface PortalNotificationEventDto {
  id: string;
  appointmentId?: string;
  channel: string;
  direction: string;
  templateKey?: string;
  messagePreview: string;
  deliveryStatus: string;
  sentAtISO?: string;
  createdAtISO: string;
}

export interface PortalReferralDto {
  code?: string;
  pointsEarned: number;
}

export interface CreateCustomerReviewInput {
  customerId: string;
  appointmentId?: string;
  rating: number;
  comment?: string;
  isPublished?: boolean;
}

export interface CreateServiceFileInput {
  customerId: string;
  appointmentId?: string;
  serviceId?: string;
  title: string;
  note?: string;
  beforeImages?: string[];
  afterImages?: string[];
  referenceImages?: string[];
}

export interface CreateJournalEntryInput {
  entryDateISO?: string;
  entryType: "SALE" | "EXPENSE" | "PAYROLL" | "ADJUSTMENT" | "TRANSFER";
  referenceType?: string;
  referenceId?: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency?: string;
}

export interface CreateAiBookingLeadInput {
  customerName: string;
  customerPhone?: string;
  preferredServiceId?: string;
  preferredDateISO?: string;
  sourceChannel?: "WEB" | "WHATSAPP" | "INSTAGRAM" | "PHONE" | "OTHER";
  summary?: string;
}

export interface InventoryForecastRow {
  productId: string;
  productName: string;
  stockQuantity: number;
  averageDailyUnits: number;
  daysRemaining: number;
  reorderAlert: boolean;
}

export interface FinancialForecastSummary {
  projectedMonthlyRevenue: number;
  projectedMonthlyExpenses: number;
  projectedMonthlyProfit: number;
  revenueRunRateDaily: number;
}

export interface ClientPortalProfile {
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
    loyaltyPoints: number;
    totalSpent: number;
    lastVisitISO?: string;
    portalLastLoginAtISO?: string;
  };
  appointments: {
    id: string;
    dateTimeISO: string;
    status: string;
    notes?: string;
    depositAmount: number;
    noShowFeeAmount: number;
    noShowFeeCharged: number;
    employeeName?: string;
    serviceName?: string;
  }[];
  invoices: {
    id: string;
    serialNumber?: string;
    dateISO: string;
    totalAmount: number;
    discount: number;
    tax: number;
    paymentMethod: string;
  }[];
  reviews: PortalReviewDto[];
  serviceFiles: PortalServiceFileDto[];
  notificationTimeline: PortalNotificationEventDto[];
  referral?: PortalReferralDto;
}
