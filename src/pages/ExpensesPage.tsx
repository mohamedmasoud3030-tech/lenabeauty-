import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { 
  Receipt, Plus, Trash2, Calendar, Tag, DollarSign, 
  Search, Filter, X, Save, AlertCircle, TrendingDown,
  ArrowDownRight, Wallet, PieChart, Sparkles, ChevronRight,
  MoreVertical, LayoutGrid, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";

export default function ExpensesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Supplies");
  const [editDate, setEditDate] = useState("");
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Supplies");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

  const categories = ["Rent", "Supplies", "Utilities", "Marketing", "Salaries", "Other"];

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await unwrap(useCases.expenses.list());
      setExpenses(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(q.toLowerCase());
    const matchesCategory = selectedCategory === "All" || exp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalExpenses = filtered.reduce((sum, exp) => sum + exp.amount, 0);

  async function handleAdd() {
    if (!newDesc.trim() || !newAmount) {
      showToast('error', t('Error'), t("Please fill all required fields"));
      return;
    }
    
    const amountNum = Number(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('error', t('Error'), t("Amount must be greater than 0"));
      return;
    }

    try {
      await unwrap(useCases.expenses.create({
        description: newDesc.trim(),
        amount: amountNum,
        category: newCategory,
        date: new Date(newDate),
      }));
      setNewDesc("");
      setNewAmount("");
      setShowAddModal(false);
      load();
    } catch (e) {
      showToast('error', 'Error', ((e as Error).message || String(e)));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t("Delete Expense"),
      message: t("Are you sure?"),
      type: "danger"
    });
    if (!ok) return;
    try {
      await unwrap(useCases.expenses.delete(id));
      load();
    } catch (e) {
      showToast('error', 'Error', ((e as Error).message || String(e)));
    }
  }

  function handleEdit(exp: any) {
    setEditingId(exp.id);
    setEditDesc(exp.description);
    setEditAmount(String(exp.amount));
    setEditCategory(exp.category);
    setEditDate(new Date(exp.date).toISOString().split("T")[0]);
  }

  async function handleSaveEdit() {
    if (!editDesc.trim() || !editAmount) {
      showToast('error', t('Error'), t("Please fill all required fields"));
      return;
    }
    
    const amountNum = Number(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('error', t('Error'), t("Amount must be greater than 0"));
      return;
    }

    try {
      await unwrap(useCases.expenses.update(editingId!, {
        description: editDesc.trim(),
        amount: amountNum,
        category: editCategory,
        date: new Date(editDate),
      }));
      setEditingId(null);
      load();
    } catch (e) {
      showToast('error', 'Error', ((e as Error).message || String(e)));
    }
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <Receipt className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t("Expenses")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Track your business costs")}</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="h-14 w-full sm:w-auto px-8 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <Plus className="h-6 w-6" />
          {t("Add Expense")}
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 end-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingDown className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <DollarSign className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Total Expenses")}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">{totalExpenses.toFixed(2)}</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 end-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <PieChart className="h-24 w-24 rotate-12" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Tag className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Transactions")}</span>
          </div>
          <div className="text-4xl font-bold text-foreground">{filtered.length}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 end-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calendar className="h-24 w-24" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Calendar className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Current Period")}</span>
          </div>
          <div className="text-2xl font-bold text-foreground uppercase tracking-tight">{new Date().toLocaleDateString('ar-OM', { month: 'long', year: 'numeric' })}</div>
        </motion.div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-8">
        <div className="relative flex-1 group">
          <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            className="w-full rounded-[1.5rem] border border-border bg-card py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
            placeholder={t("Search expenses...")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory("All")}
            className={clsx(
              "px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap shadow-sm",
              selectedCategory === "All" 
                ? "bg-primary text-primary-foreground shadow-primary/20 scale-105" 
                : "bg-card border border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {t("All")}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                "px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap shadow-sm",
                selectedCategory === cat 
                  ? "bg-primary text-primary-foreground shadow-primary/20 scale-105" 
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {t(cat)}
            </button>
          ))}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
      >
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[700px] text-sm md:min-w-full">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                <th>{t("Description")}</th>
                <th>{t("Category")}</th>
                <th>{t("Amount")}</th>
                <th>{t("Date")}</th>
                <th className="w-[100px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {filtered.map((exp, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={exp.id} 
                    className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start"
                  >
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-inner">
                          {exp.description[0]}
                        </div>
                        <div className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{exp.description}</div>
                      </div>
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-2.5 rounded-2xl bg-primary/5 px-4 py-2 text-xs font-bold text-primary border border-primary/10 shadow-sm">
                        <Tag className="h-3.5 w-3.5" />
                        {t(exp.category)}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xl">{exp.amount.toFixed(2)}</span>
                          <ArrowDownRight className="h-4 w-4 text-rose-500" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3 text-muted-foreground font-medium bg-muted/50 px-4 py-2 rounded-xl w-fit">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-bold text-foreground">{new Date(exp.date).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(exp)} 
                          className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                          title={t("Edit")}
                        >
                          <Save className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(exp.id)} 
                          className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shadow-sm hover:scale-110 active:scale-95"
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
                      <Receipt className="h-20 w-20" />
                      <p className="text-xl font-bold uppercase tracking-[0.3em]">{t("No Expenses Found")}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden p-4 grid gap-4 grid-cols-1">
          <AnimatePresence mode="popLayout">
            {filtered.map((exp, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={`m-${exp.id}`}
                className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shadow-inner shrink-0">
                    {exp.description[0]}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start">
                    <span className="font-bold text-foreground text-lg truncate w-full">{exp.description}</span>
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-primary/5 px-2 py-1 mt-1 text-[10px] font-bold text-primary border border-primary/10 w-fit shrink-0 truncate">
                      <Tag className="h-3 w-3" />
                      {t(exp.category)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Amount")}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground text-xl">{exp.amount.toFixed(2)}</span>
                      <ArrowDownRight className="h-4 w-4 text-rose-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-xl shadow-sm">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground text-sm">{new Date(exp.date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => void handleDelete(exp.id)}
                    className="h-12 w-full rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-all shadow-sm"
                  >
                    <Trash2 className="h-5 w-5" />
                    {t("Delete")}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && !loading && (
             <div className="py-20 text-center flex flex-col items-center justify-center gap-6 opacity-20">
               <Receipt className="h-16 w-16" />
               <p className="text-lg font-bold uppercase tracking-[0.2em]">{t("No Expenses Found")}</p>
             </div>
          )}
        </div>
      </motion.div>

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
              className="relative w-full max-w-lg rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-6 sm:px-10 py-5 sm:py-8 bg-muted/20">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Plus className="h-7 w-7" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold text-foreground">{t("Add Expense")}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Record New Cost")}</p>
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
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Description")}</label>
                  <div className="relative">
                    <Receipt className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input 
                      className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder={t("e.g., Electricity Bill")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Amount")}</label>
                    <div className="relative">
                      <DollarSign className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input 
                        type="number"
                        className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Category")}</label>
                    <div className="relative">
                      <Tag className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select 
                        className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-10 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none shadow-inner"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      >
                        {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Date")}</label>
                  <div className="relative">
                    <Calendar className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input 
                      type="date"
                      className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAdd}
                  className="group relative w-full h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <Save className="h-6 w-6 relative z-10" />
                  <span className="text-lg relative z-10">{t("Save Expense")}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
