import React, { useEffect, useMemo, useState } from "react";
import { 
  ImagePlus, Save, Plus, Trash2, Pencil, Download, Upload, 
  AlertTriangle, BarChart, Building2, Users, Database, 
  Terminal, ShieldCheck, Globe, Phone, MapPin, Hash, 
  Coins, CheckCircle2, XCircle, ChevronRight, Sparkles
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { validateBackupPayload } from "../application/dto";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";

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
  const [tab, setTab] = useState<"center" | "users" | "backup" | "devtools">("center");
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupInterval, setBackupInterval] = useState(30);

  // center settings
  const [s, setS] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

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
      setUsers(us);
    } catch (e) {
      console.error("Failed to load settings or users", e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
         showToast('error', 'Error', t("Failed to upload logo"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveCenter() {
    if (!s) return;
    setBusy(true);
    try {
      const updated = await unwrap(useCases.settings.update({
        name: s.name,
        address: s.address ?? "",
        phone: s.phone ?? "",
        cr: s.cr ?? "",
        postalCode: s.postalCode ?? "",
        currency: s.currency ?? "OMR",
        logoPath: s.logoPath ?? null,
      }));
      setS(updated);
      showToast('success', t('Success'), t("Settings saved successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', 'Error', err.message ?? t("Error"));
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
    if (!username.trim()) return showToast('error', 'Error', t("Username is required"));
    if (!isEditing && !password) return showToast('error', 'Error', t("Password is required"));

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
    } catch (e) {
      showToast('error', 'Error', e?.message ?? t("Error"));
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
    setTab("users");
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
    } catch (e) {
      showToast('error', 'Error', e?.message ?? t("Error"));
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
         showToast('error', 'Error', err.message || t("Failed to create backup"));
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
         showToast('error', 'Error', err.message || t("Failed to export data"));
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
             showToast('error', 'Error', err?.message || t("Failed to restore backup."));
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

  const navItems = [
    { id: "center", label: t("Center Profile"), icon: Building2, desc: t("Manage your business details") },
    { id: "users", label: t("User Management"), icon: Users, desc: t("Control access and permissions") },
    { id: "backup", label: t("Data & Backup"), icon: Database, desc: t("Secure your business data") },
    { id: "devtools", label: t("Developer Tools"), icon: Terminal, desc: t("System diagnostics and tests") },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-10">
      {/* Sidebar Navigation */}
      <aside className="lg:w-80 shrink-0">
        <div className="sticky top-24 space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("Settings")}</h1>
            <p className="text-sm text-muted-foreground">{t("Configure and manage your application preferences.")}</p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as "center" | "users" | "backup" | "devtools")}
                className={clsx(
                  "group w-full flex items-start gap-4 rounded-2xl p-4 text-start transition-all",
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
                    "text-[10px] font-medium leading-tight mt-0.5",
                    tab === item.id ? "text-white/70" : "text-muted-foreground"
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
                <div className="rounded-[2.5rem] border border-border bg-card p-10 shadow-sm space-y-10">
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
                          onChange={(e) => setS({ ...s, name: e.target.value })}
                          placeholder={t("Enter business name")}
                        />
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
                      <span className="absolute -top-3 -end-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[8px] px-2 py-0.5 rounded-full uppercase font-bold tracking-widest pointer-events-none">{t("Backend Required")}</span>
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
                            isActive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-rose-500/10 border-rose-500/20 text-rose-600"
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
                                u.role === "ADMIN" ? "bg-purple-500/10 text-purple-600" : "bg-blue-500/10 text-blue-600"
                              )}>
                                {u.role === "ADMIN" ? t("Admin") : t("Staff")}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className={clsx("h-2 w-2 rounded-full", u.isActive ? "bg-emerald-500" : "bg-rose-500")} />
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
                                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-background border border-border text-muted-foreground hover:text-rose-500 hover:border-rose-500 transition-all"
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
                                  u.role === "ADMIN" ? "bg-purple-500/10 text-purple-600" : "bg-blue-500/10 text-blue-600"
                                )}>
                                  {u.role === "ADMIN" ? t("Admin") : t("Staff")}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={clsx("h-2 w-2 rounded-full", u.isActive ? "bg-emerald-500" : "bg-rose-500")} />
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
                              className="h-10 flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-600 hover:bg-rose-500 hover:text-white transition-all"
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
                        <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">{t("Backend Required")}</span>
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
                        <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-emerald-500 shadow-sm">
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
                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
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

                  <div className="rounded-[2.5rem] border-2 border-dashed border-rose-500/20 bg-rose-500/5 p-10 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold text-rose-900">{t("Restore Data")}</h2>
                          <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">{t("Backend Required")}</span>
                        </div>
                        <p className="text-sm text-rose-700/70">{t("Restore from a previous backup file.")}</p>
                      </div>
                    </div>
                    
                    <div className="rounded-2xl bg-rose-500/10 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-rose-700 leading-relaxed uppercase tracking-wider">
                        {t("Warning: This will overwrite all current data. This action cannot be undone.")}
                      </p>
                    </div>

                    <button
                      disabled={busy}
                      onClick={handleRestore}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {t("Restore Backup Now")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "devtools" && (
              <div className="rounded-[2.5rem] border border-border bg-card p-10 shadow-sm space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <Terminal className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t("System Diagnostics")}</h2>
                    <p className="text-sm text-muted-foreground">{t("Advanced tools for system health and testing.")}</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <button
                    onClick={async () => {
                      showToast('error', 'Error', t("Running Full E2E Test... Check console and Activity Log."));
                      try {
                        await Promise.reject(new Error("E2E Test disabled in preview mode."));
                      } catch (err: any) { showToast('error', 'Error', ((err as Error).message || String(err))); }
                    }}
                    className="group flex flex-col items-start gap-4 rounded-3xl border border-border bg-muted/30 p-8 text-start transition-all hover:bg-indigo-500 hover:border-indigo-500 hover:scale-[1.02]"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-background flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground group-hover:text-white">{t("Run E2E Test")}</div>
                      <div className="text-xs text-muted-foreground mt-1 group-hover:text-white/70">{t("Simulate full user workflow")}</div>
                    </div>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await Promise.reject(new Error("DB Self-Test disabled in preview mode."));
                      } catch (err: any) { showToast('error', 'Error', ((err as Error).message || String(err))); }
                    }}
                    className="group flex flex-col items-start gap-4 rounded-3xl border border-border bg-muted/30 p-8 text-start transition-all hover:bg-emerald-500 hover:border-emerald-500 hover:scale-[1.02]"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-background flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground group-hover:text-white">{t("DB Self-Test")}</div>
                      <div className="text-xs text-muted-foreground mt-1 group-hover:text-white/70">{t("Verify database integrity")}</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
