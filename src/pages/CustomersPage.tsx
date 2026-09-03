import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  History, Search, User, Phone, UserPlus,
  MoreVertical, Sparkles, TrendingUp, Pencil,
  Download, Star, Users, Crown,
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { getDisplayName, getInitials } from "../shared/displayName";
import { motion, AnimatePresence } from "motion/react";
import { Customer, ServiceFile, CustomerEntitlement } from "../domain/entities";
import { getTierBySpend } from "../domain/loyalty";
import { PageHeader } from "../shared/components/PageHeader";
import { ListState } from "../shared/components/ListState";
import { formatOMRAmount } from "../shared/money";
import { ReceiptPreviewModal } from "../shared/components/ReceiptPreviewModal";
import { InvoicePrintData } from "../application/dto";
import { exportCustomersCSV } from "./customers/helpers";
import { CustomerFormDialog } from "./customers/CustomerFormDialog";
import { CustomerHistoryData, CustomerPassportModal } from "./customers/CustomerPassportModal";

export default function CustomersPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<CustomerHistoryData | null>(null);
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
  const [printData, setPrintData] = useState<InvoicePrintData | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await unwrap(useCases.customers.list()));
    } catch (error: any) {
      setLoadError(error?.message || String(error));
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
    return rows.filter((customer) => (customer.name + " " + (customer.phone ?? "")).toLowerCase().includes(text));
  }, [rows, q]);

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      total: rows.length,
      totalRevenue: rows.reduce((sum, customer) => sum + customer.totalSpent, 0),
      vip: rows.filter((customer) => ["tier.platinum", "tier.gold"].includes(getTierBySpend(customer.totalSpent).labelKey)).length,
      newThisMonth: rows.filter((customer) => customer.createdAt && customer.createdAt.getTime() >= monthStart.getTime()).length,
    };
  }, [rows]);

  async function openHistory(customer: Customer) {
    setOpenId(customer.id);
    setHistory(null);
    setProfileCustomer(customer);
    setServiceFiles([]);
    setEntitlements([]);
    setShowAllVisits(false);
    setNotes(customer.notes || "");
    try {
      const [customerHistory, freshCustomer, customerEntitlements, files] = await Promise.all([
        unwrap(useCases.customers.getHistory(customer.id)),
        unwrap(useCases.customers.getById(customer.id)),
        useCases.entitlements.listForCustomer(customer.id).then((result) => (result.ok ? result.data : [])).catch(() => []),
        useCases.customerExperience.listServiceFiles(customer.id).then((result) => (result.ok ? result.data : [])).catch(() => []),
      ]);
      setHistory(customerHistory as CustomerHistoryData);
      setProfileCustomer(freshCustomer);
      setEntitlements(customerEntitlements);
      setServiceFiles(files);
    } catch (error: any) {
      showToast("error", t("Error"), error?.message || "Failed to load history");
    }
  }

  async function handleSaveNotes() {
    if (!openId) return;
    setSavingNotes(true);
    try {
      await unwrap(useCases.customers.update(openId, { notes }));
      showToast("success", t("Success"), t("Notes saved successfully"));
      await load();
    } catch (error: any) {
      showToast(
        "error",
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("Backend Required") : t("Error"),
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : error?.message || String(error),
      );
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleAddCustomer() {
    if (!newName.trim()) return showToast("error", t("Error"), t("Please fill all fields"));
    setAdding(true);
    try {
      await unwrap(useCases.customers.create({ name: newName, phone: newPhone || undefined }));
      setNewName("");
      setNewPhone("");
      setShowAddModal(false);
      await load();
      showToast("success", t("Success"), t("Customer created successfully"));
    } catch (error: any) {
      showToast(
        "error",
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("Backend Required") : t("Error"),
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : error?.message || String(error),
      );
    } finally {
      setAdding(false);
    }
  }

  function openEdit(customer: Customer) {
    setEditId(customer.id);
    setEditName(customer.name);
    setEditPhone(customer.phone || "");
  }

  async function handleEditCustomer() {
    if (!editId) return;
    if (!editName.trim()) return showToast("error", t("Error"), t("Please fill all fields"));
    setAdding(true);
    try {
      await unwrap(useCases.customers.update(editId, { name: editName, phone: editPhone || undefined }));
      setEditId(null);
      await load();
      showToast("success", t("Success"), t("Customer updated successfully"));
    } catch (error: any) {
      showToast(
        "error",
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("Backend Required") : t("Error"),
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : error?.message || String(error),
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleReprint(invoiceId: string) {
    try {
      setPrintData(await unwrap(useCases.invoices.getForPrint(invoiceId)));
    } catch (error: any) {
      showToast(
        "error",
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("Backend Required") : t("Error"),
        error.code === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : error?.message || String(error),
      );
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
                onChange={(event) => setQ(event.target.value)}
              />
            </div>
            <button onClick={() => exportCustomersCSV(filtered, t)} className="h-12 w-full sm:w-auto px-5 rounded-[1.5rem] border border-border bg-card font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Download className="h-4 w-4" />{t("Export")}
            </button>
            <button onClick={() => setShowAddModal(true)} className="h-12 w-full sm:w-auto px-6 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <UserPlus className="h-5 w-5" />{t("Add Customer")}
            </button>
          </>
        }
      />

      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 print:hidden">
        {[
          { label: t("Total"), value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: t("Revenue"), value: formatOMRAmount(stats.totalRevenue), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
          { label: t("VIP"), value: stats.vip, icon: Crown, color: "text-warning", bg: "bg-warning/10" },
          { label: t("New"), value: stats.newThisMonth, icon: Star, color: "text-info", bg: "bg-info/10" },
        ].map(({ label, value, icon: Icon, color, bg }, index) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm hover:shadow-md transition-all">
            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl ${bg} flex items-center justify-center mb-2 sm:mb-3`}><Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} /></div>
            <div className={`text-base sm:text-xl font-bold ${color} truncate`}>{value}</div>
            <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="print:hidden space-y-4 lg:space-y-0 lg:rounded-[3rem] lg:border border-border lg:bg-card lg:shadow-2xl">
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[800px] text-sm md:min-w-full">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                <th>{t("Customer")}</th><th>{t("Contact")}</th><th>{t("Total Spent")}</th><th>{t("Loyalty")}</th><th className="w-[150px]">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {filtered.map((customer, index) => (
                  <motion.tr layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0, transition: { delay: index * 0.02 } }} exit={{ opacity: 0, scale: 0.95 }} key={customer.id} className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start">
                    <td>
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:scale-110 shadow-inner">{getInitials(customer, "·")}</div>
                        <div className="space-y-0.5"><span className="font-bold text-foreground text-lg block group-hover:text-primary transition-colors">{getDisplayName(customer, t("Unnamed"))}</span><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Client ID")}: {customer.id.slice(-6).toUpperCase()}</span></div>
                      </div>
                    </td>
                    <td className="text-muted-foreground font-medium"><div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-xl w-fit"><Phone className="h-4 w-4 text-primary" /><span className="font-bold text-foreground" dir="ltr">{customer.phone ?? "—"}</span></div></td>
                    <td><div className="flex flex-col"><div className="flex items-center gap-2"><span className="font-bold text-foreground text-xl">{formatOMRAmount(customer.totalSpent)}</span><TrendingUp className="h-4 w-4 text-success" /></div><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR Total")}</span></div></td>
                    <td>{(() => { const tier = getTierBySpend(customer.totalSpent); return <div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold border shadow-sm ${tier.bg} ${tier.color} ${tier.border}`}><span>{tier.icon}</span><span>{t(tier.labelKey)}</span><span className="opacity-60">· {customer.loyaltyPoints} {t("pts")}</span></div>; })()}</td>
                    <td><div className="flex items-center gap-2"><button onClick={() => void openHistory(customer)} className="relative h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110 active:scale-95" title={t("History")}><History className="h-6 w-6" /></button><button onClick={() => openEdit(customer)} className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-info/10 hover:text-info hover:border-info/20 transition-all shadow-sm hover:scale-110 active:scale-95" title={t("Edit")}><Pencil className="h-5 w-5" /></button></div></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              <ListState loading={loading && filtered.length === 0} error={loadError} empty={filtered.length === 0} onRetry={load} loadingTitle={t("Loading customers...")} errorTitle={t("Failed to load customers")} emptyTitle={t("No Customers Found")} emptyDescription={q ? t("Try a different search term") : t("Add your first customer to start selling")} emptyIcon={<Users className="h-6 w-6" />} emptyActionLabel="Add Customer" onEmptyAction={() => setShowAddModal(true)} colSpan={5} compact />
            </tbody>
          </table>
        </div>

        <div className="lg:hidden">
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 mb-2">
            <div className="relative group"><Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" /><input type="search" className="w-full rounded-xl border border-border bg-card py-3 ps-11 pe-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm" placeholder={t("Search by name or phone...")} value={q} onChange={(event) => setQ(event.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((customer, index) => (
                <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: index * 0.02 } }} exit={{ opacity: 0, scale: 0.95 }} key={customer.id} className="relative w-full min-w-0 rounded-xl border border-border bg-card shadow-sm flex items-stretch hover:shadow-md hover:border-primary/30 transition-all">
                  {/* No swipe actions: accidental delete risk on small phones. */}
                  <button type="button" onClick={() => { setMenuId(null); void openHistory(customer); }} className="flex-1 min-w-0 min-h-[56px] p-3 flex items-center gap-3 text-start touch-target active:scale-[0.99]">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{getInitials(customer, "·")}</div>
                    <div className="flex-1 min-w-0"><span className="block truncate text-sm font-bold text-foreground">{customer.name}</span><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] font-bold text-muted-foreground" dir="ltr">{customer.phone ?? "—"}</span></div></div>
                    <div className="text-end shrink-0"><div className="text-sm font-bold text-foreground">{formatOMRAmount(customer.totalSpent)}</div><div className="flex items-center gap-1 text-[9px] font-bold text-warning"><Sparkles className="h-3 w-3" />{customer.loyaltyPoints}</div></div>
                  </button>
                  <button type="button" aria-label={t("Actions")} aria-expanded={menuId === customer.id} onClick={(event) => { event.stopPropagation(); setMenuId(menuId === customer.id ? null : customer.id); }} className="shrink-0 h-auto min-h-[56px] w-11 flex items-center justify-center text-muted-foreground hover:text-foreground touch-target"><MoreVertical className="h-4 w-4" /></button>
                  {menuId === customer.id && <div className="absolute end-2 top-14 z-30 min-w-[148px] rounded-xl border border-border bg-card shadow-xl overflow-hidden"><button type="button" onClick={() => { setMenuId(null); openEdit(customer); }} className="w-full min-h-11 flex items-center gap-2 px-3 text-sm font-bold text-foreground hover:bg-muted/60"><Pencil className="h-4 w-4" />{t("Edit")}</button></div>}
                </motion.div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && <ListState loading={loading && filtered.length === 0} error={loadError} empty={filtered.length === 0} onRetry={load} loadingTitle={t("Loading...")} errorTitle={t("Failed to load customers")} emptyTitle={t("No Customers Found")} emptyDescription={q ? t("Try a different search term") : t("Add your first customer to start selling")} emptyIcon={<Users className="h-5 w-5" />} emptyActionLabel={t("Add Customer")} onEmptyAction={() => setShowAddModal(true)} compact />}
          </div>
        </div>
      </motion.div>

      <CustomerPassportModal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        customer={profileCustomer}
        history={history}
        serviceFiles={serviceFiles}
        entitlements={entitlements}
        notes={notes}
        onNotesChange={setNotes}
        savingNotes={savingNotes}
        onSaveNotes={() => void handleSaveNotes()}
        showAllVisits={showAllVisits}
        onToggleAllVisits={() => setShowAllVisits((value) => !value)}
        onReprint={(invoiceId) => void handleReprint(invoiceId)}
      />

      <CustomerFormDialog mode="add" open={showAddModal} onClose={() => setShowAddModal(false)} name={newName} onNameChange={setNewName} phone={newPhone} onPhoneChange={setNewPhone} busy={adding} onSubmit={() => void handleAddCustomer()} />
      <CustomerFormDialog mode="edit" open={editId !== null} onClose={() => setEditId(null)} name={editName} onNameChange={setEditName} phone={editPhone} onPhoneChange={setEditPhone} busy={adding} onSubmit={() => void handleEditCustomer()} />
    </div>
  );
}
