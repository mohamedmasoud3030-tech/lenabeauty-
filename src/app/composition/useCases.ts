import { createRepositoryBundle } from "../../infrastructure/createRepositoryBundle";
import { Result, BookingInput } from "../../domain/ports/repositories";
import { Appointment, Customer, Employee, Expense, Product, Service, CenterSettings, AttendanceRecord, EmployeeAdvance, VisitStage } from "../../domain/entities";
import { CheckoutPayload, BackupPayload, IssueGiftCardInput, CreateServicePackageInput, NotificationSettingsInput, PaymentGatewaySettingsInput, CreateCustomerReviewInput, CreateServiceFileInput, CreateJournalEntryInput, CreateAiBookingLeadInput } from "../../application/dto";
import { RecipeItemInput } from "../../domain/ports/repositories";
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
    onAuthStateChange: (callback: (event: string) => void) => getRepositoryBundle().authAdapter.onAuthStateChange(callback),
    getMyCenters: () => getRepositoryBundle().authAdapter.getMyCenters(),
    requestPasswordReset: (email: string) => getRepositoryBundle().authAdapter.requestPasswordReset(email),
    updatePassword: (password: string) => getRepositoryBundle().authAdapter.updatePassword(password),
  },
  dashboard: {
    getSummary: () => getRepositoryBundle().dashboardAdapter.getSummary(),
    getPnlMonth: () => getRepositoryBundle().dashboardAdapter.getPnlMonth(),
    getRevenueLast7Days: () => getRepositoryBundle().dashboardAdapter.getRevenueLast7Days(),
  },
  appointments: {
    list: (range?: { fromISO: string, toISO: string }) => getRepositoryBundle().appointmentAdapter.list(range || { fromISO:"", toISO:"" }),
    getById: async (id: string) => getRepositoryBundle().appointmentAdapter.getById(id),
    create: async (data: Partial<Appointment>) => getRepositoryBundle().appointmentAdapter.create(data),
    update: async (id: string, data: Partial<Appointment>) => getRepositoryBundle().appointmentAdapter.update(id, data),
    markNoShow: async (id: string, input?: { chargeNoShowFee?: boolean; note?: string }) => getRepositoryBundle().appointmentAdapter.markNoShow(id, input),
    transitionVisit: async (id: string, stage: VisitStage) => getRepositoryBundle().appointmentAdapter.transitionVisit(id, stage),
    delete: async (id: string) => getRepositoryBundle().appointmentAdapter.delete(id),
    sendReminder: async (_id: string): Promise<Result<void, any>> => {
      const error = new Error("NOTIFICATION_PROVIDER_NOT_CONFIGURED") as Error & { code: string };
      error.code = "BACKEND_METHOD_UNSUPPORTED";
      return { ok: false, error };
    },
  },
  services: {
    list: () => getRepositoryBundle().serviceAdapter.list(),
    create: async (data: Partial<Service>) => getRepositoryBundle().serviceAdapter.create(data),
    update: async (id: string, data: Partial<Service>) => getRepositoryBundle().serviceAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().serviceAdapter.delete(id),
  },
  recipes: {
    getForService: (serviceId: string) => getRepositoryBundle().serviceRecipeAdapter.getForService(serviceId),
    saveForService: (serviceId: string, items: RecipeItemInput[]) => getRepositoryBundle().serviceRecipeAdapter.saveForService(serviceId, items),
    listConsumptions: (input?: { limit?: number }) => getRepositoryBundle().serviceRecipeAdapter.listConsumptions(input),
  },
  customers: {
    list: (q?: string) => getRepositoryBundle().customerAdapter.list(q),
    getById: async (id: string) => getRepositoryBundle().customerAdapter.getById(id),
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
  entitlements: {
    listForCustomer: (customerId: string) => getRepositoryBundle().entitlementAdapter.listForCustomer(customerId),
    list: (query?: string) => getRepositoryBundle().entitlementAdapter.list(query),
    listLedger: (entitlementId: string) => getRepositoryBundle().entitlementAdapter.listLedger(entitlementId),
    refund: (input: { entitlementId: string; amount: number; reason: string; actorEmployeeId: string }) =>
      getRepositoryBundle().entitlementAdapter.refund(input),
    voidEntitlement: (input: { entitlementId: string; reason: string; actorEmployeeId: string }) =>
      getRepositoryBundle().entitlementAdapter.voidEntitlement(input),
    expire: (input: { entitlementId: string; reason: string; actorEmployeeId: string }) =>
      getRepositoryBundle().entitlementAdapter.expire(input),
    getSummary: () => getRepositoryBundle().entitlementAdapter.getSummary(),
  },
  reports: {
    getSales: (f: string, t: string) => getRepositoryBundle().reportAdapter.getSales(f, t),
    getAppointments: (f: string, t: string) => getRepositoryBundle().reportAdapter.getAppointments(f, t),
    getInventory: () => getRepositoryBundle().reportAdapter.getInventory(),
  },

  customerExperience: {
    listReviews: () => getRepositoryBundle().customerExperienceAdapter.listReviews(),
    createReview: (input: CreateCustomerReviewInput) => getRepositoryBundle().customerExperienceAdapter.createReview(input),
    listServiceFiles: (customerId?: string) => getRepositoryBundle().customerExperienceAdapter.listServiceFiles(customerId),
    createServiceFile: (input: CreateServiceFileInput) => getRepositoryBundle().customerExperienceAdapter.createServiceFile(input),
  },
  forecasts: {
    getInventoryForecast: () => getRepositoryBundle().forecastAdapter.getInventoryForecast(),
    getFinancialForecast: () => getRepositoryBundle().forecastAdapter.getFinancialForecast(),
  },
  accounting: {
    listJournalEntries: () => getRepositoryBundle().accountingAdapter.listJournalEntries(),
    createJournalEntry: (input: CreateJournalEntryInput) => getRepositoryBundle().accountingAdapter.createJournalEntry(input),
  },
  advanced: {
    listAiBookingLeads: () => getRepositoryBundle().advancedAdapter.listAiBookingLeads(),
    createAiBookingLead: (input: CreateAiBookingLeadInput) => getRepositoryBundle().advancedAdapter.createAiBookingLead(input),
  },

  attendance: {
    list: (range?: { fromISO: string; toISO: string }) => getRepositoryBundle().attendanceAdapter.list(range),
    listByEmployee: (employeeId: string, range?: { fromISO: string; toISO: string }) => getRepositoryBundle().attendanceAdapter.listByEmployee(employeeId, range),
    create: async (data: Partial<AttendanceRecord>) => getRepositoryBundle().attendanceAdapter.create(data),
    update: async (id: string, data: Partial<AttendanceRecord>) => getRepositoryBundle().attendanceAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().attendanceAdapter.delete(id),
  },

  advances: {
    list: (range?: { fromISO: string; toISO: string }) => getRepositoryBundle().advanceAdapter.list(range),
    listByEmployee: (employeeId: string, range?: { fromISO: string; toISO: string }) => getRepositoryBundle().advanceAdapter.listByEmployee(employeeId, range),
    create: async (data: Partial<EmployeeAdvance>) => getRepositoryBundle().advanceAdapter.create(data),
    update: async (id: string, data: Partial<EmployeeAdvance>) => getRepositoryBundle().advanceAdapter.update(id, data),
    delete: async (id: string) => getRepositoryBundle().advanceAdapter.delete(id),
  },

  payroll: {
    listRuns: () => getRepositoryBundle().payrollAdapter.listRuns(),
    getRun: (id: string) => getRepositoryBundle().payrollAdapter.getRun(id),
    createRun: async (input: { periodMonth: string; notes?: string }) => getRepositoryBundle().payrollAdapter.createRun(input),
    deleteRun: async (id: string) => getRepositoryBundle().payrollAdapter.deleteRun(id),
  },

  booking: {
    listServices: () => getRepositoryBundle().bookingAdapter.listServices(),
    listStaff: () => getRepositoryBundle().bookingAdapter.listStaff(),
    getCenterInfo: () => getRepositoryBundle().bookingAdapter.getCenterInfo(),
    getTakenSlots: (dayISO: string) => getRepositoryBundle().bookingAdapter.getTakenSlots(dayISO),
    createBooking: (input: BookingInput) => getRepositoryBundle().bookingAdapter.createBooking(input),
    cancelBooking: (input: { appointmentId: string; phone: string; token: string; reason?: string }) => getRepositoryBundle().bookingAdapter.cancelBooking(input),
    rescheduleBooking: (input: { appointmentId: string; phone: string; token: string; newDateTimeISO: string; newEmployeeId?: string; reason?: string }) => getRepositoryBundle().bookingAdapter.rescheduleBooking(input),
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
