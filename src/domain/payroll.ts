/**
 * Payroll domain rules (Phase 1)
 * ---------------------------------
 * Single source of truth for salary math so the Supabase adapter and the
 * unit tests agree exactly. Mirrors the approach in pos.calculations.test.ts.
 *
 * Model for a single salon (1-3 staff):
 *   net_salary = max(0, base_salary - advances_deducted)
 *   advances_deducted = sum of APPROVED advance amounts for the employee
 *                       in the same YYYY-MM as the payroll run.
 */

/** Round to 3 decimal places (OMR uses millis) to avoid float drift. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Net salary after subtracting the advances deducted in the same month.
 * Never negative (a salary cannot go below zero).
 */
export function computePayrollNetSalary(baseSalary: number, advancesDeducted: number): number {
  const base = Number(baseSalary) || 0;
  const deducted = Number(advancesDeducted) || 0;
  return round3(Math.max(0, base - deducted));
}

/**
 * Sum advance amounts that fall within a given calendar month.
 * @param advances array of { amount, advanceDate }
 * @param year     full year (e.g. 2026)
 * @param month    1-12
 */
export function sumAdvancesForMonth(
  advances: { amount: number; advanceDate: string | Date }[],
  year: number,
  month: number
): number {
  return round3(
    (advances || []).reduce((sum, a) => {
      const d = new Date(a.advanceDate);
      if (d.getFullYear() === year && d.getMonth() === month - 1) {
        return sum + (Number(a.amount) || 0);
      }
      return sum;
    }, 0)
  );
}

/** Parse a "YYYY-MM" period string into a year/month pair. */
export function parsePeriodMonth(periodMonth: string): { year: number; month: number } {
  const [year, month] = periodMonth.split("-").map(Number);
  return { year, month };
}
