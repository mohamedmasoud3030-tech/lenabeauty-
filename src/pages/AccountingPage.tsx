import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { requiredText, nonNegativeNumber, collectIssues, issuesToMap } from "../domain/validation";

const fieldClass = "min-h-11 rounded-xl border border-border/80 bg-card/80 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10";

export default function AccountingPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [debit, setDebit] = useState("Cash");
  const [credit, setCredit] = useState("Sales");
  const [entryType, setEntryType] = useState<"SALE" | "EXPENSE" | "PAYROLL" | "ADJUSTMENT" | "TRANSFER">("ADJUSTMENT");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    try {
      setEntries(await unwrap(useCases.accounting.listJournalEntries()));
    } catch (err: any) {
      showToast("error", t("Error"), t("Could not load journal entries. Please check your connection and try again."));
    }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    const descR = requiredText(description);
    const amountR = nonNegativeNumber(amount);
    const issues = collectIssues([
      { field: "description", result: descR },
      { field: "amount", result: amountR },
    ]);
    if (issues.length > 0) {
      setErrors(issuesToMap(issues));
      return;
    }
    setErrors({});
    try {
      await unwrap(useCases.accounting.createJournalEntry({
        description: (descR as { ok: true; value: string }).value,
        amount: (amountR as { ok: true; value: number }).value,
        debitAccount: debit,
        creditAccount: credit,
        entryType,
      }));
      setDescription(""); setAmount("0");
      await load();
      showToast("success", t("Success"), t("Journal entry saved successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), t("Could not load journal entries. Please check your connection and try again."));
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Accounting")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("General journal for sales, expenses, payroll, and adjustments")}</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/80 bg-card/86 p-4 shadow-lg shadow-primary/5 backdrop-blur-sm md:grid-cols-5">
        <select value={entryType} onChange={(e) => setEntryType(e.target.value as any)} className={fieldClass}>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
          <option value="SALE">SALE</option>
          <option value="EXPENSE">EXPENSE</option>
          <option value="PAYROLL">PAYROLL</option>
          <option value="TRANSFER">TRANSFER</option>
        </select>
        <input value={description} onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors((p) => ({ ...p, description: "" })); }} placeholder={t("Description") as string} className={`${fieldClass} md:col-span-2`} />
        <input value={debit} onChange={(e) => setDebit(e.target.value)} placeholder={t("Debit account") as string} className={fieldClass} />
        <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder={t("Credit account") as string} className={fieldClass} />
        <input value={amount} onChange={(e) => { setAmount(e.target.value); if (errors.amount) setErrors((p) => ({ ...p, amount: "" })); }} type="number" step="0.01" className={fieldClass} />
        <div className="flex items-center gap-3 md:col-span-5">
          {(errors.description || errors.amount) && (
            <span className="text-xs font-bold text-destructive">
              {errors.description ? t(errors.description) : t(errors.amount)}
            </span>
          )}
          <button onClick={save} className="ms-auto min-h-11 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:brightness-105 active:scale-[0.99]">
            {t("Save Journal Entry")}
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-border/80 bg-card/90 p-4 shadow-lg shadow-primary/5 backdrop-blur-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">{t("Date")}</th>
              <th>{t("Type")}</th>
              <th>{t("Description")}</th>
              <th>{t("Debit")}</th>
              <th>{t("Credit")}</th>
              <th>{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-border/60 transition hover:bg-primary/[0.035]">
                <td className="py-2">{new Date(entry.entryDate).toLocaleDateString()}</td>
                <td>{entry.entryType}</td>
                <td>{entry.description}</td>
                <td>{entry.debitAccount}</td>
                <td>{entry.creditAccount}</td>
                <td className="font-semibold">{entry.amount.toFixed(2)} {entry.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
