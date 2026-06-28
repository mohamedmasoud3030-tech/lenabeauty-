import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, Plus, Search } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { Service } from "../domain/entities";

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
  const [packagePrice, setPackagePrice] = useState("0");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

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

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim() || selectedServiceIds.length === 0) {
      showToast("error", t("Error"), t("Package name and at least one service are required"));
      return;
    }
    setSaving(true);
    try {
      await unwrap(useCases.servicePackages.create({
        name: name.trim(),
        description: description.trim() || undefined,
        packagePrice: Number(packagePrice),
        items: selectedServiceIds.map((serviceId) => ({ serviceId, quantity: 1 })),
      }));
      setName("");
      setDescription("");
      setPackagePrice("0");
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
          <input className="w-full rounded-xl border px-3 py-2" placeholder={t("Package Name")} value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="w-full rounded-xl border px-3 py-2 min-h-24" placeholder={t("Package Description")} value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="w-full rounded-xl border px-3 py-2" type="number" min="0" step="0.001" placeholder={t("Package Price")} value={packagePrice} onChange={(e) => setPackagePrice(e.target.value)} />
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
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="w-full rounded-xl border ps-9 pe-3 py-2" placeholder={t("Search packages...")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">{t("Loading...")}</p> : filtered.length === 0 ? <p className="text-sm text-muted-foreground">{t("No packages found")}</p> : filtered.map((pkg) => (
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
    </div>
  );
}
