import { DashboardRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { createUnsupportedReadError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { DashboardSummary, PnlData, ChartData } from "../../../application/dto";
import { getCenterIdFor, isMissingBackendFeature, toLocalDateOnly, localDayStartISO, localDayEndISO } from "./shared";

export class SupabaseDashboardAdapter implements DashboardRepository {
  async getSummary(): Promise<Result<DashboardSummary, DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getSummary");
    if (!centerRes.ok) return centerRes as any;

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data, error } = await getSupabaseClient().rpc('get_dashboard_summary_v1', {
        p_center_id: centerRes.data,
        p_day_start: localDayStartISO(now),
        p_day_end: localDayEndISO(now),
        p_month_start: monthStart.toISOString(),
      });
      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Dashboard.getSummary") };
        return { ok: false, error: createQueryError("Dashboard.getSummary", error.message) };
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: createQueryError("Dashboard.getSummary", "Invalid dashboard summary response") };
      }
      const row = data as Record<string, unknown>;
      return {
        ok: true,
        data: {
          customers: Number(row.customers) || 0,
          appointments: Number(row.appointments) || 0,
          sales: Number(row.sales) || 0,
          revenue: Number(row.revenue) || 0,
          todayRevenue: Number(row.today_revenue) || 0,
          canViewRevenue: row.can_view_revenue === true,
          lowStockCount: Number(row.low_stock_count) || 0,
          newCustomersThisMonth: Number(row.new_customers_this_month) || 0,
          currency: typeof row.currency === "string" ? row.currency : "OMR",
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getSummary", (e as Error).message) };
    }
  }

  async getPnlMonth(): Promise<Result<PnlData, DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getPnlMonth");
    if (!centerRes.ok) return centerRes as any;
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { data, error } = await getSupabaseClient().rpc('get_dashboard_pnl_v1', {
        p_center_id: centerRes.data,
        p_from: from,
        p_to: to,
      });
      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Dashboard.getPnlMonth") };
        return { ok: false, error: createQueryError("Dashboard.getPnlMonth", error.message) };
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: createQueryError("Dashboard.getPnlMonth", "Invalid P&L response") };
      }
      const row = data as Record<string, unknown>;
      return {
        ok: true,
        data: {
          revenue: Number(row.revenue) || 0,
          baseSalaries: Number(row.base_salaries) || 0,
          commissions: Number(row.commissions) || 0,
          expenses: Number(row.expenses) || 0,
          profit: Number(row.profit) || 0,
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getPnlMonth", (e as Error).message) };
    }
  }

  async getRevenueLast7Days(): Promise<Result<ChartData[], DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getRevenueLast7Days");
    if (!centerRes.ok) return centerRes as any;
    try {
      // Local calendar days are converted to UTC instants for the server query;
      // returned invoice timestamps are bucketed back into the user's local day.
      const today = new Date();
      const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      const { data, error } = await getSupabaseClient().rpc('get_dashboard_revenue_entries_v1', {
        p_center_id: centerRes.data,
        p_from: localDayStartISO(fromDate),
        p_to: localDayEndISO(today),
      });
      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Dashboard.getRevenueLast7Days") };
        return { ok: false, error: createQueryError("Dashboard.getRevenueLast7Days", error.message) };
      }

      const entries = (data as { entries?: unknown[] } | null)?.entries;
      if (!Array.isArray(entries)) {
        return { ok: false, error: createQueryError("Dashboard.getRevenueLast7Days", "Invalid revenue entries response") };
      }
      const buckets = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const day = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i);
        buckets.set(toLocalDateOnly(day), 0);
      }
      for (const raw of entries) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;
        const date = new Date(String(row.date ?? ""));
        if (isNaN(date.getTime())) continue;
        const key = toLocalDateOnly(date);
        if (!buckets.has(key)) continue;
        buckets.set(key, (buckets.get(key) || 0) + (Number(row.revenue) || 0));
      }

      return { ok: true, data: Array.from(buckets, ([date, revenue]) => ({ date, revenue })) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getRevenueLast7Days", (e as Error).message) };
    }
  }
}
