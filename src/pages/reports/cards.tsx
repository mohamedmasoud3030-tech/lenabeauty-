import { ReactNode } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function KPICard({ variants, title, value, currency, icon, trend, trendUp = true, color = "blue" }: any) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-success/10 text-success",
    blue: "bg-info/10 text-info",
    rose: "bg-secondary/10 text-secondary",
    purple: "bg-primary/10 text-primary",
  };

  return (
    <motion.div
      variants={variants}
      className="group relative rounded-2xl border border-border bg-card p-3 sm:p-6 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={clsx("h-10 w-10 rounded-lg flex items-center justify-center shadow-inner", colorClasses[color])}>
            {icon}
          </div>
          {trend && (
            <div className={clsx(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
              trendUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
            </div>
          )}
        </div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {currency && <span className="text-xs font-bold text-muted-foreground uppercase">{currency}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
      <span className="text-sm text-muted-foreground font-bold">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

export function InsightBadge({ icon, text, color }: { icon: ReactNode; text: string; color: string }) {
  const colorClasses: Record<string, string> = {
    rose: "bg-primary/10 text-primary",
    pink: "bg-secondary/10 text-secondary",
    amber: "bg-accent text-accent-foreground",
  };

  return (
    <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg", colorClasses[color])}>
      {icon}
      <span className="text-xs font-bold">{text}</span>
    </div>
  );
}
