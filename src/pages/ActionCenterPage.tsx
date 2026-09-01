import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Activity, RefreshCw, CalendarClock, ShoppingCart, AlertTriangle,
  PackageOpen, Hourglass, CalendarCheck, UserRound, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useCases } from "../app/composition/useCases";
import { useToast } from "../shared/components/Toast";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { PageHeader } from "../shared/components/PageHeader";
import { ScreenState } from "../shared/components/ScreenState";
import { formatOMRAmount } from "../shared/money";
import { formatSalonDate } from "../shared/dateTime";
import { getRetentionStatus, RetentionStatus, RetentionVisit } from "../domain/retention";
import { forecastBookingDemand } from "../domain/recipe";
import { effectiveVisitStage, UnifiedVisitStage } from "../domain/visit";
import { visitStageI18nKey } from "../shared/visitStage";
import {
  Appointment, Product, CustomerEntitlement, ServiceRecipe,
} from "../domain/entities";

const DAY_MS = 24 * 60 * 60 * 1000;

interface RebookingRow {
  customerId: string;
  customerName: string;
  daysSince: number;
  status: RetentionStatus;
}

interface VisitRow {
  id: string;
  customerName: string;
  detail: string;
  stage: string;
}

interface ExceptionRow {
  id: string;
  customerName: string;
  detail: string;
  stage: string;
}

interface DemandRow {
  productId: string;
  productName?: string;
  expectedUnits: number;
  currentStock: number;
  shortfall: number;
  drivers: string[];
}

interface ExpiryRow {
  id: string;
  instrumentName: string;
  customerName?: string;
  daysToExpiry: number;
  remaining: string;
}

function stageLabel(stage: UnifiedVisitStage, t: (k: string) => string): string {
  if (stage === "COMPLETED" || stage === "CANCELLED" || stage === "NO_SHOW") return t(stage);
  return t(visitStageI18nKey(stage));
}

function SectionShell(props: {
  icon: React.ReactNode;
  title: string;
  count: number;
  route?: string;
  routeLabel?: string;
  tone?: "default" | "warning" | "danger";
  onNavigate: (route: string) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const border =
    props.tone === "warning" ? "border-warning/25" :
    props.tone === "danger" ? "border-destructive/25" : "border-border";
  return (
    <section className={clsx("overflow-hidden rounded-2xl border bg-card shadow-sm", border)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 min-w-0 text-sm font-bold text-foreground">
          <span className="text-primary">{props.icon}</span>
          <span className="truncate">{props.title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {props.count}
          </span>
        </h2>
        {props.route && (
          <button
            type="button"
            onClick={() => props.onNavigate(props.route!)}
            className="min-h-11 shrink-0 px-2 text-sm font-bold text-primary"
          >
            {props.routeLabel ?? t("View All")}
          </button>
        )}
      </div>
      <div className="p-3 sm:p-4">{props.children}</div>
    </section>
  );
}

export default function ActionCenterPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rebooking, setRebooking] = useState<RebookingRow[]>([]);
  const [arrivals, setArrivals] = useState<VisitRow[]>([]);
  const [readyForCheckout, setReadyForCheckout] = useState<VisitRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [expiry, setExpiry] = useState<ExpiryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const pastStart = new Date(now.getTime() - 365 * DAY_MS);
    const futureEnd = new Date(now.getTime() + 60 * DAY_MS);

    try {
      const [customersRes, appointmentsRes, productsRes, entitlementsRes] = await Promise.all([
        useCases.customers.list(),
        useCases.appointments.list({ fromISO: pastStart.toISOString(), toISO: futureEnd.toISOString() }),
        useCases.products.list(),
        useCases.entitlements.list(),
      ]);
      if (!customersRes.ok || !appointmentsRes.ok || !productsRes.ok || !entitlementsRes.ok) {
        throw new Error("ACTION_CENTER_DATA_UNAVAILABLE");
      }
      const customers = customersRes.data;
      const appointments: Appointment[] = appointmentsRes.data;
      const products: Product[] = productsRes.data;
      const entitlements: CustomerEntitlement[] = entitlementsRes.data;

      const names = new Map(customers.map((c) => [c.id, c.name]));
      const nameOf = (id?: string) => (id ? names.get(id) ?? "—" : "—");

      // 1) Customers due/overdue for rebooking — retention status from real visits.
      const visitsByCustomer = new Map<string, RetentionVisit[]>();
      for (const a of appointments) {
        if (a.status !== "COMPLETED" || !a.customerId) continue;
        const list = visitsByCustomer.get(a.customerId) ?? [];
        list.push({
          id: a.id,
          dateTimeISO: a.dateTime.toISOString(),
          serviceId: a.serviceId,
          serviceName: a.service?.name,
        });
        visitsByCustomer.set(a.customerId, list);
      }
      const rebookingRows: RebookingRow[] = [];
      for (const [customerId, visits] of visitsByCustomer.entries()) {
        const status = getRetentionStatus(visits, now);
        if (status.status === "DUE_FOR_REBOOK" || status.status === "DORMANT" || status.status === "WINBACK") {
          rebookingRows.push({
            customerId,
            customerName: nameOf(customerId),
            daysSince: status.daysSinceLastVisit ?? 0,
            status: status.status,
          });
        }
      }
      rebookingRows.sort((a, b) => b.daysSince - a.daysSince);
      setRebooking(rebookingRows.slice(0, 8));

      // 2–4) Operational visit states.
      const arrivalsRows: VisitRow[] = [];
      const checkoutRows: VisitRow[] = [];
      const exceptionRows: ExceptionRow[] = [];
      for (const a of appointments) {
        if (a.status !== "SCHEDULED") continue;
        const stage = effectiveVisitStage(a);
        const when = a.dateTime.getTime();
        const label = stageLabel(stage, t);
        const isToday = when >= todayStart.getTime() && when < todayEnd.getTime();
        if ((stage === "ARRIVED" || stage === "IN_SERVICE" || stage === "READY_FOR_CHECKOUT") && isToday) {
          arrivalsRows.push({
            id: a.id,
            customerName: nameOf(a.customerId),
            detail: a.dateTime.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" }),
            stage: label,
          });
        }
        if (stage === "READY_FOR_CHECKOUT") {
          checkoutRows.push({
            id: a.id,
            customerName: nameOf(a.customerId),
            detail: a.service?.name ?? "—",
            stage: label,
          });
        }
        if ((stage === "ARRIVED" || stage === "IN_SERVICE") && !isToday && when < todayStart.getTime()) {
          exceptionRows.push({
            id: a.id,
            customerName: nameOf(a.customerId),
            detail: formatSalonDate(a.dateTime, i18n.language),
            stage: label,
          });
        }
      }
      setArrivals(arrivalsRows);
      setReadyForCheckout(checkoutRows);
      setExceptions(exceptionRows);

      // 5–6) Low consumables + deterministic upcoming demand from recipes+bookings.
      const upcoming = appointments.filter(
        (a) => a.status === "SCHEDULED" && a.serviceId && a.dateTime.getTime() >= todayStart.getTime(),
      );
      const bookedServiceIds = [...new Set(upcoming.map((a) => a.serviceId).filter(Boolean))] as string[];
      const recipeByServiceId = new Map<string, Pick<ServiceRecipe, "items">>();
      for (const sid of bookedServiceIds.slice(0, 50)) {
        const r = await useCases.recipes.getForService(sid);
        if (r.ok && r.data) recipeByServiceId.set(sid, r.data);
      }
      const demandRows = forecastBookingDemand({
        appointments: upcoming.map((a) => ({ status: a.status, serviceId: a.serviceId, serviceName: a.service?.name, service: a.service })),
        recipeByServiceId,
        products,
      });
      setDemand(
        demandRows.map((d) => ({
          productId: d.productId,
          productName: d.productName,
          expectedUnits: d.expectedUnits,
          currentStock: d.currentStock,
          shortfall: d.shortfall,
          drivers: d.drivers.map((dr) => (dr.count > 1 ? `${dr.serviceName ?? "—"} ×${dr.count}` : dr.serviceName ?? "—")),
        })),
      );

      // 7) Meaningful wallet/entitlement expiry (30 days).
      const in30 = new Date(now.getTime() + 30 * DAY_MS);
      const expiryRows: ExpiryRow[] = [];
      for (const e of entitlements) {
        if (!e.expiresAt) continue;
        const exp = new Date(e.expiresAt).getTime();
        if (exp < now.getTime() || exp > in30.getTime()) continue;
        const unitsLeft =
          e.kind === "PACKAGE"
            ? (e.units ?? []).reduce((sum, u) => sum + Math.max(0, (u.totalUnits ?? 0) - (u.usedUnits ?? 0)), 0)
            : 0;
        if (e.remainingValue <= 0 && unitsLeft <= 0) continue;
        if (e.status !== "ACTIVE" && e.status !== "PARTIALLY_REDEEMED") continue;
        expiryRows.push({
          id: e.id,
          instrumentName: e.instrumentName ?? (e.kind === "PACKAGE" ? t("Package") : t("Gift Card")),
          customerName: e.customerName,
          daysToExpiry: Math.ceil((exp - now.getTime()) / DAY_MS),
          remaining: e.kind === "PACKAGE" ? `${unitsLeft} ${t("passport.sessionsLeft")}` : `${formatOMRAmount(e.remainingValue)} ${t("OMR")}`,
        });
      }
      expiryRows.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
      setExpiry(expiryRows.slice(0, 8));
    } catch (e: any) {
      setLoadError(mapErrorToMessage(e, t) || t("Failed to load action center"));
    } finally {
      setLoading(false);
    }
  }, [t, i18n.language]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalAttention = useMemo(
    () => rebooking.length + arrivals.length + readyForCheckout.length + exceptions.length + demand.length + expiry.length,
    [rebooking, arrivals, readyForCheckout, exceptions, demand, expiry],
  );

  if (loading) {
    return <ScreenState state="loading" title={t("Loading...")} />;
  }

  if (loadError) {
    return (
      <ScreenState
        state="error"
        title={t("Failed to load action center")}
        actionLabel={t("Retry")}
        onAction={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      <PageHeader
        icon={<Activity className="h-5 w-5" />}
        title={t("Action Center")}
        subtitle={t("actionCenter.subtitle")}
        actions={
          <button
            onClick={() => void load()}
            className="h-11 w-11 shrink-0 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
            aria-label={t("Refresh")}
            title={t("Refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      {totalAttention === 0 ? (
        <ScreenState
          state="empty"
          icon={<Activity className="h-6 w-6" />}
          title={t("actionCenter.allClear")}
          description={t("actionCenter.allClearDetail")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
          {/* 1) Due / overdue for rebooking */}
          {rebooking.length > 0 && (
            <SectionShell
              icon={<Hourglass className="h-4 w-4" />}
              title={t("actionCenter.rebooking")}
              count={rebooking.length}
              route="/customers"
              onNavigate={nav}
            >
              <ul className="space-y-2">
                {rebooking.map((row) => (
                  <li key={row.customerId}>
                    <button
                      type="button"
                      onClick={() => nav("/customers")}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-muted/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">{row.customerName}</span>
                        <span className="block text-xs font-medium text-muted-foreground">
                          {t("actionCenter.daysAgo", { count: row.daysSince })}
                        </span>
                      </span>
                      <span className={clsx(
                        "shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold",
                        row.status === "WINBACK" ? "border-destructive/20 bg-destructive/10 text-destructive"
                          : row.status === "DORMANT" ? "border-warning/20 bg-warning/10 text-warning"
                          : "border-primary/20 bg-primary/10 text-primary",
                      )}>
                        {t(`retention.status.${row.status}`)}
                      </span>
                      <ChevronRight className={clsx("h-4 w-4 shrink-0 text-muted-foreground", i18n.language === "ar" && "rotate-180")} />
                    </button>
                  </li>
                ))}
              </ul>
            </SectionShell>
          )}

          {/* 2) Today's arrivals */}
          {arrivals.length > 0 && (
            <SectionShell
              icon={<CalendarCheck className="h-4 w-4" />}
              title={t("actionCenter.arrivals")}
              count={arrivals.length}
              route="/appointments"
              onNavigate={nav}
            >
              <ul className="space-y-2">
                {arrivals.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => nav("/appointments")}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-muted/40"
                    >
                      <span className="w-14 shrink-0 text-sm font-bold text-primary">{row.detail}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">{row.customerName}</span>
                      </span>
                      <span className="shrink-0 rounded-lg border border-info/20 bg-info/10 px-2 py-1 text-[10px] font-bold text-info">{row.stage}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionShell>
          )}

          {/* 3) Visits ready for checkout */}
          {readyForCheckout.length > 0 && (
            <SectionShell
              icon={<ShoppingCart className="h-4 w-4" />}
              title={t("actionCenter.readyForCheckout")}
              count={readyForCheckout.length}
              route="/pos"
              onNavigate={nav}
              tone="warning"
            >
              <ul className="space-y-2">
                {readyForCheckout.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => nav(`/pos?appointment=${row.id}`)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-warning/5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">{row.customerName}</span>
                        <span className="block truncate text-xs font-medium text-muted-foreground">{row.detail}</span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{t("actionCenter.checkout")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionShell>
          )}

          {/* 4) Exceptions — visits stuck in an open state from a previous day */}
          {exceptions.length > 0 && (
            <SectionShell
              icon={<AlertTriangle className="h-4 w-4" />}
              title={t("actionCenter.exceptions")}
              count={exceptions.length}
              route="/appointments"
              onNavigate={nav}
              tone="danger"
            >
              <ul className="space-y-2">
                {exceptions.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => nav("/appointments")}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-destructive/5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">{row.customerName}</span>
                        <span className="block text-xs font-medium text-muted-foreground">{row.detail}</span>
                      </span>
                      <span className="shrink-0 rounded-lg border border-warning/20 bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">{row.stage}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionShell>
          )}

          {/* 5–6) Consumables at risk from booked services (deterministic demand) */}
          {demand.length > 0 && (
            <SectionShell
              icon={<PackageOpen className="h-4 w-4" />}
              title={t("actionCenter.demand")}
              count={demand.length}
              route="/inventory"
              onNavigate={nav}
              tone="warning"
            >
              <ul className="space-y-2">
                {demand.map((row) => (
                  <li key={row.productId}>
                    <button
                      type="button"
                      onClick={() => nav("/inventory")}
                      className="w-full rounded-xl border border-border p-3 text-start transition hover:bg-warning/5"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-bold text-foreground">{row.productName ?? row.productId.slice(0, 8)}</span>
                        <span className="shrink-0 rounded-lg bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">
                          −{row.shortfall}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
                        <span>{t("actionCenter.needed")}: {row.expectedUnits}</span>
                        <span>{t("actionCenter.inStock")}: {row.currentStock}</span>
                      </span>
                      {row.drivers.length > 0 && (
                        <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground">{row.drivers.join(" · ")}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </SectionShell>
          )}

          {/* 7) Wallet / entitlement expiry */}
          {expiry.length > 0 && (
            <SectionShell
              icon={<CalendarClock className="h-4 w-4" />}
              title={t("actionCenter.expiry")}
              count={expiry.length}
              route="/gift-cards"
              onNavigate={nav}
            >
              <ul className="space-y-2">
                {expiry.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => nav("/gift-cards")}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">{row.instrumentName}</span>
                        <span className="block truncate text-xs font-medium text-muted-foreground">
                          {row.customerName ? `${row.customerName} · ` : ""}{t("actionCenter.daysToExpiry", { count: row.daysToExpiry })}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">{row.remaining}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionShell>
          )}
        </div>
      )}
    </div>
  );
}
