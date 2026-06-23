import { createRepositoryBundle } from "../../infrastructure/createRepositoryBundle";
import { Result } from "../../domain/ports/repositories";
import { Appointment, Customer, Employee, Expense, Product, Service, CenterSettings, Invoice } from "../../domain/entities";
import { CheckoutPayload, BackupPayload } from "../../application/dto";
import { tenantContext, requireConfiguredCenterId } from "../../infrastructure/tenantContext";

type RepositoryBundle = ReturnType<typeof createRepositoryBundle>;

let repositoryBundle: RepositoryBundle | null = null;

export function getRepositoryBundle(): RepositoryBundle {
  if (!repositoryBundle) {
    repositoryBundle = createRepositoryBundle();
  }
  return repositoryBundle;
}

// Generic helper to unwrap Result and enforce errors instead of silently failing,
// but for our React hooks we will pass the promise.
export const useCases = {
  auth: {
    login: (u: string, p: string) => getRepositoryBundle().authAdapter.login(u, p),
    logout: () => getRepositoryBundle().authAdapter.logout(),
    getSession: () => getRepositoryBundle().authAdapter.getSession(),
    getMyCenters: () => getRepositoryBundle().authAdapter.getMyCenters(),
  },
  dashboard: {
    getSummary: () => getRepositoryBundle().dashboardAdapter.getSummary(),
    getPnlMonth: () => getRepositoryBundle().dashboardAdapter.getPnlMonth(),
    getRevenueLast7Days: () => getRepositoryBundle().dashboardAdapter.getRevenueLast7Days(),
  },
  appointments: {
    list: (range?: { fromISO: string, toISO: string }) => getRepositoryBundle().appointmentAdapter.list(range || { fromISO:"", toISO:"" }),
    create: async (data: Partial<Appointment>) => getRepositoryBundle().appointmentAdapter.create(data),
    update: async (id: string, data: Partial<Appointment>) => getRepositoryBundle().appointmentAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().appointmentAdapter.delete(id),
    sendReminder: async (id: string): Promise<Result<void, any>> => {
      // Stub: returns success immediately
      // Backend: would send SMS/email reminder via Supabase function
      return { ok: true, data: undefined };
    },
  },
  services: {
    list: () => getRepositoryBundle().serviceAdapter.list(),
    create: async (data: Partial<Service>) => getRepositoryBundle().serviceAdapter.create(data),
    update: async (id: string, data: Partial<Service>) => getRepositoryBundle().serviceAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().serviceAdapter.delete(id),
  },
  customers: {
    list: (q?: string) => getRepositoryBundle().customerAdapter.list(q),
    create: async (data: Partial<Customer>) => getRepositoryBundle().customerAdapter.create(data),
    update: async (id: string, data: Partial<Customer>) => getRepositoryBundle().customerAdapter.update(id, data),
    getHistory: (id: string) => getRepositoryBundle().customerAdapter.getHistory(id),
    delete: async (id: string) => getRepositoryBundle().customerAdapter.delete(id),
  },
  employees: {
    list: () => getRepositoryBundle().employeeAdapter.list(),
    create: async (data: Partial<Employee>) => getRepositoryBundle().employeeAdapter.create(data),
    update: async (id: string, data: Partial<Employee>) => getRepositoryBundle().employeeAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().employeeAdapter.delete(id),
  },
  products: {
    list: () => getRepositoryBundle().productAdapter.list(),
    listFull: () => getRepositoryBundle().productAdapter.listFull(),
    create: async (data: Partial<Product>) => getRepositoryBundle().productAdapter.create(data),
    update: async (id: string, data: Partial<Product>) => getRepositoryBundle().productAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().productAdapter.delete(id),
  },
  expenses: {
    list: () => getRepositoryBundle().expenseAdapter.list(),
    create: async (data: Partial<Expense>) => getRepositoryBundle().expenseAdapter.create(data),
    update: async (id: string, data: Partial<Expense>) => getRepositoryBundle().expenseAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().expenseAdapter.delete(id),
  },
  settings: {
    get: () => getRepositoryBundle().settingsAdapter.get(),
    update: async (data: Partial<CenterSettings>) => getRepositoryBundle().settingsAdapter.update(data),
    uploadLogo: async (file: File) => getRepositoryBundle().settingsAdapter.uploadLogo(file),
    backup: async () => getRepositoryBundle().settingsAdapter.backup(),
    exportData: async () => getRepositoryBundle().settingsAdapter.exportData(),
    restore: async (data: BackupPayload) => getRepositoryBundle().settingsAdapter.restore(data),
  },
  invoices: {
    checkout: async (data: CheckoutPayload) => getRepositoryBundle().invoiceAdapter.checkout(data),
    getForPrint: (id: string) => getRepositoryBundle().invoiceAdapter.getForPrint(id),
  },
  reports: {
    getSales: (f: string, t: string) => getRepositoryBundle().reportAdapter.getSales(f, t),
    getAppointments: (f: string, t: string) => getRepositoryBundle().reportAdapter.getAppointments(f, t),
    getInventory: () => getRepositoryBundle().reportAdapter.getInventory(),
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
