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

const fieldClass = "min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

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
    } catch (error) {
      showToast("error", t("Error"), formatError(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadEntitlements() {
    setEntitlementsLoading(true);
    try {
      const result = await useCases.entitlements.list();
      setEntitlements(result.ok ? result.data : []);
    } catch {
      setEntitlements([]);
    } finally {
      setEntitlementsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadEntitlements();
  }, []);

  async function toggleLedger(entitlementId: string) {
    if (expandedEntitlement === entitlementId) {
      setExpandedEntitlement(null);
      return;
    }
    setExpandedEntitlement(entitlementId);
    try {
      const result = await useCases.entitlements.listLedger(entitlementId);
      setLedgerByEntitlement((prev) => ({ ...prev, [entitlementId]: result.ok ? result.data : [] }));
    } catch {
      setLedgerByEntitlement((prev) => ({ ...prev, [entitlementId]: [] }));
    }
  }

  async function handleCreate() {
    const nameResult = requiredText(name);
    const priceResult = positiveNumber(packagePrice);
    const issues = collectIssues([
      { field: "name", result: nameResult },
      { field: "packagePrice", result: priceResult },
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
        name: (nameResult as { ok: true; value: string }).value,
        description: description.trim() || undefined,
        packagePrice: (priceResult as { ok: true; value: number }).value,
        items: selectedServiceIds.map((serviceId) => ({ serviceId, quantity: 1 })),
      }));
      setName("");
      setDescription("");
      setPackagePrice("");
      setSelectedServiceIds([]);
      await load();
      showToast("success", t("Success"), t("Package created successfully"));
    } catch (error) {
      showToast("error", t("Error"), formatError(error));
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return packages;
    return packages.filter((pkg) => pkg.name.toLowerCase().includes(normalized) || (pkg.description || "").toLowerCase().includes(normalized));
  }, [packages, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("Packages")}</h1>
        <p className="text-sm text-muted-foreground">{t("Sell grouped services at a discounted package price")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("Create Package")}</h2>
          </div>

          <input
            className={fieldClass}
            placeholder={t("Package Name")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
            }}
          />
          {errors.name ? <div className="text-xs font-bold text-destructive">{t(errors.name)}</div> : null}

          <textarea
            className={`${fieldClass} min-h-24 resize-y`}
            placeholder={t("Package Description")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.001"
            placeholder={t("Package Price")}
            value={packagePrice}
            onChange={(event) => {
              setPackagePrice(event.target.value);
              if (errors.packagePrice) setErrors((prev) => ({ ...prev, packagePrice: "" }));
            }}
          />
          {errors.packagePrice ? <div className="text-xs font-bold text-destructive">{t(errors.packagePrice)}</div> : null}

          <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border bg-background p-3">
            {services.map((service) => (
              <label key={service.id} className="flex min-h-10 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(service.id)}
                  onChange={(event) => setSelectedServiceIds((prev) => (
                    event.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id)
                  ))}
                />
                <span>{service.name} · {formatOMRAmount(service.price)} {t("OMR")}</span>
              </label>
            ))}
          </div>
          {errors.services ? <div className="text-xs font-bold text-destructive">{t(errors.services)}</div> : null}

          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="min-h-11 w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("Processing...") : t("Create Package")}
          </button>
        </section>

        <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">{t("Available Packages")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("Selling a package in the POS creates a customer entitlement with its remaining sessions")}</p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${fieldClass} ps-9`}
                placeholder={t("Search packages...")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <ListState
              loading={loading}
              error={null}
              onRetry={load}
              loadingTitle={t("Loading packages...")}
              emptyTitle={t("No packages found")}
              emptyDescription={t("Create a package to sell grouped services")}
              emptyIcon={<Boxes className="h-6 w-6" />}
              empty={filtered.length === 0}
              compact
            />
            {filtered.map((pkg) => (
              <article key={pkg.id} className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Boxes className="h-4 w-4 text-primary" /> {pkg.name}
                    </div>
                    {pkg.description ? <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p> : null}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("Package Price")}: {formatOMRAmount(pkg.packagePrice)} {t("OMR")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("Included Services")}: {pkg.items?.length || 0}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pkg.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {pkg.isActive ? t("Active") : t("Inactive")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">{t("Customer Packages")}</h2>
          <span className="text-xs text-muted-foreground">{t("Purchased entitlements with remaining sessions")}</span>
        </div>

        <ListState
          loading={entitlementsLoading}
          error={null}
          onRetry={loadEntitlements}
          loadingTitle={t("Loading customer packages...")}
          emptyTitle={t("No customer packages yet")}
          emptyDescription={t("Sell a package in the POS to create a customer entitlement")}
          emptyIcon={<UserCheck className="h-6 w-6" />}
          empty={entitlements.length === 0}
          compact
        />

        <div className="space-y-3">
          {entitlements.map((entitlement) => (
            <article key={entitlement.id} className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    <Boxes className="h-4 w-4 text-primary" />
                    {entitlement.instrumentName || t("Package")}
                    <span className="text-xs font-normal text-muted-foreground">· {entitlement.customerName || "—"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("Value")}: {formatOMRAmount(entitlement.originalValue)} {t("OMR")} · {t("Remaining")}: {formatOMRAmount(entitlement.remainingValue)} {t("OMR")}
                  </p>
                  {entitlement.sourceInvoiceSerial ? (
                    <p className="text-xs text-muted-foreground">{t("Purchase invoice")}: {entitlement.sourceInvoiceSerial}</p>
                  ) : null}
                  {entitlement.legacyFlag ? <p className="text-xs text-muted-foreground">{t("Legacy record")}</p> : null}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {entitlement.units?.map((unit) => (
                      <span key={unit.id} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                        {unit.serviceName || t("Service")}: {unit.totalUnits - unit.usedUnits}/{unit.totalUnits} {t("sessions")}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entitlementTone(entitlement.status)}`}>
                    {t(entitlement.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleLedger(entitlement.id)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    <History className="h-3 w-3" />
                    {expandedEntitlement === entitlement.id ? t("Hide Ledger") : t("Ledger History")}
                  </button>
                </div>
              </div>

              {expandedEntitlement === entitlement.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {(!ledgerByEntitlement[entitlement.id] || ledgerByEntitlement[entitlement.id].length === 0) ? (
                    <p className="text-xs text-muted-foreground">{t("No ledger entries")}</p>
                  ) : null}
                  {(ledgerByEntitlement[entitlement.id] || []).map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {t(entry.entryType)}{entry.units ? ` · ${entry.units} ${t("sessions")}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.reason || ""}
                          {entry.invoiceSerial ? ` · ${t("Invoice")} ${entry.invoiceSerial}` : ""}
                          {entry.actorName ? ` · ${entry.actorName}` : ""}
                          {entry.legacyFlag ? ` · ${t("Legacy record")}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-foreground">
                        {entry.entryType === "REDEEM" || entry.entryType === "REFUND" ? "-" : "+"}{formatOMRAmount(entry.amount)} {t("OMR")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
