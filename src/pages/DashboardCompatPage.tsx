import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronRight, RefreshCw, Scissors, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import DashboardPage from "./DashboardPage";
import { useCases } from "../app/composition/useCases";
import { ScreenState } from "../shared/components/ScreenState";
import { GettingStartedCard } from "../shared/components/GettingStartedCard";
import { useAuth } from "../auth";
import { getDisplayName } from "../shared/displayName";

type CompatMode = "checking" | "full" | "operational" | "error";

type OperationalAppointment = {
  id: string;
  time: string;
  customerName: string;
  status: string;
};

type OperationalState = {
  customers: number;
  services: number;
  appointments: OperationalAppointment[];
  lowStock: { id: string; name: string; stock: number }[];
};

const EMPTY_OPERATIONAL: OperationalState = {
  customers: 0,
  services: 0,
  appointments: [],
  lowStock: [],
};

export default function DashboardCompatPage() {
  const { t, i18n } = useTranslation();
  const { me } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<CompatMode>("checking");
  const [operational, setOperational] = useState<OperationalState>(EMPTY_OPERATIONAL);

  const loadOperational = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [customersRes, servicesRes, appointmentsRes, productsRes] = await Promise.all([
      useCases.customers.list(),
      useCases.services.list(),
      useCases.appointments.list({ fromISO: todayStart.toISOString(), toISO: todayEnd.toISOString() }),
      useCases.products.list(),
    ]);

    if (!customersRes.ok || !servicesRes.ok || !appointmentsRes.ok || !productsRes.ok) {
      throw new Error("OPERATIONAL_DATA_UNAVAILABLE");
    }

    const customerNames = new Map(customersRes.data.map((customer) => [customer.id, customer.name]));
    const appointments = appointmentsRes.data
      .filter((appointment) => appointment.status !== "CANCELLED")
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
      .map((appointment) => ({
        id: appointment.id,
        time: appointment.dateTime.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        customerName: appointment.customerId ? (customerNames.get(appointment.customerId) ?? "—") : "—",
        status: appointment.status,
      }));

    const lowStock = productsRes.data
      .filter((product) => product.isActive && product.trackInventory && product.stockQuantity <= (product.reorderLevel ?? 5))
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 5)
      .map((product) => ({ id: product.id, name: product.name, stock: product.stockQuantity }));

    setOperational({
      customers: customersRes.data.length,
      services: servicesRes.data.filter((service) => service.isActive !== false).length,
      appointments,
      lowStock,
    });
  }, [i18n.language]);

  const probe = useCallback(async () => {
    setMode("checking");
    const summary = await useCases.dashboard.getSummary();
    if (summary.ok) {
      setMode("full");
      return;
    }

    try {
      await loadOperational();
      setMode("operational");
    } catch {
      setMode("error");
    }
  }, [loadOperational]);

  useEffect(() => {
    void probe();
  }, [probe]);

  const metrics = useMemo(() => [
    { label: t("Appointments"), value: operational.appointments.length, Icon: CalendarDays, route: "/appointments" },
    { label: t("Customers"), value: operational.customers, Icon: Users, route: "/customers" },
    { label: t("Services"), value: operational.services, Icon: Scissors, route: "/services" },
    { label: t("Low Stock"), value: operational.lowStock.length, Icon: AlertTriangle, route: "/inventory" },
  ], [operational, t]);

  if (mode === "checking") {
    return <ScreenState state="loading" title={t("Loading...")} />;
  }

  if (mode === "full") {
    return <DashboardPage />;
  }

  if (mode === "error") {
    return (
      <ScreenState
        state="error"
        title={t("An unexpected error occurred. Please try again.")}
        actionLabel={t("Retry")}
        onAction={() => void probe()}
      />
    );
  }

  return (
    <div className="space-y-5 pb-8 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{t("Today")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("Welcome")}{me?.username ? <>, <span className="text-primary">{getDisplayName(me, me.username)}</span></> : null}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void probe()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/30 hover:text-primary"
          aria-label={t("Refresh")}
          title={t("Refresh")}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <GettingStartedCard viewerRole={me?.role} />

      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, Icon, route }) => (
          <button
            key={label}
            type="button"
            onClick={() => nav(route)}
            className="min-h-28 rounded-2xl border border-border bg-card p-4 text-start shadow-sm transition hover:border-primary/25 hover:bg-primary/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="mt-3 block text-sm font-semibold text-muted-foreground">{label}</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-foreground">{value}</span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("Today's Appointments")}
          </h2>
          <button type="button" onClick={() => nav("/appointments")} className="min-h-11 px-2 text-sm font-bold text-primary">
            {t("View All")}
          </button>
        </div>
        <div className="p-3 sm:p-4">
          {operational.appointments.length === 0 ? (
            <ScreenState
              state="empty"
              compact
              icon={<CalendarDays className="h-6 w-6" />}
              title={t("No upcoming appointments today")}
              description={t("Book an appointment to get started")}
              actionLabel={t("New Appointment")}
              onAction={() => nav("/appointments")}
            />
          ) : (
            <div className="space-y-2">
              {operational.appointments.slice(0, 6).map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => nav("/appointments")}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-muted/40"
                >
                  <span className="w-14 shrink-0 text-sm font-bold text-primary">{appointment.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">{appointment.customerName}</span>
                    <span className="block text-xs font-medium text-muted-foreground">{t(appointment.status)}</span>
                  </span>
                  <ChevronRight className={clsx("h-4 w-4 shrink-0 text-muted-foreground", i18n.language === "ar" && "rotate-180")} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {operational.lowStock.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-warning/25 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-warning/20 bg-warning/5 px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              {t("Operational Alerts")}
            </h2>
            <button type="button" onClick={() => nav("/inventory")} className="min-h-11 px-2 text-sm font-bold text-primary">
              {t("View All")}
            </button>
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            {operational.lowStock.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => nav("/inventory")}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-warning/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">{item.name}</span>
                  <span className="block text-xs font-medium text-muted-foreground">{t("Low Stock")}</span>
                </span>
                <span className="rounded-lg bg-warning/10 px-2.5 py-1 text-sm font-bold tabular-nums text-warning">{item.stock}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
