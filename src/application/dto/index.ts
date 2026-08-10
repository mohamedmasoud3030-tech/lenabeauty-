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

export type CheckoutItem = ServiceCheckoutItem | ProductCheckoutItem | PackageCheckoutItem;

export interface CheckoutPayload {
  customerId: string;
  /** Required by the operational checkout contract for traceability. */
  employeeId: string;
  discountAmount?: number;
  useLoyaltyPoints?: boolean;
  giftCardCode?: string;
  paymentMethod: PaymentMethod;
  items: CheckoutItem[];
}

export interface InvoicePrintData {
  invoice: Invoice;
  items: {
    id: string;
    type: "service" | "product" | "package";
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
  items: { id: string, name: string, type: "service" | "product" | "package", price: number, qty: number }[];
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
    if (!item || !["service", "product", "package"].includes(item.type)) {
      errors.push(`Item at slot ${slot} has invalid type`);
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


export interface IssueGiftCardInput {
  code: string;
  initialBalance: number;
  customerId?: string;
  note?: string;
  expiresAtISO?: string;
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
