import { config } from "../config/env";
import {
  AuthRepository,
  CustomerRepository,
  EmployeeRepository,
  ServiceRepository,
  AppointmentRepository,
  ProductRepository,
  ExpenseRepository,
  InvoiceRepository,
  SettingsRepository,
  DashboardRepository,
  ReportRepository,
  BookingRepository,
  GiftCardRepository,
  ServicePackageRepository,
  CustomerExperienceRepository,
  ForecastRepository,
  AccountingRepository,
  AdvancedRepository
} from "../domain/ports/repositories";
import {
  SupabaseAuthAdapter,
  SupabaseCustomerAdapter,
  SupabaseEmployeeAdapter,
  SupabaseServiceAdapter,
  SupabaseAppointmentAdapter,
  SupabaseProductAdapter,
  SupabaseExpenseAdapter,
  SupabaseInvoiceAdapter,
  SupabaseSettingsAdapter,
  SupabaseDashboardAdapter,
  SupabaseReportAdapter,
  SupabaseBookingAdapter,
  SupabaseGiftCardAdapter,
  SupabaseServicePackageAdapter,
  SupabaseCustomerExperienceAdapter,
  SupabaseForecastAdapter,
  SupabaseAccountingAdapter,
  SupabaseAdvancedAdapter
} from "./supabase";

export interface RepositoryBundle {
  authAdapter: AuthRepository;
  customerAdapter: CustomerRepository;
  employeeAdapter: EmployeeRepository;
  serviceAdapter: ServiceRepository;
  appointmentAdapter: AppointmentRepository;
  productAdapter: ProductRepository;
  expenseAdapter: ExpenseRepository;
  invoiceAdapter: InvoiceRepository;
  settingsAdapter: SettingsRepository;
  dashboardAdapter: DashboardRepository;
  reportAdapter: ReportRepository;
  bookingAdapter: BookingRepository;
  giftCardAdapter: GiftCardRepository;
  servicePackageAdapter: ServicePackageRepository;
  customerExperienceAdapter: CustomerExperienceRepository;
  forecastAdapter: ForecastRepository;
  accountingAdapter: AccountingRepository;
  advancedAdapter: AdvancedRepository;
}

export class InfrastructureError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "InfrastructureError";
  }
}

export function createRepositoryBundle(): RepositoryBundle {
  if (config.backend === "supabase") {
    return {
      authAdapter: new SupabaseAuthAdapter(),
      customerAdapter: new SupabaseCustomerAdapter(),
      employeeAdapter: new SupabaseEmployeeAdapter(),
      serviceAdapter: new SupabaseServiceAdapter(),
      appointmentAdapter: new SupabaseAppointmentAdapter(),
      productAdapter: new SupabaseProductAdapter(),
      expenseAdapter: new SupabaseExpenseAdapter(),
      invoiceAdapter: new SupabaseInvoiceAdapter(),
      settingsAdapter: new SupabaseSettingsAdapter(),
      dashboardAdapter: new SupabaseDashboardAdapter(),
      reportAdapter: new SupabaseReportAdapter(),
      bookingAdapter: new SupabaseBookingAdapter(),
      giftCardAdapter: new SupabaseGiftCardAdapter(),
      servicePackageAdapter: new SupabaseServicePackageAdapter(),
      customerExperienceAdapter: new SupabaseCustomerExperienceAdapter(),
      forecastAdapter: new SupabaseForecastAdapter(),
      accountingAdapter: new SupabaseAccountingAdapter(),
      advancedAdapter: new SupabaseAdvancedAdapter()
    };
  }

  throw new InfrastructureError(`Unsupported backend mode: ${config.backend}`, "UNSUPPORTED_BACKEND");
}
