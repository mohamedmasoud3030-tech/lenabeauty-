import type { RefObject } from "react";
import { Menu, Plus } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { GlobalSearch } from "../../shared/components/GlobalSearch";

interface MobileActionDockProps {
  userRole?: string;
  isKeyboardOpen: boolean;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenMenu: () => void;
  onNewAppointment: () => void;
}

const actionClass =
  "grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-foreground outline-none transition-colors duration-150 hover:bg-muted active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary/20";

export function MobileActionDock({
  userRole,
  isKeyboardOpen,
  menuOpen,
  menuButtonRef,
  onOpenMenu,
  onNewAppointment,
}: MobileActionDockProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden={isKeyboardOpen}
      className={clsx(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav)] flex justify-center px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-[transform,opacity] duration-200 lg:hidden print:hidden",
        isKeyboardOpen ? "translate-y-[calc(100%+2rem)] opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <nav
        aria-label={t("Primary navigation")}
        className="pointer-events-auto relative flex w-auto items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 py-1 shadow-sm backdrop-blur-3xl"
      >
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          aria-label={t("Open menu")}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-sheet"
          className={clsx(actionClass, menuOpen && "bg-primary/10 text-primary")}
        >
          <Menu aria-hidden="true" className="h-[21px] w-[21px]" />
        </button>

        <div className="[&>button]:h-11 [&>button]:w-11 [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:rounded-xl [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:shadow-none [&>button]:hover:bg-muted">
          <GlobalSearch userRole={userRole} />
        </div>

        <button
          type="button"
          onClick={onNewAppointment}
          aria-label={t("New Appointment")}
          title={t("New Appointment")}
          className={clsx(actionClass, "text-primary hover:text-primary")}
        >
          <Plus aria-hidden="true" className="h-6 w-6" />
        </button>
      </nav>
    </div>
  );
}
