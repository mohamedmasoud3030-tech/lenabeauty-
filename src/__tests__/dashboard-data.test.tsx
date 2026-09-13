import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

/**
 * Dashboard data loading contracts: role-gated P&L / 7-day revenue, today's
 * operations (upcoming appointments joined with customer/service names, low
 * stock top-5), and the merged activity feed (newest first, max 6).
 */

const h = vi.hoisted(() => ({
  showToast: vi.fn(),
  calls: {
    getSummary: vi.fn(),
    getPnlMonth: vi.fn(),
    getRevenueLast7Days: vi.fn(),
    appointmentsList: vi.fn(),
    customersList: vi.fn(),
    servicesList: vi.fn(),
    productsList: vi.fn(),
    expensesList: vi.fn(),
  },
}));

vi.mock("../shared/components/Toast", () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock("../app/composition/useCases", () => ({
  useCases: {
    dashboard: {
      getSummary: h.calls.getSummary,
      getPnlMonth: h.calls.getPnlMonth,
      getRevenueLast7Days: h.calls.getRevenueLast7Days,
    },
    appointments: { list: h.calls.appointmentsList },
    customers: { list: h.calls.customersList },
    services: { list: h.calls.servicesList },
    products: { list: h.calls.productsList },
    expenses: { list: h.calls.expensesList },
  },
}));

import { useDashboardData } from "../pages/dashboard/useDashboardData";

const ok = (data: unknown) => ({ ok: true, data });

/** Noon-anchored times: always inside "today" regardless of the run clock. */
const at = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

function stubTodayOps() {
  h.calls.appointmentsList.mockResolvedValue(ok([
    {
      id: "a1", status: "COMPLETED", dateTime: at(13), createdAt: at(11),
      customerId: "c1", serviceId: "s1", employee: { name: "Emp One" },
    },
    { id: "a2", status: "CANCELLED", dateTime: at(14), createdAt: at(11) },
    { id: "a3", status: "SCHEDULED", dateTime: at(15), createdAt: at(10) },
  ]));
  h.calls.customersList.mockResolvedValue(ok([
    { id: "c1", name: "Client One", createdAt: at(9) },
  ]));
  h.calls.servicesList.mockResolvedValue(ok([
    { id: "s1", name: "Hair Care" },
  ]));
  h.calls.productsList.mockResolvedValue(ok([
    { id: "p1", name: "Low", isActive: true, trackInventory: true, stockQuantity: 1, reorderLevel: 5 },
    { id: "p2", name: "Fine", isActive: true, trackInventory: true, stockQuantity: 10, reorderLevel: 5 },
    { id: "p3", name: "Untracked", isActive: true, trackInventory: false, stockQuantity: 0, reorderLevel: 5 },
    { id: "p4", name: "Inactive", isActive: false, trackInventory: true, stockQuantity: 0, reorderLevel: 1 },
  ]));
}

beforeEach(() => {
  h.showToast.mockClear();
  Object.values(h.calls).forEach((fn) => fn.mockReset());
  stubTodayOps();
});

describe("useDashboardData", () => {
  it("non-revenue role: summary + today ops only — P&L, revenue and expenses stay untouched", async () => {
    h.calls.getSummary.mockResolvedValue(ok({ canViewRevenue: false, currency: "OMR" }));
    const { result } = renderHook(() => useDashboardData());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toEqual(expect.objectContaining({ canViewRevenue: false }));
    expect(result.current.pnl).toBeNull();
    expect(result.current.last7Days).toEqual([]);
    expect(h.calls.getPnlMonth).not.toHaveBeenCalled();
    expect(h.calls.getRevenueLast7Days).not.toHaveBeenCalled();
    expect(h.calls.expensesList).not.toHaveBeenCalled();

    // Upcoming = non-cancelled, joined with names, sorted by time.
    await waitFor(() => expect(result.current.todayAppts).toHaveLength(2));
    expect(result.current.todayAppts[0]).toEqual(
      expect.objectContaining({
        id: "a1",
        status: "COMPLETED",
        customerName: "Client One",
        serviceName: "Hair Care",
        employeeName: "Emp One",
      }),
    );
    expect(result.current.todayAppts[1]).toEqual(
      expect.objectContaining({ id: "a3", status: "SCHEDULED", customerName: "—" }),
    );

    // Low stock: active + tracked + at/below reorder level, sorted asc, top 5.
    await waitFor(() => expect(result.current.lowStockItems).toHaveLength(1));
    expect(result.current.lowStockItems).toEqual([{ id: "p1", name: "Low", stock: 1 }]);
    expect(result.current.trackedProductCount).toBe(4);

    // Activity: 3 appointments + 1 customer, no expenses (role gate).
    await waitFor(() => expect(result.current.activity).toHaveLength(4));
    expect(result.current.activity.map((a) => a.id)).toEqual(
      expect.arrayContaining(["appt-a1", "appt-a2", "appt-a3", "cust-c1"]),
    );
    expect(result.current.activity.some((a) => a.id.startsWith("exp-"))).toBe(false);
    expect(h.showToast).not.toHaveBeenCalled();
  });

  it("revenue role: P&L + 7-day revenue load, and expenses join the activity feed", async () => {
    h.calls.getSummary.mockResolvedValue(ok({ canViewRevenue: true, currency: "OMR" }));
    h.calls.getPnlMonth.mockResolvedValue(ok({ rows: [], currency: "OMR" }));
    h.calls.getRevenueLast7Days.mockResolvedValue(ok([
      { date: "2026-09-13", revenue: 10 },
    ]));
    h.calls.expensesList.mockResolvedValue(ok([
      { id: "x1", amount: 12.5, createdAt: at(11, 30) },
    ]));

    const { result } = renderHook(() => useDashboardData());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.pnl).toEqual(expect.objectContaining({ currency: "OMR" }));
    expect(result.current.last7Days).toEqual([{ date: "2026-09-13", revenue: 10 }]);

    // The 11:30 expense is the newest event.
    await waitFor(() => expect(result.current.activity).toHaveLength(5));
    expect(result.current.activity[0].id).toBe("exp-x1");
    // Money always travels through the OMR formatter.
    expect(result.current.activity[0].message).toContain("12.500");
    expect(result.current.activity[0].message).toContain("OMR");
  });

  it("a failed summary surfaces a toast and stops cleanly", async () => {
    h.calls.getSummary.mockResolvedValue({ ok: false, error: { code: "X", message: "boom" } });
    const { result } = renderHook(() => useDashboardData());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith("error", expect.any(String), "boom");
  });
});
