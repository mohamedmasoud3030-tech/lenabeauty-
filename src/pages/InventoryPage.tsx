import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  AlertTriangle, Plus, Pencil, Trash2, Boxes, 
  Package, DollarSign, BarChart, Search, Save, 
  X, CheckCircle2, TrendingUp, Wallet, 
  AlertCircle, ArrowUpRight, ArrowDownRight,
  LayoutGrid, List, Filter, RefreshCw, Sparkles,
  ChevronRight, MoreVertical, Tag, Layers,
  Download, Bell, TrendingDown, ShoppingCart
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import {
  requiredText, nonNegativeNumber, nonNegativeInteger, collectIssues, issuesToMap
} from "../domain/validation";
import { ScreenState } from "../shared/components/ScreenState";

type Product = { id: string; name: string; stockQuantity: number; price: number; cost: number; reorderLevel?: number };

// Export products to CSV
function exportToCSV(products: Product[], t: (k: string) => string) {
  const headers = [t('Product'), t('Stock'), t('Cost'), t('Price'), t('Profit %')];
  const rows = products.map(p => [
    p.name,
    p.stockQuantity,
    p.cost.toFixed(3),
    p.price.toFixed(3),
    ((p.price - p.cost) / (p.price || 1) * 100).toFixed(1) + '%'
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InventoryPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const [rows, setRows] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lowStockThreshold] = useState(5);
  const [name, setName] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!editingId;

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await unwrap(useCases.products.listFull());
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
    let result = rows;
    const text = q.trim().toLowerCase();
    if (text) result = result.filter((p) => p.name.toLowerCase().includes(text));
    if (showLowStockOnly) result = result.filter((p) => p.stockQuantity < (p.reorderLevel ?? lowStockThreshold));
    return result;
  }, [rows, q, showLowStockOnly, lowStockThreshold]);

  const stats = useMemo(() => {
    const totalItems = rows.length;
    const lowStock = rows.filter(p => p.stockQuantity < (p.reorderLevel ?? 5)).length;
    const totalValue = rows.reduce((acc, p) => acc + (p.stockQuantity * p.cost), 0);
    return { totalItems, lowStock, totalValue };
  }, [rows]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setStockQuantity("0");
    setReorderLevel("0");
    setCost("0");
    setPrice("0");
    setErrors({});
  }

  async function submit() {
    const nameR = requiredText(name);
    const stockR = nonNegativeInteger(stockQuantity);
    const reorderR = nonNegativeInteger(reorderLevel);
    const costR = nonNegativeNumber(cost);
    const priceR = nonNegativeNumber(price);
    const issues = collectIssues([
      { field: "name", result: nameR },
      { field: "stockQuantity", result: stockR },
      { field: "reorderLevel", result: reorderR },
      { field: "cost", result: costR },
      { field: "price", result: priceR },
    ]);
    if (issues.length > 0) {
      setErrors(issuesToMap(issues));
      return;
    }
    setErrors({});

    const payload = {
      name: (nameR as { ok: true; value: string }).value,
      stockQuantity: (stockR as { ok: true; value: number }).value,
      reorderLevel: (reorderR as { ok: true; value: number }).value,
      cost: (costR as { ok: true; value: number }).value,
      price: (priceR as { ok: true; value: number }).value,
    };

    try {
      if (isEditing && editingId) {
        await unwrap(useCases.products.update(editingId, payload));
      } else {
        await unwrap(useCases.products.create(payload));
      }
      await load();
      resetForm();
    } catch (e) {
      showToast('error', t("Error"), ((e as Error).message || String(e)));
    }
  }

  function onEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setStockQuantity(String(p.stockQuantity));
    setReorderLevel(String(p.reorderLevel ?? 0));
    setCost(String(p.cost));
    setPrice(String(p.price));
    setErrors({});
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: t("Delete Product"),
      message: t("Are you sure you want to delete this product?"),
      type: "danger"
    });
    if (!ok) return;
    await unwrap(useCases.products.delete(id));
    await load();
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-10">
      {/* Low Stock Alert Banner */}
      {stats.lowStock > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 px-5 py-4 text-rose-600"
        >
          <Bell className="h-5 w-5 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-bold">
            {t("Warning")}: {stats.lowStock} {t("products are running low on stock")}
          </p>
          <button
            onClick={() => setShowLowStockOnly(true)}
            className="ms-auto text-xs font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t("View All")}
          </button>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <Boxes className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t("Inventory")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Manage your products and stock levels")}</p>
          </div>
        </div>
        
        <div className="relative w-full max-w-md group">
          <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            className="w-full rounded-[1.5rem] border border-border bg-card py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-xl"
            placeholder={t("Search products...")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 end-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Layers className="h-20 w-20 -rotate-12" />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Package className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Total Products")}</span>
          </div>
          <div className="text-4xl font-bold text-foreground">{stats.totalItems}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 end-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wallet className="h-20 w-20 rotate-12" />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Inventory Value")}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">{stats.totalValue.toFixed(2)}</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={clsx(
            "group rounded-[2.5rem] border border-border bg-card p-8 shadow-xl border-l-[10px] hover:shadow-2xl transition-all relative overflow-hidden",
            stats.lowStock > 0 ? "border-l-rose-500" : "border-l-emerald-500"
          )}
        >
          <div className="absolute top-0 end-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertTriangle className="h-20 w-20" />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className={clsx(
              "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner",
              stats.lowStock > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
            )}>
              <AlertCircle className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("Low Stock Items")}</span>
          </div>
          <div className="text-4xl font-bold text-foreground">{stats.lowStock}</div>
        </motion.div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:gap-10 lg:grid-cols-[450px_1fr]">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card p-4 sm:p-6 lg:p-10 shadow-2xl h-fit space-y-4 sm:space-y-6 lg:space-y-10 sticky top-10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                {isEditing ? <Pencil className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{isEditing ? t("Edit Product") : t("New Product")}</h2>
            </div>
            {isEditing && (
              <button 
                onClick={resetForm} 
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Product Name")}</label>
              <div className="relative group">
                <Tag className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  className="w-full rounded-2xl border border-border bg-muted/30 ps-14 pe-6 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }}
                  placeholder={t("e.g. Luxury Shampoo")}
                />
                {errors.name && <div className="mt-1 ms-2 text-xs font-bold text-rose-500">{t(errors.name)}</div>}
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Stock Quantity")}</label>
                <div className="relative group">
                  <Package className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    className="w-full rounded-2xl border border-border bg-muted/30 py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                    inputMode="numeric"
                    value={stockQuantity}
                    onChange={(e) => { setStockQuantity(e.target.value); if (errors.stockQuantity) setErrors((p) => ({ ...p, stockQuantity: "" })); }}
                  />
                </div>
                {errors.stockQuantity && <div className="mt-1 ms-2 text-xs font-bold text-rose-500">{t(errors.stockQuantity)}</div>}
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Reorder Level")}</label>
                <div className="relative group">
                  <Package className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    className="w-full rounded-2xl border border-border bg-muted/30 py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                    inputMode="numeric"
                    value={reorderLevel}
                    onChange={(e) => { setReorderLevel(e.target.value); if (errors.reorderLevel) setErrors((p) => ({ ...p, reorderLevel: "" })); }}
                  />
                </div>
                {errors.reorderLevel && <div className="mt-1 ms-2 text-xs font-bold text-rose-500">{t(errors.reorderLevel)}</div>}
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Cost Price")}</label>
                <div className="relative group">
                  <BarChart className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    className="w-full rounded-2xl border border-border bg-muted/30 py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                    inputMode="decimal"
                    value={cost}
                    onChange={(e) => { setCost(e.target.value); if (errors.cost) setErrors((p) => ({ ...p, cost: "" })); }}
                  />
                </div>
                {errors.cost && <div className="mt-1 ms-2 text-xs font-bold text-rose-500">{t(errors.cost)}</div>}
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Selling Price")}</label>
                <div className="relative group">
                  <DollarSign className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    className="w-full rounded-2xl border border-border bg-muted/30 py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); if (errors.price) setErrors((p) => ({ ...p, price: "" })); }}
                  />
                </div>
                {errors.price && <div className="mt-1 ms-2 text-xs font-bold text-rose-500">{t(errors.price)}</div>}
              </div>
            </div>

            <button
              onClick={submit}
              className="w-full h-16 rounded-2xl bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            >
              {isEditing ? <Save className="h-6 w-6 group-hover:rotate-12 transition-transform" /> : <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />}
              {isEditing ? t("Save Changes") : t("Add to Inventory")}
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="overflow-hidden rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl"
        >
          <div className="border-b border-border bg-muted/30 px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <List className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">{t("Inventory List")}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLowStockOnly(v => !v)}
                className={clsx(
                  "h-10 px-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all shadow-sm",
                  showLowStockOnly
                    ? "bg-rose-500 text-white border-rose-500"
                    : "border-border bg-card text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">{t("Low Stock")}</span>
              </button>
              <button
                onClick={() => exportToCSV(filtered, t)}
                className="h-10 px-3 rounded-xl border border-border bg-card flex items-center gap-2 text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{t("Export")}</span>
              </button>
              <button className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
                <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} onClick={load} />
              </button>
            </div>
          </div>
          <div className="hidden lg:block overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[700px] text-sm md:min-w-full font-sans">
              <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                  <th>{t("Product")}</th>
                  <th>{t("Stock")}</th>
                  <th>{t("Cost")}</th>
                  <th>{t("Price")}</th>
                  <th className="w-[180px]">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <AnimatePresence mode="popLayout">
                  {filtered.map((p, idx) => {
                    const low = p.stockQuantity < 5;
                    return (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={p.id} 
                        className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start"
                      >
                        <td>
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-inner">
                              {p.name[0]}
                            </div>
                            <div className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{p.name}</div>
                          </div>
                        </td>
                        <td>
                          <div className={clsx(
                            "inline-flex items-center gap-2.5 rounded-2xl px-5 py-2.5 text-xs font-bold border shadow-sm transition-all",
                            low 
                              ? "bg-rose-500/10 text-rose-600 border-rose-200 animate-pulse" 
                              : "bg-muted text-foreground border-border"
                          )}>
                            {p.stockQuantity}
                            {low && <AlertTriangle className="h-4 w-4" />}
                          </div>
                        </td>
                        <td className="text-muted-foreground font-bold text-base">
                          <span className="font-bold text-foreground">{p.cost.toFixed(2)}</span>
                          <span className="ms-1.5 text-[10px] uppercase tracking-[0.2em] opacity-40">{t("OMR")}</span>
                        </td>
                        <td>
                          <div className="flex flex-col items-start">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-bold text-primary text-xl">{p.price.toFixed(2)}</span>
                              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{t("OMR")}</span>
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                              {t("Profit")}: {((p.price - p.cost) / (p.price || 1) * 100).toFixed(0)}%
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => onEdit(p)} 
                              className="h-11 w-11 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button 
                              onClick={() => onDelete(p.id)} 
                              className="h-11 w-11 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-all shadow-sm hover:scale-110"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <ScreenState state="loading" title={t("Loading products...")} compact />
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <ScreenState
                        state="error"
                        title={t("Failed to load products")}
                        description={t("Something went wrong while loading. Try again.")}
                        actionLabel="Retry"
                        onAction={load}
                        errorDetail={loadError}
                        compact
                      />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <ScreenState
                        state="empty"
                        icon={<Boxes className="h-6 w-6" />}
                        title={t("No Products Found")}
                        description={q ? t("Try a different search term") : t("Add your first product to start selling")}
                        compact
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden p-4 grid gap-4 grid-cols-1">
            <AnimatePresence mode="popLayout">
              {filtered.map((p, idx) => {
                const low = p.stockQuantity < 5;
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={`m-${p.id}`}
                    className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shadow-inner shrink-0">
                        {p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-start">
                        <span className="font-bold text-foreground text-lg truncate w-full">{p.name}</span>
                        <div className={clsx(
                          "inline-flex items-center gap-1.5 rounded-xl px-2 py-1 mt-1 text-[10px] font-bold border shrink-0",
                          low ? "bg-rose-500/10 text-rose-600 border-rose-200 animate-pulse" : "bg-muted text-foreground border-border"
                        )}>
                          {p.stockQuantity} {t("In Stock")}
                          {low && <AlertTriangle className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Cost")}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-foreground text-base">{p.cost.toFixed(2)}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{t("OMR")}</span>
                        </div>
                      </div>
                      <div className="flex flex-col text-end">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t("Price")}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-primary text-xl">{p.price.toFixed(2)}</span>
                          <span className="text-[8px] font-bold text-primary uppercase">{t("OMR")}</span>
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                          {t("Profit")}: {((p.price - p.cost) / (p.price || 1) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => onEdit(p)}
                        className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                      >
                        <Pencil className="h-5 w-5" />
                        {t("Edit")}
                      </button>
                      <button
                        onClick={() => void onDelete(p.id)}
                        className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all shadow-sm"
                      >
                        <Trash2 className="h-5 w-5" />
                        {t("Delete")}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {loading && filtered.length === 0 ? (
              <ScreenState state="loading" title={t("Loading products...")} compact />
            ) : loadError ? (
              <ScreenState
                state="error"
                title={t("Failed to load products")}
                description={t("Something went wrong while loading. Try again.")}
                actionLabel="Retry"
                onAction={load}
                errorDetail={loadError}
                compact
              />
            ) : filtered.length === 0 ? (
              <ScreenState
                state="empty"
                icon={<Boxes className="h-6 w-6" />}
                title={t("No Products Found")}
                description={q ? t("Try a different search term") : t("Add your first product to start selling")}
                compact
              />
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
