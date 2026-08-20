/**
 * SupportOperationsPage — Admin investigation dashboard
 * ------------------------------------------------------------
 * Safe read-only tools for record lookup, audit trail viewing, and
 * support notes. All write/privileged actions require reason capture
 * + confirmation, enforced server-side through has_center_role.
 *
 * MANAGER role: read-only search + audit trail, no action buttons.
 * ADMIN role: full search + audit trail + reason-captured actions.
 */

import { useEffect, useState } from "react";
import { formatLocalizedDate } from "../shared/dateTime";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  Search, Shield, FileText, Users, UserCog,
  Clock, Save,
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { useAuth } from "../auth";
import { useToast } from "../shared/components/Toast";
import { useConfirm } from "../shared/components/ConfirmDialog";
import { ScreenState } from "../shared/components/ScreenState";
import { clsx } from "clsx";

type TabId = "search" | "audit" | "tickets" | "employees";

export default function SupportOperationsPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const { showToast } = useToast();
  const isAdmin = me?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<TabId>("search");
  const [centerId, setCenterId] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Resolve active center
  useEffect(() => {
    try {
      const cid = useCases.tenant.getActiveCenterId();
      if (cid) setCenterId(cid);
    } catch {
      showToast("error", t("Error"), t("Could not resolve active center"));
    }
  }, []);

  // Reset load errors
  function resetError() { setLoadError(null); }

  if (loadError) {
    return (
      <ScreenState
        state="error"
        title={t("Failed to load support tools")}
        description={loadError}
        actionLabel={t("Retry")}
        onAction={() => setLoadError(null)}
      />
    );
  }

  if (!centerId) {
    return <ScreenState state="loading" title={t("Loading...")} />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Shield className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("Support Operations")}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? t("Record lookup, audit trail, and administrative actions")
              : t("Read-only record lookup and audit trail")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto" role="tablist">
        {[
          { id: "search" as TabId, label: t("Global Search"), icon: Search },
          { id: "audit" as TabId, label: t("Audit Trail"), icon: Clock },
          { id: "tickets" as TabId, label: t("Support Tickets"), icon: FileText },
          { id: "employees" as TabId, label: t("Employee Management"), icon: UserCog },
        ].map((tab) => (
          <button type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-bold transition-all",
              activeTab === tab.id
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "search" && <GlobalSearchTab centerId={centerId} isAdmin={isAdmin} />}
        {activeTab === "audit" && <AuditTrailTab centerId={centerId} isAdmin={isAdmin} />}
        {activeTab === "tickets" && <SupportTicketsTab centerId={centerId} />}
        {activeTab === "employees" && <EmployeeManagementTab centerId={centerId} isAdmin={isAdmin} />}
      </motion.div>
    </div>
  );
}

/* ==================================================================== *
 *  GLOBAL SEARCH TAB
 * ==================================================================== */
function GlobalSearchTab({ centerId, isAdmin }: Readonly<{ centerId: string; isAdmin: boolean }>) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ customers: any[]; employees: any[]; invoices: any[] } | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await useCases.admin.search(centerId, query.trim());
      if (res.ok) setResults(res.data);
      else setResults(null);
    } catch {
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t("Search by customer name, phone, invoice serial, or employee name")}
            className="w-full rounded-xl border border-border bg-card ps-10 pe-4 py-3 font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label={t("Global search query")}
          />
        </div>
        <button type="button"
          onClick={handleSearch}
          disabled={searching || query.trim().length < 2}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:bg-primary/90 transition-all"
        >
          {searching ? t("Searching...") : t("Search")}
        </button>
      </div>

      {/* Results */}
      {searched && !searching && results && (
        <div className="grid xl:grid-cols-3 gap-6">
          {/* Customers */}
          <SectionCard title={t("Customers")} icon={Users} count={results.customers.length}>
            {results.customers.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">{t("No customers found")}</p>
            ) : (
              results.customers.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 border-b border-border/60 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-foreground">{c.name}</p>
                    {c.phone && <p className="text-xs text-muted-foreground mt-0.5">{c.phone}</p>}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    {t("Customer")}
                  </span>
                </div>
              ))
            )}
          </SectionCard>

          {/* Employees */}
          <SectionCard title={t("Employees")} icon={UserCog} count={results.employees.length}>
            {results.employees.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">{t("No employees found")}</p>
            ) : (
              results.employees.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-3 border-b border-border/60 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-foreground">{e.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.role}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    {t("Employee")}
                  </span>
                </div>
              ))
            )}
          </SectionCard>

          {/* Invoices */}
          <SectionCard title={t("Invoices")} icon={FileText} count={results.invoices.length}>
            {results.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">{t("No invoices found")}</p>
            ) : (
              results.invoices.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between p-3 border-b border-border/60 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-foreground">{i.serial ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatLocalizedDate(i.date, i18n.language)} · {Number(i.total).toFixed(3)} OMR
                    </p>
                  </div>
                  <span className={clsx(
                    "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-bold",
                    i.status === "PAID" ? "text-success bg-success/10" : "text-muted-foreground bg-muted/50",
                  )}>
                    {i.status}
                  </span>
                </div>
              ))
            )}
          </SectionCard>
        </div>
      )}

      {searched && !searching && !results && (
        <div className="text-center py-12">
          <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("No results found. Try a different search term.")}</p>
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 *  AUDIT TRAIL TAB
 * ==================================================================== */

/** Action → color mapping for the audit table (outer scope). */
function actionColor(action: string): string {
  if (action.includes("deactivate")) return "text-destructive";
  if (action.includes("reactivate")) return "text-success";
  if (action.includes("void")) return "text-warning";
  return "text-info";
}
function AuditTrailTab({ centerId, isAdmin }: Readonly<{ centerId: string; isAdmin: boolean }>) {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [targetFilter, setTargetFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  async function loadAudit() {
    setLoading(true);
    try {
      const res = await useCases.admin.listAuditEvents(centerId, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: actionFilter || undefined,
        targetType: targetFilter || undefined,
      });
      if (res.ok) {
        setEvents(res.data.events);
        setTotal(res.data.total);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAudit(); }, [centerId, page]);

  function handleFilter() {
    setPage(0);
    void loadAudit();
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
          aria-label={t("Filter by action")}
        >
          <option value="">{t("All actions")}</option>
          <option value="employee_deactivate">{t("Employee deactivation")}</option>
          <option value="employee_reactivate">{t("Employee reactivation")}</option>
          <option value="support_note_added">{t("Support notes")}</option>
        </select>
        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
          aria-label={t("Filter by target type")}
        >
          <option value="">{t("All targets")}</option>
          <option value="employee">{t("Employee")}</option>
          <option value="customer">{t("Customer")}</option>
          <option value="invoice">{t("Invoice")}</option>
        </select>
        <button type="button"
          onClick={handleFilter}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:bg-primary/90 transition-all"
        >
          {t("Apply Filters")}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Date")}</th>
                <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Action")}</th>
                <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Target")}</th>
                <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Actor")}</th>
                <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Reason")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("Loading...")}</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("No audit events found")}</td></tr>
              ) : (
                events.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString(i18n.language === "ar" ? "ar-OM" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("text-xs font-bold", actionColor(e.action))}>{e.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {e.targetSummary ?? e.targetType}
                      {e.targetId && <span className="text-muted-foreground ms-1">({e.targetId.slice(0, 8)}…)</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{e.actorName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {e.reason || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t("Showing")} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} {t("of")} {total}</p>
          <div className="flex gap-2">
            <button type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-bold disabled:opacity-40 hover:bg-muted/30 transition-all"
            >
              {t("Previous")}
            </button>
            <button type="button"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-bold disabled:opacity-40 hover:bg-muted/30 transition-all"
            >
              {t("Next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 *  SUPPORT TICKETS TAB (read-only tracking for ADMIN/MANAGER)
 * ==================================================================== */
function SupportTicketsTab({ centerId }: Readonly<{ centerId: string }>) {
  const { t, i18n } = useTranslation();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadTickets() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await useCases.help.listTickets();
      if (res.ok) setTickets(res.data);
      else setLoadError(res.error.message);
    } catch (e: any) {
      setLoadError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTickets(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("Tickets submitted by center members appear here. High-urgency items are shown first.")}
        </p>
        <button type="button" onClick={() => void loadTickets()}
          className="px-4 py-2 rounded-lg border border-border text-sm font-bold hover:bg-muted/30 transition-all touch-target">
          {t("Refresh")}
        </button>
      </div>

      {loadError ? (
        <ScreenState state="error" title={t("Failed to load tickets")} description={loadError}
          actionLabel={t("Retry")} onAction={() => void loadTickets()} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("Loading...")}</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("No support tickets yet")}</p>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
          {tickets.map((tk: any) => (
            <div key={tk.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={clsx(
                    "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold shrink-0",
                    tk.urgency === "high" ? "text-destructive bg-destructive/10"
                      : tk.urgency === "low" ? "text-muted-foreground bg-muted/50"
                      : "text-info bg-info/10",
                  )}>
                    {tk.urgency}
                  </span>
                  <span className={clsx(
                    "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold shrink-0",
                    tk.status === "RESOLVED" ? "text-success bg-success/10" : "text-warning bg-warning/10",
                  )}>
                    {tk.status}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(tk.createdAt).toLocaleString(i18n.language === "ar" ? "ar-OM" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">{tk.expectedBehavior || tk.actualBehavior}</p>
              {tk.route && <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{tk.route}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 *  EMPLOYEE MANAGEMENT TAB (safe deactivation/reactivation with reason)
 * ==================================================================== */
function EmployeeManagementTab({ centerId, isAdmin }: Readonly<{ centerId: string; isAdmin: boolean }>) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await useCases.employees.list();
      if (res.ok) setEmployees(res.data);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleDeactivate(emp: any) {
    const ok = await confirm({
      title: t("Deactivate Employee"),
      message: `${t("Deactivate")} "${emp.name}"? ${t("This will hide them from appointment and POS selection. History is preserved.")}`,
      type: "danger",
      confirmText: t("Continue"),
    });
    if (!ok) return;
    setShowReasonInput(emp.id);
    setReason("");
  }

  async function confirmDeactivate(empId: string) {
    if (reason.trim().length < 10) {
      showToast("error", t("Validation"), t("Reason must be at least 10 characters"));
      return;
    }
    try {
      const res = await useCases.admin.deactivateEmployee(centerId, empId, reason.trim());
      if (res.ok) {
        showToast("success", t("Success"), `${t("Employee deactivated")}: ${res.data.name}`);
        setShowReasonInput(null);
        setReason("");
        await load();
      } else {
        showToast("error", t("Error"), res.error.message);
      }
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }

  async function handleReactivate(emp: any) {
    const ok = await confirm({
      title: t("Reactivate Employee"),
      message: `${t("Reactivate")} "${emp.name}"? ${t("This will restore their access to appointments and POS.")}`,
      type: "status",
      confirmText: t("Continue"),
    });
    if (!ok) return;
    setShowReasonInput(emp.id);
    setReason("");
  }

  async function confirmReactivate(empId: string) {
    if (reason.trim().length < 10) {
      showToast("error", t("Validation"), t("Reason must be at least 10 characters"));
      return;
    }
    try {
      const res = await useCases.admin.reactivateEmployee(centerId, empId, reason.trim());
      if (res.ok) {
        showToast("success", t("Success"), `${t("Employee reactivated")}: ${res.data.name}`);
        setShowReasonInput(null);
        setReason("");
        await load();
      } else {
        showToast("error", t("Error"), res.error.message);
      }
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }

  if (!isAdmin) {
    return (
      <ScreenState
        state="error"
        title={t("Restricted")}
        description={t("Employee management is available to administrators only.")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("Deactivate or reactivate employee records with a mandatory reason for the audit trail.")}
      </p>
      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("Loading...")}</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("No employees found")}</p>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-foreground">{emp.name}</p>
                    <EmployeeStatusBadge isActive={emp.isActive} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{emp.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  {emp.isActive ? (
                    <button type="button"
                      onClick={() => handleDeactivate(emp)}
                      className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-all"
                    >
                      {t("Deactivate")}
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => handleReactivate(emp)}
                      className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-bold hover:bg-success/20 transition-all"
                    >
                      {t("Reactivate")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline reason input */}
      {showReasonInput && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <p className="text-sm font-bold text-foreground">{t("Reason for this action")}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("Enter a reason (minimum 10 characters)")}
            rows={3}
            className="w-full rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex justify-end gap-2">
            <button type="button"
              onClick={() => setShowReasonInput(null)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-bold hover:bg-muted/30 transition-all"
            >
              {t("Cancel")}
            </button>
            <button type="button"
              onClick={() => {
                const emp = employees.find((e) => e.id === showReasonInput);
                if (emp?.isActive) confirmDeactivate(showReasonInput);
                else confirmReactivate(showReasonInput);
              }}
              disabled={reason.trim().length < 10}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all"
            >
              <Save className="h-4 w-4 inline-block me-1" />
              {t("Confirm & Save")}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ==================================================================== *
 *  SHARED SECTION CARD
 * ==================================================================== */
function SectionCard({ title, icon: Icon, count, children }: Readonly<{ title: string; icon: any; count: number; children: React.ReactNode }>) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}


/** Small status badge for employee active state. */
function EmployeeStatusBadge({ isActive }: Readonly<{ isActive: boolean }>) {
  const { t } = useTranslation();
  const active = isActive;
  const badgeClass = active
    ? "text-success bg-success/10"
    : "text-muted-foreground bg-muted/50";
  return (
    <span className={clsx(
      "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold",
      badgeClass,
    )}>
      {active ? t("Active") : t("Inactive")}
    </span>
  );
}
