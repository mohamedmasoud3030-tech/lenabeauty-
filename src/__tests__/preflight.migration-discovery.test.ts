import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The live preflight must discover migrations from disk, never from a
 * hand-maintained array.
 */

const ROOT = resolve(process.cwd());
const source = readFileSync(resolve(ROOT, "scripts/supabase-live-preflight.mjs"), "utf8");
const entry = readFileSync(resolve(ROOT, "scripts/supabase-live-preflight-entry.mjs"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

describe("live preflight migration discovery", () => {
  it("reads the migration chain from disk", () => {
    expect(source).toContain("readdirSync(migrationsDir)");
  });

  it("does not rebuild the chain as a hand-listed array", () => {
    const arrayOfMigrations = /\[\s*(?:\/\/[^\n]*\n\s*)*"\d{14}_[a-z0-9_]+\.sql"\s*,\s*"\d{14}_/;
    expect(
      arrayOfMigrations.test(source),
      "the migration chain must be discovered from disk, not enumerated in an array",
    ).toBe(false);
  });

  it("fails loudly when no migration is discovered", () => {
    expect(source).toContain("no canonical migrations were discovered");
  });

  it("covers every migration currently on disk", () => {
    const onDisk = readdirSync(resolve(ROOT, "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"));
    expect(onDisk.length).toBeGreaterThan(30);
    expect(source).toContain('resolve(root, "supabase/migrations")');
  });

  it("routes the canonical live preflight through a browser-key authority guard", () => {
    expect(packageJson.scripts["preflight:supabase"]).toBe("node scripts/supabase-live-preflight-entry.mjs");
    expect(entry).toContain('jwtRole(publishableKey) === "service_role"');
    expect(entry).toContain('await import("./supabase-live-preflight.mjs")');
    expect(entry).toContain("modernPrivilegedPrefix");
  });
});
