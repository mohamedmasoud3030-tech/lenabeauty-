import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gift, Plus, Search, Receipt, History, ShieldCheck } from "lucide-react";
import { ListState } from "../shared/components/ListState";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Customer, Employee, CustomerEntitlement } from "../domain/entities";
import { formatOMRAmount } from "../shared/money";

/** Works for both gift-card rows and entitlement rows (status may be absent). */
function effectiveStatus(entitlement: CustomerEntitlement & { isActive?: boolean }): { key: string; tone: string } {
  if (entitlement.status === "REFUNDED") return { key: "Refunded", tone: "bg-muted text-muted-foreground" };
  if (entitlement.status === "VOID") return { key: "Void", tone: "bg-muted text-muted-foreground" };
  if (entitlement.status === "FULLY_REDEEMED") return { key: "Redeemed", tone: "bg-muted text-muted-foreground" };
  if (entitlement.status === "EXPIRED") return { key: "Expired", tone: "bg-warning/10 text-warning" };
  if (entitlement.expiresAt && new Date(entitlement.expiresAt).getTime() < Date.now()) {
    return { key: "Expired", tone: "bg-warning/10 text-warning" };
  }
  if (entitlement.status === "PARTIALLY_REDEEMED") return { key: "Partially Redeemed", tone: "bg-info/10 text-info" };
  if (entitlement.isActive === false) {
    return { key: "Redeemed", tone: "bg-muted text-muted-foreground" };
  }
  return { key: "Active", tone: "bg-success/10 text-success" };
}

export default function GiftCardsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [cards, setCards] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    code: "",
    initialBalance: "",
    customerId: "",
    employeeId: "",
    paymentMethod: "cash",
    note: "",
    expiresAtISO: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ledgerByCard, setLedgerByCard] = useState<Record<string, any[]>>({});
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [giftCards, customerRows, employeeRows] = await Promise.all([
        unwrap(useCases.giftCards.list()),
        unwrap(useCases.customers.list()),
        unwrap(useCases.employees.list()),
      ]);
      setCards(giftCards as any[]);
      setCustomers(customerRows);
      setEmployees(employeeRows);
    } catch (err) {
      showToast("error", t("Error"), formatError(err as Error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleLedger(card: any) {
    if (expandedCard === card.id) {
      setExpandedCard(null);
      return;
    }
    setExpandedCard(card.id);
    try {
      const res = await useCases.entitlements.list(card.code || "");
      const entitlement = (res.ok ? res.data : []).find((e: any) => e.giftCardId === card.id);
      if (entitlement) {
        const ledger = await useCases.entitlements.listLedger(entitlement.id);
        setLedgerByCard((prev) => ({ ...prev, [card.id]: ledger.ok ? ledger.data : [] }));
      } else {
        setLedgerByCard((prev) => ({ ...prev, [card.id]: [] }));
      }
    } catch {
      setLedgerByCard((prev) => ({ ...prev, [card.id]: [] }));
    }
  }

  async function handleSell() {
    const amount = Number(form.initialBalance);
    if (!form.code.trim() || amount <= 0) {
      showToast("error", t("Error"), t("Gift card code and positive balance are required"));
      return;
    }
    if (!form.customerId || !form.employeeId) {
      showToast("error", t("Error"), t("Customer and employee are required to sell a gift card"));
      return;
    }
    setSaving(true);
    try {
      // The sale flows through the atomic checkout pipeline: payment
      // collection + invoice + deferred entitlement in one transaction.
      await unwrap(useCases.giftCards.issue({
        code: form.code.trim().toUpperCase(),
        initialBalance: amount,
        customerId: form.customerId,
        employeeId: form.employeeId,
        paymentMethod: form.paymentMethod as "cash" | "card" | "transfer",
        note: form.note || undefined,
        expiresAtISO: form.expiresAtISO || undefined,
      }));
      setForm({ code: "", initialBalance: "", customerId: "", employeeId: "", paymentMethod: "cash", note: "", expiresAtISO: "" });
      await load();
      showToast("success", t("Success"), t("Gift card sold successfully — payment recorded"));
    } catch (err) {
      showToast("error", t("Error"), formatError(err as Error));
    } finally {
      setSaving(false);
    }
  }

  const filtered = cards.filter((card) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return card.code.toLowerCase().includes(q) || (card.note || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Gift Cards")}</h1>
          <p className="text-sm text-muted-foreground">{t("Sell prepaid value; redemption is booked as a deferred obligation until used")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <div className="rounded-3xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <h2 className="font-semibold">{t("Sell Gift Card")}</h2>
          </div>
          <input className="w-full rounded-xl border px-3 py-2" placeholder={t("Gift Card Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="w-full rounded-xl border px-3 py-2" type="number" min="0" step="0.001" placeholder={t("Card Value (OMR)")} value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
          <select className="w-full rounded-xl border px-3 py-2" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{t("Customer (required)")}</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <select className="w-full rounded-xl border px-3 py-2" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            <option value="">{t("Employee (required)")}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
          <select className="w-full rounded-xl border px-3 py-2" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            <option value="cash">{t("Cash")}</option>
            <option value="card">{t("Card")}</option>
            <option value="transfer">{t("Transfer")}</option>
          </select>
          <input className="w-full rounded-xl border px-3 py-2" type="datetime-local" value={form.expiresAtISO} onChange={(e) => setForm({ ...form, expiresAtISO: e.target.value })} />
          <textarea className="w-full rounded-xl border px-3 py-2 min-h-24" placeholder={t("Note (optional)")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button onClick={handleSell} disabled={saving} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 font-semibold disabled:opacity-50">
            {saving ? t("Processing...") : t("Sell Gift Card")}
          </button>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {t("The sale creates an invoice, records the payment, and books the value as a deferred obligation — never as earned service revenue.")}
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t("Sold Gift Cards")}</h2>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="w-full rounded-xl border ps-9 pe-3 py-2" placeholder={t("Search gift cards...")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="space-y-3">
            <ListState loading={loading} error={null} onRetry={load} loadingTitle={t("Loading gift cards...")} emptyTitle={t("No gift cards found")} emptyDescription={t("Sell a gift card to get started")} emptyIcon={<Gift className="h-6 w-6" />} empty={filtered.length === 0} compact />
            {filtered.length > 0 && filtered.map((card) => {
              const status = effectiveStatus(card);
              return (
                <div key={card.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-semibold"><Gift className="h-4 w-4" /> {card.code}</div>
                      <p className="text-sm text-muted-foreground">{t("Initial Balance")}: {formatOMRAmount(card.initialBalance)} {t("OMR")}</p>
                      <p className="text-sm text-muted-foreground">{t("Available Balance")}: {formatOMRAmount(card.currentBalance)} {t("OMR")}</p>
                      {card.note && <p className="text-xs text-muted-foreground">{card.note}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>
                        {t(status.key)}
                      </span>
                      <button onClick={() => toggleLedger(card)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
                        <History className="h-3 w-3" />
                        {expandedCard === card.id ? t("Hide Ledger") : t("Ledger History")}
                      </button>
                    </div>
                  </div>
                  {expandedCard === card.id && (
                    <div className="mt-3 border-t pt-3 space-y-2">
                      {Array.isArray(ledgerByCard[card.id]) && ledgerByCard[card.id].length === 0 && (
                        <p className="text-xs text-muted-foreground">{t("No ledger entries")}</p>
                      )}
                      {Array.isArray(ledgerByCard[card.id]) && ledgerByCard[card.id].map((entry: any) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold">{t(entry.entryType)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.reason || ""}
                              {entry.invoiceSerial ? ` · ${t("Invoice")} ${entry.invoiceSerial}` : ""}
                              {entry.actorName ? ` · ${entry.actorName}` : ""}
                              {entry.legacyFlag ? ` · ${t("Legacy record")}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 font-bold">
                            {entry.entryType === "REDEEM" || entry.entryType === "REFUND" ? "-" : "+"}{formatOMRAmount(entry.amount)} {t("OMR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
