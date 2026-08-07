import { describe, expect, it } from "vitest";
import {
  requiredText, optionalText, parseFinite, nonNegativeNumber, positiveNumber,
  nonNegativeInteger, positiveInteger, percentField, numberField,
  dateField, dateRangeField, phoneField, emailField, collectIssues, issuesToMap,
  DomainValidationError,
} from "../domain/validation";

describe("parseFinite", () => {
  it("accepts finite numbers", () => {
    expect(parseFinite(5)).toEqual({ ok: true, value: 5 });
    expect(parseFinite(0)).toEqual({ ok: true, value: 0 });
    expect(parseFinite("-3.5")).toEqual({ ok: true, value: -3.5 });
    expect(parseFinite("  12 ")).toEqual({ ok: true, value: 12 });
  });
  it("rejects NaN, Infinity, empty text, and non-numeric text", () => {
    expect(parseFinite(NaN)).toEqual({ ok: false });
    expect(parseFinite(Infinity)).toEqual({ ok: false });
    expect(parseFinite("")).toEqual({ ok: false });
    expect(parseFinite("  ")).toEqual({ ok: false });
    expect(parseFinite("abc")).toEqual({ ok: false });
    expect(parseFinite(undefined)).toEqual({ ok: false });
  });
});

describe("requiredText", () => {
  it("trims and accepts non-empty text", () => {
    expect(requiredText("  Haircut  ")).toEqual({ ok: true, value: "Haircut" });
  });
  it("rejects blank / missing / non-string", () => {
    expect(requiredText("").ok).toBe(false);
    expect(requiredText("   ").ok).toBe(false);
    expect(requiredText(undefined).ok).toBe(false);
    expect(requiredText(null).ok).toBe(false);
    expect(requiredText(123).ok).toBe(false);
  });
});

describe("numberField", () => {
  it("distinguishes empty, invalid, negative, and zero-where-forbidden", () => {
    expect(nonNegativeNumber("").ok).toBe(false); // empty
    expect(nonNegativeNumber("abc").ok).toBe(false); // invalid
    expect(nonNegativeNumber("-1")).toEqual({ ok: false, key: "validation.number_non_negative" });
    expect(nonNegativeNumber("0")).toEqual({ ok: true, value: 0 }); // zero allowed
    expect(positiveNumber("0")).toEqual({ ok: false, key: "validation.number_positive" });
    expect(positiveNumber("5")).toEqual({ ok: true, value: 5 });
  });
  it("enforces integer-only for quantity fields", () => {
    expect(nonNegativeInteger("3")).toEqual({ ok: true, value: 3 });
    expect(nonNegativeInteger("3.5")).toEqual({ ok: false, key: "validation.number_integer" });
    expect(nonNegativeInteger("-1").ok).toBe(false);
  });
  it("binds percentages to 0..100", () => {
    expect(percentField("0")).toEqual({ ok: true, value: 0 });
    expect(percentField("100")).toEqual({ ok: true, value: 100 });
    expect(percentField("101")).toEqual({ ok: false, key: "validation.over_max" });
    expect(percentField("-5").ok).toBe(false);
  });
  it("does not silently convert text to zero", () => {
    // The critical regression: 'abc' must be an error, never 0.
    const r = nonNegativeNumber("abc");
    expect(r.ok).toBe(false);
    expect(numberField("", { required: true }).ok).toBe(false);
  });
});

describe("date / range", () => {
  it("accepts valid dates and rejects invalid ones", () => {
    expect(dateField("2026-08-01T10:00:00Z", { required: true }).ok).toBe(true);
    expect(dateField("not-a-date", { required: true }).ok).toBe(false);
    expect(dateField(undefined, { required: true }).ok).toBe(false);
    expect(dateField(undefined, { required: false }).ok).toBe(true);
  });
  it("rejects a range where from is after to", () => {
    const bad = dateRangeField("2026-08-10T00:00:00Z", "2026-08-01T00:00:00Z");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.key).toBe("validation.date_range");
    const good = dateRangeField("2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z");
    expect(good.ok).toBe(true);
  });
});

describe("phone / email", () => {
  it("validates phone format and normalizes", () => {
    expect(phoneField("968 9123 4567").ok).toBe(true);
    expect(phoneField("+96891234567").ok).toBe(true);
    expect(phoneField("abc").ok).toBe(false);
    expect(phoneField("").ok).toBe(true); // optional
    expect(phoneField("", { required: true }).ok).toBe(false);
  });
  it("validates email format", () => {
    expect(emailField("a@b.com").ok).toBe(true);
    expect(emailField("nope").ok).toBe(false);
    expect(emailField(undefined).ok).toBe(true);
  });
});

describe("aggregation helpers", () => {
  it("collects only failed issues and maps them by field", () => {
    const issues = collectIssues([
      { field: "name", result: requiredText("ok") },
      { field: "price", result: nonNegativeNumber("-1") },
      { field: "duration", result: positiveInteger("0") },
    ]);
    expect(issues).toHaveLength(2);
    const map = issuesToMap(issues);
    expect(map.price).toBe("validation.number_non_negative");
    expect(map.duration).toBe("validation.number_positive");
    expect(map.name).toBeUndefined();
  });
  it("DomainValidationError carries a stable VALIDATION_ERROR code", () => {
    const err = new DomainValidationError([{ field: "price", key: "validation.number_invalid" }]);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.issues).toHaveLength(1);
  });
});

describe("optionalText", () => {
  it("returns undefined for blank and trimmed text otherwise", () => {
    expect(optionalText(undefined)).toEqual({ ok: true, value: undefined });
    expect(optionalText("   ")).toEqual({ ok: true, value: undefined });
    expect(optionalText(" hi ")).toEqual({ ok: true, value: "hi" });
  });
});
