import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { Modal } from "../shared/components/Modal";
import { getDisplayName, getInitials } from "../shared/displayName";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { useAuth } from "../auth";
import {
  Plus, Edit, Users, UserPlus, Save,
  Briefcase, Percent,
  TrendingUp, Award, Star, UserCheck, UserX, Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { ListState } from "../shared/components/ListState";
import { Employee } from "../domain/entities";
import { requiredText, nonNegativeNumber, percentField, collectIssues, issuesToMap } from "../domain/validation";
import { formatOMRAmount } from "../shared/money";

export default function EmployeesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  const { me } = useAuth();
  const isAdmin = me?.role === "ADMIN";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null); // null = hidden, {} = create, {id...} = edit
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await unwrap(useCases.employees.list());
      setEmployees(res);
    } catch (e: any) {
      setLoadError(mapErrorToMessage(e, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleToggleActive(employee: Employee) {
    const nextActive = !employee.isActive;
    if (!nextActive) {
      const ok = await confirm({
        title: t("Deactivate Employee"),
        message: t("Deactivate this employee without deleting payroll or attendance history?"),
        type: "status",
      });
      if (!ok) return;
    }
    try {
      await unwrap(useCases.employees.update(employee.id, { isActive: nextActive }));
      showToast("success", t("Success"), nextActive ? t("Employee activated") : t("Employee deactivated"));
      await load();
    } catch (e) {
      showToast("error", t("Error"), mapErrorToMessage(e, t));
    }
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    const nameR = requiredText(form?.name);
    const salaryR = nonNegativeNumber(form?.baseSalary);
    const commissionR = percentField(form?.commissionPercentage);
    const issues = collectIssues([
      { field: "name", result: nameR },
      { field: "baseSalary", result: salaryR },
      { field: "commission", result: commissionR },
    ]);
    if (issues.length > 0) {
      setErrors(issuesToMap(issues));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: (nameR as { ok: true; value: string }).value,
        baseSalary: (salaryR as { ok: true; value: number }).value,
        commissionPercentage: (commissionR as { ok: true; value: number }).value,
      };
      if (form.id) {
        await unwrap(useCases.employees.update(form.id, payload));
      } else {
        await unwrap(useCases.employees.create(payload));
      }
      setForm(null);
      setErrors({});
      showToast("success", t("Success"), t("Employee saved successfully"));
      load();
    } catch (err: any) {
      // Keep the form open so the user can recover; values are preserved.
      showToast("error", t("Error"), mapErrorToMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setForm({ name: "", role: "STYLIST", baseSalary: 0, commissionPercentage: 0 });
    setErrors({});
  }

  const formDirty = (form?.name ?? "").trim().length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">{t("Employees")}</h1>
            <p className="text-[11px] text-muted-foreground truncate">{t("Manage your team and performance")}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="h-11 shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            {t("Add Employee")}
          </button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm"
      >
        <div className="hidden lg:block overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-start">
                <th>{t("Employee")}</th>
                <th>{t("Role")}</th>
                {isAdmin && <th>{t("Base Salary")}</th>}
                {isAdmin && <th>{t("Month Commission")}</th>}
                {isAdmin && <th className="w-[150px]">{t("Actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                <ListState
                  loading={loading}
                  error={loadError}
                  empty={employees.length === 0}
                  onRetry={load}
                  loadingTitle={t("Loading Team...")}
                  emptyTitle={t("No Employees Found")}
                  emptyDescription={t("Add your first team member")}
                  emptyIcon={<Users className="h-5 w-5" />}
                  emptyActionLabel={isAdmin ? t("Add Employee") : undefined}
                  onEmptyAction={isAdmin ? openCreate : undefined}
                  colSpan={5}
                  compact
                />
                {employees.length > 0 && employees.map((emp, idx) => (
                  <motion.tr
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={emp.id}
                    className="group hover:bg-muted/30 transition-all [&>td]:px-5 [&>td]:py-3 [&>td]:text-start"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                          {getInitials(emp, "·")}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-foreground text-sm block group-hover:text-primary transition-colors truncate">{getDisplayName(emp, t("Unnamed"))}</span>
                          {!emp.isActive && <span className="text-[9px] font-bold text-destructive uppercase">{t("Disabled")}</span>}
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("Staff ID")}: {emp.id.slice(-6).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        {emp.role}
                      </div>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-base">{formatOMRAmount(emp.baseSalary)}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{t("OMR Base")}</span>
                        </div>
                      </td>
                    )}
                    {isAdmin && (
                      <td>
                        <div className="flex flex-col">
                          <span className="font-bold text-success text-base">{formatOMRAmount(emp.monthCommissionTotal ?? 0)}</span>
                          <span className="text-[9px] font-bold text-success/70 uppercase tracking-wider">{t("OMR Commission")}</span>
                        </div>
                      </td>
                    )}
                    {isAdmin && (
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setForm(emp); setErrors({}); }}
                            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                            aria-label={t("Edit")}
                            title={t("Edit")}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void handleToggleActive(emp)}
                            className={clsx(
                              "h-9 w-9 rounded-lg border bg-card flex items-center justify-center transition-all",
                              emp.isActive
                                ? "border-border text-muted-foreground hover:bg-warning/10 hover:text-warning"
                                : "border-success/30 text-success hover:bg-success/10",
                            )}
                            aria-label={emp.isActive ? t("Deactivate") : t("Activate")}
                            title={emp.isActive ? t("Deactivate") : t("Activate")}
                          >
                            {emp.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile Cards — compact single column (detailed operational rows) */}
        <div className="lg:hidden p-2.5 grid gap-2.5 grid-cols-1">
          <AnimatePresence mode="popLayout">
            <ListState
              loading={loading}
              error={loadError}
              empty={employees.length === 0}
              onRetry={load}
              loadingTitle={t("Loading Team...")}
              emptyTitle={t("No Employees Found")}
              emptyDescription={t("Add your first team member")}
              emptyIcon={<Users className="h-5 w-5" />}
              emptyActionLabel={isAdmin ? t("Add Employee") : undefined}
              onEmptyAction={isAdmin ? openCreate : undefined}
              compact
            />
            {employees.length > 0 && employees.map((emp, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={`m-${emp.id}`}
                className="bg-card border border-border rounded-xl p-3 shadow-sm flex flex-col gap-2.5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shrink-0">
                    {getInitials(emp, "·")}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                    <span className="font-bold text-foreground text-sm truncate w-full leading-tight">{getDisplayName(emp, t("Unnamed"))}</span>
                    {!emp.isActive && <span className="text-[9px] font-bold text-destructive uppercase">{t("Disabled")}</span>}
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("Staff ID")}: {emp.id.slice(-6).toUpperCase()}</span>
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-0.5 mt-0.5 text-[10px] font-bold text-muted-foreground">
                      <Briefcase className="h-3 w-3" />
                      {emp.role}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{t("Base Salary")}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-foreground text-sm">{formatOMRAmount(emp.baseSalary)}</span>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{t("OMR")}</span>
                      </div>
                    </div>
                    <div className="flex flex-col text-end">
                      <span className="text-[9px] font-bold text-success/70 uppercase tracking-wider">{t("Commission")}</span>
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="font-bold text-success text-sm">{formatOMRAmount(emp.monthCommissionTotal ?? 0)}</span>
                        <span className="text-[8px] font-bold text-success uppercase">{t("OMR")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                    <button
                      onClick={() => { setForm(emp); setErrors({}); }}
                      className="h-11 flex-1 rounded-lg border border-border bg-card flex items-center justify-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                    >
                      <Edit className="h-4 w-4" />
                      {t("Edit")}
                    </button>
                    <button
                      onClick={() => void handleToggleActive(emp)}
                      className={clsx(
                        "h-9 flex-1 rounded-lg border bg-card flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all",
                        emp.isActive
                          ? "border-border text-muted-foreground hover:bg-warning/10 hover:text-warning"
                          : "border-success/30 text-success hover:bg-success/10",
                      )}
                    >
                      {emp.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      {emp.isActive ? t("Deactivate") : t("Activate")}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Performance Highlights (Admin Only) */}
      {isAdmin && employees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center text-warning shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{t("Top Performer")}</p>
              <h3 className="text-sm font-bold text-foreground truncate">{getDisplayName(employees.reduce((prev, current) => ((prev.monthCommissionTotal ?? 0) > (current.monthCommissionTotal ?? 0)) ? prev : current), t("Unnamed"))}</h3>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center text-success shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{t("Total Team Commission")}</p>
              <h3 className="text-sm font-bold text-foreground">
                {formatOMRAmount(employees.reduce((sum, emp) => sum + (emp.monthCommissionTotal || 0), 0))} <span className="text-[10px]">{t("OMR")}</span>
              </h3>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Star className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{t("Team Size")}</p>
              <h3 className="text-sm font-bold text-foreground">{employees.filter((employee) => employee.isActive).length} {t("Active Staff")}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit employee — portaled overlay above all app chrome */}
      <Modal
        isOpen={!!form}
        onClose={() => { setForm(null); setErrors({}); }}
        title={form?.id ? t("Edit Employee") : t("New Employee")}
        description={t("Team Member Details")}
        size="lg"
        confirmCloseMessage={formDirty ? t("Discard unsaved changes?") : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setForm(null); setErrors({}); }}
              className="h-11 px-4 rounded-lg border border-border bg-card font-bold text-foreground hover:bg-muted transition-all"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-11 px-4 rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {t("Save Employee")}
            </button>
          </div>
        }
      >
        {form && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">{t("Full Name")}</label>
                <div className="relative">
                  <UserCheck className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    required
                    className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                    value={form.name ?? ""}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }}
                    placeholder={t("Employee Name")}
                  />
                </div>
                {errors.name && <div className="text-xs font-bold text-destructive">{t(errors.name)}</div>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">{t("Role")}</label>
                <div className="relative">
                  <Briefcase className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                    value={form.role ?? "STYLIST"}
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
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">{t("Base Salary")}</label>
                    <div className="relative">
                      <Wallet className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                        value={form.baseSalary ?? 0}
                        onChange={(e) => { setForm({ ...form, baseSalary: e.target.value }); if (errors.baseSalary) setErrors((p) => ({ ...p, baseSalary: "" })); }}
                      />
                    </div>
                    {errors.baseSalary && <div className="text-xs font-bold text-destructive">{t(errors.baseSalary)}</div>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">{t("Commission (%)")}</label>
                    <div className="relative">
                      <Percent className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full rounded-lg border border-border bg-muted/30 ps-9 pe-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                        value={form.commissionPercentage ?? 0}
                        onChange={(e) => { setForm({ ...form, commissionPercentage: e.target.value }); if (errors.commission) setErrors((p) => ({ ...p, commission: "" })); }}
                      />
                    </div>
                    {errors.commission && <div className="text-xs font-bold text-destructive">{t(errors.commission)}</div>}
                  </div>
                </>
              )}
            </div>
            {/* Allow Enter to submit from inside the modal body form. */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        )}
      </Modal>
    </div>
  );
}
