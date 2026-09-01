import { ReactNode } from "react";
import { clsx } from "clsx";

/**
 * PageHeader — the app-wide, reusable page header.
 *
 * Mobile-optimized: compact on mobile, icon + title always visible,
 * actions can be made sticky on mobile for better UX.
 */
interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Primary actions, search inputs, filters… rendered on the opposite side. */
  actions?: ReactNode;
  className?: string;
  /** Make actions sticky on mobile - useful for search/filter bars */
  stickyActions?: boolean;
}

export function PageHeader({ icon, title, subtitle, actions, className, stickyActions = false }: PageHeaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6",
        stickyActions && "lg:static",
        className,
      )}
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
        <div className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-primary/15 via-primary/10 to-secondary/10 border border-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10 shrink-0">
          {icon}
        </div>
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <h1 className={clsx(
            "font-bold text-foreground tracking-tight truncate",
            "text-lg sm:text-2xl lg:text-3xl"
          )}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className={clsx(
          "flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0",
          stickyActions && "lg:flex-wrap"
        )}>
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
