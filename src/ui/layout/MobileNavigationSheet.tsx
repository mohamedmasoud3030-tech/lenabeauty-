import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth";
import { NAV_GROUPS, visibleDestinations } from "../../app/navigation";
import { useOptionalModules } from "../../shared/hooks/useOptionalModules";

interface MobileNavigationSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavigationSheet({ open, onClose }: MobileNavigationSheetProps) {
  const { me } = useAuth();
  const { t } = useTranslation();
  const optionalModules = useOptionalModules();

  const groups = useMemo(() => {
    const visible = visibleDestinations({
      isAdmin: me?.role === "ADMIN",
      optionalModules,
    });

    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: visible.filter((destination) => destination.group === group.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [me?.role, optionalModules]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[var(--z-overlay)] lg:hidden print:hidden">
          <motion.button
            type="button"
            aria-label={t("Close")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-[3px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("Primary navigation")}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            data-mobile-nav-sheet
            className="absolute inset-x-0 bottom-0 flex max-h-[min(86dvh,52rem)] flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-border bg-card shadow-2xl"
          >
            <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <img src="/lena-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">LenaBeauty</p>
                  <p className="text-[11px] font-bold text-muted-foreground">{t("Primary navigation")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("Close")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <div className="space-y-4">
                {groups.map((group) => (
                  <section key={group.id} className="space-y-1.5">
                    <p className="px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t(group.titleKey)}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.items.map(({ path, labelKey, icon: Icon }) => (
                        <NavLink
                          key={path}
                          to={path}
                          onClick={onClose}
                          className={({ isActive }) => clsx(
                            "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm font-bold transition-colors",
                            isActive
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-transparent bg-muted/40 text-foreground hover:border-border hover:bg-muted",
                          )}
                        >
                          <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                          <span className="min-w-0 truncate">{t(labelKey)}</span>
                        </NavLink>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
