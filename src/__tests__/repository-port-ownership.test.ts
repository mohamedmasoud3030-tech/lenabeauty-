import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const DOMAIN_PORT_FILES = [
  "appointments.ts",
  "auth.ts",
  "customers.ts",
  "employees.ts",
  "engagement.ts",
  "finance.ts",
  "inventory.ts",
  "reports.ts",
  "services.ts",
  "settings.ts",
  "shared.ts",
  "workforce.ts",
] as const;

describe("repository port ownership", () => {
  it("keeps the legacy repositories.ts path as a compatibility facade only", () => {
    const facade = read("src/domain/ports/repositories.ts");
    expect(facade).toContain('export * from "./repositories/index"');
    expect(facade).not.toMatch(/\binterface\s+\w+Repository\b/);
    expect(facade).not.toMatch(/\btype\s+(Result|DomainError|AuthError)\b/);
  });

  it("owns repository contracts in explicit business-domain files", () => {
    const dir = resolve(ROOT, "src/domain/ports/repositories");
    const actual = readdirSync(dir).filter((name) => name.endsWith(".ts") && name !== "index.ts").sort();
    expect(actual).toEqual([...DOMAIN_PORT_FILES].sort());

    const index = read("src/domain/ports/repositories/index.ts");
    for (const file of DOMAIN_PORT_FILES) {
      expect(index).toContain(`export * from "./${file.replace(/\.ts$/, "")}"`);
    }
  });

  it("does not let domain ports depend on Supabase or UI layers", () => {
    for (const file of DOMAIN_PORT_FILES) {
      const source = read(`src/domain/ports/repositories/${file}`);
      expect(source, file).not.toContain("supabase");
      expect(source, file).not.toContain("/pages/");
      expect(source, file).not.toContain("shared/components");
    }
  });
});
