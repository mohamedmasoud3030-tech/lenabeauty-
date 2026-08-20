/**
 * Deterministic Arabic-first date/time formatting for the salon's daily flow.
 *
 * Why not `toLocaleDateString('ar', ...)`?
 *  - The browser/ICU locale may be missing Arabic data, producing English
 *    month names ("Aug 2026 10") and English AM/PM ("PM 9:00") that then
 *    reorder badly inside RTL.
 *  - Locale string parsing is fragile and environment-dependent.
 *
 * This module extracts numeric parts via `Intl.DateTimeFormat.formatToParts`
 * with a fixed salon timezone, then assembles readable output from fixed
 * Arabic/English month and meridiem arrays. Output is stable across browsers
 * and node, and stays correctly ordered inside RTL content.
 */

/** The salon operates in the Gulf (Oman, UTC+4). */
export const SALON_TIMEZONE = "Asia/Muscat";

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const AR_WEEKDAYS_LONG = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];
const AR_WEEKDAYS_SHORT = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
const EN_WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SalonParts {
  year: number;
  monthIndex: number; // 0-11
  day: number;
  weekday: number; // 0-6 (Sunday=0)
  hour24: number; // 0-23
  minute: number;
}

/** Extract deterministic calendar/time parts in the salon timezone. */
function toSalonParts(date: Date): SalonParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const map = new Map<string, string>();
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map.set(part.type, part.value);
  }

  const toNum = (key: string): number => {
    const v = map.get(key);
    return v ? Number(v) : 0;
  };

  let hour = toNum("hour");
  // Some runtimes emit "24" at midnight with hour12:false; normalize.
  if (hour === 24) hour = 0;

  const weekdayStr = map.get("weekday") ?? "";
  const weekday = EN_WEEKDAYS_SHORT.findIndex(
    (w) => weekdayStr.toLowerCase() === w.toLowerCase()
  );

  return {
    year: toNum("year"),
    monthIndex: toNum("month") - 1,
    day: toNum("day"),
    weekday: weekday >= 0 ? weekday : 0,
    hour24: hour,
    minute: toNum("minute"),
  };
}

function isArabic(lang?: string): boolean {
  return !lang || lang === "ar" || lang.startsWith("ar");
}

/** "10 أغسطس 2026" (ar) / "10 Aug 2026" (en). */
export function formatSalonDate(date: Date | string | number, lang?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const p = toSalonParts(d);
  if (isArabic(lang)) return `${p.day} ${AR_MONTHS[p.monthIndex]} ${p.year}`;
  return `${p.day} ${EN_MONTHS_SHORT[p.monthIndex]} ${p.year}`;
}

/** "9:00 م" (ar) / "9:00 PM" (en) — 12-hour, no locale parsing. */
export function formatSalonTime(date: Date | string | number, lang?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const p = toSalonParts(d);
  const h12 = p.hour24 % 12 || 12;
  const mm = String(p.minute).padStart(2, "0");
  if (isArabic(lang)) return `${h12}:${mm} ${p.hour24 < 12 ? "ص" : "م"}`;
  return `${h12}:${mm} ${p.hour24 < 12 ? "AM" : "PM"}`;
}

/** "10 أغسطس 2026 · 9:00 م". */
export function formatSalonDateTime(date: Date | string | number, lang?: string): string {
  return `${formatSalonDate(date, lang)} · ${formatSalonTime(date, lang)}`;
}

/** "أغسطس 2026" (ar) / "Aug 2026" (en). */
export function formatSalonMonthYear(date: Date | string | number, lang?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const p = toSalonParts(d);
  if (isArabic(lang)) return `${AR_MONTHS[p.monthIndex]} ${p.year}`;
  return `${EN_MONTHS_SHORT[p.monthIndex]} ${p.year}`;
}

/** Long weekday, e.g. "السبت" / "Saturday". */
export function formatSalonWeekdayLong(date: Date | string | number, lang?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const p = toSalonParts(d);
  if (isArabic(lang)) return AR_WEEKDAYS_LONG[p.weekday];
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][p.weekday];
}

/** Short weekday + day, e.g. "السبت 10" / "Sat 10" — for compact day headers. */
export function formatSalonDayHeader(date: Date | string | number, lang?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const p = toSalonParts(d);
  if (isArabic(lang)) return `${AR_WEEKDAYS_SHORT[p.weekday]} ${p.day}`;
  return `${EN_WEEKDAYS_SHORT[p.weekday]} ${p.day}`;
}


/**
 * Localized medium date — follows the active UI language (Arabic-first).
 * Centralizes the locale choice so pages never hardcode a locale string.
 */
export function formatLocalizedDate(
  date: Date | string | number,
  lang?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const d = date instanceof Date ? date : new Date(date);
  const locale = lang === "ar" ? "ar-OM" : "en-US";
  return d.toLocaleDateString(locale, options);
}

/**
 * Localized short date+time — follows the active UI language.
 */
export function formatLocalizedDateTime(
  date: Date | string | number,
  lang?: string,
): string {
  const d = date instanceof Date ? date : new Date(date);
  const locale = lang === "ar" ? "ar-OM" : "en-US";
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
