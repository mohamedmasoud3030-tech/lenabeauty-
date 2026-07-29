import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";

export default function AccountingPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [debit, setDebit] = useState("Cash");
  const [credit, setCredit] = useState("Sales");
  const [entryType, setEntryType] = useState<"SALE" | "EXPENSE" | "PAYROLL" | "ADJUSTMENT" | "TRANSFER">("ADJUSTMENT");

  async function load() {
    try {
      setEntries(await unwrap(useCases.accounting.listJournalEntries()));
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    try {
      await unwrap(useCases.accounting.createJournalEntry({ description, amount: Number(amount), debitAccount: debit, creditAccount: credit, entryType }));
      setDescription(""); setAmount("0");
      await load();
      showToast("success", t("Success"), t("Journal entry saved successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">{t("Accounting")}</h1>
        <p className="text-sm text-muted-foreground">{t("General journal for sales, expenses, payroll, and adjustments")}</p>
      </div>
      <div className="rounded-2xl border bg-card p-4 grid gap-3 md:grid-cols-5">
        <select value={entryType} onChange={(e) => setEntryType(e.target.value as any)} className="rounded-xl border bg-background px-3 py-2 text-sm"><option value="ADJUSTMENT">ADJUSTMENT</option><option value="SALE">SALE</option><option value="EXPENSE">EXPENSE</option><option value="PAYROLL">PAYROLL</option><option value="TRANSFER">TRANSFER</option></select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Description") as string} className="rounded-xl border bg-background px-3 py-2 text-sm md:col-span-2" />
        <input value={debit} onChange={(e) => setDebit(e.target.value)} placeholder={t("Debit account") as string} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder={t("Credit account") as string} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <button onClick={save} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{t("Save Journal Entry")}</button>
      </div>
      <div className="rounded-2xl border bg-card p-4 overflow-auto">
        <table className="min-w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">{t("Date")}</th><th>{t("Type")}</th><th>{t("Description")}</th><th>{t("Debit")}</th><th>{t("Credit")}</th><th>{t("Amount")}</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-t"><td className="py-2">{new Date(entry.entryDate).toLocaleDateString()}</td><td>{entry.entryType}</td><td>{entry.description}</td><td>{entry.debitAccount}</td><td>{entry.creditAccount}</td><td>{entry.amount.toFixed(2)} {entry.currency}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
