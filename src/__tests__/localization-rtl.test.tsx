/**
 * Localization & RTL enforcement tests.
 *
 * - Physical direction utilities (text-left/right, ml-/mr-) must not appear
 *   in shipped page components (they break RTL).
 * - Latin inputs must carry dir="ltr".
 * - Dates follow the active UI language, not a hardcoded locale.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const PAGES = resolve(__dirname, "../pages");
const SERVICES = resolve(__dirname, "../infrastructure/services");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => resolve(dir, e.name));
}

describe("RTL logical-property enforcement", () => {
  const pages = listFiles(PAGES);

  it("no shipped page uses physical text-left / text-right", () => {
    const offenders: string[] = [];
    for (const p of pages) {
      const c = readFileSync(p, "utf8");
      if (/\btext-(left|right)\b/.test(c)) offenders.push(p.split("/").pop()!);
    }
    expect(offenders).toEqual([]);
  });

  it("no shipped page uses physical ml- / mr- spacing", () => {
    const offenders: string[] = [];
    for (const p of pages) {
      const c = readFileSync(p, "utf8");
      if (/\b(ml|mr)-[0-9]/.test(c)) offenders.push(p.split("/").pop()!);
    }
    expect(offenders).toEqual([]);
  });

  it("email/phone/url inputs carry dir=ltr for correct RTL rendering", () => {
    const samples = listFiles(PAGES);
    const checks: { file: string; ok: boolean }[] = [];
    for (const p of samples) {
      const c = readFileSync(p, "utf8");
      if (/type="(email|tel|url)"/.test(c)) {
        // Every file with a latin input must also contain dir="ltr" so the
        // field renders correctly inside RTL text (allow generous distance —
        // JSX attributes can span many lines).
        checks.push({ file: p.split("/").pop()!, ok: /dir="ltr"/.test(c) });
      }
    }
    const bad = checks.filter((x) => !x.ok);
    expect(bad).toEqual([]);
  });
});

describe("date locale follows active language", () => {
  it("no page hardcodes ar-SA / ar-OM / bare toLocaleDateString()", () => {
    const offenders: string[] = [];
    for (const p of [...listFiles(PAGES), ...listFiles(SERVICES)]) {
      const c = readFileSync(p, "utf8");
      if (
        c.includes('toLocaleDateString("ar-SA")') ||
        c.includes('toLocaleDateString("ar-OM"') ||
        c.includes("toLocaleDateString()") ||
        c.includes('toLocaleDateString("en-US")')
      ) {
        offenders.push(p.split("/").pop()!);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("glossary consistency", () => {
  it("does not use the deprecated 'زبون' for customer in shipped strings", () => {
    const all = [...listFiles(PAGES)]
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    // Interface copy must use the canonical 'عميل'. The word زبون may only
    // appear in user-entered data, never as UI copy.
    expect(all).not.toMatch(/["'`]زبون/);
  });
});
