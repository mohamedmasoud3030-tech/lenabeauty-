import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCases } from "../app/composition/useCases";
import ReportsPage from "../pages/ReportsPage";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

/**
 * Regression tests for the "no blank screens" requirement on Reports:
 * loading / empty / error must each render a visible, translated state —
 * never `null`, never an empty card, never a dead space.
 *
 * Determinism contract (P0.1):
 * - motion/react is replaced with a passthrough mock. The page wraps its
 *   loading/empty/error/content states in <AnimatePresence mode="wait">,
 *   whose child swaps are driven by motion's animation frame loop. jsdom does
 *   not pump frames the way a browser does, so a swap can be observed before
 *   the new child is mounted — or never, once a prior test's unmount leaves
 *   the global frame loop dirty. Making AnimatePresence render children
 *   synchronously (motion's documented test strategy) removes animation
 *   timing from the tests entirely.
 * - Every query the page can start (sales, appointments, inventory and the
 *   optional entitlement summary) is explicitly mocked in beforeEach so no
 *   test ever reaches the real Supabase adapter.
 * - The page's load() applies its result (including error results) from an
 *   awaited microtask continuation that runs *outside* React's act() scope.
 *   React's act() environment defers updates scheduled outside act(), so
 *   polling queries (findBy / waitFor) race that delivery against act()
 *   boundaries and can observe a stale loading state. flushAsync() runs an
 *   act() scope immediately after render/interaction; the microtask chain
 *   drains while act() is active, so the resulting state updates are applied
 *   and flushed synchronously. Assertions then use synchronous getBy* — no
 *   polling, no sleeps, no timeout increases.
 * - Every test ends with all async work settled inside act(); the "pending"
 *   test uses a controlled deferred promise that is always resolved inside
 *   act() before the test ends — never a dangling promise.
 */
vi.mock("motion/react", async () => {
  const React = await import("react");

  const Passthrough = (props: Record<string, unknown>) => {
    const { children, ref, ...rest } = props as {
      children?: React.ReactNode;
      ref?: React.Ref<HTMLDivElement>;
      [key: string]: unknown;
    };
    const domProps: Record<string, unknown> = { ...rest };
    // Drop motion-only props so they are never spread onto the DOM node.
    for (const key of [
      "initial", "animate", "exit", "variants", "transition",
      "whileHover", "whileTap", "whileFocus", "whileDrag", "whileInView",
      "layout", "layoutId", "drag", "dragConstraints", "dragElastic",
      "dragMomentum", "onAnimationStart", "onAnimationComplete", "onDragStart",
      "onDragEnd", "onUpdate", "custom",
    ]) {
      delete domProps[key];
    }
    return React.createElement("div", { ...domProps, ref }, children);
  };

  return {
    motion: new Proxy({}, { get: () => Passthrough }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ReportsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** Flush microtask-driven React updates inside an act() scope. */
async function flushAsync() {
  await act(async () => {
    // Yield enough microtask turns for every await hop in the page's load()
    // chain (query promise -> unwrap -> load continuation -> setState) to
    // drain while act() is active.
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Flush 0ms timers (e.g. Modal's focus-on-open) inside an act() scope. */
async function flushTimersAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ReportsPage screen states", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Safe deterministic defaults: sales/appointments/inventory resolve to
    // empty and the optional entitlement/ledger summary is inert. Tests that
    // need a specific shape override the relevant adapter below.
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.reports, "getAppointments").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.reports, "getInventory").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.entitlements, "getSummary").mockResolvedValue({ ok: true, data: null } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("renders a translated loading state while the query is pending", async () => {
    await i18n.changeLanguage("ar");

    // Controlled deferred query so the pending state is observable without
    // leaving a never-settling promise behind.
    let resolveSales!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      resolveSales = resolve;
    });
    vi.spyOn(useCases.reports, "getSales").mockReturnValue(pending as any);

    renderPage();

    // Loading state is visible (not a blank screen). The mount effect sets
    // loading inside act(render) and the motion mock mounts children
    // synchronously, so it is present right after render.
    expect(screen.getByText(i18n.t("Loading analytics..."))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("No Sales Data"))).not.toBeInTheDocument();

    // Deterministically settle the deferred query inside act() so no pending
    // async work can leak into subsequent tests.
    await act(async () => {
      resolveSales({ ok: true, data: [] });
    });
  });

  it("renders a translated EMPTY state (with CTA) when there are no sales", async () => {
    await i18n.changeLanguage("ar");
    renderPage();
    await flushAsync();

    expect(screen.getByText(i18n.t("No Sales Data"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Start selling to see detailed analytics"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("New Invoice"))).toBeInTheDocument();
  });

  it("renders a translated ERROR state (with Retry) when the sales query fails", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({
      ok: false,
      error: Object.assign(new Error("query exploded"), { code: "QUERY_ERROR" }),
    } as any);

    renderPage();
    await flushAsync();

    expect(screen.getByText(i18n.t("Failed to load sales report"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Retry"))).toBeInTheDocument();
  });

  it("renders an EMPTY state for appointments when there are no rows", async () => {
    await i18n.changeLanguage("ar");
    renderPage();
    await flushAsync();

    expect(screen.getByText(i18n.t("No Sales Data"))).toBeInTheDocument();

    fireEvent.click(screen.getByText(i18n.t("Appointments")));
    await flushAsync();

    expect(screen.getByText(i18n.t("No Appointments Data"))).toBeInTheDocument();
  });

  it("renders an EMPTY state for inventory when there are no rows", async () => {
    await i18n.changeLanguage("ar");
    renderPage();
    await flushAsync();

    expect(screen.getByText(i18n.t("No Sales Data"))).toBeInTheDocument();

    fireEvent.click(screen.getByText(i18n.t("Inventory")));
    await flushAsync();

    expect(screen.getByText(i18n.t("No Inventory Data"))).toBeInTheDocument();
  });

  it("does not silently hide sales beyond the first visible batch", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `inv-${index + 1}`,
      date: `2026-08-${String((index % 20) + 1).padStart(2, "0")}T10:00:00.000Z`,
      totalAmount: 10,
      discount: 0,
      customer: `Customer ${index + 1}`,
      items: [],
    }));
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({ ok: true, data: rows } as any);

    renderPage();
    await flushAsync();

    expect(screen.getByText("Showing 20 of 21")).toBeInTheDocument();
    expect(screen.queryByText("Customer 21")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await flushAsync();
    expect(screen.getAllByText("Customer 21").length).toBeGreaterThan(0);
  });

  it("shows the date range filter inputs", async () => {
    await i18n.changeLanguage("ar");
    renderPage();
    await flushAsync();

    expect(screen.getByLabelText(i18n.t("From date"))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t("To date"))).toBeInTheDocument();
  });

  it("lists sales transactions with drill-down to transaction details", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.reports, "getSales").mockResolvedValue({
      ok: true,
      data: [
        {
          id: "inv-1",
          date: "2026-08-10T10:00:00.000Z",
          totalAmount: 15,
          discount: 1,
          customer: "أمل",
          items: [
            { id: "it-1", name: "قص شعر", type: "service", price: 15, qty: 1 },
          ],
        },
      ],
    } as any);

    renderPage();
    await flushAsync();

    // Transactions section with the invoice row
    expect(screen.getByText(i18n.t("Sales Transactions"))).toBeInTheDocument();
    expect(screen.getAllByText("أمل").length).toBeGreaterThan(0);

    // Drill-down opens an accessible transaction details dialog.
    const rowTrigger = screen.getByRole("button", { name: i18n.t("Details") });
    rowTrigger.focus();
    fireEvent.click(rowTrigger);
    await flushAsync();
    // Modal focuses the panel on a 0ms timer.
    await flushTimersAsync();

    const dialog = screen.getByRole("dialog", { name: i18n.t("Transaction Details") });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getAllByText("قص شعر").length).toBeGreaterThan(0);
    // Discount is shown when > 0
    expect(screen.getByText("-1.000")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await flushAsync();

    expect(screen.queryByRole("dialog", { name: i18n.t("Transaction Details") })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(rowTrigger);
  });
});
