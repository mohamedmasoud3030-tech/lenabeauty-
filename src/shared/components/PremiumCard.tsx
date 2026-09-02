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
    default: "border border-border/80 bg-card/92 shadow-lg shadow-primary/5 backdrop-blur-sm",
    gradient: "border border-primary/10 bg-gradient-to-br from-primary/8 via-card/95 to-secondary/8 shadow-lg shadow-primary/10",
    glass: "border border-primary/10 bg-card/72 backdrop-blur-xl shadow-xl shadow-primary/8",
  };

  return (
    <motion.div
      whileHover={hoverable ? { y: -3 } : {}}
      whileTap={interactive ? { scale: 0.985 } : {}}
      onClick={onClick}
      className={clsx(
        "rounded-2xl transition-all",
        variants[variant],
        hoverable && "hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/10",
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
    <div className={clsx("border-b border-border/50 px-6 py-4 bg-gradient-to-r from-primary/8 via-secondary/5 to-transparent", className)}>
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

// A StatCard used to live here as a second, incompatible metric-card owner
// (label / value / unit / trend API, decorative color names). The live
// canonical owner is the dashboard widget StatCard in
// src/pages/dashboard/widgets.tsx (title / subValue / variants API), which is
// what DashboardPage actually renders through the /dashboard route.
//
// The duplicate was imported by nothing in the application, so two same-named
// exports with different props were pure ownership ambiguity: reaching for the
// "shared" one gave you a card the product does not render. Removed in Round 2
// Phase 13 to leave exactly one metric-card owner.
//
// Note for traceability: docs/archive/PREMIUM_FEATURES.md still shows the old
// shared StatCard signature. That document is an archived proposal, not a live
// contract; if a shared metric card is wanted again, adopt the dashboard
// widget's API rather than reintroducing a second one.
