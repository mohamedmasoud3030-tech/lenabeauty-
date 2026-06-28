import { Appointment, Customer, Employee, Expense, Invoice, Product, Service, CenterSettings } from "../../domain/entities";

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
  employeeId?: string; 
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
    type: "service" | "product";
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
  items: { id: string, name: string, type: "service" | "product", price: number, qty: number }[];
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
  if (!payload) {
    errors.push("Payload is required");
    return errors;
  }
  if (!payload.customerId) {
    errors.push("Customer details are missing");
  }
  if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push("Cart must not be empty");
    return errors;
  }
  payload.items.forEach((item: any, idx: number) => {
    if (!item.type) {
      errors.push(`Item at slot ${idx + 1} has no type`);
    } else if (item.type === "service") {
      if (!item.serviceId) errors.push(`Service item at slot ${idx + 1} is missing serviceId`);
      if (typeof item.qty !== "number" || item.qty <= 0) errors.push(`Service item at slot ${idx + 1} must have a positive quantity`);
    } else if (item.type === "product") {
      if (!item.productId) errors.push(`Product item at slot ${idx + 1} is missing productId`);
      if (typeof item.qty !== "number" || item.qty <= 0) errors.push(`Product item at slot ${idx + 1} must have a positive quantity`);
    } else {
      errors.push(`Item at slot ${idx + 1} has invalid type`);
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
