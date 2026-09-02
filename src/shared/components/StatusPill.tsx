import type { ReactNode } from "react";

/**
 * Canonical status pill: one visual owner for status chips across the app.
 * Pages map their own status enums to a StatusTone; the tone → class mapping
 * lives here only, so a tone change is a single-point edit.
 */
export type StatusTone = "warning" | "primary" | "destructive" | "success";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  warning: "border-warning/25 bg-warning/10 text-warning",
  primary: "border-primary/25 bg-primary/10 text-primary",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  success: "border-success/25 bg-success/10 text-success",
};

export function StatusPill({
  tone,
  className = "",
  children,
}: {
  tone: StatusTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export default StatusPill;
