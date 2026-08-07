/**
 * Domain validation primitives (pure, deterministic, framework-agnostic).
 * ----------------------------------------------------------------------
 * Single source of truth for parsing + validating user/business input so the
 * UI forms, the repository boundary, and unit tests all agree exactly.
 *
 * Design rules:
 *  - NO `Number(x) || 0` silent conversions. Invalid text is an error, never 0.
 *  - Distinguish empty / invalid / negative / zero-where-forbidden.
 *  - Every failure carries a STABLE i18n key (not a literal language string)
 *    so Arabic and English both resolve via the existing i18n layer.
 *  - Pure functions only; no I/O, no framework imports.
 */

export interface ValidationIssue {
  /** Field identifier used by forms to render the error inline. */
  field: string;
  /** Stable i18n key resolved through `t(...)` in the UI. */
  key: string;
}

/** Structured, localized-friendly validation failure. */
export class DomainValidationError extends Error {
  code = "VALIDATION_ERROR" as const;
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[], message?: string) {
    super(message || "Invalid input");
    this.name = "DomainValidationError";
    this.issues = issues;
  }
}

/** Stable i18n keys. Keep in sync with src/i18n.ts (ar + en). */
export const ValidationKeys = {
  required: "validation.required",
  required_select: "validation.required_select",
  number_invalid: "validation.number_invalid",
  number_non_negative: "validation.number_non_negative",
  number_positive: "validation.number_positive",
  number_integer: "validation.number_integer",
  percent_range: "validation.percent_range",
  over_max: "validation.over_max",
  phone_invalid: "validation.phone_invalid",
  email_invalid: "validation.email_invalid",
  date_invalid: "validation.date_invalid",
  date_range: "validation.date_range",
  past_date: "validation.past_date",
  checkout_after_checkin: "validation.checkout_after_checkin",
} as const;

export type ValidationKey = (typeof ValidationKeys)[keyof typeof ValidationKeys];

/** Result of a single field check: either a normalized value or an error key. */
export type FieldResult<T> = { ok: true; value: T } | { ok: false; key: ValidationKey };

/** True when a raw value is empty (undefined / null / blank string). */
export function isBlank(raw: unknown): boolean {
  return (
    raw === undefined ||
    raw === null ||
    (typeof raw === "string" && raw.trim().length === 0)
  );
}

/** Parse a raw value into a finite number, rejecting NaN/Infinity/empty text. */
export function parseFinite(raw: unknown): { ok: true; value: number } | { ok: false } {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false };
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return { ok: true, value: n };
  }
  return { ok: false };
}

/* --------------------------------------------------------------------- *
 * Text fields
 * --------------------------------------------------------------------- */

export function requiredText(raw: unknown): FieldResult<string> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, key: ValidationKeys.required };
  }
  return { ok: true, value: raw.trim() };
}

export function optionalText(raw: unknown): FieldResult<string | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== "string") return { ok: false, key: ValidationKeys.required };
  const trimmed = raw.trim();
  return { ok: true, value: trimmed.length ? trimmed : undefined };
}

/* --------------------------------------------------------------------- *
 * Numeric fields
 * --------------------------------------------------------------------- */

export interface NumberOpts {
  /** When true (default), a blank/absent value is an error. */
  required?: boolean;
  /** Inclusive lower bound. 0 means "non-negative". */
  min?: number;
  /** Inclusive upper bound. */
  max?: number;
  /** When true, only whole integers pass. */
  integer?: boolean;
  /** When false, an explicit 0 is rejected (strictly positive). */
  allowZero?: boolean;
}

export function numberField(raw: unknown, opts: NumberOpts = {}): FieldResult<number> {
  const {
    required = true,
    min,
    max,
    integer = false,
    allowZero = true,
  } = opts;

  if (isBlank(raw)) {
    if (!required) return { ok: true, value: 0 };
    return { ok: false, key: ValidationKeys.required };
  }

  const parsed = parseFinite(raw);
  if (!parsed.ok) return { ok: false, key: ValidationKeys.number_invalid };

  const n = parsed.value;
  if (integer && !Number.isInteger(n)) {
    return { ok: false, key: ValidationKeys.number_integer };
  }
  if (min !== undefined && n < min) {
    return { ok: false, key: ValidationKeys.number_non_negative };
  }
  if (max !== undefined && n > max) {
    return { ok: false, key: ValidationKeys.over_max };
  }
  if (!allowZero && n === 0) {
    return { ok: false, key: ValidationKeys.number_positive };
  }
  return { ok: true, value: n };
}

/** Non-negative number (>= 0). */
export function nonNegativeNumber(raw: unknown, opts?: Omit<NumberOpts, "min" | "allowZero">): FieldResult<number> {
  return numberField(raw, { ...opts, min: 0, allowZero: true });
}

/** Strictly positive number (> 0). */
export function positiveNumber(raw: unknown, opts?: Omit<NumberOpts, "min" | "allowZero">): FieldResult<number> {
  return numberField(raw, { ...opts, min: 0, allowZero: false });
}

/** Non-negative whole number (>= 0 integer). */
export function nonNegativeInteger(raw: unknown, opts?: Omit<NumberOpts, "min" | "integer" | "allowZero">): FieldResult<number> {
  return numberField(raw, { ...opts, min: 0, integer: true, allowZero: true });
}

/** Strictly positive whole number (>= 1 integer). */
export function positiveInteger(raw: unknown, opts?: Omit<NumberOpts, "min" | "integer" | "allowZero">): FieldResult<number> {
  return numberField(raw, { ...opts, min: 0, integer: true, allowZero: false });
}

/** Percentage bounded 0..100. */
export function percentField(raw: unknown, opts?: Omit<NumberOpts, "min" | "max">): FieldResult<number> {
  return numberField(raw, { ...opts, min: 0, max: 100 });
}

/* --------------------------------------------------------------------- *
 * Date / time fields
 * --------------------------------------------------------------------- */

export function dateField(raw: unknown, opts: { required?: boolean } = {}): FieldResult<Date | undefined> {
  const required = opts.required ?? false;
  if (isBlank(raw)) {
    if (required) return { ok: false, key: ValidationKeys.date_invalid };
    return { ok: true, value: undefined };
  }
  const d = new Date(raw as string | number | Date);
  if (Number.isNaN(d.getTime())) return { ok: false, key: ValidationKeys.date_invalid };
  return { ok: true, value: d };
}

export function dateRangeField(
  fromRaw: unknown,
  toRaw: unknown
): { ok: true; from: Date; to: Date } | { ok: false; key: ValidationKey } {
  const from = new Date(fromRaw as string | number | Date);
  const to = new Date(toRaw as string | number | Date);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, key: ValidationKeys.date_invalid };
  }
  if (from.getTime() > to.getTime()) {
    return { ok: false, key: ValidationKeys.date_range };
  }
  return { ok: true, from, to };
}

/** Reject appointments/dateTimes in the past (allowing the current instant). */
export function notInPastField(raw: unknown, opts: { required?: boolean } = {}): FieldResult<Date> {
  const d = dateField(raw, { required: opts.required ?? false });
  if (!d.ok) return d;
  const date = d.value as Date;
  if (date.getTime() < Date.now() - 60_000) {
    return { ok: false, key: ValidationKeys.past_date };
  }
  return { ok: true, value: date };
}

/* --------------------------------------------------------------------- *
 * Phone / email
 * --------------------------------------------------------------------- */

const PHONE_RE = /^\+?[0-9][0-9\s\-()]{4,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function phoneField(raw: unknown, opts: { required?: boolean } = {}): FieldResult<string | undefined> {
  const required = opts.required ?? false;
  if (isBlank(raw)) {
    if (required) return { ok: false, key: ValidationKeys.phone_invalid };
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") return { ok: false, key: ValidationKeys.phone_invalid };
  const p = raw.trim();
  if (!PHONE_RE.test(p)) return { ok: false, key: ValidationKeys.phone_invalid };
  return { ok: true, value: p };
}

export function emailField(raw: unknown, opts: { required?: boolean } = {}): FieldResult<string | undefined> {
  const required = opts.required ?? false;
  if (isBlank(raw)) {
    if (required) return { ok: false, key: ValidationKeys.email_invalid };
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") return { ok: false, key: ValidationKeys.email_invalid };
  const e = raw.trim();
  if (!EMAIL_RE.test(e)) return { ok: false, key: ValidationKeys.email_invalid };
  return { ok: true, value: e };
}

/* --------------------------------------------------------------------- *
 * Aggregation
 * --------------------------------------------------------------------- */

/** Convert a list of (field -> result) pairs into the issues that failed. */
export function collectIssues(results: { field: string; result: FieldResult<unknown> }[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const r of results) {
    if (!r.result.ok) issues.push({ field: r.field, key: r.result.key });
  }
  return issues;
}

/** Convert issues into a `field -> i18n key` map for inline form errors. */
export function issuesToMap(issues: ValidationIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    if (map[issue.field] === undefined) map[issue.field] = issue.key;
  }
  return map;
}
