import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gift, Plus, Search } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Customer } from "../domain/entities";

export default function GiftCardsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [cards, setCards] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ code: "", initialBalance: "", customerId: "", note: "", expiresAtISO: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [giftCards, customerRows] = await Promise.all([
        unwrap(useCases.giftCards.list()),
        unwrap(useCases.customers.list()),
      ]);
      setCards(giftCards as any[]);
      setCustomers(customerRows);
    } catch (err) {
      showToast("error", t("Error"), formatError(err as Error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleIssue() {
    const amount = Number(form.initialBalance);
    if (!form.code.trim() || amount <= 0) {
      showToast("error", t("Error"), t("Gift card code and positive balance are required"));
      return;
    }
    setSaving(true);
    try {
      await unwrap(useCases.giftCards.issue({
        code: form.code.trim().toUpperCase(),
        initialBalance: amount,
        customerId: form.customerId || undefined,
        note: form.note || undefined,
        expiresAtISO: form.expiresAtISO || undefined,
      }));
      setForm({ code: "", initialBalance: "", customerId: "", note: "", expiresAtISO: "" });
      await load();
      showToast("success", t("Success"), t("Gift card issued successfully"));
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
          <p className="text-sm text-muted-foreground">{t("Issue prepaid value and redeem it during checkout")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <div className="rounded-3xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <h2 className="font-semibold">{t("Issue Gift Card")}</h2>
          </div>
          <input className="w-full rounded-xl border px-3 py-2" placeholder={t("Gift Card Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="w-full rounded-xl border px-3 py-2" type="number" min="0" step="0.001" placeholder={t("Initial Balance")} value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
          <select className="w-full rounded-xl border px-3 py-2" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{t("Assign to customer (optional)")}</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <input className="w-full rounded-xl border px-3 py-2" type="datetime-local" value={form.expiresAtISO} onChange={(e) => setForm({ ...form, expiresAtISO: e.target.value })} />
          <textarea className="w-full rounded-xl border px-3 py-2 min-h-24" placeholder={t("Note (optional)")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button onClick={handleIssue} disabled={saving} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 font-semibold disabled:opacity-50">
            {saving ? t("Processing...") : t("Issue Gift Card")}
          </button>
        </div>

        <div className="rounded-3xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t("Issued Gift Cards")}</h2>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="w-full rounded-xl border ps-9 pe-3 py-2" placeholder={t("Search gift cards...")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">{t("Loading...")}</p> : filtered.length === 0 ? <p className="text-sm text-muted-foreground">{t("No gift cards found")}</p> : filtered.map((card) => (
              <div key={card.id} className="rounded-2xl border p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold"><Gift className="h-4 w-4" /> {card.code}</div>
                  <p className="text-sm text-muted-foreground">{t("Initial Balance")}: {card.initialBalance.toFixed(2)} {t("OMR")}</p>
                  <p className="text-sm text-muted-foreground">{t("Available Balance")}: {card.currentBalance.toFixed(2)} {t("OMR")}</p>
                  {card.note && <p className="text-xs text-muted-foreground">{card.note}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${card.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {card.isActive ? t("Active") : t("Redeemed")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
