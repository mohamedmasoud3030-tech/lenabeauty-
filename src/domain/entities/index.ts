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

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  price: number;
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
  status: AppointmentStatus;
  notes?: string;
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
  price: number;
  cost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId?: string;
  productId?: string;
  price: number;
  quantity: number;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  serialNumber?: string;
  date: Date;
  totalAmount: number;
  discount: number;
  tax?: number;
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
}
