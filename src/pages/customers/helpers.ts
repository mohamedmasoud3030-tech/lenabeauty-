import { Customer } from "../../domain/entities";
import { getTierBySpend } from "../../domain/loyalty";
import { RetentionStatus } from "../../domain/retention";
import { visitStageI18nKey } from "../../shared/visitStage";
import { downloadCSV } from "../../shared/downloadCSV";

/** i18n label for a unified lifecycle stage (terminal states use their status). */
export function passportStageLabel(stage: string, t: (k: string) => string): string {
  if (stage === "COMPLETED" || stage === "CANCELLED" || stage === "NO_SHOW") return t(stage);
  return t(visitStageI18nKey(stage as any));
}

/** Semantic badge classes for a unified lifecycle stage. */
export function passportStageClass(stage: string): string {
  switch (stage) {
    case "COMPLETED": return "bg-success/10 text-success border-success/20";
    case "CANCELLED": return "bg-destructive/10 text-destructive border-destructive/20";
    case "NO_SHOW": return "bg-warning/10 text-warning border-warning/20";
    case "IN_SERVICE":
    case "READY_FOR_CHECKOUT": return "bg-info/10 text-info border-info/20";
    case "ARRIVED": return "bg-primary/10 text-primary border-primary/20";
    case "CONFIRMED": return "bg-info/10 text-info border-info/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

/** Semantic badge classes for the deterministic retention status. */
export function retentionStatusClass(status: RetentionStatus): string {
  switch (status) {
    case "ACTIVE": return "bg-success/10 text-success border-success/20";
    case "NEW":
    case "INSUFFICIENT_HISTORY": return "bg-info/10 text-info border-info/20";
    case "DUE_FOR_REBOOK": return "bg-primary/10 text-primary border-primary/20";
    case "DORMANT": return "bg-warning/10 text-warning border-warning/20";
    case "WINBACK": return "bg-destructive/10 text-destructive border-destructive/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

// Loyalty tier is derived from lifetime spend via the shared domain model
// (src/domain/loyalty.ts) — single source of truth across the app.

// Export customers to CSV
export function exportCustomersCSV(customers: Customer[], t: (k: string) => string) {
  const headers = [t('Name'), t('Phone'), t('Total Spent'), t('Loyalty Points'), t('Tier')];
  const rows = customers.map(c => [
    c.name,
    c.phone ?? '',
    c.totalSpent.toFixed(3),
    c.loyaltyPoints,
    t(getTierBySpend(c.totalSpent).labelKey)
  ]);
  downloadCSV(`customers_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
}
