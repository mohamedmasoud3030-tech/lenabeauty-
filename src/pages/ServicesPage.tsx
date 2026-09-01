import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Pencil, RefreshCw, Scissors, Search,
  Save, CheckCircle2, Clock, Tag, DollarSign,
  Sparkles, XCircle, LayoutGrid, Beaker, Boxes, Trash2,
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { Modal } from "../shared/components/Modal";
import { getDisplayName, getInitials } from "../shared/displayName";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";

import { Service, ServiceRecipe, InventoryConsumption, Product } from "../domain/entities";
import { RecipeItemInput } from "../domain/ports/repositories";
import { planRecipeConsumption } from "../domain/recipe";
import {
  requiredText, positiveNumber, nonNegativeNumber, positiveInteger, collectIssues, issuesToMap, FieldResult
} from "../domain/validation";
import { PageHeader } from "../shared/components/PageHeader";
import { ListState } from "../shared/components/ListState";
import { formatOMRAmount } from "../shared/money";
import {
  ALL_SERVICE_CATEGORIES,
  filterServicesForCatalog,
  ServiceCategoryFilters,
} from "../shared/catalog/ServiceCategoryFilters";

let lineKeyCounter = 0;
function makeLineKey(idx: number): string {
  lineKeyCounter += 1;
  return `line-${lineKeyCounter}-${idx}`;
}

export default function ServicesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_SERVICE_CATEGORIES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [pricingMode, setPricingMode] = useState<"FIXED" | "STARTING_FROM">("FIXED");
  const [durationMins, setDurationMins] = useState("30");

  const isEditing = !!editingId;
  const formDirty = name.trim().length > 0 || category.trim().length > 0 || price.trim().length > 0;

  const [loadError, setLoadError] = useState<string | null>(null);

  // Service Recipes (Slice D) — server-backed consumables per service.
  type DraftRecipeLine = { key: string; productId: string; quantity: string; unit: string; estimatedCost: string };
  const [recipeFor, setRecipeFor] = useState<Service | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipe, setRecipe] = useState<ServiceRecipe | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [draftLines, setDraftLines] = useState<DraftRecipeLine[]>([]);
  const [recipeErrors, setRecipeErrors] = useState<Record<string, string>>({});
  const [consumptions, setConsumptions] = useState<InventoryConsumption[]>([]);

  function newBlankLine(): DraftRecipeLine {
    return { key: makeLineKey(0), productId: "", quantity: "1", unit: "", estimatedCost: "" };
  }

  const recipeDirty = draftLines.some((l) => l.productId.trim().length > 0);

  async function openRecipe(s: Service) {
    setRecipeFor(s);
    setRecipeOpen(true);
    setRecipeLoading(true);
    setRecipeError(null);
    setRecipe(null);
    setProducts([]);
    setConsumptions([]);
    setRecipeErrors({});
    setDraftLines([]);
    try {
      const [recipeRes, productsRes, consumptionsRes] = await Promise.all([
        useCases.recipes.getForService(s.id),
        useCases.products.list(),
        useCases.recipes.listConsumptions({ limit: 12 }),
      ]);
      if (!recipeRes.ok) throw recipeRes.error;
      if (!productsRes.ok) throw productsRes.error;
      if (!consumptionsRes.ok) throw consumptionsRes.error;
      const r = recipeRes.data;
      setRecipe(r);
      const p = productsRes.data;
      setProducts(p);
      const c = consumptionsRes.data.filter((con) => con.serviceId === s.id);
      setConsumptions(c);
      const existing = r?.items ?? [];
      setDraftLines(
        existing.length > 0
          ? existing.map((it, idx) => ({
              key: makeLineKey(idx),
              productId: it.productId,
              quantity: String(it.quantity),
              unit: it.unit ?? "",
              estimatedCost: it.estimatedCost !== undefined ? String(it.estimatedCost) : "",
            }))
          : [newBlankLine()],
      );
    } catch (e: any) {
      setRecipeError(mapErrorToMessage(e, t));
    } finally {
      setRecipeLoading(false);
    }
  }

  function closeRecipe() {
    setRecipeOpen(false);
    setRecipeFor(null);
    setRecipe(null);
    setDraftLines([]);
    setRecipeErrors({});
    setConsumptions([]);
  }

  async function saveRecipe() {
    if (!recipeFor) return;
    const items: RecipeItemInput[] = [];
    const errs: Record<string, string> = {};

    draftLines.forEach((line, idx) => {
      const productR = requiredText(line.productId);
      const qtyR = positiveNumber(Number(line.quantity));
      const costBlank = line.estimatedCost.trim() === "";
      const costR = costBlank ? null : nonNegativeNumber(Number(line.estimatedCost));

      if (!productR.ok) errs[`p-${idx}`] = t("recipe.errProduct");
      if (!qtyR.ok) errs[`q-${idx}`] = t("recipe.errQuantity");
      if (costR && !costR.ok) errs[`c-${idx}`] = t("recipe.errCost");

      if (productR.ok && qtyR.ok && (!costR || costR.ok)) {
        items.push({
          productId: (productR as FieldResult<string> & { ok: true }).value,
          quantity: (qtyR as FieldResult<number> & { ok: true }).value,
          unit: line.unit.trim() || undefined,
          estimatedCost: costBlank ? 0 : Number(line.estimatedCost),
        });
      }
    });

    if (Object.keys(errs).length > 0) {
      setRecipeErrors(errs);
      return;
    }
    if (items.length === 0) {
      setRecipeErrors({ empty: t("recipe.errEmpty") });
      return;
    }

    setRecipeSaving(true);
    try {
      await unwrap(useCases.recipes.saveForService(recipeFor.id, items));
      const refreshed = await useCases.recipes.getForService(recipeFor.id);
      if (!refreshed.ok) throw refreshed.error;
      const r = refreshed.data;
      setRecipe(r);
      setDraftLines(
        (r?.items ?? []).map((it, idx) => ({
          key: makeLineKey(idx),
          productId: it.productId,
          quantity: String(it.quantity),
          unit: it.unit ?? "",
          estimatedCost: it.estimatedCost !== undefined ? String(it.estimatedCost) : "",
        })),
      );
      setRecipeErrors({});
      showToast("success", t("Success"), t("recipe.saved"));
    } catch (err: any) {
      if (err?.code === "BACKEND_METHOD_UNSUPPORTED") {
        showToast("error", t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
        showToast("error", t("Error"), mapErrorToMessage(err, t));
      }
    } finally {
      setRecipeSaving(false);
    }
  }

  const recipeMaterialCost = (() => {
    if (!recipe) return null;
    const costById = new Map(products.map((p) => [p.id, p]));
    const plan = planRecipeConsumption(recipe, 1, costById as Map<string, Pick<Product, "id" | "cost">>);
    return plan.estimatedMaterialCost;
  })();

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await unwrap(useCases.services.list());
      setItems(res);
    } catch (e: any) {
      setLoadError(mapErrorToMessage(e, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(
    () => filterServicesForCatalog(items, selectedCategory, q),
    [items, selectedCategory, q],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory("");
    setPrice("");
    setPricingMode("FIXED");
    setDurationMins("30");
    setErrors({});
  }

  async function onSubmit() {
    const nameR = requiredText(name);
    const categoryR = requiredText(category);
    const priceR = positiveNumber(price);
    const durationR = positiveInteger(durationMins);
    const issues = collectIssues([
      { field: "name", result: nameR },
      { field: "category", result: categoryR },
      { field: "price", result: priceR },
      { field: "duration", result: durationR },
    ]);
    if (issues.length > 0) {
      setErrors(issuesToMap(issues));
      return;
    }
    setErrors({});
    setSaving(true);

    const payload = {
      name: (nameR as FieldResult<string> & { ok: true }).value,
      categoryName: (categoryR as FieldResult<string> & { ok: true }).value,
      price: (priceR as FieldResult<number> & { ok: true }).value,
      pricingMode,
      durationMinutes: (durationR as FieldResult<number> & { ok: true }).value,
    };

    try {
      if (isEditing && editingId) {
        await unwrap(useCases.services.update(editingId, payload));
      } else {
        await unwrap(useCases.services.create(payload));
      }
      await reload();
      resetForm();
      setFormOpen(false);
      showToast('success', t("Success"), t("Service saved successfully"));
    } catch (err: any) {
      if (err?.code === "BACKEND_METHOD_UNSUPPORTED") {
        showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
        showToast('error', t("Error"), mapErrorToMessage(err, t));
      }
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  async function onEdit(s: Service) {
    setEditingId(s.id);
    setName(s.name);
    setCategory(s.categoryName ?? s.categoryId);
    setPrice(String(s.price));
    setPricingMode(s.pricingMode);
    setDurationMins(String(s.durationMinutes));
    setErrors({});
    setFormOpen(true);
  }

  /** تعطيل/تفعيل الخدمة — تختفي من نقطة البيع دون حذف سجلها. */
  async function onToggleActive(s: Service) {
    const next = !s.isActive;
    const ok = await confirm({
      title: next ? t("Enable Service") : t("Disable Service"),
      message: next
        ? t("This service will be available in POS again")
        : t("This service will be hidden from POS until re-enabled"),
      type: "status",
    });
    if (!ok) return;
    try {
      await unwrap(useCases.services.update(s.id, { isActive: next }));
      await reload();
      showToast('success', t("Success"), next ? t("Service enabled") : t("Service disabled"));
    } catch (err: any) {
      showToast('error', t("Error"), mapErrorToMessage(err, t));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      <PageHeader
        icon={<Scissors className="h-5 w-5" />}
        title={t("Services")}
        subtitle={t("Manage your spa service catalog")}
        actions={
          <>
            <div className="relative w-full sm:w-56 group">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-border bg-card py-2.5 ps-9 pe-3 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                placeholder={t("Search services...")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              onClick={openCreate}
              className="h-11 shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-3 sm:px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="whitespace-nowrap">{t("Add Service")}</span>
            </button>
            <button
              onClick={reload}
              className="h-11 w-11 shrink-0 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
              aria-label={t("Refresh")}
              title={t("Refresh")}
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </>
        }
      />

      <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/30 px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider truncate">{t("Service Catalog")}</h3>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("Total Services")}:</span>
            <span className="text-xs font-bold text-primary">{items.length}</span>
          </div>
        </div>
        <div className="border-b border-border px-2.5 py-2.5 sm:px-4">
          <ServiceCategoryFilters
            services={items}
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
            allLabel={t("All")}
          />
        </div>
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-start">
                <th>{t("Service")}</th>
                <th>{t("Category")}</th>
                <th>{t("Price")}</th>
                <th>{t("Duration")}</th>
                <th className="w-[150px]">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {filtered.map((s, idx) => (
                  <motion.tr
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={s.id}
                    className="group hover:bg-muted/30 transition-all [&>td]:px-5 [&>td]:py-3 [&>td]:text-start"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                          {getInitials(s.name, "·")}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground text-sm group-hover:text-primary transition-colors truncate">{getDisplayName(s.name, t("Unnamed"))}</div>
                          {s.isActive === false && (
                            <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {t("Disabled")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary border border-primary/10">
                        <Tag className="h-3 w-3" />
                        {s.categoryName ?? s.categoryId}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-base">{formatOMRAmount(s.price)}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                          {s.pricingMode === "STARTING_FROM" ? `${t("Starts from")} · ` : ""}{t("OMR")}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-foreground text-xs">{s.durationMinutes} {t("min")}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => void openRecipe(s)}
                          className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                          aria-label={t("recipe.title")}
                          title={t("recipe.title")}
                        >
                          <Beaker className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onToggleActive(s)}
                          className={clsx(
                            "h-9 w-9 rounded-lg border flex items-center justify-center transition-all",
                            s.isActive === false
                              ? "border-success/30 bg-success/10 text-success hover:bg-success hover:text-white"
                              : "border-border bg-card text-muted-foreground hover:bg-warning/10 hover:text-warning"
                          )}
                          title={s.isActive === false ? t("Enable") : t("Disable")}
                          aria-label={s.isActive === false ? t("Enable") : t("Disable")}
                        >
                          {s.isActive === false ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => onEdit(s)}
                          className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                          aria-label={t("Edit")}
                          title={t("Edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              <ListState
                loading={loading && filtered.length === 0}
                error={loadError}
                empty={filtered.length === 0}
                onRetry={reload}
                loadingTitle={t("Loading services...")}
                errorTitle={t("Failed to load services")}
                emptyTitle={t("No Services Found")}
                emptyDescription={q ? t("Try a different search term") : t("Add your first service to start selling")}
                emptyIcon={<Scissors className="h-5 w-5" />}
                emptyActionLabel={q ? undefined : t("Add Service")}
                onEmptyAction={q ? undefined : openCreate}
                colSpan={5}
                compact
              />
            </tbody>
          </table>
        </div>

        {/* Mobile Cards — compact two-column */}
        <div className="lg:hidden grid grid-cols-2 gap-2.5 p-2.5">
          <AnimatePresence mode="popLayout">
            {filtered.map((s, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.03 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={s.id}
                className="min-w-0 rounded-xl border border-border bg-card p-2.5 shadow-sm flex flex-col gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-bold text-foreground text-xs leading-snug line-clamp-2 break-words">{s.name}</span>
                    {!s.isActive && <span className="text-[9px] font-bold text-destructive shrink-0">{t("Disabled")}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary min-w-0">
                    <Tag className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.categoryName ?? s.categoryId}</span>
                  </div>
                </div>

                <div className="mt-auto border-t border-border pt-1.5 space-y-0.5">
                  <div className="font-bold text-foreground text-sm leading-none">{formatOMRAmount(s.price)}</div>
                  <div className="text-[9px] font-bold text-muted-foreground">
                    {s.pricingMode === "STARTING_FROM" ? `${t("Starts from")} · ` : ""}{t("OMR")}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <Clock className="h-3 w-3 text-primary" />
                    {s.durationMinutes} {t("min")}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-0.5">
                  <button
                    onClick={() => void openRecipe(s)}
                    className="h-9 min-w-0 flex-1 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors"
                    title={t("recipe.title")}
                    aria-label={t("recipe.title")}
                  >
                    <Beaker className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void onToggleActive(s)}
                    className={clsx(
                      "h-9 min-w-0 flex-1 rounded-lg flex items-center justify-center transition-colors",
                      s.isActive ? "text-muted-foreground hover:bg-warning/10 hover:text-warning" : "text-success hover:bg-success/10"
                    )}
                    title={s.isActive ? t("Disable") : t("Enable")}
                    aria-label={s.isActive ? t("Disable") : t("Enable")}
                  >
                    {s.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onEdit(s)}
                    className="h-11 min-w-0 flex-1 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors"
                    aria-label={t("Edit")}
                    title={t("Edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="col-span-2">
            <ListState
              loading={loading && filtered.length === 0}
              error={loadError}
              empty={filtered.length === 0}
              onRetry={reload}
              loadingTitle={t("Loading services...")}
              errorTitle={t("Failed to load services")}
              emptyTitle={t("No Services Found")}
              emptyDescription={q ? t("Try a different search term") : t("Add your first service to start selling")}
              emptyIcon={<Scissors className="h-5 w-5" />}
              emptyActionLabel={q ? undefined : t("Add Service")}
              onEmptyAction={q ? undefined : openCreate}
              compact
            />
          </div>
        </div>
      </div>

      {/* Create / Edit service — closed by default, opens in a shared overlay */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={isEditing ? t("Edit Service") : t("New Service")}
        description={t("Service Details")}
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
              onClick={onSubmit}
              disabled={saving}
              className="h-11 px-4 rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {t("Save Changes")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground">{t("Service Name")}</label>
            <div className="relative">
              <Sparkles className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }}
                placeholder={t("e.g. Swedish Massage")}
              />
            </div>
            {errors.name && <div className="text-xs font-bold text-destructive">{t(errors.name)}</div>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground">{t("Category")}</label>
            <div className="relative">
              <Tag className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                value={category}
                onChange={(e) => { setCategory(e.target.value); if (errors.category) setErrors((p) => ({ ...p, category: "" })); }}
                placeholder={t("e.g. Massage / Nails / Hair")}
              />
            </div>
            {errors.category && <div className="text-xs font-bold text-destructive">{t(errors.category)}</div>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground">{t("Pricing method")}</label>
            <select
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as "FIXED" | "STARTING_FROM")}
            >
              <option value="FIXED">{t("Fixed price")}</option>
              <option value="STARTING_FROM">{t("Starts from")}</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground">
                {pricingMode === "STARTING_FROM" ? t("Minimum price") : t("Price")}
              </label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  inputMode="decimal"
                  aria-label={t("Price")}
                  value={price}
                  onChange={(e) => { setPrice(e.target.value); if (errors.price) setErrors((p) => ({ ...p, price: "" })); }}
                />
              </div>
              {errors.price && <div className="text-xs font-bold text-destructive">{t(errors.price)}</div>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground">{t("Duration (min)")}</label>
              <div className="relative">
                <Clock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  inputMode="numeric"
                  value={durationMins}
                  onChange={(e) => { setDurationMins(e.target.value); if (errors.duration) setErrors((p) => ({ ...p, duration: "" })); }}
                />
              </div>
              {errors.duration && <div className="text-xs font-bold text-destructive">{t(errors.duration)}</div>}
            </div>
          </div>
        </div>
      </Modal>

      {/* Service Recipe (consumables) — server-backed, real products only */}
      <Modal
        isOpen={recipeOpen}
        onClose={closeRecipe}
        title={t("recipe.title")}
        description={recipeFor ? `${recipeFor.name} · ${t("recipe.subtitle")}` : t("recipe.subtitle")}
        size="lg"
        confirmCloseMessage={recipeDirty ? t("Discard unsaved changes?") : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeRecipe}
              className="h-11 px-4 rounded-lg border border-border bg-card font-bold text-foreground hover:bg-muted transition-all"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={saveRecipe}
              disabled={recipeSaving || recipeLoading}
              className="h-11 px-4 rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {t("Save Changes")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {recipeLoading ? (
            <div className="py-10 flex items-center justify-center text-sm font-bold text-muted-foreground">
              {t("Loading services...")}
            </div>
          ) : recipeError ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm font-bold text-destructive">{recipeError}</p>
              <button onClick={() => recipeFor && void openRecipe(recipeFor)} className="text-xs font-bold text-primary underline">
                {t("Retry")}
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                {t("recipe.hint")}
              </p>

              {draftLines.map((line, idx) => {
                const product = products.find((p) => p.id === line.productId);
                return (
                  <div key={line.key} data-recipe-line className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                        <Beaker className="h-3.5 w-3.5 text-primary" />
                        {t("recipe.lineTitle", { n: idx + 1 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraftLines((prev) => prev.filter((l) => l.key !== line.key))}
                        className="h-8 w-8 rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                        aria-label={t("recipe.removeLine")}
                        title={t("recipe.removeLine")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">{t("recipe.product")}</label>
                        <select
                          aria-label={t("recipe.product")}
                          className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={line.productId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, productId: v } : l)));
                            if (recipeErrors[`p-${idx}`]) setRecipeErrors((prev) => { const n = { ...prev }; delete n[`p-${idx}`]; return n; });
                          }}
                        >
                          <option value="">{t("recipe.selectProduct")}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {recipeErrors[`p-${idx}`] && <div className="text-[10px] font-bold text-destructive">{recipeErrors[`p-${idx}`]}</div>}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">{t("recipe.quantity")}</label>
                        <input
                          aria-label={t("recipe.quantity")}
                          className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l)));
                            if (recipeErrors[`q-${idx}`]) setRecipeErrors((prev) => { const n = { ...prev }; delete n[`q-${idx}`]; return n; });
                          }}
                        />
                        {recipeErrors[`q-${idx}`] && <div className="text-[10px] font-bold text-destructive">{recipeErrors[`q-${idx}`]}</div>}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">{t("recipe.unit")}</label>
                        <input
                          aria-label={t("recipe.unit")}
                          className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          value={line.unit}
                          onChange={(e) => setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit: e.target.value } : l)))}
                          placeholder={t("recipe.unitPlaceholder")}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">{t("recipe.estimatedCost")}</label>
                        <input
                          aria-label={t("recipe.estimatedCost")}
                          className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          inputMode="decimal"
                          value={line.estimatedCost}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, estimatedCost: v } : l)));
                            if (recipeErrors[`c-${idx}`]) setRecipeErrors((prev) => { const n = { ...prev }; delete n[`c-${idx}`]; return n; });
                          }}
                        />
                        {recipeErrors[`c-${idx}`] && <div className="text-[10px] font-bold text-destructive">{recipeErrors[`c-${idx}`]}</div>}
                      </div>

                      {product && (
                        <div className="col-span-2 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                          <Boxes className="h-3 w-3" />
                          {t("Stock")}: <span className="text-foreground">{product.stockQuantity}</span>
                          {product.trackInventory === false && (
                            <span className="text-warning">· {t("recipe.untracked")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {recipeErrors.empty && <div className="text-xs font-bold text-destructive">{recipeErrors.empty}</div>}

              <button
                type="button"
                onClick={() => setDraftLines((prev) => [...prev, newBlankLine()])}
                className="w-full h-11 rounded-lg border border-dashed border-border bg-card flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("recipe.addLine")}
              </button>

              {(recipe?.items?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground">{t("recipe.estimatedMaterial")}</span>
                  <span className="text-xs font-bold text-foreground">{formatOMRAmount(recipeMaterialCost ?? 0)} {t("OMR")}</span>
                </div>
              )}

              {consumptions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{t("recipe.recentConsumption")}</p>
                  <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border/60">
                    {consumptions.slice(0, 5).map((con) => {
                      const product = products.find((p) => p.id === con.productId);
                      return (
                        <div key={con.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] font-bold">
                          <span className="text-muted-foreground truncate">{product?.name ?? con.productId.slice(0, 8)}</span>
                          <span className="text-foreground shrink-0">{con.quantity} {con.unit ?? ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
