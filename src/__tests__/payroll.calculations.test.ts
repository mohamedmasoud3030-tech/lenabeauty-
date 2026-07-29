import { describe, expect, it } from "vitest";
import { computePayrollNetSalary, sumAdvancesForMonth, parsePeriodMonth } from "../domain/payroll";

/**
 * Payroll calculation invariants — must mirror the Supabase adapter
 * (SupabasePayrollAdapter.createRun) which calls these exact functions.
 *
 *   net_salary        = max(0, base_salary - advances_deducted)
 *   advances_deducted = SUM(amount) of APPROVED advances for the employee
 *                       in the same YYYY-MM as the payroll run.
 */
describe("Payroll calculations (mirror Supabase adapter)", () => {
  it("net salary = base - advances", () => {
    expect(computePayrollNetSalary(500, 100)).toBe(400);
    expect(computePayrollNetSalary(450, 50)).toBe(400);
  });

  it("net salary never goes negative when advances exceed base", () => {
    expect(computePayrollNetSalary(300, 500)).toBe(0);
    expect(computePayrollNetSalary(0, 100)).toBe(0);
  });

  it("no advances means net = base", () => {
    expect(computePayrollNetSalary(600, 0)).toBe(600);
  });

  it("rounds to 3 decimal places (OMR millis)", () => {
    expect(computePayrollNetSalary(10.1234, 0)).toBe(10.123);
    expect(computePayrollNetSalary(10.1236, 0)).toBe(10.124);
  });

  it("treats non-numeric inputs as zero (defensive)", () => {
    expect(computePayrollNetSalary(NaN, NaN)).toBe(0);
    expect(computePayrollNetSalary(100, Number("abc"))).toBe(100);
  });

  it("sums only advances within the target month", () => {
    const advances = [
      { amount: 100, advanceDate: new Date("2026-07-05T10:00:00Z") },
      { amount: 50, advanceDate: new Date("2026-07-20T10:00:00Z") },
      { amount: 999, advanceDate: new Date("2026-06-30T10:00:00Z") }, // previous month
      { amount: 999, advanceDate: new Date("2026-08-01T10:00:00Z") }, // next month
    ];
    expect(sumAdvancesForMonth(advances, 2026, 7)).toBe(150);
  });

  it("returns 0 when there are no advances in the month", () => {
    const advances = [{ amount: 999, advanceDate: new Date("2026-06-15T10:00:00Z") }];
    expect(sumAdvancesForMonth(advances, 2026, 7)).toBe(0);
  });

  it("parses a YYYY-MM period", () => {
    expect(parsePeriodMonth("2026-07")).toEqual({ year: 2026, month: 7 });
  });

  it("end-to-end: net for a month matches base minus that month's advances", () => {
    const base = 500;
    const advances = [
      { amount: 100, advanceDate: new Date("2026-07-05T10:00:00Z") },
      { amount: 50, advanceDate: new Date("2026-07-20T10:00:00Z") },
    ];
    const deducted = sumAdvancesForMonth(advances, 2026, 7);
    expect(deducted).toBe(150);
    expect(computePayrollNetSalary(base, deducted)).toBe(350);
  });
});
