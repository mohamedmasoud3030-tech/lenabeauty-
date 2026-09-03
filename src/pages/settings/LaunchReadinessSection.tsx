import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCases } from "../../app/composition/useCases";
import { unwrap } from "../../shared/hooks/useApplication";

type Readiness = {
  profile: boolean;
  branding: boolean;
  services: boolean;
  employees: boolean;
  inventory: boolean;
};

const emptyReadiness: Readiness = {
  profile: false,
  branding: false,
  services: false,
  employees: false,
  inventory: false,
};

export default function LaunchReadinessSection() {
  const { t } = useTranslation();
  const [state, setState] = useState<Readiness>(emptyReadiness);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(false);
    try {
      const [settings, services, employees, products] = await Promise.all([
        unwrap(useCases.settings.get()),
        unwrap(useCases.services.list()),
        unwrap(useCases.employees.list()),
        unwrap(useCases.products.listFull()),
      ]);
      setState({
        profile: Boolean(settings.name.trim() && settings.phone?.trim() && settings.address?.trim()),
        branding: Boolean(settings.displayName?.trim() || settings.displayNameAr?.trim() || settings.brandLogoBase64 || settings.logoPath),
        services: services.some((service) => service.isActive),
        employees: employees.some((employee) => employee.isActive),
        inventory: products.length > 0,
      });
    } catch (cause) {
      console.error("Launch readiness load failed", cause);
      setError(true);
      setState(emptyReadiness);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const checks = useMemo(() => [
    { key: "profile", ready: state.profile, label: t("Center profile"), detail: t("Business name, phone and address are ready"), href: "/settings" },
    { key: "branding", ready: state.branding, label: t("Salon branding"), detail: t("Logo or customer-facing display identity is configured"), href: "/settings?tab=branding" },
    { key: "services", ready: state.services, label: t("Opening services"), detail: t("At least one active service is ready for booking and POS"), href: "/services" },
    { key: "employees", ready: state.employees, label: t("Operating staff"), detail: t("At least one active employee is available"), href: "/employees" },
    { key: "inventory", ready: state.inventory, label: t("Opening inventory"), detail: t("Opening products have been loaded and can be physically verified"), href: "/inventory" },
  ], [state, t]);

  const readyCount = checks.filter((check) => check.ready).length;
  const coreReady = readyCount === checks.length;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{t("First Customer Go-Live")}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {t("Verify the real operating prerequisites before the salon accepts its first production checkout.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("Refresh readiness")}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">{t("Core readiness")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{readyCount}/{checks.length} {t("verified")}</p>
            </div>
            {coreReady ? <ShieldCheck className="h-7 w-7 text-emerald-600" /> : <CircleAlert className="h-7 w-7 text-amber-600" />}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(readyCount / checks.length) * 100}%` }} />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive">
            {t("Readiness could not be verified. Resolve the data or permission error before go-live.")}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <Link
              key={check.key}
              to={check.href}
              className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-background p-4 transition hover:bg-muted/50"
            >
              {check.ready ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{check.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <h3 className="font-bold text-foreground">{t("Final operator checks")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("These checks require an operator decision and are never auto-marked by the application.")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            t("Owner/admin login and one staff login verified"),
            t("Opening stock physically counted"),
            t("Pre-go-live operational export saved"),
            t("Managed database recovery procedure confirmed"),
            t("Golden workflow rehearsed without permission errors"),
            t("First real sale will be verified once, end-to-end"),
          ].map((label) => (
            <div key={label} className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}