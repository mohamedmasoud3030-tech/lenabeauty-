export const LENA_BRAND_PALETTE = {
  primary: "#8B5CF6",
  secondary: "#EC4899",
  surfaceAccent: "#F3E8FF",
} as const;

/**
 * Strict brand-color contract.
 *
 * Brand colors flow into generated CSS (print documents, app theme tokens) and
 * are persisted (Supabase + localStorage). Only `#RRGGBB` is accepted at every
 * boundary; anything else (named colors, rgb()/hsl(), CSS payloads, URLs,
 * var() indirection) is invalid and must never reach a stylesheet or the
 * database.
 */
export const BRAND_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** True only for a string that is exactly `#RRGGBB` (case-insensitive, trimmed). */
export function isValidBrandColor(value: unknown): value is string {
  return typeof value === "string" && BRAND_COLOR_PATTERN.test(value.trim());
}

/** Returns the value when it is a strict `#RRGGBB` color, otherwise `fallback`. */
export function normalizeBrandColor(value: unknown, fallback: string): string {
  return isValidBrandColor(value) ? (value as string).trim() : fallback;
}
