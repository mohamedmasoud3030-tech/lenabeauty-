import { useEffect, useMemo, useRef } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth";
import { NAV_GROUPS, visibleDestinations } from "../../app/navigation";
import { useOptionalModules } from "../../shared/hooks/useOptionalModules";
import { useSalonIdentity } from "../../shared/hooks/useSalonIdentity";
import { getDisplayName, getInitials } from "../../shared/displayName";
import { UserRole } from "../../domain/entities/Session";

interface MobileNavigationSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavigationSheet({ open, onClose }: MobileNavigationSheetProps) {
  const { me } = useAuth();
  const { t } = useTranslation();
  const optionalModules = useOptionalModules();
  const salon = useSalonIdentity();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  // Quick access: the "today" group — the pages the operator touches every
  // hour — lives as a horizontal chip row ABOVE the full list instead of a
  // cell inside it. The remaining groups render below, so every destination
  // keeps exactly one home in the sheet (no duplicated entries).
  const quickItems = groups.find((group) => group.id === "today")?.items ?? [];
  const listGroups = groups.filter((group) => group.id !== "today");

  const roleLabel =
    me?.role === UserRole.ADMIN
      ? t("Administrator")
      : me?.role === UserRole.MANAGER
        ? t("Manager")
        : me?.role === UserRole.STAFF
          ? t("Staff Member")
          : "";

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[var(--z-overlay)] lg:hidden print:hidden">
          <motion.button
            type="button"
            aria-label={t("Close")}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-[3px]"
          />

          <motion.div
            id="mobile-navigation-sheet"
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

            {/* Profile header: the operator opens this sheet, so they meet
                themselves first — their name, launch role and the salon
                they run. The old header showed the salon logo plus a
                redundant "Primary navigation" caption instead. */}
            <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
                {getInitials(me, "·")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-extrabold leading-tight text-foreground">
                  {getDisplayName(me, t("Unnamed"))}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-muted-foreground">
                  {[roleLabel, salon.name].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t("Close")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {quickItems.length > 0 ? (
                <>
                  <div className="flex gap-2 overflow-x-auto px-1 py-2 scrollbar-hide">
                    {quickItems.map(({ path, labelKey, icon: Icon }) => (
                      <NavLink
                        key={path}
                        to={path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx(
                            "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                              : "bg-primary/10 text-primary",
                          )
                        }
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {t(labelKey)}
                      </NavLink>
                    ))}
                  </div>
                  <div aria-hidden="true" className="mx-1 my-1.5 h-px bg-border" />
                </>
              ) : null}

              <div className="space-y-4">
                {listGroups.map((group) => (
                  <section key={group.id} className="space-y-1.5">
                    <p className="px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t(group.titleKey)}
                    </p>
                    <div className="flex flex-col">
                      {group.items.map(({ path, labelKey, icon: Icon }) => (
                        <NavLink
                          key={path}
                          to={path}
                          onClick={onClose}
                          className={({ isActive }) =>
                            clsx(
                              "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted",
                            )
                          }
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
