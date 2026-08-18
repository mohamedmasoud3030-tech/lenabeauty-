import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The live preflight must discover migrations from disk, never from a
 * hand-maintained array.
 *
 * The hardcoded list had silently rotted: it ended at 20260817000003 while the
 * repository already contained 20260817000004 and 20260817000005. The preflight
 * still reported PASS, so the two newest migrations — attendance integrity and
 * storage upload hardening — were never verified against the live schema. A
 * verification tool that quietly checks less than it claims is worse than no
 * tool, because it manufactures false confidence right before a release.
 */

const ROOT = resolve(process.cwd());
const source = readFileSync(resolve(ROOT, "scripts/supabase-live-preflight.mjs"), "utf8");

describe("live preflight migration discovery", () => {
  it("reads the migration chain from disk", () => {
    expect(source).toContain("readdirSync(migrationsDir)");
  });

  it("does not rebuild the chain as a hand-listed array", () => {
    // Targeted single-file reads (e.g. asserting one migration's contents) are
    // legitimate. What must never come back is an ARRAY of migration names
    // standing in for the chain, because that is the construct that rots.
    const arrayOfMigrations = /\[\s*(?:\/\/[^\n]*\n\s*)*"\d{14}_[a-z0-9_]+\.sql"\s*,\s*"\d{14}_/;
    expect(
      arrayOfMigrations.test(source),
      "the migration chain must be discovered from disk, not enumerated in an array",
    ).toBe(false);
  });

  it("fails loudly when no migration is discovered", () => {
    // An empty directory must abort rather than vacuously "pass" zero checks.
    expect(source).toContain("no canonical migrations were discovered");
  });

  it("covers every migration currently on disk", () => {
    const onDisk = readdirSync(resolve(ROOT, "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"));
    expect(onDisk.length).toBeGreaterThan(30);
    // Discovery is by definition complete; this asserts the directory the
    // preflight reads is the canonical one the chain checker also uses.
    expect(source).toContain('resolve(root, "supabase/migrations")');
  });
});
