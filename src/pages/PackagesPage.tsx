import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, Plus, Search, UserCheck, History } from "lucide-react";
import { ListState } from "../shared/components/ListState";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Service, CustomerEntitlement } from "../domain/entities";
import { requiredText, positiveNumber, collectIssues, issuesToMap } from "../domain/validation";
import { formatOMRAmount } from "../shared/money";

function entitlementTone(status: string): string {
  if (status === "ACTIVE") return "bg-success/10 text-success";
  if (status === "PARTIALLY_REDEEMED") return "bg-info/10 text-info";
  if (status === "FULLY_REDEEMED") return "bg-muted text-muted-foreground";
  if (status === "EXPIRED") return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}

export default function PackagesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [entitlements, setEntitlements] = useState<CustomerEntitlement[]>([]);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [ledgerByEntitlement, setLedgerByEntitlement] = useState<Record<string, any[]>>({});
  const [expandedEntitlement, setExpandedEntitlement] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [packageRows, serviceRows] = await Promise.all([
        unwrap(useCases.servicePackages.list()),
        unwrap(useCases.services.list()),
      ]);
      setPackages(packageRows as any[]);
      setServices(serviceRows);
    } catch (err) {
      showToast("error", t("Error"), formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadEntitlements() {
    setEntitlementsLoading(true);
    try {
      const res = await useCases.entitlements.list();
      setEntitlements(res.ok ? res.data : []);
    } catch {
      setEntitlements([]);
    } finally {
      setEntitlementsLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadEntitlements();
  }, []);

  async function toggleLedger(entitlementId: string) {
    if (expandedEntitlement === entitlementId) {
      setExpandedEntitlement(null);
      return;
    }
    setExpandedEntitlement(entitlementId);
    try {
      const res = await useCases.entitlements.listLedger(entitlementId);
      setLedgerByEntitlement((prev) => ({ ...prev, [entitlementId]: res.ok ? res.data : [] }));
    } catch {
      setLedgerByEntitlement((prev) => ({ ...prev, [entitlementId]: [] }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    const nameR = requiredText(name);
    const priceR = positiveNumber(packagePrice);
    const issues = collectIssues([
      { field: "name", result: nameR },
      { field: "packagePrice", result: priceR },
    ]);
    if (selectedServiceIds.length === 0) {
      issues.push({ field: "services", key: "validation.required_select" });
    }
    if (issues.length > 0) {
      setErrors(issuesToMap(issues));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await unwrap(useCases.servicePackages.create({
        name: (nameR as { ok: true; value: string }).value,
        description: description.trim() || undefined,
        packagePrice: (priceR as { ok: true; value: number }).value,
        items: selectedServiceIds.map((serviceId) => ({ serviceId, quantity: 1 })),
      }));
      setName("");
      setDescription("");
      setPackagePrice("");
      setSelectedServiceIds([]);
      await load();
      showToast("success", t("Success"), t("Package created successfully"));
    } catch (err) {
      showToast("error", t("Error"), formatError(err));
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((pkg) => pkg.name.toLowerCase().includes(q) || (pkg.description || "").toLowerCase().includes(q));
  }, [packages, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("Packages")}</h1>
        <p className="text-sm text-muted-foreground">{t("Sell grouped services at a discounted package price")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <div className="rounded-3xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2"><Plus className="h-4 w-4" /> <h2 className="font-semibold">{t("Create Package")}</h2></div>
          <input className="w-full rounded-xl border px-3 py-2" placeholder={t("Package Name")} value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }} />
          {errors.name && <div className="text-xs font-bold text-rose-500">{t(errors.name)}</div>}
          <textarea className="w-full rounded-xl border px-3 py-2 min-h-24" placeholder={t("Package Description")} value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="w-full rounded-xl border px-3 py-2" type="number" min="0" step="0.001" placeholder={t("Package Price")} value={packagePrice} onChange={(e) => { setPackagePrice(e.target.value); if (errors.packagePrice) setErrors((p) => ({ ...p, packagePrice: "" })); }} />
          {errors.packagePrice && <div className="text-xs font-bold text-rose-500">{t(errors.packagePrice)}</div>}
          <div className="space-y-2 max-h-56 overflow-auto rounded-xl border p-3">
            {services.map((service) => (
              <label key={service.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(service.id)}
                  onChange={(e) => setSelectedServiceIds((prev) => e.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id))}
                />
                <span>{service.name} · {service.price.toFixed(2)} {t("OMR")}</span>
              </label>
            ))}
          </div>
          <button onClick={handleCreate} disabled={saving} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 font-semibold disabled:opacity-50">
            {saving ? t("Processing...") : t("Create Package")}
          </button>
        </div>

        <div className="rounded-3xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t("Available Packages")}</h2>
            <p className="hidden lg:block text-xs text-muted-foreground">{t("Selling a package in the POS creates a customer entitlement with its remaining sessions")}</p>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="w-full rounded-xl border ps-9 pe-3 py-2" placeholder={t("Search packages...")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <ListState loading={loading} error={null} onRetry={load} loadingTitle={t("Loading packages...")} emptyTitle={t("No packages found")} emptyDescription={t("Create a package to sell grouped services")} emptyIcon={<Boxes className="h-6 w-6" />} empty={filtered.length === 0} compact />
            {filtered.length > 0 && filtered.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold"><Boxes className="h-4 w-4" /> {pkg.name}</div>
                    {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
                    <p className="text-sm text-muted-foreground mt-2">{t("Package Price")}: {pkg.packagePrice.toFixed(2)} {t("OMR")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("Included Services")}: {pkg.items?.length || 0}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pkg.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {pkg.isActive ? t("Active") : t("Inactive")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer package entitlements */}
      <div className="rounded-3xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          <h2 className="font-semibold">{t("Customer Packages")}</h2>
          <span className="text-xs text-muted-foreground">{t("Purchased entitlements with remaining sessions")}</span>
        </div>
        <ListState loading={entitlementsLoading} error={null} onRetry={loadEntitlements} loadingTitle={t("Loading customer packages...")} emptyTitle={t("No customer packages yet")} emptyDescription={t("Sell a package in the POS to create a customer entitlement")} emptyIcon={<UserCheck className="h-6 w-6" />} empty={entitlements.length === 0} compact />
        {entitlements.length > 0 && (
          <div className="space-y-3">
            {entitlements.map((ent) => (
              <div key={ent.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <Boxes className="h-4 w-4" />
                      {ent.instrumentName || t("Package")}
                      <span className="text-xs font-normal text-muted-foreground">· {ent.customerName || "—"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("Value")}: {formatOMRAmount(ent.originalValue)} {t("OMR")} · {t("Remaining")}: {formatOMRAmount(ent.remainingValue)} {t("OMR")}
                    </p>
                    {ent.sourceInvoiceSerial && (
                      <p className="text-xs text-muted-foreground">{t("Purchase invoice")}: {ent.sourceInvoiceSerial}</p>
                    )}
                    {ent.legacyFlag && <p className="text-xs text-muted-foreground">{t("Legacy record")}</p>}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ent.units?.map((unit) => (
                        <span key={unit.id} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                          {unit.serviceName || t("Service")}: {unit.totalUnits - unit.usedUnits}/{unit.totalUnits} {t("sessions")}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entitlementTone(ent.status)}`}>{t(ent.status)}</span>
                    <button onClick={() => toggleLedger(ent.id)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
                      <History className="h-3 w-3" />
                      {expandedEntitlement === ent.id ? t("Hide Ledger") : t("Ledger History")}
                    </button>
                  </div>
                </div>
                {expandedEntitlement === ent.id && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    {(!ledgerByEntitlement[ent.id] || ledgerByEntitlement[ent.id].length === 0) && (
                      <p className="text-xs text-muted-foreground">{t("No ledger entries")}</p>
                    )}
                    {(ledgerByEntitlement[ent.id] || []).map((entry: any) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold">{t(entry.entryType)}{entry.units ? ` · ${entry.units} ${t("sessions")}` : ""}</p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
