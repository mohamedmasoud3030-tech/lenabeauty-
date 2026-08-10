import { describe, expect, it } from "vitest";
import {
  formatSalonDate,
  formatSalonTime,
  formatSalonDateTime,
  formatSalonMonthYear,
  formatSalonWeekdayLong,
  formatSalonDayHeader,
  SALON_TIMEZONE,
} from "../shared/dateTime";

// 2026-08-10 21:00 in the salon timezone (Asia/Muscat, UTC+4).
const evening = new Date("2026-08-10T21:00:00+04:00");
// 2026-08-10 09:00 in the salon timezone.
const morning = new Date("2026-08-10T09:00:00+04:00");

describe("Arabic salon date/time formatter", () => {
  it("formats a date as day month year in Arabic", () => {
    expect(formatSalonDate(evening, "ar")).toBe("10 أغسطس 2026");
  });

  it("formats a date in English when lang is en", () => {
    expect(formatSalonDate(evening, "en")).toBe("10 Aug 2026");
  });

  it("formats an evening time as 12-hour with م", () => {
    expect(formatSalonTime(evening, "ar")).toBe("9:00 م");
  });

  it("formats a morning time as 12-hour with ص", () => {
    expect(formatSalonTime(morning, "ar")).toBe("9:00 ص");
  });

  it("formats an evening time in English as AM/PM", () => {
    expect(formatSalonTime(evening, "en")).toBe("9:00 PM");
  });

  it("combines date and time", () => {
    expect(formatSalonDateTime(evening, "ar")).toBe("10 أغسطس 2026 · 9:00 م");
  });

  it("formats month and year", () => {
    expect(formatSalonMonthYear(evening, "ar")).toBe("أغسطس 2026");
  });

  it("formats a long weekday in Arabic", () => {
    // 2026-08-10 is a Monday.
    expect(formatSalonWeekdayLong(evening, "ar")).toBe("الاثنين");
  });

  it("formats a compact day header", () => {
    expect(formatSalonDayHeader(evening, "ar")).toBe("اثن 10");
  });

  it("defaults to Arabic when no lang is given", () => {
    expect(formatSalonDate(evening)).toBe("10 أغسطس 2026");
    expect(formatSalonTime(evening)).toBe("9:00 م");
  });

  it("returns a neutral dash for invalid dates instead of throwing", () => {
    expect(formatSalonDate(new Date("not-a-date"), "ar")).toBe("—");
    expect(formatSalonTime(new Date("not-a-date"), "ar")).toBe("—");
  });

  it("uses the approved salon timezone", () => {
    expect(SALON_TIMEZONE).toBe("Asia/Muscat");
    // The same instant renders as the 10th in Muscat (UTC+4), not the 10th
    // elsewhere — a UTC 17:00 instant is 21:00 in Muscat on the same day.
    expect(formatSalonTime(new Date("2026-08-10T17:00:00Z"), "ar")).toBe("9:00 م");
  });
});
