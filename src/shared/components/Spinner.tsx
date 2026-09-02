import { clsx } from "clsx";

/**
 * Canonical inline loading spinner. Use this for region-level loading states;
 * full-page loading still goes through ScreenState/PageLoader.
 */
export function Spinner({ size = "lg", className }: { size?: "lg" | "md"; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        "rounded-full animate-spin",
        size === "lg"
          ? "h-10 w-10 border-4 border-primary border-t-transparent"
          : "h-8 w-8 border-2 border-primary/20 border-t-primary",
        className,
      )}
    />
  );
}
