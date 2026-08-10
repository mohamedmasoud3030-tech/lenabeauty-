import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'secondary';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-muted/50 text-foreground border border-border/50',
  primary: 'bg-primary/10 text-primary border border-primary/20',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
  secondary: 'bg-info/10 text-info border border-info/20',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg',
  md: 'px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg',
  lg: 'px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  className = '',
}: BadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {icon && <span className="h-3 w-3 flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
