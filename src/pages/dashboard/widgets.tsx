import { ReactNode } from "react";
import { motion, Variants } from "motion/react";
import { clsx } from "clsx";
import { ArrowRight, CalendarDays, Coins, List, Receipt, Users } from "lucide-react";
import { formatOMRAmount } from "../../shared/money";

export function StatCard({ title, value, subValue, icon, color, variants, compact = false }: {
  title: string
  value: string | number
  subValue: string
  icon: ReactNode
  color: string
  variants: Variants
  compact?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-success/10 text-success",
    blue: "bg-info/10 text-info",
    purple: "bg-primary/10 text-primary",
    rose: "bg-destructive/10 text-destructive",
  };

  return (
    <motion.div 
      variants={variants}
      className={clsx(
        "group relative rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md overflow-hidden",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-6"
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className={clsx(
          "rounded-lg transition-all group-hover:scale-110 shadow-sm",
          compact ? "p-1.5 sm:p-2" : "p-2.5 sm:p-3",
          colorMap[color]
        )}>
          {icon}
        </div>
      </div>
      <div className={clsx("relative z-10", compact ? "mt-2 sm:mt-4" : "mt-4 sm:mt-6")}>
        <p className={clsx(
          "font-bold text-muted-foreground uppercase tracking-wider",
          compact ? "text-[8px] sm:text-[9px]" : "text-[9px]"
        )}>{title}</p>
        <h3 className={clsx(
          "font-bold text-foreground tracking-tighter truncate",
          compact ? "text-lg sm:text-2xl mt-0.5" : "text-2xl sm:text-3xl mt-1 sm:mt-2"
        )}>{value}</h3>
        <p className={clsx(
          "text-muted-foreground font-bold uppercase tracking-wider opacity-60 truncate",
          compact ? "text-[8px] sm:text-[9px] mt-0.5" : "text-[9px] mt-1 sm:mt-2"
        )}>{subValue}</p>
      </div>
    </motion.div>
  );
}

export function QuickActionButton({ title, icon, color, onClick }: {
  title: string
  icon: ReactNode
  color: string
  onClick: () => void
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    emerald: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    purple: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    amber: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    slate: "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
  };

  return (
    <button 
      onClick={onClick}
      className={clsx(
        "group min-h-11 w-full flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:shadow-lg hover:-translate-y-0.5",
        colorClasses[color]
      )}
    >
      <div className="flex-shrink-0">
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-start flex-1">{title}</span>
      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export function FinancialRow({ label, value, currency, icon, color }: {
  label: string
  value: number | string
  currency?: string
  icon: ReactNode
  color: string
}) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-success/10 text-success",
    orange: "bg-warning/10 text-warning",
    blue: "bg-info/10 text-info",
    rose: "bg-destructive/10 text-destructive"
  };

  return (
    <div className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-all border border-transparent hover:border-border">
      <div className="flex items-center gap-2.5">
        <div className={clsx("h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm", colorClasses[color])}>
          {icon}
        </div>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-end">
        <span className="text-sm font-bold text-foreground">{formatOMRAmount(value)}</span>
        <span className="ms-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{currency}</span>
      </div>
    </div>
  );
}

export function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "INVOICE_CREATED": return <Receipt className="h-5 w-5" />;
    case "APPOINTMENT_CREATED": return <CalendarDays className="h-5 w-5" />;
    case "USER_CREATED": return <Users className="h-5 w-5" />;
    case "EXPENSE_CREATED": return <Coins className="h-5 w-5" />;
    default: return <List className="h-5 w-5" />;
  }
}
