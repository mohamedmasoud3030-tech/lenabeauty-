/**
 * Payroll domain rules (Phase 1 → Phase 2)
 * ---------------------------------
 * Single source of truth for salary math so the Supabase adapter, the
 * create_payroll_run_v1 RPC and the unit tests agree exactly.
 *
 * Model:
 *   net_salary = max(0, base_salary + commission + tips - advances_deducted)
 *   advances_deducted = sum of APPROVED advance amounts for the employee
 *                       in the same YYYY-MM as the payroll run.
 *   commission/tips    = ledger-derived totals for the same month (the DB
 *                        commission_ledger and invoices.tips_amount are
 *                        authoritative; these params are the rolled-up
 *                        amounts the RPC already summed).
 */

/** Round to 3 decimal places (OMR uses millis) to avoid float drift. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Net salary = base + commission + tips - advances, floored at zero.
 * Commission and tips default to 0 so callers that only know base/advances
 * keep working unchanged.
 */
export function computePayrollNetSalary(
  baseSalary: number,
  advancesDeducted: number,
  commission: number = 0,
  tips: number = 0
): number {
  const base = Number(baseSalary) || 0;
  const deducted = Number(advancesDeducted) || 0;
  const comm = Number(commission) || 0;
  const gratuity = Number(tips) || 0;
  return round3(Math.max(0, base + comm + gratuity - deducted));
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
