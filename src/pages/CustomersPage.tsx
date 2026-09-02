import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  History, Search, User, Phone, Calendar,
  Receipt, FileText, Save, UserPlus,
  MoreVertical, Sparkles,
  TrendingUp, Pencil,
  Download, Star, Users, Crown,
  Wallet, Clock, ChevronDown, ChevronUp, Scissors, Image as ImageIcon
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { getDisplayName, getInitials } from "../shared/displayName";
import { motion, AnimatePresence } from "motion/react";
import { Customer, Appointment, Invoice, AppointmentStatus, ServiceFile, CustomerEntitlement } from "../domain/entities";
import { getTierBySpend } from "../domain/loyalty";
import { PageHeader } from "../shared/components/PageHeader";
import { ScreenState } from "../shared/components/ScreenState";
import { ListState } from "../shared/components/ListState";
import { formatOMRAmount } from "../shared/money";
import { ReceiptPreviewModal } from "../shared/components/ReceiptPreviewModal";
import { InvoicePrintData } from "../application/dto";
import { Modal } from "../shared/components/Modal";
import { composeBeautyPassport } from "../domain/passport";
import {
  retentionVisitsFromHistory,
  getNextBestCustomerAction,
  getRetentionStatus,
  getCustomerVisitPattern,
} from "../domain/retention";
import { buildCustomerWallet } from "../domain/wallet";
import { formatSalonDate } from "../shared/dateTime";
import { effectiveVisitStage } from "../domain/visit";
import { passportStageLabel, passportStageClass, retentionStatusClass, exportCustomersCSV } from "./customers/helpers";
import { CustomerFormDialog } from "./customers/CustomerFormDialog";

interface InvoiceHistoryItem extends Invoice {
  items?: {
    id: string;
    service?: { name: string };
    product?: { name: string };
  }[];
}

interface CustomerHistoryType {
  appointments: Appointment[];
  invoices: InvoiceHistoryItem[];
}

export default function CustomersPage() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<CustomerHistoryType | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const [serviceFiles, setServiceFiles] = useState<ServiceFile[]>([]);
  const [entitlements, setEntitlements] = useState<CustomerEntitlement[]>([]);
  const [showAllVisits, setShowAllVisits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await unwrap(useCases.customers.list());
      setRows(res);
    } catch (e: any) {
      setLoadError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((c) => (c.name + " " + (c.phone ?? "")).toLowerCase().includes(text));
  }, [rows, q]);

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      total: rows.length,
      totalRevenue: rows.reduce((s, c) => s + c.totalSpent, 0),
      // VIP = أعلى فئتين ولاءً (ذهبي/بلاتيني) من الإنفاق الفعلي — لا تقديرات.
      vip: rows.filter(c => ["tier.platinum", "tier.gold"].includes(getTierBySpend(c.totalSpent).labelKey)).length,
      // عملاء جدد فعليًا من تاريخ الإنشاء — لا تخمين من إنفاق منخفض.
      newThisMonth: rows.filter(c => c.createdAt && c.createdAt.getTime() >= monthStart.getTime()).length,
    };
  }, [rows]);

  // Beauty Passport composition — pure domain modules over real history.
  const passportView = useMemo(() => {
    if (!history) return null;
    const now = Date.now();
    const upcoming = history.appointments
      .filter((a) => a.status === AppointmentStatus.SCHEDULED && new Date(a.dateTime).getTime() >= now)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const nextAppointment = upcoming[0];
    const passport = composeBeautyPassport({
      appointments: history.appointments,
      invoices: history.invoices,
      serviceFiles,
      nextAppointment,
      lifetimeSpend: profileCustomer?.totalSpent,
    });
    const retentionVisits = retentionVisitsFromHistory(history);
    const retentionAction = getNextBestCustomerAction(retentionVisits, new Date());
    const retentionStatus = getRetentionStatus(retentionVisits, new Date());
    const visitPattern = getCustomerVisitPattern(retentionVisits);
    const wallet = buildCustomerWallet({
      entitlements,
      loyaltyPoints: profileCustomer?.loyaltyPoints ?? 0,
      depositAmount: nextAppointment?.depositAmount ?? 0,
    });
    // A legitimate wallet benefit (remaining sessions / gift-card value) is an
    // operational rebooking reason derived from real instruments — never a guess.
    const walletBenefit =
      wallet.packages.length > 0 || wallet.giftCardBalance > 0
        ? {
            sessionCount: wallet.packages.reduce((sum, p) => sum + p.remainingUnits, 0),
            giftCardBalance: wallet.giftCardBalance,
          }
        : null;
    return {
      passport,
      nextAppointment,
      retentionAction,
      retentionStatus,
      visitPattern,
      wallet,
      walletBenefit,
      hasFutureBooking: !!nextAppointment,
    };
  }, [history, serviceFiles, entitlements, profileCustomer]);

  async function openHistory(customer: Customer) {
    setOpenId(customer.id);
    setHistory(null);
    setProfileCustomer(customer);
    setServiceFiles([]);
    setEntitlements([]);
    setShowAllVisits(false);
    setNotes(customer.notes || "");
    try {
      const [hist, cust, ent, files] = await Promise.all([
        unwrap(useCases.customers.getHistory(customer.id)),
        unwrap(useCases.customers.getById(customer.id)),
        useCases.entitlements.listForCustomer(customer.id).then((r) => (r.ok ? r.data : [])).catch(() => []),
        useCases.customerExperience.listServiceFiles(customer.id).then((r) => (r.ok ? r.data : [])).catch(() => []),
      ]);
      setHistory(hist as CustomerHistoryType);
      setProfileCustomer(cust);
      setEntitlements(ent);
      setServiceFiles(files);
    } catch (e: any) {
      showToast('error', t("Error"), e?.message || "Failed to load history");
    }
  }

  async function handleSaveNotes() {
    if (!openId) return;
    setSavingNotes(true);
    try {
      await unwrap(useCases.customers.update(openId, { notes }));
      showToast('success', t("Success"), t("Notes saved successfully"));
      await load();
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleAddCustomer() {
    if (!newName.trim()) return showToast('error', t("Error"), t("Please fill all fields"));
    setAdding(true);
    try {
      await unwrap(useCases.customers.create({ name: newName, phone: newPhone || undefined }));
      setNewName("");
      setNewPhone("");
      setShowAddModal(false);
      await load();
      showToast('success', t("Success"), t("Customer created successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    } finally {
      setAdding(false);
    }
  }

  function openEdit(c: Customer) {
    setEditId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone || "");
  }

  async function handleEditCustomer() {
    if (!editId) return;
    if (!editName.trim()) return showToast('error', t("Error"), t("Please fill all fields"));
    setAdding(true);
    try {
      await unwrap(useCases.customers.update(editId, { name: editName, phone: editPhone || undefined }));
      setEditId(null);
      await load();
      showToast('success', t("Success"), t("Customer updated successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    } finally {
      setAdding(false);
    }
  }

  const [printData, setPrintData] = useState<InvoicePrintData | null>(null);

  async function handleReprint(invoiceId: string) {
    try {
      const pData = await unwrap(useCases.invoices.getForPrint(invoiceId));
      setPrintData(pData);
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    }
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-10">
      <ReceiptPreviewModal data={printData} onClose={() => setPrintData(null)} />

      <PageHeader
        icon={<User className="h-7 w-7 sm:h-8 sm:w-8" />}
        title={t("Customers")}
        subtitle={t("Manage your client database")}
        actions={
          <>
            <div className="relative w-full sm:w-72 group">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                className="w-full rounded-[1.5rem] border border-border bg-card py-3.5 ps-11 pe-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                placeholder={t("Search by name or phone...")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              onClick={() => exportCustomersCSV(filtered, t)}
              className="h-12 w-full sm:w-auto px-5 rounded-[1.5rem] border border-border bg-card font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t("Export")}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-12 w-full sm:w-auto px-6 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="h-5 w-5" />
              {t("Add Customer")}
            </button>
          </>
        }
      />

      {/* Stats Cards - compact 2x2 on mobile */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 print:hidden">
        {[
          { label: t('Total'), value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: t('Revenue'), value: formatOMRAmount(stats.totalRevenue), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
          { label: t('VIP'), value: stats.vip, icon: Crown, color: 'text-warning', bg: 'bg-warning/10' },
          { label: t('New'), value: stats.newThisMonth, icon: Star, color: 'text-info', bg: 'bg-info/10' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl ${bg} flex items-center justify-center mb-2 sm:mb-3`}>
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
            </div>
            <div className={`text-base sm:text-xl font-bold ${color} truncate`}>{value}</div>
            <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="print:hidden space-y-4 lg:space-y-0 lg:rounded-[3rem] lg:border border-border lg:bg-card lg:shadow-2xl"
      >
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[800px] text-sm md:min-w-full">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                <th>{t("Customer")}</th>
                <th>{t("Contact")}</th>
                <th>{t("Total Spent")}</th>
                <th>{t("Loyalty")}</th>
                <th className="w-[150px]">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {filtered.map((c, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={c.id} 
                    className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start"
                  >
                    <td>
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:scale-110 shadow-inner">
                          {getInitials(c, "·")}
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground text-lg block group-hover:text-primary transition-colors">{getDisplayName(c, t("Unnamed"))}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Client ID")}: {c.id.slice(-6).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground font-medium">
                      <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-xl w-fit">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="font-bold text-foreground" dir="ltr">{c.phone ?? "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xl">{formatOMRAmount(c.totalSpent)}</span>
                          <TrendingUp className="h-4 w-4 text-success" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR Total")}</span>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const tier = getTierBySpend(c.totalSpent);
                        return (
                          <div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold border shadow-sm ${tier.bg} ${tier.color} ${tier.border}`}>
                            <span>{tier.icon}</span>
                            <span>{t(tier.labelKey)}</span>
                            <span className="opacity-60">· {c.loyaltyPoints} {t('pts')}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openHistory(c)}
                          className="relative h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                          title={t("History")}
                        >
                          <History className="h-6 w-6" />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-info/10 hover:text-info hover:border-info/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                          title={t("Edit")}
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              <ListState loading={loading && filtered.length === 0} error={loadError} empty={filtered.length === 0} onRetry={load} loadingTitle={t("Loading customers...")} errorTitle={t("Failed to load customers")} emptyTitle={t("No Customers Found")} emptyDescription={q ? t("Try a different search term") : t("Add your first customer to start selling")} emptyIcon={<Users className="h-6 w-6" />} emptyActionLabel="Add Customer" onEmptyAction={() => setShowAddModal(true)} colSpan={5} compact />
            </tbody>
          </table>
        </div>

        {/* Mobile cards — tap to open, explicit 44px menu. No swipe (accidental delete). */}
        <div className="lg:hidden">
          {/* Sticky Search Header */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 mb-2">
            <div className="relative group">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="search"
                className="w-full rounded-xl border border-border bg-card py-3 ps-11 pe-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                placeholder={t("Search by name or phone...")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((c, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={c.id}
                  className="relative w-full min-w-0 rounded-xl border border-border bg-card shadow-sm flex items-stretch hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => { setMenuId(null); openHistory(c); }}
                    className="flex-1 min-w-0 min-h-[56px] p-3 flex items-center gap-3 text-start touch-target active:scale-[0.99]"
                  >
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {getInitials(c, "·")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground">{c.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground" dir="ltr">{c.phone ?? "—"}</span>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="text-sm font-bold text-foreground">{formatOMRAmount(c.totalSpent)}</div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-warning">
                        <Sparkles className="h-3 w-3" />
                        {c.loyaltyPoints}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={t("Actions")}
                    aria-expanded={menuId === c.id}
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                    className="shrink-0 h-auto min-h-[56px] w-11 flex items-center justify-center text-muted-foreground hover:text-foreground touch-target"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === c.id && (
                    <div className="absolute end-2 top-14 z-30 min-w-[148px] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setMenuId(null); openEdit(c); }}
                        className="w-full min-h-11 flex items-center gap-2 px-3 text-sm font-bold text-foreground hover:bg-muted/60"
                      >
                        <Pencil className="h-4 w-4" />
                        {t("Edit")}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <ListState 
                loading={loading && filtered.length === 0} 
                error={loadError} 
                empty={filtered.length === 0} 
                onRetry={load} 
                loadingTitle={t("Loading...")} 
                errorTitle={t("Failed to load customers")} 
                emptyTitle={t("No Customers Found")} 
                emptyDescription={q ? t("Try a different search term") : t("Add your first customer to start selling")} 
                emptyIcon={<Users className="h-5 w-5" />} 
                emptyActionLabel={t("Add Customer")} 
                onEmptyAction={() => setShowAddModal(true)} 
                compact 
              />
            )}
          </div>
        </div>
      </motion.div>

      <Modal
        isOpen={openId !== null}
        onClose={() => setOpenId(null)}
        size="xl"
        title={
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>{t("passport.title")}</span>
          </span>
        }
        description={profileCustomer ? getDisplayName(profileCustomer, t("Unnamed")) : t("passport.subtitle")}
        disableClose={savingNotes}
        overlayClassName="print:hidden"
        className="sm:max-w-6xl sm:rounded-[3rem]"
      >
        <div className="sm:p-5">
          {!history || !passportView ? (
            <ScreenState state="loading" title={t("Fetching Data...")} compact />
          ) : (
            <div className="space-y-6">
              {/* 1) Identity & contact header */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[1.5rem] border border-border bg-muted/30 p-4 sm:p-5">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 uppercase">
                  {getInitials(profileCustomer, "·")}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold truncate">{getDisplayName(profileCustomer, t("Unnamed"))}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {profileCustomer?.phone && (
                      <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /><span dir="ltr">{profileCustomer.phone}</span></span>
                    )}
                    <span>{t("Client ID")}: {profileCustomer?.id.slice(-6).toUpperCase()}</span>
                    {profileCustomer?.createdAt && (
                      <span>{t("passport.clientSince")} {formatSalonDate(profileCustomer.createdAt, i18n.language)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(() => {
                    const tier = getTierBySpend(profileCustomer?.totalSpent ?? 0);
                    return (
                      <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold border ${tier.bg} ${tier.color} ${tier.border}`}>
                        <span>{tier.icon}</span>
                        <span>{t(tier.labelKey)}</span>
                      </span>
                    );
                  })()}
                  <span className="inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold border border-warning/20 bg-warning/10 text-warning">
                    <Sparkles className="h-3.5 w-3.5" /> {profileCustomer?.loyaltyPoints ?? 0} {t("pts")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold border border-success/20 bg-success/10 text-success">
                    <TrendingUp className="h-3.5 w-3.5" /> {formatOMRAmount(profileCustomer?.totalSpent ?? 0)} {t("OMR")}
                  </span>
                </div>
              </div>

              {/* 2) Relationship snapshot */}
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {t("passport.snapshot")}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2">
                  {[
                    { label: t("passport.lastVisit"), value: passportView.passport.summary.lastVisitISO ? formatSalonDate(passportView.passport.summary.lastVisitISO, i18n.language) : "—" },
                    { label: t("passport.nextAppointment"), value: passportView.passport.summary.nextAppointmentISO ? formatSalonDate(passportView.passport.summary.nextAppointmentISO, i18n.language) : "—" },
                    { label: t("passport.totalVisits"), value: String(passportView.passport.summary.totalVisits) },
                    { label: t("passport.lifetimeSpend"), value: `${formatOMRAmount(passportView.passport.summary.lifetimeSpend)} ${t("OMR")}` },
                    { label: t("passport.averageVisitValue"), value: passportView.passport.summary.averageVisitValue !== undefined ? formatOMRAmount(passportView.passport.summary.averageVisitValue) : "—" },
                    { label: t("passport.preferredEmployee"), value: passportView.passport.summary.preferredEmployeeName ?? "—" },
                    { label: t("passport.mostUsedService"), value: passportView.passport.summary.mostUsedServiceName ?? "—" },
                  ].map((chip) => (
                    <div key={chip.label} className="rounded-xl border border-border bg-card p-3">
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{chip.label}</div>
                      <div className="text-sm font-bold text-foreground truncate mt-0.5">{chip.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3) Next booking + retention + wallet summary */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                  <section className="rounded-[1.5rem] border border-border bg-card p-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> {t("passport.nextBooking")}
                    </h4>
                    {passportView.nextAppointment ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="font-bold text-foreground">{formatSalonDate(passportView.nextAppointment.dateTime, i18n.language)}</span>
                        {passportView.nextAppointment.service?.name && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Scissors className="h-3.5 w-3.5" />{passportView.nextAppointment.service.name}</span>
                        )}
                        {passportView.nextAppointment.employee?.name && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><User className="h-3.5 w-3.5" />{passportView.nextAppointment.employee.name}</span>
                        )}
                        <span className={`rounded-lg px-2 py-1 text-[9px] font-bold border ${passportStageClass(effectiveVisitStage(passportView.nextAppointment))}`}>
                          {passportStageLabel(effectiveVisitStage(passportView.nextAppointment), t)}
                        </span>
                        {(passportView.nextAppointment.depositAmount ?? 0) > 0 && (
                          <span className="text-xs font-bold text-muted-foreground">{t("wallet.deposit")}: {formatOMRAmount(passportView.nextAppointment.depositAmount ?? 0)} {t("OMR")}</span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm font-bold text-muted-foreground">{t("passport.noNextBooking")}</p>
                    )}
                  </section>

                  <section className="rounded-[1.5rem] border border-border bg-card p-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" /> {t("passport.retention")}
                    </h4>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${retentionStatusClass(passportView.retentionStatus.status)}`}>
                          {t(`retention.status.${passportView.retentionStatus.status}`)}
                        </span>
                        {passportView.hasFutureBooking && (
                          <span className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-[9px] font-bold text-success">
                            {t("retention.hasFutureBooking")}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-foreground">{t(passportView.retentionAction.titleKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(passportView.retentionAction.detailKey)}</p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/30 p-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.lastVisit")}</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {passportView.passport.summary.lastVisitISO
                              ? formatSalonDate(passportView.passport.summary.lastVisitISO, i18n.language)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.daysSince")}</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {passportView.retentionStatus.daysSinceLastVisit !== null
                              ? passportView.retentionStatus.daysSinceLastVisit
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.normalInterval")}</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {passportView.visitPattern.averageDaysBetweenVisits !== null
                              ? t("retention.daysValue", { count: passportView.visitPattern.averageDaysBetweenVisits })
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.rebookingWindow")}</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {passportView.retentionStatus.rebookingWindow
                              ? t("retention.daysRange", { min: passportView.retentionStatus.rebookingWindow.minDays, max: passportView.retentionStatus.rebookingWindow.maxDays })
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {passportView.walletBenefit && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                          <p className="text-[10px] font-bold text-primary">{t("retention.walletBenefit")}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {passportView.walletBenefit.sessionCount > 0 &&
                              t("retention.walletSessions", { count: passportView.walletBenefit.sessionCount })}
                            {passportView.walletBenefit.sessionCount > 0 && passportView.walletBenefit.giftCardBalance > 0 && " · "}
                            {passportView.walletBenefit.giftCardBalance > 0 &&
                              t("retention.walletGiftCard", { amount: formatOMRAmount(passportView.walletBenefit.giftCardBalance) })}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <section className="rounded-[1.5rem] border border-border bg-card p-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" /> {t("passport.wallet")}
                  </h4>
                  <div className="mt-3 space-y-2">
                    {!passportView.wallet.hasValue ? (
                      <p className="text-xs font-bold text-muted-foreground">{t("passport.walletEmpty")}</p>
                    ) : (
                      <>
                        {passportView.wallet.giftCardBalance > 0 && (
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="text-muted-foreground">{t("wallet.giftCard")}</span>
                            <span className="text-foreground">{formatOMRAmount(passportView.wallet.giftCardBalance)} {t("OMR")}</span>
                          </div>
                        )}
                        {passportView.wallet.rewardsPoints > 0 && (
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="text-muted-foreground">{t("wallet.rewards")}</span>
                            <span className="text-foreground">{passportView.wallet.rewardsPoints} {t("pts")}</span>
                          </div>
                        )}
                        {passportView.wallet.depositAmount > 0 && (
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="text-muted-foreground">{t("wallet.deposit")}</span>
                            <span className="text-foreground">{formatOMRAmount(passportView.wallet.depositAmount)} {t("OMR")}</span>
                          </div>
                        )}
                        {passportView.wallet.packages.map((p) => (
                          <div key={`${p.entitlementId}-${p.serviceId}`} className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="text-muted-foreground truncate">{p.packageName}{p.serviceName ? ` · ${p.serviceName}` : ""}</span>
                            <span className="text-foreground shrink-0">{p.remainingUnits} {t("passport.sessionsLeft")}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </section>
              </div>

              {/* 4) Visit timeline */}
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> {t("passport.timeline")}
                </h4>
                {passportView.passport.timeline.length === 0 ? (
                  <p className="text-sm font-bold text-muted-foreground">{t("passport.noTimeline")}</p>
                ) : (
                  <div className="space-y-2">
                    {(showAllVisits ? passportView.passport.timeline : passportView.passport.timeline.slice(0, 6)).map((visit) => (
                      <div key={visit.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{formatSalonDate(visit.dateTimeISO, i18n.language)}</span>
                            <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold border ${passportStageClass(visit.stage)}`}>{passportStageLabel(visit.stage, t)}</span>
                            {visit.amount !== undefined && (
                              <span className="text-xs font-bold text-success">{formatOMRAmount(visit.amount)} {t("OMR")}</span>
                            )}
                          </div>
                          {(visit.serviceName || visit.employeeName) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] font-bold text-muted-foreground">
                              {visit.serviceName && <span className="inline-flex items-center gap-1"><Scissors className="h-3 w-3" />{visit.serviceName}</span>}
                              {visit.employeeName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{visit.employeeName}</span>}
                            </div>
                          )}
                          {visit.images && visit.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {visit.images.map((img) => (
                                <img key={img} src={img} alt="" className="h-10 w-10 rounded-lg object-cover border border-border" />
                              ))}
                            </div>
                          )}
                          {visit.notes && <p className="mt-1 text-[10px] text-muted-foreground">{visit.notes}</p>}
                        </div>
                        {visit.invoiceId && (
                          <button
                            onClick={() => handleReprint(visit.invoiceId!)}
                            className="shrink-0 h-8 px-2.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                          >
                            {t("Print")}
                          </button>
                        )}
                      </div>
                    ))}
                    {passportView.passport.timeline.length > 6 && (
                      <button
                        onClick={() => setShowAllVisits((v) => !v)}
                        className="w-full h-10 rounded-xl border border-border bg-muted/30 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 touch-target"
                      >
                        {showAllVisits ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {showAllVisits ? t("passport.showLess") : t("passport.showAll")}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* 5) Notes & service files */}
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-[1.5rem] border border-border bg-muted/30 p-4 space-y-3">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> {t("passport.notes")}
                  </h4>
                  <textarea
                    className="w-full h-40 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all"
                    placeholder={t("Medical History / Preferences / Allergies")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="w-full h-12 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{savingNotes ? t("Saving...") : t("Save Changes")}</span>
                  </button>
                </section>

                <section className="rounded-[1.5rem] border border-border bg-card p-4 space-y-3">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> {t("passport.serviceFiles")}
                  </h4>
                  {serviceFiles.length === 0 ? (
                    <p className="text-xs font-bold text-muted-foreground">{t("passport.noServiceFiles")}</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {serviceFiles.map((file) => (
                        <div key={file.id} className="rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground truncate">{file.title}</span>
                            <span className="text-[9px] font-bold text-muted-foreground shrink-0">{formatSalonDate(file.createdAt, i18n.language)}</span>
                          </div>
                          {file.note && <p className="mt-1 text-[10px] text-muted-foreground">{file.note}</p>}
                          {file.images && file.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {file.images.map((img) => (
                                <img key={img.id} src={img.imageUrl} alt={file.title} className="h-10 w-10 rounded-lg object-cover border border-border" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <CustomerFormDialog
        mode="add"
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        name={newName}
        onNameChange={(v) => setNewName(v)}
        phone={newPhone}
        onPhoneChange={(v) => setNewPhone(v)}
        busy={adding}
        onSubmit={() => void handleAddCustomer()}
      />

      <CustomerFormDialog
        mode="edit"
        open={editId !== null}
        onClose={() => setEditId(null)}
        name={editName}
        onNameChange={(v) => setEditName(v)}
        phone={editPhone}
        onPhoneChange={(v) => setEditPhone(v)}
        busy={adding}
        onSubmit={() => void handleEditCustomer()}
      />
    </div>
  );
}
