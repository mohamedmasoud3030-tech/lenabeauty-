import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, Save } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PageHeader } from "../shared/components/PageHeader";
import { ListState } from "../shared/components/ListState";
import { Modal } from "../shared/components/Modal";
import { formatOMRAmount } from "../shared/money";
import type { PnlData } from "../application/dto";

const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const ACCOUNTS = ["Cash", "Bank", "Sales", "Expense", "Payroll", "Inventory", "Owner"] as const;
const ENTRY_TYPES = ["ADJUSTMENT", "SALE", "EXPENSE", "PAYROLL", "TRANSFER"] as const;

function defaultsForType(type: (typeof ENTRY_TYPES)[number]): { debit: string; credit: string } {
  if (type === "SALE") return { debit: "Cash", credit: "Sales" };
  if (type === "EXPENSE") return { debit: "Expense", credit: "Cash" };
  if (type === "PAYROLL") return { debit: "Payroll", credit: "Cash" };
  if (type === "TRANSFER") return { debit: "Bank", credit: "Cash" };
  return { debit: "Cash", credit: "Sales" };
}

export default function AccountingPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState<(typeof ENTRY_TYPES)[number]>("ADJUSTMENT");
  const [debit, setDebit] = useState("Cash");
  const [credit, setCredit] = useState("Sales");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [journal, month] = await Promise.all([
        unwrap(useCases.accounting.listJournalEntries()),
        useCases.dashboard.getPnlMonth().then((result) => (result.ok ? result.data : null)).catch(() => null),
      ]);
      setEntries(journal);
      setPnl(month);
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function resetForm() {
    setDescription("");
    setAmount("");
    setEntryType("ADJUSTMENT");
    setDebit("Cash");
    setCredit("Sales");
    setEntryDate(new Date().toISOString().slice(0, 10));
  }

  async function save() {
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      showToast("error", t("Error"), t("Please fill all required fields"));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await unwrap(useCases.accounting.createJournalEntry({
        description: description.trim(),
        amount: value,
        debitAccount: debit,
        creditAccount: credit,
        entryType,
        entryDateISO: entryDate,
      }));
      resetForm();
      setOpen(false);
      showToast("success", t("Success"), t("Journal entry saved successfully"));
      await load();
    } catch (error) {
      showToast("error", t("Error"), formatError(error) || t("Could not save journal entry. Please check your input and try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        icon={<BookOpen className="h-7 w-7" />}
        title={t("Accounting")}
        actions={
          <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-xl bg-primary font-bold text-primary-foreground flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            {t("Add journal entry")}
          </button>
        }
      />

      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t("Journal is for manual entries. Sales and expenses this month come from recorded operations — they are not posted here automatically.")}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("From recorded sales")}</p>
          <p className="mt-2 text-2xl font-bold">{formatOMRAmount(pnl?.revenue)} <span className="text-xs text-muted-foreground">{t("OMR")}</span></p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("From recorded expenses")}</p>
          <p className="mt-2 text-2xl font-bold">{formatOMRAmount(pnl?.expenses)} <span className="text-xs text-muted-foreground">{t("OMR")}</span></p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("Journal entries")}</p>
          <p className="mt-2 text-2xl font-bold">{entries.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-start">
                <th>{t("Date")}</th>
                <th>{t("Entry type")}</th>
                <th>{t("Description")}</th>
                <th>{t("Debit account")}</th>
                <th>{t("Credit account")}</th>
                <th>{t("Amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {entries.map((entry) => (
                <tr key={entry.id} className="[&>td]:px-5 [&>td]:py-3 [&>td]:text-start">
                  <td>{new Date(entry.entryDate).toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US")}</td>
                  <td>{t(entry.entryType === "SALE" ? "Sale" : entry.entryType === "EXPENSE" ? "Expense" : entry.entryType === "PAYROLL" ? "Payroll" : entry.entryType === "TRANSFER" ? "Transfer" : "Adjustment")}</td>
                  <td className="font-bold">{entry.description}</td>
                  <td>{t(entry.debitAccount)}</td>
                  <td>{t(entry.creditAccount)}</td>
                  <td className="font-bold">{formatOMRAmount(entry.amount)}</td>
                </tr>
              ))}
              <ListState loading={loading && entries.length === 0} error={loadError} empty={entries.length === 0} onRetry={() => void load()} loadingTitle={t("Loading journal...")} errorTitle={t("Failed to load journal")} emptyTitle={t("No journal entries")} emptyDescription={t("Record the first adjustment")} emptyIcon={<BookOpen className="h-6 w-6" />} colSpan={6} compact />
            </tbody>
          </table>
        </div>
        <div className="lg:hidden p-4 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border p-3 space-y-1">
              <p className="font-bold">{entry.description}</p>
              <p className="text-xs text-muted-foreground">{new Date(entry.entryDate).toLocaleDateString(i18n.language === "ar" ? "ar-OM" : "en-US")} · {t(entry.debitAccount)} → {t(entry.creditAccount)}</p>
              <p className="font-bold">{formatOMRAmount(entry.amount)} {t("OMR")}</p>
            </div>
          ))}
          <ListState loading={loading && entries.length === 0} error={loadError} empty={entries.length === 0} onRetry={() => void load()} loadingTitle={t("Loading journal...")} errorTitle={t("Failed to load journal")} emptyTitle={t("No journal entries")} emptyDescription={t("Record the first adjustment")} emptyIcon={<BookOpen className="h-6 w-6" />} compact />
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={() => { setOpen(false); resetForm(); }}
        title={t("Add journal entry")}
        size="md"
        footer={
          <button type="button" onClick={() => void save()} disabled={saving} className="w-full min-h-11 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? t("Processing...") : t("Save Journal Entry")}
          </button>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("Entry type")}</span>
            <select className={fieldClass} value={entryType} onChange={(event) => {
              const next = event.target.value as (typeof ENTRY_TYPES)[number];
              setEntryType(next);
              const accounts = defaultsForType(next);
              setDebit(accounts.debit);
              setCredit(accounts.credit);
            }}>
              {ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>{t(type === "SALE" ? "Sale" : type === "EXPENSE" ? "Expense" : type === "PAYROLL" ? "Payroll" : type === "TRANSFER" ? "Transfer" : "Adjustment")}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("Description")}</span>
            <input className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{t("Debit account")}</span>
              <select className={fieldClass} value={debit} onChange={(event) => setDebit(event.target.value)}>
                {ACCOUNTS.map((account) => <option key={account} value={account}>{t(account)}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{t("Credit account")}</span>
              <select className={fieldClass} value={credit} onChange={(event) => setCredit(event.target.value)}>
                {ACCOUNTS.map((account) => <option key={account} value={account}>{t(account)}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{t("Amount")}</span>
              <input className={fieldClass} type="number" min="0" step="0.001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{t("Date")}</span>
              <input className={fieldClass} type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
