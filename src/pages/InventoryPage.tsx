import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, Plus, Pencil, Trash2, Boxes,
  Package, DollarSign, BarChart, Search, Save,
  CheckCircle2,
  AlertCircle,
  List, RefreshCw, Sparkles,
  Tag,
  Download, Bell, Wallet,
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { Modal } from "../shared/components/Modal";
import { getInitials } from "../shared/displayName";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import {
  requiredText, nonNegativeNumber, positiveNumber, nonNegativeInteger, collectIssues, issuesToMap
} from "../domain/validation";
import { ListState } from "../shared/components/ListState";
import { formatOMRAmount } from "../shared/money";

type Product = { id: string; name: string; stockQuantity: number; price: number; cost: number; reorderLevel?: number; isActive: boolean; trackInventory: boolean };

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
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lowStockThreshold] = useState(5);
  const [name, setName] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!editingId;
  // Warn before discarding only when the user has actually entered something.
  const formDirty = name.trim().length > 0 || price.trim().length > 0;

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await unwrap(useCases.products.listFull());
      setRows(res);
    } catch (e: any) {
      setLoadError(mapErrorToMessage(e, t));
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
    if (showLowStockOnly) result = result.filter((p) => p.isActive && p.trackInventory && p.stockQuantity < (p.reorderLevel ?? lowStockThreshold));
    return result;
  }, [rows, q, showLowStockOnly, lowStockThreshold]);

  const stats = useMemo(() => {
    const totalItems = rows.length;
    const lowStock = rows.filter(p => p.isActive && p.trackInventory && p.stockQuantity < (p.reorderLevel ?? 5)).length;
    const totalValue = rows.filter((p) => p.trackInventory).reduce((acc, p) => acc + (p.stockQuantity * p.cost), 0);
    return { totalItems, lowStock, totalValue };
  }, [rows]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setStockQuantity("0");
    setReorderLevel("0");
    setCost("0");
    setPrice("");
    setTrackInventory(true);
    setErrors({});
  }

  async function submit() {
    const nameR = requiredText(name);
    const stockR = nonNegativeInteger(stockQuantity);
    const reorderR = nonNegativeInteger(reorderLevel);
    const costR = nonNegativeNumber(cost);
    const priceR = positiveNumber(price);
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
    setSaving(true);

    const payload = {
      name: (nameR as { ok: true; value: string }).value,
      stockQuantity: (stockR as { ok: true; value: number }).value,
      reorderLevel: (reorderR as { ok: true; value: number }).value,
      cost: (costR as { ok: true; value: number }).value,
      price: (priceR as { ok: true; value: number }).value,
      trackInventory,
    };

    try {
      if (isEditing && editingId) {
        await unwrap(useCases.products.update(editingId, payload));
      } else {
        await unwrap(useCases.products.create(payload));
      }
      showToast("success", t("Success"), t("Product saved successfully"));
      await load();
      resetForm();
      setFormOpen(false);
    } catch (e) {
      // Keep the form open so the user can recover; values are preserved.
      showToast("error", t("Error"), mapErrorToMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function onEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setStockQuantity(String(p.stockQuantity));
    setReorderLevel(String(p.reorderLevel ?? 0));
    setCost(String(p.cost));
    setPrice(String(p.price));
    setTrackInventory(p.trackInventory);
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: t("Delete Product"),
      message: t("Are you sure you want to delete this product?"),
      type: "danger"
    });
    if (!ok) return;
    try {
      await unwrap(useCases.products.delete(id));
      await load();
    } catch (e) {
      showToast("error", t("Error"), mapErrorToMessage(e, t));
    }
  }

  async function onToggleActive(product: Product) {
    try {
      await unwrap(useCases.products.update(product.id, { isActive: !product.isActive }));
      await load();
    } catch (e) {
      showToast("error", t("Error"), mapErrorToMessage(e, t));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      {/* Low Stock Alert Banner */}
      {stats.lowStock > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/20 px-4 py-3 text-warning"
        >
          <Bell className="h-4 w-4 flex-shrink-0" />
          <p className="text-xs font-bold flex-1">
            {t("Warning")}: {stats.lowStock} {t("products are running low on stock")}
          </p>
          <button
            onClick={() => setShowLowStockOnly(true)}
            className="min-h-9 inline-flex items-center text-[11px] font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t("View All")}
          </button>
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">{t("Inventory")}</h1>
            <p className="text-[11px] text-muted-foreground truncate">{t("Manage your products and stock levels")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-border bg-card py-2.5 ps-9 pe-3 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              placeholder={t("Search products...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            onClick={openCreate}
            className="h-11 shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-3 sm:px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">{t("Add Product")}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-4 w-4" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("Total Products")}</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-foreground">{stats.totalItems}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("Inventory Value")}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-2xl font-bold text-foreground">{formatOMRAmount(stats.totalValue)}</span>
            <span className="text-[9px] font-bold text-muted-foreground">{t("OMR")}</span>
          </div>
        </div>
        <div className={clsx(
          "rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm border-s-4",
          stats.lowStock > 0 ? "border-s-warning" : "border-s-success"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <div className={clsx(
              "h-8 w-8 rounded-lg flex items-center justify-center",
              stats.lowStock > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            )}>
              <AlertCircle className="h-4 w-4" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("Low Stock Items")}</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-foreground">{stats.lowStock}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/30 px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <List className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider truncate">{t("Inventory List")}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowLowStockOnly(v => !v)}
              className={clsx(
                "h-9 px-2.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition-all",
                showLowStockOnly
                  ? "bg-warning text-warning-foreground border-warning"
                  : "border-border bg-card text-muted-foreground hover:bg-warning/10 hover:text-warning"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("Low Stock")}</span>
            </button>
            <button
              onClick={() => exportToCSV(filtered, t)}
              className="h-9 px-2.5 rounded-lg border border-border bg-card flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("Export")}</span>
            </button>
            <button
              onClick={load}
              className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
              aria-label={t("Refresh")}
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[700px] text-sm font-sans">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-start">
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
                  const low = p.trackInventory && p.stockQuantity < (p.reorderLevel ?? 5);
                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={p.id}
                      className="group hover:bg-muted/30 transition-all [&>td]:px-5 [&>td]:py-3 [&>td]:text-start"
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shrink-0">
                            {getInitials(p.name, "·")}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-sm group-hover:text-primary transition-colors truncate">{p.name}</div>
                            {!p.isActive && <span className="text-[10px] font-bold text-destructive">{t("Disabled")}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={clsx(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border",
                          low
                            ? "bg-warning/10 text-warning border-warning/30"
                            : "bg-muted text-foreground border-border"
                        )}>
                          {p.stockQuantity}
                          {low && <AlertTriangle className="h-3 w-3" />}
                        </div>
                      </td>
                      <td className="text-muted-foreground font-bold text-sm">
                        <span className="font-bold text-foreground">{formatOMRAmount(p.cost)}</span>
                        <span className="ms-1 text-[9px] uppercase tracking-wider opacity-50">{t("OMR")}</span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start">
                          <div className="flex items-baseline gap-1">
                            <span className="font-bold text-primary text-base">{formatOMRAmount(p.price)}</span>
                            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">{t("OMR")}</span>
                          </div>
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider opacity-60">
                            {t("Profit")}: {((p.price - p.cost) / (p.price || 1) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void onToggleActive(p)}
                            className={clsx(
                              "h-9 w-9 rounded-lg border flex items-center justify-center transition-all",
                              p.isActive ? "border-border text-muted-foreground hover:text-warning" : "border-success/30 text-success"
                            )}
                            title={p.isActive ? t("Disable") : t("Enable")}
                            aria-label={p.isActive ? t("Disable") : t("Enable")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEdit(p)}
                            className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                            aria-label={t("Edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void onDelete(p.id)}
                            className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                            aria-label={t("Delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              <ListState
                loading={loading && filtered.length === 0}
                error={loadError}
                empty={filtered.length === 0}
                onRetry={load}
                loadingTitle={t("Loading products...")}
                errorTitle={t("Failed to load products")}
                emptyTitle={t("No Products Found")}
                emptyDescription={q ? t("Try a different search term") : t("Add your first product to start selling")}
                emptyIcon={<Boxes className="h-5 w-5" />}
                emptyActionLabel={q ? undefined : t("Add Product")}
                onEmptyAction={q ? undefined : openCreate}
                colSpan={5}
                compact
              />
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden grid grid-cols-2 gap-2.5 p-2.5">
          <AnimatePresence mode="popLayout">
            {filtered.map((p, idx) => {
              const low = p.trackInventory && p.stockQuantity < (p.reorderLevel ?? 5);
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.03 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={`m-${p.id}`}
                  className="min-w-0 rounded-xl border border-border bg-card p-2.5 shadow-sm flex flex-col gap-2"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                      {getInitials(p.name, "·")}
                    </div>
                    <span className="block truncate text-xs font-bold text-foreground">{p.name}</span>
                  </div>
                  {!p.isActive && <span className="text-[9px] font-bold text-destructive">{t("Disabled")}</span>}
                  <div className={clsx(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border w-fit",
                    low ? "status-danger" : "border-border bg-muted text-foreground",
                  )}>
                    {p.stockQuantity} {t("In Stock")}
                    {low && <AlertTriangle className="h-3 w-3" />}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 border-t border-border pt-2">
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold text-muted-foreground">{t("Cost")}</div>
                      <div className="truncate text-[11px] font-bold text-foreground">{formatOMRAmount(p.cost)}</div>
                    </div>
                    <div className="min-w-0 text-end">
                      <div className="text-[9px] font-bold text-primary">{t("Price")}</div>
                      <div className="truncate text-xs font-bold text-primary">{formatOMRAmount(p.price)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void onToggleActive(p)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border text-muted-foreground flex items-center justify-center"
                      title={p.isActive ? t("Disable") : t("Enable")}
                      aria-label={p.isActive ? t("Disable") : t("Enable")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit(p)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border text-muted-foreground flex items-center justify-center"
                      aria-label={t("Edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void onDelete(p.id)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border text-destructive flex items-center justify-center"
                      aria-label={t("Delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div className="col-span-2">
            <ListState
              loading={loading && filtered.length === 0}
              error={loadError}
              empty={filtered.length === 0}
              onRetry={load}
              loadingTitle={t("Loading products...")}
              errorTitle={t("Failed to load products")}
              emptyTitle={t("No Products Found")}
              emptyDescription={q ? t("Try a different search term") : t("Add your first product to start selling")}
              emptyIcon={<Boxes className="h-5 w-5" />}
              emptyActionLabel={q ? undefined : t("Add Product")}
              onEmptyAction={q ? undefined : openCreate}
              compact
            />
          </div>
        </div>
      </div>

      {/* Create / Edit product — closed by default, opens in a shared overlay */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={isEditing ? t("Edit Product") : t("New Product")}
        size="md"
        confirmCloseMessage={formDirty ? t("Discard unsaved changes?") : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="h-11 px-4 rounded-lg border border-border bg-card font-bold text-foreground hover:bg-muted transition-all"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="h-11 px-4 rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEditing ? <Save className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {isEditing ? t("Save Changes") : t("Add to Inventory")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground">{t("Product Name")}</label>
            <div className="relative">
              <Tag className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }}
                placeholder={t("e.g. Luxury Shampoo")}
              />
            </div>
            {errors.name && <div className="text-xs font-bold text-destructive">{t(errors.name)}</div>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground">{t("Stock Quantity")}</label>
              <div className="relative">
                <Package className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/30 py-2.5 ps-9 pe-3 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  inputMode="numeric"
                  value={stockQuantity}
                  onChange={(e) => { setStockQuantity(e.target.value); if (errors.stockQuantity) setErrors((p) => ({ ...p, stockQuantity: "" })); }}
                />
              </div>
              {errors.stockQuantity && <div className="text-xs font-bold text-destructive">{t(errors.stockQuantity)}</div>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground">{t("Reorder Level")}</label>
              <div className="relative">
                <Package className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/30 py-2.5 ps-9 pe-3 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  inputMode="numeric"
                  value={reorderLevel}
                  onChange={(e) => { setReorderLevel(e.target.value); if (errors.reorderLevel) setErrors((p) => ({ ...p, reorderLevel: "" })); }}
                />
              </div>
              {errors.reorderLevel && <div className="text-xs font-bold text-destructive">{t(errors.reorderLevel)}</div>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground">{t("Cost Price")}</label>
              <div className="relative">
                <BarChart className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/30 py-2.5 ps-9 pe-3 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => { setCost(e.target.value); if (errors.cost) setErrors((p) => ({ ...p, cost: "" })); }}
                />
              </div>
              {errors.cost && <div className="text-xs font-bold text-destructive">{t(errors.cost)}</div>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground">{t("Selling Price")}</label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/30 py-2.5 ps-9 pe-3 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => { setPrice(e.target.value); if (errors.price) setErrors((p) => ({ ...p, price: "" })); }}
                />
              </div>
              {errors.price && <div className="text-xs font-bold text-destructive">{t(errors.price)}</div>}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm font-bold">
            <input
              type="checkbox"
              checked={trackInventory}
              onChange={(e) => setTrackInventory(e.target.checked)}
            />
            {t("Track inventory for this product")}
          </label>
        </div>
      </Modal>
    </div>
  );
}
