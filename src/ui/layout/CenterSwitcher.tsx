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
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(useCases.tenant.getActiveCenterId());
  const isMulti = config.branchMode === "multi";

  useEffect(() => {
    if (!isMulti) return;
    (async () => {
      const res = await useCases.auth.getMyCenters();
      if (res.ok) {
        setCenters(res.data);
        // Default to the first center if none selected yet.
        const current = useCases.tenant.getActiveCenterId();
        if (!current && res.data.length > 0) {
          useCases.tenant.setActiveCenterId(res.data[0].id);
          setActiveId(res.data[0].id);
        }
      }
    })();
  }, [isMulti]);

  // Only rendered in multi-branch mode.
  if (!isMulti) return null;

  const activeName = centers.find((c) => c.id === activeId)?.name || t("Select branch");

  function choose(id: string) {
    useCases.tenant.setActiveCenterId(id);
    setActiveId(id);
    setOpen(false);
    // Reload so every page re-fetches data scoped to the new center.
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Switch branch")}
        className="flex items-center gap-2 h-10 rounded-lg bg-muted/50 px-3 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
      >
        <Building2 className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-bold max-w-[120px] truncate">{activeName}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 end-0 z-50 w-56 rounded-lg border border-border bg-card shadow-xl py-1">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("Branches")}
            </p>
            {centers.map((c) => (
              <button
                key={c.id}
                onClick={() => choose(c.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-all"
              >
                <span className="truncate">{c.name}</span>
                {c.id === activeId && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
            {centers.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t("No branches found.")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
