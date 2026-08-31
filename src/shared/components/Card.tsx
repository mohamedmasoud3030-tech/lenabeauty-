import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  clickable?: boolean;
  onClick?: () => void;
  /** Compact variant for mobile - smaller padding */
  compact?: boolean;
}

export function Card({ children, className = '', clickable = false, onClick, compact = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-xl sm:rounded-2xl border border-border/80 bg-card/92 shadow-sm backdrop-blur-sm transition-all",
        compact ? "p-3 sm:p-4" : "p-4 sm:p-6",
        clickable && "cursor-pointer hover:shadow-lg hover:shadow-primary/10 hover:border-primary/20 active:scale-[0.99]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function CardHeader({ children, className = '', compact = false }: CardHeaderProps) {
  return (
    <div className={clsx(
      "flex items-center justify-between border-b border-border/50",
      compact ? "mb-4 pb-3" : "mb-6 pb-4",
      className
    )}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function CardFooter({ children, className = '', compact = false }: CardFooterProps) {
  return (
    <div className={clsx(
      "flex items-center gap-4 border-t border-border/50",
      compact ? "mt-4 pt-3" : "mt-6 pt-4",
      className
    )}>
      {children}
    </div>
  );
}
