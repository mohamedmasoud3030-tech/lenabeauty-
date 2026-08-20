import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  Save, Download, Building2, Database,
  ShieldCheck, Globe, Phone, MapPin, Hash,
  Coins, ChevronRight, Bell, Palette, CreditCard,
  Trash2, FileJson, CheckCircle2
} from "lucide-react";
import { CenterSettings } from "../domain/entities";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
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

type SettingsTab = "center" | "backup" | "branding" | "notifications" | "payments" | "privacy";
const SETTINGS_TABS = new Set<SettingsTab>(["center", "backup", "branding", "notifications", "payments", "privacy"]);

function readSettingsTab(value: string | null): SettingsTab {
  return value && SETTINGS_TABS.has(value as SettingsTab) ? value as SettingsTab : "center";
}

/** Shared JSON downloader — pure function; hooks must come from the caller. */
async function downloadJsonExport(
  fetchData: () => Promise<any>,
  filename: string,
  toast: (type: "success" | "error", title: string, msg?: string) => void,
  messages: { success?: string; backendRequired: string; failed: string },
) {
  try {
    const res = await fetchData();
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    if (messages.success) toast("success", messages.success, messages.success);
  } catch (err: any) {
    if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
      toast('error', messages.backendRequired, messages.backendRequired);
    } else {
      toast('error', messages.failed, err.message || messages.failed);
    }
  }
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>(() => readSettingsTab(searchParams.get("tab")));

  function selectTab(next: SettingsTab) {
    setTab(next);
    setSearchParams(next === "center" ? {} : { tab: next }, { replace: true });
  }
  // center settings
  const [s, setS] = useState<CenterSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [centerErrors, setCenterErrors] = useState<Record<string, string>>({});
  // VAT is kept as text so empty/invalid input is an error, never a silent 0.
  const [vatText, setVatText] = useState("0");

  async function load() {
    setLoadError(null);
    try {
      const settings = await unwrap(useCases.settings.get());
      setS(settings);
      setVatText(String(settings.taxRate ?? 0));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(message);
      setS(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setTab(readSettingsTab(searchParams.get("tab")));
  }, [searchParams]);

  async function saveCenter() {
    if (!s) return;
    const nameR = requiredText(s.name);
    const taxR = percentField(vatText);
    const issues = collectIssues([
      { field: "name", result: nameR },
      { field: "taxRate", result: taxR },
    ]);
    if (issues.length > 0) {
      setCenterErrors(issuesToMap(issues));
      return;
    }
    setCenterErrors({});
    setBusy(true);
    try {
      const updated = await unwrap(useCases.settings.update({
        name: (nameR as { ok: true; value: string }).value,
        address: s.address ?? "",
        phone: s.phone ?? "",
        cr: s.cr ?? "",
        postalCode: s.postalCode ?? "",
        currency: s.currency ?? "OMR",
        taxRate: (taxR as { ok: true; value: number }).value,
      }));
      setVatText(String((taxR as { ok: true; value: number }).value));
      setS(updated);
      showToast('success', t('Success'), t("Settings saved successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err.message ?? t("Error"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleExportData() {
    const filename = `salon_data_export_${new Date().toISOString().split("T")[0]}.json`;
    await downloadJsonExport(
      () => unwrap(useCases.settings.exportData()),
      filename,
      (type, title, msg) => showToast(type, title, msg),
      { backendRequired: t("Backend Required"), failed: t("Failed to export data") },
    );
  }

  if (!s) {
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
    { id: "backup", label: t("Data Export"), icon: Database, desc: t("Export operational data safely") },
    { id: "branding", label: t("Branding"), icon: Palette, desc: t("Manage salon visual identity") },
    { id: "notifications", label: t("Notifications"), icon: Bell, desc: t("Appointment reminders and messages") },
    { id: "payments", label: t("Payment Gateway"), icon: CreditCard, desc: t("Booking deposit configuration") },
    { id: "privacy", label: t("Privacy & My Data"), icon: ShieldCheck, desc: t("Export or request deletion of your data") },
  ];

  return (
    <div className="flex flex-col gap-6 pb-10">


      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        {/* Settings section navigation */}
      <aside className="lg:w-72 shrink-0">
        <div className="lg:sticky lg:top-24 space-y-4 lg:space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("Settings")}</h1>
            <p className="text-sm text-muted-foreground">{t("Configure and manage your application preferences.")}</p>
          </div>

          <nav aria-label={t("Settings")} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:block lg:space-y-2">
            {navItems.map((item) => (
              <button type="button"
                key={item.id}
                onClick={() => selectTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={clsx(
                  "group min-h-11 min-w-[145px] flex items-center gap-2 rounded-xl p-3 text-start transition-colors lg:w-full lg:min-w-0 lg:items-start lg:gap-4 lg:rounded-2xl lg:p-4",
                  tab === item.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={clsx(
                  "mt-0.5 rounded-xl p-2 transition-colors",
                  tab === item.id ? "bg-white/20" : "bg-muted group-hover:bg-background"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 text-start">
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className={clsx(
                    "hidden lg:block text-[10px] font-medium leading-tight mt-0.5",
                    tab === item.id ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {item.desc}
                  </div>
                </div>
                {tab === item.id && (
                  <motion.div layoutId="active-tab" className="mt-2">
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </motion.div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content Area */}
      <section className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-8"
          >
            {tab === "center" && (
              <div className="space-y-8">
                <div className="rounded-[2.5rem] border border-border bg-card p-6 sm:p-10 shadow-sm space-y-6 sm:space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{t("Business Profile")}</h2>
                      <p className="text-sm text-muted-foreground">{t("This information will appear on your invoices and reports.")}</p>
                    </div>
                  </div>

                  <div className="grid gap-8">
                    <div className="grid gap-8 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Globe className="h-3 w-3" />
                          {t("Business Name")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={s.name}
                          onChange={(e) => { setS({ ...s, name: e.target.value }); if (centerErrors.name) setCenterErrors((p) => ({ ...p, name: "" })); }}
                          placeholder={t("Enter business name")}
                        />
                        {centerErrors.name && <div className="text-xs font-bold text-destructive">{t(centerErrors.name)}</div>}
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Phone className="h-3 w-3" />
                          {t("Phone Number")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={s.phone ?? ""}
                          onChange={(e) => setS({ ...s, phone: e.target.value })}
                          placeholder="+968 0000 0000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <MapPin className="h-3 w-3" />
                        {t("Address")}
                      </label>
                      <input
                        className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                        value={s.address ?? ""}
                        onChange={(e) => setS({ ...s, address: e.target.value })}
                        placeholder={t("Street, City, Country")}
                      />
                    </div>

                    <div className="grid gap-8 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Hash className="h-3 w-3" />
                          {t("Commercial Register")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={s.cr ?? ""}
                          onChange={(e) => setS({ ...s, cr: e.target.value })}
                          placeholder="CR-123456"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <MapPin className="h-3 w-3" />
                          {t("Postal Code")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={s.postalCode ?? ""}
                          onChange={(e) => setS({ ...s, postalCode: e.target.value })}
                          placeholder="123"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Coins className="h-3 w-3" />
                          {t("Currency")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={s.currency}
                          onChange={(e) => setS({ ...s, currency: e.target.value })}
                          placeholder="OMR"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Coins className="h-3 w-3" />
                          {t("VAT Rate")}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={vatText}
                          onChange={(e) => { setVatText(e.target.value); if (centerErrors.taxRate) setCenterErrors((p) => ({ ...p, taxRate: "" })); }}
                          placeholder="0"
                        />
                        {centerErrors.taxRate && <div className="text-xs font-bold text-destructive">{t(centerErrors.taxRate)}</div>}
                        <p className="text-xs text-muted-foreground">{t("VAT")} (%)</p>
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-border p-6 bg-muted/30">
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="h-24 w-24 rounded-3xl bg-background border border-border flex items-center justify-center overflow-hidden shadow-inner">
                          {(s.brandLogoBase64 || s.logoPath) ? (
                            <img src={s.brandLogoBase64 || s.logoPath} alt={t("Business Logo")} className="h-full w-full object-contain p-2" />
                          ) : (
                            <Building2 className="h-10 w-10 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 text-center md:text-start space-y-3">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{t("Business Logo")}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{t("Manage the logo and brand colors in the Branding section.")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectTab("branding")}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-background border border-border px-5 py-2.5 text-sm font-bold hover:bg-muted transition-colors"
                          >
                            <Palette className="h-4 w-4 text-primary" />
                            {t("Open Branding")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border flex justify-end">
                    <button type="button"
                      disabled={busy}
                      onClick={saveCenter}
                      className="group relative inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-10 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {t("Save Changes")}
                      <span className="absolute -top-3 -end-3 bg-warning/10 text-warning border border-warning/20 text-[8px] px-2 py-0.5 rounded-full uppercase font-bold tracking-widest pointer-events-none">{t("Backend Required")}</span>
                      {busy && <div className="absolute inset-0 bg-primary/50 flex items-center justify-center rounded-2xl"><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "branding" && (
              <Suspense fallback={<PageLoader />}>
                <BrandingSettingsSection embedded />
              </Suspense>
            )}

            {tab === "notifications" && (
              <Suspense fallback={<PageLoader />}>
                <NotificationsSettingsSection embedded />
              </Suspense>
            )}

            {tab === "payments" && (
              <Suspense fallback={<PageLoader />}>
                <PaymentGatewaySettingsSection embedded />
              </Suspense>
            )}

            {tab === "backup" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Download className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{t("Operational JSON Export")}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("Downloads a partial operational dataset. It is not a database backup and cannot restore financial records.")}
                      </p>
                    </div>
                  </div>
                  <button type="button"
                    disabled={busy}
                    onClick={handleExportData}
                    className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {busy ? t("Processing...") : t("Export JSON")}
                  </button>
                </div>

                <div className="rounded-[2rem] border border-warning/30 bg-warning/5 p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-warning/10 flex items-center justify-center text-warning">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{t("Restore is unavailable")}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("Recovery controls are disabled until an atomic, complete restore is implemented.")}
                      </p>
                    </div>
                  </div>
                  <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    {t("Use managed database backups and a tested recovery runbook for disaster recovery.")}
                  </p>
                </div>
              </div>
            )}

            {tab === "privacy" && (
              <PrivacySection />
            )}

          </motion.div>
        </AnimatePresence>
      </section>
      </div>
    </div>
  );
}

/* ==================================================================== *
 *  PRIVACY & MY DATA SECTION
 * ==================================================================== */
function PrivacySection() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleExportMyData() {
    const filename = `my_data_export_${new Date().toISOString().split("T")[0]}.json`;
    await downloadJsonExport(
      // Personal-data export: the signed-in user's own profile and center
      // memberships — NOT the center's operational dataset (which is the
      // separate "Data Export" tab).
      async () => {
        const session = await useCases.auth.getSession();
        const memberships = await useCases.auth.getMyCenters();
        const sessionData = session.ok ? session.data : null;
        return {
          exported_at: new Date().toISOString(),
          user: sessionData && sessionData.status === "authenticated"
            ? { id: sessionData.session.user.id, role: sessionData.session.user.role }
            : null,
          center_memberships: memberships.ok ? memberships.data : [],
        };
      },
      filename,
      (type, title, msg) => showToast(type, title, msg),
      { success: t("Your data export was downloaded to this device."), backendRequired: t("Backend Required"), failed: t("Failed to export data") },
    );
  }

  async function handleRequestDeletion() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const res = await useCases.help.createTicket({
        route: "/settings?tab=privacy",
        expectedBehavior: "My account and personal data should be deleted",
        actualBehavior: "I request account deletion",
        urgency: "high",
      });
      if (res.ok) {
        setDeletionRequested(true);
        showToast("success", t("Success"), t("Deletion request submitted to the center administrator."));
      } else {
        showToast("error", t("Error"), res.error?.message || t("Could not submit request"));
      }
    } catch (e: any) {
      showToast("error", t("Error"), e?.message || t("Could not submit request"));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Export */}
      <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <FileJson className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t("Export my data")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Download the operational records of this center as a JSON file to this device. Nothing is sent to a server.")}
            </p>
          </div>
        </div>
        <button type="button"
          disabled={busy}
          onClick={handleExportMyData}
          className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {busy ? t("Processing...") : t("Download my data")}
        </button>
      </div>

      {/* Deletion request */}
      <div className="rounded-[2rem] border border-destructive/25 bg-destructive/5 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t("Request account deletion")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Submits a deletion request to the center administrator. The administrator confirms before any data is removed. Invoices and financial records may be retained for legal requirements.")}
            </p>
          </div>
        </div>

        {(() => {
          if (deletionRequested) {
            return (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">{t("Request submitted")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("The administrator will review it. You can follow its status in Support Operations.")}
                  </p>
                </div>
              </div>
            );
          }
          if (confirmDelete) {
            return (
              <div className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-4">
                <p className="text-sm font-bold text-foreground">{t("Are you sure?")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("This will hide your account from the app and notify the administrator. It does not immediately delete financial history.")}
                </p>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="h-11 flex-1 rounded-xl border border-border text-sm font-bold hover:bg-muted/30 transition-all"
                  >
                    {t("Cancel")}
                  </button>
                  <button type="button"
                    onClick={handleRequestDeletion}
                    disabled={busy}
                    className="h-11 flex-1 rounded-xl bg-destructive text-white text-sm font-bold disabled:opacity-50 transition-all"
                  >
                    {busy ? t("Processing...") : t("Confirm request")}
                  </button>
                </div>
              </div>
            );
          }
          return (
            <button type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-card px-6 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              {t("Request deletion")}
            </button>
          );
        })()}

        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {t("This is a provider-neutral request workflow — no external service is used.")}
        </p>
      </div>
    </div>
  );
}
