import { createRepositoryBundle } from "../../infrastructure/createRepositoryBundle";
import { Result, BookingInput } from "../../domain/ports/repositories";
import { Appointment, Customer, Employee, Expense, Product, Service, CenterSettings } from "../../domain/entities";
import { CheckoutPayload, BackupPayload, IssueGiftCardInput, CreateServicePackageInput, NotificationSettingsInput, PaymentGatewaySettingsInput } from "../../application/dto";
import { tenantContext, requireConfiguredCenterId, setActiveCenter } from "../../infrastructure/tenantContext";

type RepositoryBundle = ReturnType<typeof createRepositoryBundle>;

let repositoryBundle: RepositoryBundle | null = null;

export function getRepositoryBundle(): RepositoryBundle {
  if (!repositoryBundle) {
    repositoryBundle = createRepositoryBundle();
  }
  return repositoryBundle;
}

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
    markNoShow: async (id: string, input?: { chargeNoShowFee?: boolean; note?: string }) => getRepositoryBundle().appointmentAdapter.markNoShow(id, input),
    delete: async (id: string) => getRepositoryBundle().appointmentAdapter.delete(id),
    sendReminder: async (_id: string): Promise<Result<void, any>> => ({ ok: true, data: undefined }),
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
    rotatePortalToken: async (id: string) => getRepositoryBundle().customerAdapter.rotatePortalToken(id),
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
    getNotificationSettings: () => getRepositoryBundle().settingsAdapter.getNotificationSettings(),
    updateNotificationSettings: async (data: NotificationSettingsInput) => getRepositoryBundle().settingsAdapter.updateNotificationSettings(data),
    getPaymentGatewaySettings: () => getRepositoryBundle().settingsAdapter.getPaymentGatewaySettings(),
    updatePaymentGatewaySettings: async (data: PaymentGatewaySettingsInput) => getRepositoryBundle().settingsAdapter.updatePaymentGatewaySettings(data),
  },
  invoices: {
    checkout: async (data: CheckoutPayload) => getRepositoryBundle().invoiceAdapter.checkout(data),
    getForPrint: (id: string) => getRepositoryBundle().invoiceAdapter.getForPrint(id),
  },
  giftCards: {
    list: () => getRepositoryBundle().giftCardAdapter.list(),
    issue: (input: IssueGiftCardInput) => getRepositoryBundle().giftCardAdapter.issue(input),
    getTransactions: (giftCardId: string) => getRepositoryBundle().giftCardAdapter.getTransactions(giftCardId),
  },
  servicePackages: {
    list: () => getRepositoryBundle().servicePackageAdapter.list(),
    create: (input: CreateServicePackageInput) => getRepositoryBundle().servicePackageAdapter.create(input),
  },
  reports: {
    getSales: (f: string, t: string) => getRepositoryBundle().reportAdapter.getSales(f, t),
    getAppointments: (f: string, t: string) => getRepositoryBundle().reportAdapter.getAppointments(f, t),
    getInventory: () => getRepositoryBundle().reportAdapter.getInventory(),
  },
  booking: {
    listServices: () => getRepositoryBundle().bookingAdapter.listServices(),
    listStaff: () => getRepositoryBundle().bookingAdapter.listStaff(),
    getCenterInfo: () => getRepositoryBundle().bookingAdapter.getCenterInfo(),
    getTakenSlots: (dayISO: string) => getRepositoryBundle().bookingAdapter.getTakenSlots(dayISO),
    createBooking: (input: BookingInput) => getRepositoryBundle().bookingAdapter.createBooking(input),
    clientPortalLogin: (phone: string, token: string) => getRepositoryBundle().bookingAdapter.clientPortalLogin(phone, token),
    getClientPortalProfile: (customerId: string, phone: string, token: string) => getRepositoryBundle().bookingAdapter.getClientPortalProfile(customerId, phone, token),
  },
  tenant: {
    setActiveCenterId: (id: string | null) => { setActiveCenter(id); },
    getActiveCenterId: () => {
      try {
        return requireConfiguredCenterId();
      } catch {
        return tenantContext.activeCenterId;
      }
    }
  }
};
