import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  History, X, Search, User, Phone, Coins, Calendar, 
  Receipt, Plus, FileText, Save, CheckCircle2, UserPlus,
  ChevronRight, MoreVertical, Mail, MapPin, Sparkles, XCircle,
  ArrowUpRight, TrendingUp, Wallet, Pencil, Trash2,
  Download, Star, Users, Crown, KeyRound, Copy
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { Customer, Appointment, Invoice } from "../domain/entities";
import { getTierBySpend } from "../domain/loyalty";

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

// Loyalty tier is derived from lifetime spend via the shared domain model
// (src/domain/loyalty.ts) — single source of truth across the app.

// Export customers to CSV
function exportCustomersCSV(customers: Customer[], t: (k: string) => string) {
  const headers = [t('Name'), t('Phone'), t('Total Spent'), t('Loyalty Points'), t('Tier')];
  const rows = customers.map(c => [
    c.name,
    c.phone ?? '',
    c.totalSpent.toFixed(3),
    c.loyaltyPoints,
    t(getTierBySpend(c.totalSpent).labelKey)
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `customers_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CustomersPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<CustomerHistoryType | null>(null);
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

  async function load() {
    setLoading(true);
    try {
      const res = await unwrap(useCases.customers.list());
      setRows(res);
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

  const stats = useMemo(() => ({
    total: rows.length,
    totalRevenue: rows.reduce((s, c) => s + c.totalSpent, 0),
    vip: rows.filter(c => c.loyaltyPoints >= 500).length,
    newThisMonth: rows.filter(c => {
      // approximate: customers with low totalSpent are likely new
      return c.totalSpent < 50;
    }).length,
  }), [rows]);

  async function openHistory(customer: Customer) {
    setOpenId(customer.id);
    setHistory(null);
    setNotes(customer.notes || "");
    try {
      const res = await unwrap(useCases.customers.getHistory(customer.id));
      setHistory(res as CustomerHistoryType);
    } catch (e: any) {
      showToast('error', t("Error"), e?.message || "Failed to load history");
    }
  }

  async function handleSaveNotes() {
    if (!openId) return;
    setSavingNotes(true);
    try {
      await unwrap(useCases.customers.update(openId, { notes }));
      showToast('error', t("Error"), t("Notes saved successfully"));
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

  async function handleDeleteCustomer(id: string) {
    const ok = await confirm({
      title: t("Confirm"),
      message: t("Are you sure you want to delete this customer?"),
      type: "danger"
    });
    if (!ok) return;
    try {
      await unwrap(useCases.customers.delete(id));
      await load();
      showToast('success', t("Success"), t("Customer deleted successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', t("Error"), err?.message || String(err));
      }
    }
  }

  const [printData, setPrintData] = useState<any | null>(null);

  async function handleRotatePortalToken(customer: Customer) {
    try {
      const res = await unwrap(useCases.customers.rotatePortalToken(customer.id));
      const shareText = `${window.location.origin}/portal\n${t("Phone")}: ${customer.phone || ""}\n${t("Portal Code")}: ${res.portalAccessToken}`;
      await navigator.clipboard.writeText(shareText);
      showToast('success', t("Success"), t("Portal access copied to clipboard"));
      await load();
    } catch (err: any) {
      showToast('error', t("Error"), err?.message || t("Failed to rotate portal code"));
    }
  }

  async function handleReprint(invoiceId: string) {
    try {
      const pData = await unwrap(useCases.invoices.getForPrint(invoiceId));
      setPrintData(pData);
      setTimeout(() => {
        window.print();
        setPrintData(null);
      }, 500);
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
      {/* Print Area Hidden */}
      {printData && (
        <div id="print-area" className="hidden print:block bg-white text-black p-8 font-sans text-sm w-[80mm] mx-auto" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
          <div className="text-center mb-6 space-y-1">
            <h1 className="font-bold text-xl">{printData.settings?.name || "Lena Beauty"}</h1>
            <div className="text-xs opacity-70">{printData.settings?.address}</div>
            <div className="text-xs opacity-70">{printData.settings?.phone}</div>
          </div>
          <div className="border-t border-b border-dashed border-black py-3 mb-4 text-xs space-y-1">
            <div className="flex justify-between">
              <span>{i18n.language === "ar" ? "رقم الفاتورة:" : "Invoice No:"}</span> 
              <span className="font-bold">{printData.invoice.id.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>{i18n.language === "ar" ? "التاريخ:" : "Date:"}</span> 
              <span>{new Date(printData.invoice.date).toLocaleString(i18n.language || "ar")}</span>
            </div>
            <div className="flex justify-between">
              <span>{i18n.language === "ar" ? "العميل:" : "Customer:"}</span> 
              <span className="font-bold">{printData.customer?.name}</span>
            </div>
          </div>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2 text-start">
                  {i18n.language === "ar" ? "الصنف" : "Item"}
                </th>
                <th className="py-2 text-end">
                  {i18n.language === "ar" ? "السعر" : "Price"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-black/20">
              {printData.items.map((it: any) => (
                <tr key={it.id}>
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 font-bold text-end">{it.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-black pt-3 text-base font-bold flex justify-between">
            <span>{i18n.language === "ar" ? "الإجمالي:" : "Total Amount:"}</span>
            <span>{printData.invoice.totalAmount} {printData.settings?.currency}</span>
          </div>
          <div className="text-center mt-10 text-xs opacity-50 italic">
            {i18n.language === "ar" ? "شكراً لزيارتكم!" : "Thank you for your visit!"}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 print:hidden">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <User className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
              {t("Customers")}
            </h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Manage your client database")}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              className="w-full rounded-[1.5rem] border border-border bg-card py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
              placeholder={t("Search by name or phone...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            onClick={() => exportCustomersCSV(filtered, t)}
            className="h-14 w-full sm:w-auto px-6 rounded-[1.5rem] border border-border bg-card font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <Download className="h-5 w-5" />
            {t("Export")}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-14 w-full sm:w-auto px-8 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <UserPlus className="h-6 w-6" />
            {t("Add Customer")}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:hidden">
        {[
          { label: t('Total Clients'), value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: t('Total Revenue'), value: stats.totalRevenue.toFixed(2) + ' OMR', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { label: t('VIP Clients'), value: stats.vip, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { label: t('New Clients'), value: stats.newThisMonth, icon: Star, color: 'text-blue-600', bg: 'bg-blue-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
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
                          {c.name[0]}
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground text-lg block group-hover:text-primary transition-colors">{c.name}</span>
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
                          <span className="font-bold text-foreground text-xl">{c.totalSpent.toFixed(2)}</span>
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
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
                          onClick={() => handleRotatePortalToken(c)}
                          className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                          title={t("Rotate Portal Code")}
                        >
                          <KeyRound className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                          title={t("Edit")}
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => void handleDeleteCustomer(c.id)}
                          className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                          title={t("Delete")}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-10 py-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-6 opacity-20">
                      <Search className="h-20 w-20" />
                      <p className="text-xl font-bold uppercase tracking-[0.3em]">{t("No Customers Found")}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden grid gap-4 grid-cols-1">
          <AnimatePresence mode="popLayout">
            {filtered.map((c, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={c.id}
                className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase shadow-inner shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="font-bold text-foreground text-lg truncate">{c.name}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{t("Client ID")}: {c.id.slice(-6).toUpperCase()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-muted/50 px-4 py-3 rounded-xl w-fit">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="font-bold text-foreground text-sm" dir="ltr">{c.phone ?? "—"}</span>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-xl">{c.totalSpent.toFixed(2)}</span>
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR Total")}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 border border-amber-500/20 shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    {c.loyaltyPoints} {t("Pts")}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => openHistory(c)}
                    className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                  >
                    <History className="h-5 w-5" />
                    {t("History")}
                  </button>
                  <button
                    onClick={() => handleRotatePortalToken(c)}
                    className="h-12 w-14 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-all shadow-sm shrink-0"
                  >
                    <KeyRound className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="h-12 w-14 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 transition-all shadow-sm shrink-0"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => void handleDeleteCustomer(c.id)}
                    className="h-12 w-14 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all shadow-sm shrink-0"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && !loading && (
             <div className="py-20 text-center flex flex-col items-center justify-center gap-6 opacity-20">
               <Search className="h-16 w-16" />
               <p className="text-lg font-bold uppercase tracking-[0.2em]">{t("No Customers Found")}</p>
             </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {openId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 print:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-6xl rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-6 sm:px-10 py-5 sm:py-8 bg-muted/20">
                <div className="flex items-center gap-5">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <History className="h-7 w-7" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold text-foreground">{t("Customer Profile")}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("History & Preferences")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpenId(null)}
                  className="h-12 w-12 rounded-full hover:bg-muted flex items-center justify-center transition-all hover:rotate-90"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-auto p-5 sm:p-10 scrollbar-hide">
                {!history ? (
                  <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-40">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]">{t("Fetching Data...")}</p>
                  </div>
                ) : (
                  <div className="grid gap-12 lg:grid-cols-3">
                    {/* Notes Section */}
                    <div className="lg:col-span-1 space-y-8">
                      <div className="flex items-center gap-4 text-sm font-bold text-foreground uppercase tracking-[0.2em]">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        {t("Notes & Preferences")}
                      </div>
                      <div className="rounded-[2.5rem] border border-border bg-muted/30 p-8 space-y-6 shadow-inner">
                        <textarea
                          className="w-full h-64 rounded-[1.5rem] border border-border bg-card p-6 text-sm font-medium text-foreground focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all shadow-sm"
                          placeholder={t("Medical History / Preferences / Allergies")}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                        <button
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                          className="group relative flex w-full h-14 items-center justify-center gap-3 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                          <Save className="h-5 w-5 relative z-10" />
                          <span className="relative z-10">{savingNotes ? t("Saving...") : t("Save Changes")}</span>
                        </button>
                      </div>
                    </div>

                    {/* Appointments Section */}
                    <div className="lg:col-span-1 space-y-8">
                      <div className="flex items-center gap-4 text-sm font-bold text-foreground uppercase tracking-[0.2em]">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Calendar className="h-5 w-5" />
                        </div>
                        {t("Appointments")}
                      </div>
                      <div className="space-y-5">
                        {history.appointments?.length ? (
                          history.appointments.map((a: any, idx: number) => (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                              key={a.id} 
                              className="group rounded-[1.5rem] border border-border bg-muted/50 p-6 transition-all hover:bg-card hover:shadow-xl hover:-translate-y-1"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border border-border shadow-sm">
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                                    {new Date(a.dateTime).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
                                  </span>
                                </div>
                                <span className={clsx(
                                  "rounded-xl px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest shadow-sm",
                                  a.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                )}>
                                  {t(a.status)}
                                </span>
                              </div>
                              <div className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{a.service?.name}</div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                <User className="h-3 w-3" />
                                {a.employee?.name}
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="rounded-[2rem] border border-dashed border-border py-32 text-center opacity-20">
                            <Calendar className="h-12 w-12 mx-auto mb-4" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{t("No Appointments")}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoices Section */}
                    <div className="lg:col-span-1 space-y-8">
                      <div className="flex items-center gap-4 text-sm font-bold text-foreground uppercase tracking-[0.2em]">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Receipt className="h-5 w-5" />
                        </div>
                        {t("Invoices")}
                      </div>
                      <div className="space-y-5">
                        {history.invoices?.length ? (
                          history.invoices.map((inv, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                              key={inv.id} 
                              className="group rounded-[1.5rem] border border-border bg-muted/50 p-6 transition-all hover:bg-card hover:shadow-xl hover:-translate-y-1"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border border-border shadow-sm">
                                  <Receipt className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                                    {new Date(inv.date).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-lg font-bold text-primary">{inv.totalAmount.toFixed(2)}</span>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{t("OMR")}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-4 mt-2">
                                <div className="flex flex-wrap gap-2">
                                  {(inv.items || []).map((it) => (
                                    <span key={it.id} className="rounded-xl bg-background border border-border px-3 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest group-hover:border-primary/30 transition-colors shadow-sm">
                                      {it.service?.name || it.product?.name}
                                    </span>
                                  ))}
                                </div>
                                <button
                                  onClick={() => handleReprint(inv.id)}
                                  className="shrink-0 h-8 px-3 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2 relative"
                                >
                                  <Receipt className="h-3 w-3" />
                                  {t("Print")}
                                </button>
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="rounded-[2rem] border border-dashed border-border py-32 text-center opacity-20">
                            <Receipt className="h-12 w-12 mx-auto mb-4" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{t("No Invoices")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-md rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-6 sm:px-10 py-5 sm:py-8 bg-muted/20">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <UserPlus className="h-7 w-7" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold text-foreground">{t("Add Customer")}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Create New Client")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="h-12 w-12 rounded-full hover:bg-muted flex items-center justify-center transition-all hover:rotate-90"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Full Name")}</label>
                  <div className="relative">
                    <User className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                      placeholder={t("Enter customer name")}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Phone Number")}</label>
                  <div className="relative">
                    <Phone className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-start shadow-inner"
                      dir="ltr"
                      placeholder="968XXXXXXXX"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  disabled={adding}
                  onClick={handleAddCustomer}
                  className="group relative w-full h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 overflow-hidden flex items-center justify-center gap-3"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <CheckCircle2 className="h-6 w-6 relative z-10" />
                  <span className="text-lg relative z-10">{adding ? t("Creating...") : t("Create Customer")}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-md rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-6 sm:px-10 py-5 sm:py-8 bg-muted/20">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                    <Pencil className="h-7 w-7" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold text-foreground">{t("Edit Customer")}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Update Details")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditId(null)}
                  className="h-12 w-12 rounded-full hover:bg-muted flex items-center justify-center transition-all hover:rotate-90"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Full Name")}</label>
                  <div className="relative">
                    <User className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner"
                      placeholder={t("Enter customer name")}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Phone Number")}</label>
                  <div className="relative">
                    <Phone className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-start shadow-inner"
                      dir="ltr"
                      placeholder="968XXXXXXXX"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  disabled={adding}
                  onClick={handleEditCustomer}
                  className="group relative w-full h-16 rounded-[2rem] bg-blue-500 font-bold text-white shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 overflow-hidden flex items-center justify-center gap-3"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <Save className="h-6 w-6 relative z-10" />
                  <span className="text-lg relative z-10">{adding ? t("Saving...") : t("Save Changes")}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
