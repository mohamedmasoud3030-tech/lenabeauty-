import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";

/**
 * PageHeader — the app-wide, reusable page header.
 *
 * Unified pattern for every operational page: icon tile + Arabic title +
 * short subtitle on the right, and the page's primary actions / search /
 * filters in the `actions` slot. Keeps the existing visual identity
 * (rounded tile, gradient accents) without per-page variations.
 */
interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Primary actions, search inputs, filters… rendered on the opposite side. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon, title, subtitle, actions, className }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div
      className={clsx(
        "flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-8",
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <div className="h-11 w-11 sm:h-16 sm:w-16 rounded-xl sm:rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
          {icon}
        </div>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
