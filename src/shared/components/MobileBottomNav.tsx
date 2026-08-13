import { ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Mobile-optimized bottom navigation item
 * Ensures 44px minimum touch target and proper spacing
 */
export function MobileNavItem({
  icon,
  label,
  isActive,
  onClick,
  badge,
  className,
}: {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 touch-target relative",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center h-9 w-14 rounded-xl transition-all duration-300",
          isActive ? "bg-primary/15" : "bg-transparent"
        )}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span
        className={clsx(
          "text-[10px] font-bold tracking-wide leading-tight",
          isActive && "text-primary"
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * Mobile bottom action bar - fixed to bottom with safe-area support
 */
export function MobileBottomAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-background via-background to-transparent",
        "lg:hidden",
        className
      )}
    >
      <div className="safe-area-bottom">
        {children}
      </div>
    </div>
  );
}

/**
 * Mobile sticky header with backdrop blur
 */
export function MobileStickyHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50",
        "lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:border-0",
        "-mx-4 px-4 py-3 sm:mx-0 sm:px-0 sm:py-0",
        className
      )}
    >
      {children}
    </div>
  );
}
