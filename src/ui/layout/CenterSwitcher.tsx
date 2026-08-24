import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronDown, Check } from "lucide-react";
import { config } from "../../config/env";
import { useCases } from "../../app/composition/useCases";

/**
 * Center (branch) switcher — only rendered in multi-branch mode.
 * Lets the operator switch the active center; the selection persists
 * (localStorage) and all subsequent queries are scoped to it.
 */
export default function CenterSwitcher() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [centers, setCenters] = useState<{ id: string; name: string; role: "ADMIN" | "MANAGER" | "STAFF" }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(useCases.tenant.getActiveCenterId());
  const isMulti = config.branchMode === "multi";

  useEffect(() => {
    if (!isMulti) return;
    (async () => {
      const res = await useCases.auth.getMyCenters();
      if (res.ok) {
        setCenters(res.data);
        const current = useCases.tenant.getActiveCenterId();
        if (!current && res.data.length > 0) {
          useCases.tenant.setActiveCenterId(res.data[0].id);
          setActiveId(res.data[0].id);
        }
      }
    })();
  }, [isMulti]);

  if (!isMulti) return null;

  const activeName = centers.find((c) => c.id === activeId)?.name || t("Select branch");

  function choose(id: string) {
    useCases.tenant.setActiveCenterId(id);
    setActiveId(id);
    setOpen(false);
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Switch branch")}
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-muted/50 px-3 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
      >
        <Building2 className="h-4 w-4" />
        <span className="hidden max-w-[120px] truncate text-sm font-bold sm:inline">{activeName}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card py-1 shadow-xl">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("Branches")}
            </p>
            {centers.map((center) => (
              <button
                key={center.id}
                type="button"
                onClick={() => choose(center.id)}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/50"
              >
                <span className="truncate">{center.name}</span>
                {center.id === activeId && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
            {centers.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">{t("No branches found.")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
