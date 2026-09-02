import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Reads the whole Supabase repository layer (all split domain modules joined
 * in lexical order) for source-contract assertions that previously targeted
 * the single repositories.ts file.
 */
export function repositoriesSource(): string {
  const dir = resolve(process.cwd(), "src/infrastructure/supabase/repositories");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}
