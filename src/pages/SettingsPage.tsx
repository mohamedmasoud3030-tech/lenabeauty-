import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ImagePlus, Save, Plus, Trash2, Pencil, Download, Upload,
  AlertTriangle, BarChart, Building2, Users, Database,
  ShieldCheck, Globe, Phone, MapPin, Hash,
  Coins, CheckCircle2, XCircle, ChevronRight, Bell, Palette, CreditCard
} from "lucide-react";
import { CenterSettings } from "../domain/entities";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { validateBackupPayload } from "../application/dto";
import { requiredText, percentField, collectIssues, issuesToMap } from "../domain/validation";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageLoader } from "../shared/components/PageLoader";

const BrandingSettingsSection = lazy(() => import("./BrandingSettingsPage"));
const NotificationsSettingsSection = lazy(() => import("./NotificationsSettingsPage"));
const PaymentGatewaySettingsSection = lazy(() => import("./PaymentGatewaySettingsPage"));

type SettingsTab = "center" | "users" | "backup" | "branding" | "notifications" | "payments";
const SETTINGS_TABS = new Set<SettingsTab>(["center", "users", "backup", "branding", "notifications", "payments"]);

function readSettingsTab(value: string | null): SettingsTab {
  return value && SETTINGS_TABS.has(value as SettingsTab) ? value as SettingsTab : "center";
}

type Settings = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  cr: string | null;
  postalCode: string | null;
  currency: string;
  logoPath: string | null;
};

type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt?: string;
};

export default function SettingsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>(() => readSettingsTab(searchParams.get("tab")));

  function selectTab(next: SettingsTab) {
    setTab(next);
    setSearchParams(next === "center" ? {} : { tab: next }, { replace: true });
  }
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupInterval, setBackupInterval] = useState(30);

  // center settings
  const [s, setS] = useState<CenterSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [centerErrors, setCenterErrors] = useState<Record<string, string>>({});
  // VAT is kept as text so empty/invalid input is an error, never a silent 0.
  const [vatText, setVatText] = useState("0");

  // users
  const [users, setUsers] = useState<any[]>([]);
  const [uBusy, setUBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  const isEditing = !!editingId;

  async function load() {
    try {
      const [x, us] = await Promise.all([unwrap(useCases.settings.get()), unwrap(useCases.employees.list())]);
      setS(x);
      setVatText(String(x.taxRate ?? 0));
      setUsers(us);
    } catch (e) {
      console.error("Failed to load settings or users", e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setTab(readSettingsTab(searchParams.get("tab")));
  }, [searchParams]);

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const res = await unwrap(useCases.settings.uploadLogo(file));
      setS((prev) => (prev ? { ...prev, logoPath: res.logoPath } : prev));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), t("Failed to upload logo"));
      }
    } finally {
      setBusy(false);
    }
  }

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
        logoPath: s.logoPath ?? undefined,
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

  function resetUserForm() {
    setEditingId(null);
    setUsername("");
    setRole("STAFF");
    setIsActive(true);
    setPassword("");
  }

  async function loadUsersOnly() {
    const us = await unwrap(useCases.employees.list());
    setUsers(us);
  }

  async function submitUser() {
    if (!username.trim()) return showToast('error', t("Error"), t("Username is required"));
    if (!isEditing && !password) return showToast('error', t("Error"), t("Password is required"));

    setUBusy(true);
    try {
      if (isEditing && editingId) {
        await unwrap(useCases.employees.update(editingId, {
          id: editingId,
          role,
          isActive,
          password: password || undefined,
        }));
      } else {
        await unwrap(useCases.employees.create({ username: username.trim(), password, role, isActive }));
      }
      await loadUsersOnly();
      resetUserForm();
    } catch (e: any) {
      showToast("error", t("Error"), formatError(e));
    } finally {
      setUBusy(false);
    }
  }

  function onEdit(u: UserRow) {
    setEditingId(u.id);
    setUsername(u.username);
    setRole(u.role);
    setIsActive(u.isActive);
    setPassword("");
    selectTab("users");
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: t("Delete User"),
      message: t("Are you sure you want to delete this user?"),
      type: "danger"
    });
    if (!ok) return;
    setUBusy(true);
    try {
      await useCases.employees.delete(id);
      await loadUsersOnly();
    } catch (e: any) {
      showToast("error", t("Error"), formatError(e));
    } finally {
      setUBusy(false);
    }
  }

  const usersSorted = useMemo(
    () => [...users].sort((a, b) => (a.username > b.username ? 1 : -1)),
    [users]
  );

  // Backup Functions
  async function handleBackup() {
    try {
      setBusy(true);
      const res = await unwrap(useCases.settings.backup());
      showToast('success', t('Success'), res.message || t("Backup created successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err.message || t("Failed to create backup"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleExportData() {
    try {
      setBusy(true);
      const res = await unwrap(useCases.settings.exportData());
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salon_data_export_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err.message || t("Failed to export data"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    const ok = await confirm({
      title: t("Restore Backup"),
      message: t("Warning: Restoring backup will delete all current data. Are you sure?"),
      type: "danger"
    });
    if (!ok) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setBusy(true);
          const data = JSON.parse(event.target?.result as string);
          if (!validateBackupPayload(data)) {
            throw new Error(t("Invalid backup file structure."));
          }
          await unwrap(useCases.settings.restore(data));
          showToast('success', t('Success'), t("Restore successful. Application will reload."));
          window.location.reload();
        } catch (err: any) {
          if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
             showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
          } else {
             showToast('error', t("Error"), err?.message || t("Failed to restore backup."));
             console.error(err);
          }
        } finally {
          setBusy(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  if (!s) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("Loading Settings...")}</p>
      </div>
    </div>
  );

  const navItems: { id: SettingsTab; label: string; icon: typeof Building2; desc: string }[] = [
    { id: "center", label: t("Center Profile"), icon: Building2, desc: t("Manage your business details") },
    { id: "users", label: t("User Management"), icon: Users, desc: t("Control access and permissions") },
    { id: "backup", label: t("Data & Backup"), icon: Database, desc: t("Secure your business data") },
    { id: "branding", label: t("Branding"), icon: Palette, desc: t("Manage salon visual identity") },
    { id: "notifications", label: t("Notifications"), icon: Bell, desc: t("Appointment reminders and messages") },
    { id: "payments", label: t("Payment Gateway"), icon: CreditCard, desc: t("Booking deposit configuration") },
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

          <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:block lg:space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
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
      <main className="flex-1 min-w-0">
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

                    <div className="rounded-[2rem] border-2 border-dashed border-border p-8 bg-muted/30 group hover:border-primary/50 transition-colors">
                      <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="h-32 w-32 rounded-3xl bg-background border border-border flex items-center justify-center overflow-hidden shadow-inner relative group-hover:scale-105 transition-transform">
                          {s.logoPath ? (
                            <img src={s.logoPath} alt="Logo" className="h-full w-full object-contain p-2" />
                          ) : (
                            <Building2 className="h-12 w-12 text-muted-foreground/20" />
                          )}
                        </div>
                        <div className="flex-1 text-center md:text-start space-y-4">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{t("Business Logo")}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{t("Upload a high-resolution logo for your invoices.")}</p>
                          </div>
                          <div className="relative inline-block">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={pickLogo}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <button className="inline-flex items-center gap-2 rounded-xl bg-background border border-border px-6 py-2.5 text-sm font-bold hover:bg-muted transition-all shadow-sm">
                              <ImagePlus className="h-4 w-4 text-primary" />
                              {t("Upload New Logo")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border flex justify-end">
                    <button
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

            {tab === "users" && (
              <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
                <div className="rounded-[2.5rem] border border-border bg-card p-8 shadow-sm space-y-8 h-fit sticky top-24">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold">{isEditing ? t("Edit User") : t("Create User")}</h3>
                      <p className="text-xs text-muted-foreground">{t("Add or modify system access.")}</p>
                    </div>
                    {isEditing && (
                      <button onClick={resetUserForm} className="rounded-full bg-muted p-2 text-muted-foreground hover:text-foreground transition-colors">
                        <XCircle className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Username")}</label>
                      <input
                        disabled={isEditing}
                        className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:opacity-50"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t("e.g. admin_john")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Role")}</label>
                        <select
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={role}
                          onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
                        >
                          <option value="ADMIN">{t("Administrator")}</option>
                          <option value="STAFF">{t("Staff Member")}</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Status")}</label>
                        <button
                          onClick={() => setIsActive(!isActive)}
                          className={clsx(
                            "w-full flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-all",
                            isActive ? "bg-success/10 border-success/20 text-success" : "bg-destructive/10 border-destructive/20 text-destructive"
                          )}
                        >
                          {isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          {isActive ? t("Active") : t("Inactive")}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {t("Password")} {isEditing && <span className="lowercase font-normal opacity-60">({t("Leave blank to keep current")})</span>}
                      </label>
                      <input
                        type="password"
                        className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      disabled={uBusy}
                      onClick={submitUser}
                      className="group w-full relative inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      {isEditing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {isEditing ? t("Update User") : t("Create User Account")}
                      {uBusy && <div className="absolute inset-0 bg-primary/50 flex items-center justify-center rounded-2xl"><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                    </button>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-border bg-card shadow-sm overflow-hidden flex flex-col">
                  <div className="border-b border-border px-8 py-6 flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">{t("System Users")}</h3>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{t("Manage access levels")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <table className="hidden lg:table w-full text-start">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 [&>th]:px-8 [&>th]:py-4 [&>th]:text-xs [&>th]:font-bold [&>th]:text-muted-foreground [&>th]:uppercase [&>th]:tracking-widest">
                          <th>{t("User")}</th>
                          <th>{t("Role")}</th>
                          <th>{t("Status")}</th>
                          <th className="text-start">{t("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {usersSorted.map((u) => (
                          <tr key={u.id} className="group hover:bg-muted/50 transition-colors [&>td]:px-8 [&>td]:py-5">
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                  {u.username[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-bold text-foreground">{u.username}</span>
                              </div>
                            </td>
                            <td>
                              <span className={clsx(
                                "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                                u.role === "ADMIN" ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
                              )}>
                                {u.role === "ADMIN" ? t("Admin") : t("Staff")}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className={clsx("h-2 w-2 rounded-full", u.isActive ? "bg-success" : "bg-destructive")} />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                  {u.isActive ? t("Active") : t("Inactive")}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onEdit(u)}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition-all"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => onDelete(u.id)}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-background border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {usersSorted.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-8 py-20 text-center">
                              <div className="flex flex-col items-center gap-4 opacity-20">
                                <Users className="h-12 w-12" />
                                <p className="text-sm font-bold uppercase tracking-widest">{t("No Users Found")}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Mobile Cards for Users */}
                    <div className="lg:hidden p-4 grid gap-4 grid-cols-1">
                      {usersSorted.map((u) => (
                        <div key={`m-user-${u.id}`} className="bg-card border border-border rounded-[2rem] p-5 shadow-sm flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                {u.username[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground text-base">{u.username}</span>
                                <span className={clsx(
                                  "inline-flex items-center rounded-full mt-1 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider w-fit",
                                  u.role === "ADMIN" ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
                                )}>
                                  {u.role === "ADMIN" ? t("Admin") : t("Staff")}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={clsx("h-2 w-2 rounded-full", u.isActive ? "bg-success" : "bg-destructive")} />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {u.isActive ? t("Active") : t("Inactive")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-4 border-t border-border">
                            <button
                              onClick={() => onEdit(u)}
                              className="h-10 flex-1 flex items-center justify-center gap-2 rounded-xl bg-muted border border-border text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-all"
                            >
                              <Pencil className="h-4 w-4" />
                              {t("Edit")}
                            </button>
                            <button
                              onClick={() => void onDelete(u.id)}
                              className="h-10 flex-1 flex items-center justify-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("Delete")}
                            </button>
                          </div>
                        </div>
                      ))}
                      {usersSorted.length === 0 && (
                        <div className="py-12 text-center flex flex-col items-center gap-4 opacity-20">
                          <Users className="h-12 w-12" />
                          <p className="text-sm font-bold uppercase tracking-widest">{t("No Users Found")}</p>
                        </div>
                      )}
                    </div>
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
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-[2.5rem] border border-border bg-card p-10 shadow-sm space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Download className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold">{t("Data Export")}</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">{t("Download your business data for safekeeping.")}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      disabled={busy}
                      onClick={handleBackup}
                      className="group w-full flex items-center justify-between rounded-2xl bg-muted p-6 transition-all hover:bg-primary/5 hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-primary shadow-sm">
                          <Database className="h-5 w-5" />
                        </div>
                        <div className="text-start">
                          <div className="text-sm font-bold text-foreground">{t("Database Backup")}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{t("SQL Format")}</div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                      disabled={busy}
                      onClick={handleExportData}
                      className="group w-full flex items-center justify-between rounded-2xl bg-muted p-6 transition-all hover:bg-primary/5 hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-success shadow-sm">
                          <BarChart className="h-5 w-5" />
                        </div>
                        <div className="text-start">
                          <div className="text-sm font-bold text-foreground">{t("Accounting Export")}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{t("JSON Format")}</div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="rounded-[2.5rem] border border-border bg-card p-10 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-info/10 flex items-center justify-center text-info">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{t("Auto-Backup")}</h2>
                          <p className="text-sm text-muted-foreground">{t("Automate your data protection.")}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAutoBackup(!autoBackup)}
                        className={clsx(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          autoBackup ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span className={clsx(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          autoBackup ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Backup Interval (Minutes)")}</label>
                      <div className="relative">
                        <input
                          type="number"
                          className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={backupInterval}
                          onChange={(e) => setBackupInterval(Number(e.target.value))}
                        />
                        <div className="absolute end-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {t("Min")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2.5rem] border-2 border-dashed border-destructive/20 bg-destructive/5 p-10 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold text-destructive">{t("Restore Data")}</h2>
                        </div>
                        <p className="text-sm text-destructive/70">{t("Restore from a previous backup file.")}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-destructive/10 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-destructive leading-relaxed uppercase tracking-wider">
                        {t("Warning: This will overwrite all current data. This action cannot be undone.")}
                      </p>
                    </div>

                    <button
                      disabled={busy}
                      onClick={handleRestore}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-destructive px-6 py-4 text-sm font-bold text-white shadow-xl shadow-destructive/20 hover:bg-destructive transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {t("Restore Backup Now")}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}
