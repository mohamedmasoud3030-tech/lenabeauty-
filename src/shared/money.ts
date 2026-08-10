export const OMR_FRACTION_DIGITS = 3;

/**
 * Display an Omani-rial amount with the same three-decimal precision used by
 * PostgreSQL and the checkout contract. Invalid transport values never leak
 * `NaN`/`Infinity` into the UI; they fail closed to a neutral zero display.
 */
export function formatOMRAmount(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "0.000";

  // Avoid rendering "-0.000" for tiny signed floating-point artifacts.
  const normalized = Math.abs(amount) < 0.0005 ? 0 : amount;
  return normalized.toFixed(OMR_FRACTION_DIGITS);
}
