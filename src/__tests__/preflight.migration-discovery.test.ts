import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The live preflight must discover migrations from disk, never from a
 * hand-maintained array.
 */

const ROOT = resolve(process.cwd());
const source = readFileSync(resolve(ROOT, "scripts/supabase-live-preflight.mjs"), "utf8");
const keyAuthority = readFileSync(resolve(ROOT, "scripts/lib/supabase-key-authority.mjs"), "utf8");
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

  it("applies the shared browser-key authority guard before any live check", () => {
    expect(packageJson.scripts["preflight:supabase"]).toBe("node scripts/supabase-live-preflight.mjs");
    expect(source).toContain('from "./lib/supabase-key-authority.mjs"');
    const guard = source.indexOf("isPrivilegedPublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY)");
    const firstLiveCheck = source.indexOf("await fetch(");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(firstLiveCheck);
    expect(keyAuthority).toContain('legacyJwtRole(key) === "service_role"');
    expect(keyAuthority).toContain("MODERN_PRIVILEGED_PREFIX");
  });
});
