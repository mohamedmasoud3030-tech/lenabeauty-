import { ChartData, DashboardSummary, FinancialForecastSummary, InventoryForecastRow, InventoryReportRow, AppointmentReportRow, PnlData, SalesReportRow } from "../../../application/dto";
import { DomainError, Result } from "./shared";

export interface DashboardRepository {
  getSummary(): Promise<Result<DashboardSummary, DomainError>>;
  getPnlMonth(): Promise<Result<PnlData, DomainError>>;
  getRevenueLast7Days(): Promise<Result<ChartData[], DomainError>>;
}

export interface ReportRepository {
  getSales(from: string, to: string): Promise<Result<SalesReportRow[], DomainError>>;
  getAppointments(from: string, to: string): Promise<Result<AppointmentReportRow[], DomainError>>;
  getInventory(): Promise<Result<InventoryReportRow[], DomainError>>;
}

export interface ForecastRepository {
  getInventoryForecast(): Promise<Result<InventoryForecastRow[], DomainError>>;
  getFinancialForecast(): Promise<Result<FinancialForecastSummary, DomainError>>;
}
