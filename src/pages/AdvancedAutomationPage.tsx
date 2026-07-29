import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";

export default function AdvancedAutomationPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [summary, setSummary] = useState("");

  async function load() {
    try {
      setLeads(await unwrap(useCases.advanced.listAiBookingLeads()));
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }
  useEffect(() => { void load(); }, []);

  async function saveLead() {
    try {
      await unwrap(useCases.advanced.createAiBookingLead({ customerName, customerPhone, summary, sourceChannel: "WEB" }));
      setCustomerName(""); setCustomerPhone(""); setSummary("");
      await load();
      showToast("success", t("Success"), t("AI booking lead saved successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">{t("Advanced Automation")}</h1>
        <p className="text-sm text-muted-foreground">{t("AI booking leads, smart recommendations foundation, and desktop readiness")}</p>
      </div>
      <div className="rounded-2xl border bg-card p-4 grid gap-3 md:grid-cols-4">
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("Lead name") as string} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t("Phone") as string} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t("Intent summary") as string} className="rounded-xl border bg-background px-3 py-2 text-sm md:col-span-2" />
        <button onClick={saveLead} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{t("Save Lead")}</button>
      </div>
      <div className="rounded-2xl border bg-card p-4 overflow-auto">
        <table className="min-w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">{t("Name")}</th><th>{t("Phone")}</th><th>{t("Status")}</th><th>{t("Summary")}</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t"><td className="py-2">{lead.customerName}</td><td>{lead.customerPhone || "—"}</td><td>{lead.status}</td><td>{lead.summary || "—"}</td></tr>)}</tbody></table>
      </div>
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        <strong>{t("Tauri desktop status")}:</strong> {t("Documented foundation added in roadmap; app remains web-first until Tauri bootstrap is initialized.")}
      </div>
    </div>
  );
}
