import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import {
  Save, Download, Building2, Database,
  Globe, Phone, MapPin, Hash, Coins,
  ChevronRight, Bell, Palette, CreditCard, Rocket,
} from "lucide-react";
import { CenterSettings } from "../domain/entities";
import { useCases } from "../app/composition/useCases";
import { formatError, unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { requiredText, percentField, collectIssues, issuesToMap } from "../domain/validation";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageLoader } from "../shared/components/PageLoader";
import { ScreenState } from "../shared/components/ScreenState";

const BrandingSettingsSection = lazy(() => import("./BrandingSettingsPage"));
const NotificationsSettingsSection = lazy(() => import("./NotificationsSettingsPage"));
const PaymentGatewaySettingsSection = lazy(() => import("./PaymentGatewaySettingsPage"));
const LaunchReadinessSection = lazy(() => import("./settings/LaunchReadinessSection"));

type SettingsTab = "center" | "launch" | "backup" | "branding" | "notifications" | "payments";
const SETTINGS_TABS = new Set<SettingsTab>(["center", "launch", "backup", "branding", "notifications", "payments"]);

function readSettingsTab(value: string | null): SettingsTab {
  return value && SETTINGS_TABS.has(value as SettingsTab) ? value as SettingsTab : "center";
}

const fieldClass = "min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function SettingsPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>(() => readSettingsTab(searchParams.get("tab")));
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [centerErrors, setCenterErrors] = useState<Record<string, string>>({});
  const [vatText, setVatText] = useState("0");

  function selectTab(next: SettingsTab) {
    setTab(next);
    setSearchParams(next === "center" ? {} : { tab: next }, { replace: true });
  }

  async function load() {
    setLoadError(null);
    try {
      const loaded = await unwrap(useCases.settings.get());
      setSettings(loaded);
      setVatText(String(loaded.taxRate ?? 0));
    } catch (error) {
      console.error("Settings load failed", error);
      setLoadError(formatError(error));
      setSettings(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setTab(readSettingsTab(searchParams.get("tab")));
  }, [searchParams]);

  async function saveCenter() {
    if (!settings) return;

    const nameResult = requiredText(settings.name);
    const taxResult = percentField(vatText);
    const issues = collectIssues([
      { field: "name", result: nameResult },
      { field: "taxRate", result: taxResult },
    ]);

    if (issues.length > 0) {
      setCenterErrors(issuesToMap(issues));
      return;
    }

    setCenterErrors({});
    setBusy(true);
    try {
      const updated = await unwrap(useCases.settings.update({
        name: (nameResult as { ok: true; value: string }).value,
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        cr: settings.cr ?? "",
        postalCode: settings.postalCode ?? "",
        currency: settings.currency ?? "OMR",
        taxRate: (taxResult as { ok: true; value: number }).value,
      }));
      setVatText(String((taxResult as { ok: true; value: number }).value));
      setSettings(updated);
      showToast("success", t("Success"), t("Settings saved successfully"));
    } catch (error) {
      console.error("Settings save failed", error);
      showToast("error", t("Error"), formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleExportData() {
    try {
      setBusy(true);
      const data = await unwrap(useCases.settings.exportData());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `salon_data_export_${new Date().toISOString().split("T")[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Data export failed", error);
      showToast("error", t("Error"), t("Failed to export data"));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    if (loadError) {
      return (
        <ScreenState
          state="error"
          title={t("Failed to load settings")}
          description={loadError}
          actionLabel={t("Retry")}
          onAction={() => void load()}
        />
      );
    }
    return <PageLoader />;
  }

  const navItems: { id: SettingsTab; label: string; icon: typeof Building2; desc: string }[] = [
    { id: "center", label: t("Center Profile"), icon: Building2, desc: t("Manage your business details") },
    { id: "launch", label: t("Go-Live"), icon: Rocket, desc: t("Verify first customer launch readiness") },
    { id: "backup", label: t("Data Export"), icon: Database, desc: t("Export operational data safely") },
    { id: "branding", label: t("Branding"), icon: Palette, desc: t("Manage salon visual identity") },
    { id: "notifications", label: t("Notifications"), icon: Bell, desc: t("Appointment reminders and messages") },
    { id: "payments", label: t("Payment Gateway"), icon: CreditCard, desc: t("Configure online deposit collection for booking confirmations") },
  ];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <aside className="shrink-0 lg:w-72">
          <div className="space-y-4 lg:sticky lg:top-24 lg:space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("Settings")}</h1>
              <p className="text-sm text-muted-foreground">{t("Configure and manage your application preferences.")}</p>
            </div>

            <nav aria-label={t("Settings")} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:block lg:space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={clsx(
                    "group flex min-h-11 min-w-[145px] items-center gap-2 rounded-xl p-3 text-start transition-colors lg:w-full lg:min-w-0 lg:items-start lg:gap-4 lg:rounded-2xl lg:p-4",
                    tab === item.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className={clsx(
                    "mt-0.5 rounded-xl p-2 transition-colors",
                    tab === item.id ? "bg-primary-foreground/15" : "bg-muted group-hover:bg-background",
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-start">
                    <div className="text-sm font-bold">{item.label}</div>
                    <div className={clsx(
                      "mt-0.5 hidden text-[10px] font-medium leading-tight lg:block",
                      tab === item.id ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}>
                      {item.desc}
                    </div>
                  </div>
                  {tab === item.id ? (
                    <motion.div layoutId="active-tab" className="mt-2">
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </motion.div>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              {tab === "center" ? (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
                  <div className="mb-7 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{t("Business Profile")}</h2>
                      <p className="text-sm text-muted-foreground">{t("This information will appear on your invoices and reports.")}</p>
                    </div>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label={t("Business Name")} icon={<Globe className="h-3.5 w-3.5" />}>
                        <input
                          className={fieldClass}
                          value={settings.name}
                          onChange={(event) => {
                            setSettings({ ...settings, name: event.target.value });
                            if (centerErrors.name) setCenterErrors((prev) => ({ ...prev, name: "" }));
                          }}
                          placeholder={t("Enter business name")}
                        />
                        {centerErrors.name ? <p className="text-xs font-bold text-destructive">{t(centerErrors.name)}</p> : null}
                      </Field>

                      <Field label={t("Phone Number")} icon={<Phone className="h-3.5 w-3.5" />}>
                        <input
                          className={fieldClass}
                          value={settings.phone ?? ""}
                          onChange={(event) => setSettings({ ...settings, phone: event.target.value })}
                          placeholder="+968 0000 0000"
                          dir="ltr"
                        />
                      </Field>
                    </div>

                    <Field label={t("Address")} icon={<MapPin className="h-3.5 w-3.5" />}>
                      <input
                        className={fieldClass}
                        value={settings.address ?? ""}
                        onChange={(event) => setSettings({ ...settings, address: event.target.value })}
                        placeholder={t("Street, City, Country")}
                      />
                    </Field>

                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                      <Field label={t("Commercial Register")} icon={<Hash className="h-3.5 w-3.5" />}>
                        <input
                          className={fieldClass}
                          value={settings.cr ?? ""}
                          onChange={(event) => setSettings({ ...settings, cr: event.target.value })}
                          placeholder="CR-123456"
                        />
                      </Field>

                      <Field label={t("Postal Code")} icon={<MapPin className="h-3.5 w-3.5" />}>
                        <input
                          className={fieldClass}
                          value={settings.postalCode ?? ""}
                          onChange={(event) => setSettings({ ...settings, postalCode: event.target.value })}
                          placeholder="123"
                        />
                      </Field>

                      <Field label={t("Currency")} icon={<Coins className="h-3.5 w-3.5" />}>
                        <input
                          className={fieldClass}
                          value={settings.currency}
                          onChange={(event) => setSettings({ ...settings, currency: event.target.value })}
                          placeholder="OMR"
                        />
                      </Field>

                      <Field label={t("VAT Rate")} icon={<Coins className="h-3.5 w-3.5" />}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={fieldClass}
                          value={vatText}
                          onChange={(event) => {
                            setVatText(event.target.value);
                            if (centerErrors.taxRate) setCenterErrors((prev) => ({ ...prev, taxRate: "" }));
                          }}
                          placeholder="0"
                        />
                        {centerErrors.taxRate ? <p className="text-xs font-bold text-destructive">{t(centerErrors.taxRate)}</p> : null}
                      </Field>
                    </div>

                    <div className="mt-2 rounded-2xl border border-border bg-muted/35 p-4 sm:p-5">
                      <div className="flex flex-col items-center gap-4 sm:flex-row">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                          {settings.brandLogoBase64 || settings.logoPath ? (
                            <img
                              src={settings.brandLogoBase64 || settings.logoPath}
                              alt={t("Business Logo")}
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 text-center sm:text-start">
                          <h3 className="font-bold text-foreground">{t("Business Logo")}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{t("Manage the logo and brand colors in the Branding section.")}</p>
                          <button
                            type="button"
                            onClick={() => selectTab("branding")}
                            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition hover:bg-muted"
                          >
                            <Palette className="h-4 w-4 text-primary" />
                            {t("Open Branding")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 flex justify-end border-t border-border pt-5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={saveCenter}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {busy ? t("Saving...") : t("Save Changes")}
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === "launch" ? (
                <Suspense fallback={<PageLoader />}>
                  <LaunchReadinessSection />
                </Suspense>
              ) : null}

              {tab === "branding" ? (
                <Suspense fallback={<PageLoader />}>
                  <BrandingSettingsSection embedded />
                </Suspense>
              ) : null}

              {tab === "notifications" ? (
                <Suspense fallback={<PageLoader />}>
                  <NotificationsSettingsSection embedded />
                </Suspense>
              ) : null}

              {tab === "payments" ? (
                <Suspense fallback={<PageLoader />}>
                  <PaymentGatewaySettingsSection embedded />
                </Suspense>
              ) : null}

              {tab === "backup" ? (
                <div className="max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Download className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{t("Operational JSON Export")}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t("Downloads a partial operational dataset. It is not a database backup and cannot restore financial records.")}
                      </p>
                      <p className="mt-3 text-xs font-bold text-destructive">{t("Restore is unavailable")}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleExportData}
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {busy ? t("Processing...") : t("Export JSON")}
                  </button>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}