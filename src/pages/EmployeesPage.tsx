import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { useAuth } from "../auth";
import { 
  Plus, Trash2, Edit, Users, UserPlus, X, Save, 
  CheckCircle2, Briefcase, DollarSign, Percent,
  TrendingUp, Award, Star, Shield, UserCheck,
  ChevronRight, MoreVertical, Wallet, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { Employee } from "../domain/entities";

export default function EmployeesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const { me } = useAuth();
  const isAdmin = me?.role === "ADMIN";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null); // null = hidden, {} = create, {id...} = edit

  async function load() {
    setLoading(true);
    try {
      const res = isAdmin 
        ? await unwrap(useCases.employees.list()) 
        : await unwrap(useCases.employees.list());
      setEmployees(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t("Delete Employee"),
      message: t("Are you sure you want to delete this employee?"),
      type: "danger"
    });
    if (!ok) return;
    await unwrap(useCases.employees.delete(id));
    load();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        baseSalary: Number(form.baseSalary) || 0,
        commissionPercentage: Number(form.commissionPercentage) || 0,
      };
      if (form.id) {
        await unwrap(useCases.employees.update(form.id, payload));
      } else {
        await unwrap(useCases.employees.create(payload));
      }
      setForm(null);
      load();
    } catch (err: any) {
      showToast('error', 'Error', ((err as Error).message || String(err)));
    }
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 group transition-all hover:scale-110">
            <Users className="h-8 w-8 transition-transform group-hover:rotate-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t("Employees")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{t("Manage your team and performance")}</p>
          </div>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setForm({ name: "", role: "STYLIST", baseSalary: 0, commissionPercentage: 0 })}
            className="h-14 w-full sm:w-auto px-8 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <UserPlus className="h-6 w-6" />
            {t("Add Employee")}
          </button>
        )}
      </div>

      <AnimatePresence>
        {form && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setForm(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-2xl rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-6 sm:px-10 py-5 sm:py-8 bg-muted/20">
                <div className="flex items-center gap-5">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    {form.id ? <Edit className="h-6 w-6 sm:h-7 sm:w-7" /> : <Plus className="h-6 w-6 sm:h-7 sm:w-7" />}
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">{form.id ? t("Edit Employee") : t("New Employee")}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Team Member Details")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setForm(null)}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full hover:bg-muted flex items-center justify-center transition-all hover:rotate-90"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Full Name")}</label>
                    <div className="relative">
                      <UserCheck className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        required
                        className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={t("Employee Name")}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Role")}</label>
                    <div className="relative">
                      <Briefcase className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select
                        className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-10 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none shadow-inner"
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                      >
                        <option value="STYLIST">{t("Stylist")}</option>
                        <option value="THERAPIST">{t("Therapist")}</option>
                        <option value="ASSISTANT">{t("Assistant")}</option>
                        <option value="RECEPTIONIST">{t("Receptionist")}</option>
                        <option value="MANAGER">{t("Manager")}</option>
                        <option value="OTHER">{t("Other")}</option>
                      </select>
                    </div>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Base Salary")}</label>
                        <div className="relative">
                          <Wallet className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <input
                            type="number"
                            className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                            value={form.baseSalary}
                            onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Commission (%)")}</label>
                        <div className="relative">
                          <Percent className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <input
                            type="number"
                            className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                            value={form.commissionPercentage}
                            onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  className="group relative w-full h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <CheckCircle2 className="h-6 w-6 relative z-10" />
                  <span className="text-lg relative z-10">{t("Save Employee")}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[1.5rem] sm:rounded-[3rem] border border-border bg-card shadow-2xl"
      >
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[800px] text-sm md:min-w-full">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              <tr className="[&>th]:px-5 sm:[&>th]:px-10 [&>th]:py-4 sm:[&>th]:py-8 [&>th]:text-start">
                <th>{t("Employee")}</th>
                <th>{t("Role")}</th>
                {isAdmin && <th>{t("Base Salary")}</th>}
                {isAdmin && <th>{t("Month Commission")}</th>}
                {isAdmin && <th className="w-[150px]">{t("Actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-10 py-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-6 opacity-40">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-xs font-bold uppercase tracking-[0.2em]">{t("Loading Team...")}</p>
                      </div>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-10 py-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-6 opacity-20">
                        <Users className="h-20 w-20" />
                        <p className="text-xl font-bold uppercase tracking-[0.3em]">{t("No Employees Found")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp, idx) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={emp.id} 
                      className="group hover:bg-muted/30 transition-all [&>td]:px-5 sm:[&>td]:px-10 [&>td]:py-4 sm:[&>td]:py-8 [&>td]:text-start"
                    >
                      <td>
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:scale-110 shadow-inner">
                            {emp.name[0]}
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-foreground text-lg block group-hover:text-primary transition-colors">{emp.name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Staff ID")}: {emp.id.slice(-6).toUpperCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2.5 rounded-2xl bg-muted px-4 py-2 text-xs font-bold text-muted-foreground border border-transparent group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all shadow-sm">
                          <Briefcase className="h-4 w-4" />
                          {emp.role}
                        </div>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-xl">{emp.baseSalary.toFixed(2)}</span>
                              <Wallet className="h-4 w-4 text-muted-foreground opacity-40" />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("OMR Base")}</span>
                          </div>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-600 text-xl">{(emp.monthCommissionTotal ?? 0).toFixed(2)}</span>
                              <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600/50 uppercase tracking-widest">{t("OMR Commission")}</span>
                          </div>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setForm(emp)} 
                              className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                              title={t("Edit")}
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(emp.id)} 
                              className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shadow-sm hover:scale-110 active:scale-95"
                              title={t("Delete")}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden p-4 grid gap-4 grid-cols-1">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-6 opacity-40 py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-xs font-bold uppercase tracking-[0.2em]">{t("Loading Team...")}</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-6 opacity-20">
                <Users className="h-16 w-16" />
                <p className="text-lg font-bold uppercase tracking-[0.2em]">{t("No Employees Found")}</p>
              </div>
            ) : (
              employees.map((emp, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={`m-${emp.id}`}
                  className="bg-card border border-border rounded-[2rem] p-5 shadow-xl flex flex-col gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shadow-inner shrink-0">
                      {emp.name[0]}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                      <span className="font-bold text-foreground text-lg truncate w-full leading-tight">{emp.name}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Staff ID")}: {emp.id.slice(-6).toUpperCase()}</span>
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-2 py-1 mt-1 text-[10px] font-bold text-muted-foreground border border-transparent shadow-sm shrink-0">
                        <Briefcase className="h-3 w-3" />
                        {emp.role}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Base Salary")}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-foreground text-base">{emp.baseSalary.toFixed(2)}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{t("OMR")}</span>
                        </div>
                      </div>
                      <div className="flex flex-col text-end">
                        <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">{t("Commission")}</span>
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-bold text-emerald-600 text-lg">{(emp.monthCommissionTotal ?? 0).toFixed(2)}</span>
                          <span className="text-[8px] font-bold text-emerald-600 uppercase">{t("OMR")}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <button
                        onClick={() => setForm(emp)}
                        className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                      >
                        <Edit className="h-4 w-4" />
                        {t("Edit")}
                      </button>
                      <button
                        onClick={() => void handleDelete(emp.id)}
                        className="h-12 flex-1 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all shadow-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("Delete")}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Performance Highlights (Admin Only) */}
      {isAdmin && employees.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[2.5rem] border border-border bg-card p-8 shadow-xl flex items-center gap-6 group hover:shadow-2xl transition-all"
          >
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Top Performer")}</p>
              <h3 className="text-xl font-bold text-foreground">{employees.reduce((prev, current) => (prev.monthCommissionTotal > current.monthCommissionTotal) ? prev : current).name}</h3>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.1 } }}
            className="rounded-[2.5rem] border border-border bg-card p-8 shadow-xl flex items-center gap-6 group hover:shadow-2xl transition-all"
          >
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Total Team Commission")}</p>
              <h3 className="text-xl font-bold text-foreground">
                {employees.reduce((sum, emp) => sum + (emp.monthCommissionTotal || 0), 0).toFixed(2)} <span className="text-xs">{t("OMR")}</span>
              </h3>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
            className="rounded-[2.5rem] border border-border bg-card p-8 shadow-xl flex items-center gap-6 group hover:shadow-2xl transition-all"
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Star className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Team Size")}</p>
              <h3 className="text-xl font-bold text-foreground">{employees.length} {t("Active Staff")}</h3>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
