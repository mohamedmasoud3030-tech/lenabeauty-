import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../../app/composition/useCases";
import { unwrap } from "../../shared/hooks/useApplication";
import { useToast } from "../../shared/components/Toast";
import { formatOMRAmount } from "../../shared/money";
import { DashboardSummary, PnlData } from "../../application/dto";

export interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  user?: { username?: string };
}

export interface TodayAppt {
  id: string;
  time: string;
  dateTime: string;
  customerName: string;
  serviceName?: string;
  employeeName?: string;
  status: string;
  depositAmount?: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  stock: number;
}

/**
 * Dashboard data loading. Owns the summary / P&L / 7-day revenue / activity /
 * today-operations state and the single `load` entry point used by the page
 * on mount and on manual refresh.
 */
export function useDashboardData() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [last7Days, setLast7Days] = useState<{ date: string; revenue: number }[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayAppts, setTodayAppts] = useState<TodayAppt[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [trackedProductCount, setTrackedProductCount] = useState<number | null>(null);

  /** مواعيد اليوم القادمة + تنبيهات المخزون — بيانات حقيقية فقط. */
  async function loadTodayOps() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    try {
      const [apptsRes, customersRes, servicesRes] = await Promise.all([
        useCases.appointments.list({ fromISO: todayStart.toISOString(), toISO: todayEnd.toISOString() }),
        useCases.customers.list(),
        useCases.services.list(),
      ]);
      const customerNames = new Map((customersRes.ok ? customersRes.data : []).map((c) => [c.id, c.name]));
      const serviceNames = new Map((servicesRes.ok ? servicesRes.data : []).map((s) => [s.id, s.name]));
      const upcoming = (apptsRes.ok ? apptsRes.data : [])
        .filter((a) => a.status !== "CANCELLED")
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
        .map((a) => ({
          id: a.id,
          time: a.dateTime.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" }),
          dateTime: a.dateTime.toISOString(),
          customerName: a.customerId ? (customerNames.get(a.customerId) ?? "—") : "—",
          serviceName: a.serviceId ? serviceNames.get(a.serviceId) : undefined,
          employeeName: a.employee?.name,
          status: a.status,
          depositAmount: a.depositAmount,
        }));
      setTodayAppts(upcoming);
    } catch {
      setTodayAppts([]);
    }

    try {
      const productsRes = await useCases.products.list();
      const catalog = productsRes.ok ? productsRes.data : [];
      setTrackedProductCount(productsRes.ok ? catalog.length : null);
      const low = catalog
        .filter((p) => p.isActive && p.trackInventory && p.stockQuantity <= (p.reorderLevel ?? 5))
        .sort((a, b) => a.stockQuantity - b.stockQuantity)
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, stock: p.stockQuantity }));
      setLowStockItems(low);
    } catch {
      setLowStockItems([]);
    }
  }

  async function loadActivity(s: DashboardSummary | null) {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const tasks: Promise<ActivityEvent[]>[] = [
        useCases.appointments
          .list({ fromISO: windowStart.toISOString(), toISO: windowEnd.toISOString() })
          .then((res) =>
            res.ok
              ? res.data.map((a) => ({
                  id: `appt-${a.id}`,
                  type: "APPOINTMENT_CREATED",
                  message: t("New appointment scheduled"),
                  createdAt: new Date(a.createdAt).toISOString(),
                }))
              : []
          )
          .catch(() => []),
        useCases.customers
          .list()
          .then((res) =>
            res.ok
              ? res.data.map((c) => ({
                  id: `cust-${c.id}`,
                  type: "USER_CREATED",
                  message: `${t("New customer")}: ${c.name}`,
                  createdAt: new Date(c.createdAt).toISOString(),
                }))
              : []
          )
          .catch(() => []),
      ];

      if (s?.canViewRevenue) {
        tasks.push(
          useCases.expenses
            .list()
            .then((res) =>
              res.ok
                ? res.data.map((e) => ({
                    id: `exp-${e.id}`,
                    type: "EXPENSE_CREATED",
                    message: `${t("New expense recorded")}: ${formatOMRAmount(e.amount)} ${s.currency || ""}`.trim(),
                    createdAt: new Date(e.createdAt).toISOString(),
                  }))
                : []
            )
            .catch(() => [])
        );
      }

      const results = await Promise.all(tasks);
      const merged = results
        .flat()
        .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
        .slice(0, 6);

      setActivity(merged);
    } catch {
      setActivity([]);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const s = await unwrap(useCases.dashboard.getSummary());
      setSummary(s);

      void loadActivity(s);
      void loadTodayOps();

      if (s && s.canViewRevenue) {
        try {
          const p = await unwrap(useCases.dashboard.getPnlMonth());
          setPnl(p);
        } catch (e) {
          console.error("Failed to load P&L:", e);
        }

        try {
          const last7 = await unwrap(useCases.dashboard.getRevenueLast7Days());
          setLast7Days(last7 || []);
        } catch (e) {
          console.error("Failed to load 7-day revenue:", e);
        }
      } else {
        setPnl(null);
        setLast7Days([]);
      }
    } catch (err: any) {
      showToast('error', t("Error"), err.message || t("Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  }

  return {
    summary,
    pnl,
    last7Days,
    activity,
    loading,
    todayAppts,
    lowStockItems,
    trackedProductCount,
    load,
  };
}
