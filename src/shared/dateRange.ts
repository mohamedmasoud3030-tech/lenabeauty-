const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseLocalDateOnly(value: string, field: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) throw new Error(`${field} must be a YYYY-MM-DD date`);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day, 0, 0, 0, 0);

  // The Date constructor normalizes impossible dates (for example Feb 30), so
  // compare the calendar fields and reject rather than silently moving days.
  if (
    date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    throw new Error(`${field} is not a valid calendar date`);
  }

  return date;
}

export function formatLocalDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("date is invalid");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert an inclusive local calendar-date selection into an instant range.
 *
 * The upper bound is the start of the next local day and must be queried with
 * `<`, never `<=`. Constructing the next date by calendar fields also remains
 * correct across daylight-saving transitions without a 23:59:59.999 sentinel.
 */
export function localDateRangeISO(fromDateOnly: string, toDateOnly: string): {
  fromISO: string;
  toExclusiveISO: string;
} {
  const from = parseLocalDateOnly(fromDateOnly, "from");
  const to = parseLocalDateOnly(toDateOnly, "to");
  if (from.getTime() > to.getTime()) {
    throw new Error("from date must not be after to date");
  }

  const toExclusive = new Date(
    to.getFullYear(),
    to.getMonth(),
    to.getDate() + 1,
    0,
    0,
    0,
    0,
  );

  return {
    fromISO: from.toISOString(),
    toExclusiveISO: toExclusive.toISOString(),
  };
}
