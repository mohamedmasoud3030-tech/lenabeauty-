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
    <nav
      aria-label={t("Primary navigation")}
      aria-hidden={isKeyboardOpen}
      className={clsx(
        "fixed bottom-[calc(0.55rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[var(--z-bottom-nav)] flex h-14 w-[min(13rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between rounded-full border border-border bg-card/95 px-2 shadow-2xl backdrop-blur-3xl transition-all duration-200 lg:hidden print:hidden",
        isKeyboardOpen && "translate-y-[calc(100%+2rem)] pointer-events-none opacity-0",
      )}
    >
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        aria-label={t("Open menu")}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className={clsx(
          "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition active:scale-95",
          menuOpen ? "bg-primary/15 text-primary" : "hover:bg-muted hover:text-foreground",
        )}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <div className="[&>button]:h-11 [&>button]:w-11 [&>button]:rounded-full [&>button]:border-0 [&>button]:bg-transparent [&>button]:shadow-none [&>button]:hover:bg-muted">
        <GlobalSearch userRole={userRole} />
      </div>

      <button
        type="button"
        onClick={onNewAppointment}
        aria-label={t("New Appointment")}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-105 active:scale-95"
      >
        <Plus aria-hidden="true" className="h-5 w-5" />
      </button>
    </nav>
  );
}
