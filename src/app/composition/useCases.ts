import { createRepositoryBundle } from "../../infrastructure/createRepositoryBundle";
import { Result } from "../../domain/ports/repositories";
import { Appointment, Customer, Employee, Expense, Product, Service, CenterSettings, Invoice } from "../../domain/entities";
import { CheckoutPayload, BackupPayload } from "../../application/dto";
import { tenantContext, requireConfiguredCenterId } from "../../infrastructure/tenantContext";

const {
  authAdapter,
  customerAdapter,
  employeeAdapter,
  serviceAdapter,
  appointmentAdapter,
  productAdapter,
  expenseAdapter,
  invoiceAdapter,
  settingsAdapter,
  dashboardAdapter,
  reportAdapter
} = createRepositoryBundle();

// Generic helper to unwrap Result and enforce errors instead of silently failing,
// but for our React hooks we will pass the promise.
export const useCases = {
  auth: {
    login: (u: string, p: string) => authAdapter.login(u, p),
    logout: () => authAdapter.logout(),
    getSession: () => authAdapter.getSession(),
    getMyCenters: () => authAdapter.getMyCenters(),
  },
  dashboard: {
    getSummary: () => dashboardAdapter.getSummary(),
    getPnlMonth: () => dashboardAdapter.getPnlMonth(),
    getRevenueLast7Days: () => dashboardAdapter.getRevenueLast7Days(),
  },
  appointments: {
    list: (range?: { fromISO: string, toISO: string }) => appointmentAdapter.list(range || { fromISO:"", toISO:"" }),
    create: async (data: Partial<Appointment>) => appointmentAdapter.create(data),
    update: async (id: string, data: Partial<Appointment>) => appointmentAdapter.update(id, data),
    delete: async (id: string) => appointmentAdapter.delete(id),
    sendReminder: async (id: string): Promise<Result<void, any>> => {
      // Stub: returns success immediately
      // Backend: would send SMS/email reminder via Supabase function
      return { ok: true, data: undefined };
    },
  },
  services: {
    list: () => serviceAdapter.list(),
    create: async (data: Partial<Service>) => serviceAdapter.create(data),
    update: async (id: string, data: Partial<Service>) => serviceAdapter.update(id, data),
    delete: async (id: string) => serviceAdapter.delete(id),
  },
  customers: {
    list: (q?: string) => customerAdapter.list(q),
    create: async (data: Partial<Customer>) => customerAdapter.create(data),
    update: async (id: string, data: Partial<Customer>) => customerAdapter.update(id, data),
    getHistory: (id: string) => customerAdapter.getHistory(id),
    delete: async (id: string) => customerAdapter.delete(id),
  },
  employees: {
    list: () => employeeAdapter.list(),
    create: async (data: Partial<Employee>) => employeeAdapter.create(data),
    update: async (id: string, data: Partial<Employee>) => employeeAdapter.update(id, data),
    delete: async (id: string) => employeeAdapter.delete(id),
  },
  products: {
    list: () => productAdapter.list(),
    listFull: () => productAdapter.listFull(),
    create: async (data: Partial<Product>) => productAdapter.create(data),
    update: async (id: string, data: Partial<Product>) => productAdapter.update(id, data),
    delete: async (id: string) => productAdapter.delete(id),
  },
  expenses: {
    list: () => expenseAdapter.list(),
    create: async (data: Partial<Expense>) => expenseAdapter.create(data),
    delete: async (id: string) => expenseAdapter.delete(id),
  },
  settings: {
    get: () => settingsAdapter.get(),
    update: async (data: Partial<CenterSettings>) => settingsAdapter.update(data),
    uploadLogo: async (file: File) => settingsAdapter.uploadLogo(file),
    backup: async () => settingsAdapter.backup(),
    exportData: async () => settingsAdapter.exportData(),
    restore: async (data: BackupPayload) => settingsAdapter.restore(data),
  },
  invoices: {
    checkout: async (data: CheckoutPayload) => invoiceAdapter.checkout(data),
    getForPrint: (id: string) => invoiceAdapter.getForPrint(id),
  },
  reports: {
    getSales: (f: string, t: string) => reportAdapter.getSales(f, t),
    getAppointments: (f: string, t: string) => reportAdapter.getAppointments(f, t),
    getInventory: () => reportAdapter.getInventory(),
  },
  tenant: {
    setActiveCenterId: (id: string | null) => {
      tenantContext.activeCenterId = id;
    },
    getActiveCenterId: () => {
      try {
        return requireConfiguredCenterId();
      } catch {
        return tenantContext.activeCenterId;
      }
    }
  }
};
