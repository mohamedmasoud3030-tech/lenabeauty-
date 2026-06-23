import { ReactNode } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  variant?: "default" | "gradient" | "glass";
}

export function PremiumCard({
  children,
  className,
  hoverable = true,
  interactive = false,
  onClick,
  variant = "default",
}: PremiumCardProps) {
  const variants = {
    default: "border border-border bg-card shadow-lg",
    gradient: "border border-border bg-gradient-to-br from-card to-muted/5 shadow-lg",
    glass: "border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl",
  };

  return (
    <motion.div
      whileHover={hoverable ? { y: -4 } : {}}
      whileTap={interactive ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={clsx(
        "rounded-2xl transition-all",
        variants[variant],
        hoverable && "hover:shadow-2xl",
        interactive && "cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={clsx("border-b border-border/50 px-6 py-4 bg-gradient-to-r from-primary/5 to-transparent", className)}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx("px-6 py-4", className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={clsx("border-t border-border/50 px-6 py-4 bg-gradient-to-r from-muted/20 to-transparent flex gap-3 justify-end", className)}>
      {children}
    </div>
  );
}

// Stat Card - for displaying metrics
interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: ReactNode;
  color?: "blue" | "emerald" | "amber" | "rose" | "purple";
}

export function StatCard({ label, value, unit, trend, icon, color = "blue" }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
    purple: "bg-purple-500/10 text-purple-600",
  };

  return (
    <PremiumCard variant="glass" hoverable>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          {icon && (
            <div className={clsx("h-10 w-10 rounded-lg flex items-center justify-center shadow-inner", colorClasses[color])}>
              {icon}
            </div>
          )}
          {trend && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
                trend.isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </motion.div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {unit && <span className="text-xs font-bold text-muted-foreground uppercase">{unit}</span>}
          </div>
        </div>
      </div>
    </PremiumCard>
  );
}
