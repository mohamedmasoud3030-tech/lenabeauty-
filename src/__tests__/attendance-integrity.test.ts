import { describe, expect, it } from "vitest";
import {
  computeAttendanceWorkHours,
  isCheckoutAfterCheckin,
  timeOfDayMinutes,
} from "../domain/attendance";

describe("attendance time integrity", () => {
  it("parses PostgreSQL and UI time-of-day forms", () => {
    expect(timeOfDayMinutes("09:30")).toBe(570);
    expect(timeOfDayMinutes("17:05:00")).toBe(1025);
    expect(timeOfDayMinutes("25:00")).toBeNull();
    expect(timeOfDayMinutes("not-a-time")).toBeNull();
  });

  it("rejects equal, reversed, and malformed checkout times", () => {
    expect(isCheckoutAfterCheckin("09:00", "17:00")).toBe(true);
    expect(isCheckoutAfterCheckin("09:00", "09:00")).toBe(false);
    expect(isCheckoutAfterCheckin("17:00", "09:00")).toBe(false);
    expect(isCheckoutAfterCheckin("bad", "17:00")).toBe(false);
  });

  it("calculates work hours only for a valid non-absent interval", () => {
    expect(computeAttendanceWorkHours("09:00", "17:30", "PRESENT")).toBe(8.5);
    expect(computeAttendanceWorkHours("17:00", "09:00", "PRESENT")).toBe(0);
    expect(computeAttendanceWorkHours("09:00", "17:00", "ABSENT")).toBe(0);
  });
});
