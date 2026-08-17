import type { AttendanceStatus } from "./entities";

/** Parses the database/UI time-of-day forms without relying on Date parsing. */
export function timeOfDayMinutes(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/^(?:\d{4}-\d{2}-\d{2}T)?(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isCheckoutAfterCheckin(checkIn?: string, checkOut?: string): boolean {
  const inMinutes = timeOfDayMinutes(checkIn);
  const outMinutes = timeOfDayMinutes(checkOut);
  return inMinutes !== null && outMinutes !== null && outMinutes > inMinutes;
}

export function computeAttendanceWorkHours(
  checkIn?: string,
  checkOut?: string,
  status?: AttendanceStatus,
): number {
  if (status === "ABSENT") return 0;
  if (!isCheckoutAfterCheckin(checkIn, checkOut)) return 0;
  const inMinutes = timeOfDayMinutes(checkIn)!;
  const outMinutes = timeOfDayMinutes(checkOut)!;
  return Math.round(((outMinutes - inMinutes) / 60) * 100) / 100;
}
