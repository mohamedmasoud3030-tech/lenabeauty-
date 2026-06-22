import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, Pencil, Trash2, RefreshCw, Scissors, Search, 
  Save, X, CheckCircle2, Clock, Tag, DollarSign,
  Layers, Sparkles, Zap, ChevronRight, MoreVertical,
  TrendingUp, Star, LayoutGrid
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";

import { Service } from "../domain/entities";

export default function ServicesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("0");
  const [durationMins, setDurationMins] = useState("30");

  const isEditing = !!editingId;

  async function reload() {
    setLoading(true);
    try {
      const res = await unwrap(useCases.services.list());
      setItems(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return items;
    return items.filter((s: Service) => (s.name + " " + s.categoryId).toLowerCase().includes(text));
  }, [items, q]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory("");
    setPrice("0");
    setDurationMins("30");
  }

  async function onSubmit() {
    const payload = {
      name,
      categoryId: category,
      price: Number(price),
      durationMinutes: Math.max(1, Math.floor(Number(durationMins))),
    };

    if (!payload.name.trim() || !payload.categoryId.trim()) return;

    try {
      if (isEditing && editingId) {
        await unwrap(useCases.services.update(editingId, payload));
      } else {
        await unwrap(useCases.services.create(payload));
      }

      await reload();
      resetForm();
      showToast('success', t("Success"), t("Service saved successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', 'Error', err?.message || String(err));
      }
    }
  }

  async function onEdit(s: Service) {
    setEditingId(s.id);
    setName(s.name);
    setCategory(s.categoryId);
    setPrice(String(s.price));
    setDurationMins(String(s.durationMinutes));
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: t("Delete Service"),
      message: t("Are you sure you want to delete this service?"),
      type: "danger"
    });
    if (!ok) return;
    try {
      await unwrap(useCases.services.delete(id));
      await reload();
      showToast('success', t("Success"), t("Service deleted successfully"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', 'Error', err?.message || String(err));
      }
    }
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <Scissors className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t("Services")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Manage your spa service catalog")}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80 group font">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              className="w-full rounded-[1.5rem] border border-border bg-card py-4 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
              placeholder={t("Search services...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            onClick={reload}
            className="h-14 w-14 rounded-[1.5rem] border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110 active:scale-95"
          >
            <RefreshCw className={clsx("h-6 w-6", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:gap-10 lg:grid-cols-[450px_1fr]">
        {/* Form Section */}
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
              <div className="space-y-0.5">
                <h2 className="text-2xl font-bold text-foreground">{isEditing ? t("Edit Service") : t("New Service")}</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Service Details")}</p>
              </div>
            </div>
            {isEditing && (
              <button 
                onClick={resetForm} 
                className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center transition-all hover:rotate-90"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Service Name")}</label>
              <div className="relative">
                <Sparkles className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("e.g. Swedish Massage")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Category")}</label>
              <div className="relative">
                <Tag className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t("e.g. Massage / Nails / Hair")}
                />
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Price")}</label>
                <div className="relative">
                   <DollarSign className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Duration (min)")}</label>
                <div className="relative">
                  <Clock className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                    inputMode="numeric"
                    value={durationMins}
                    onChange={(e) => setDurationMins(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={onSubmit}
              className="group relative w-full h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {isEditing ? <Save className="h-6 w-6 relative z-10" /> : <CheckCircle2 className="h-6 w-6 relative z-10" />}
              <span className="text-lg relative z-10">{isEditing ? t("Save Changes") : t("Add Service")}</span>
            </button>
          </div>
        </motion.div>

        {/* Catalog Section */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="overflow-hidden rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl"
        >
          <div className="border-b border-border bg-muted/30 px-6 sm:px-10 py-5 sm:py-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">{t("Service Catalog")}</h3>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background border border-border shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Total Services")}:</span>
              <span className="text-xs font-bold text-primary">{items.length}</span>
            </div>
          </div>
          <div className="hidden lg:block overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[700px] text-sm md:min-w-full">
              <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
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
                      className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start"
                    >
                      <td>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-inner">
                            {s.name[0]}
                          </div>
                          <div className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{s.name}</div>
                        </div>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2.5 rounded-2xl bg-primary/5 px-4 py-2 text-xs font-bold text-primary border border-primary/10 shadow-sm">
                          <Tag className="h-3.5 w-3.5" />
                          {s.categoryId}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-xl">{s.price.toFixed(2)}</span>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3 text-muted-foreground font-medium bg-muted/50 px-4 py-2 rounded-xl w-fit">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="font-bold text-foreground">{s.durationMinutes} {t("min")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => onEdit(s)} 
                            className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                            title={t("Edit")}
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => onDelete(s.id)} 
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
                        <Scissors className="h-20 w-20" />
                        <p className="text-xl font-bold uppercase tracking-[0.3em]">{t("No Services Found")}</p>
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
              {filtered.map((s, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={s.id}
                  className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shadow-inner shrink-0">
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="font-bold text-foreground text-lg truncate">{s.name}</span>
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-primary/5 px-2 py-1 mt-1 text-[10px] font-bold text-primary border border-primary/10 w-fit shrink-0 truncate">
                        <Tag className="h-3 w-3" />
                        {s.categoryId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-xl">{s.price.toFixed(2)}</span>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-xl shadow-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-bold text-foreground text-sm">{s.durationMinutes} {t("min")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => onEdit(s)}
                      className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                    >
                      <Pencil className="h-5 w-5" />
                      {t("Edit")}
                    </button>
                    <button
                      onClick={() => void onDelete(s.id)}
                      className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all shadow-sm"
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
                 <Scissors className="h-16 w-16" />
                 <p className="text-lg font-bold uppercase tracking-[0.2em]">{t("No Services Found")}</p>
               </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
