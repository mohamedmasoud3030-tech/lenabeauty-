import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const srcDir = resolve(root, "src");
const migrationsDir = resolve(root, "supabase/migrations");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk(srcDir).filter((path) => /\.(ts|tsx)$/.test(path));
const rpcUsage = new Map();
const rpcPattern = /\.rpc\(\s*["'`]([^"'`]+)["'`]/g;
for (const path of sourceFiles) {
  const text = readFileSync(path, "utf8");
  let match;
  while ((match = rpcPattern.exec(text))) {
    const name = match[1];
    const hits = rpcUsage.get(name) ?? [];
    hits.push(relative(root, path));
    rpcUsage.set(name, hits);
  }
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationSql = migrationFiles.map((name) => readFileSync(resolve(migrationsDir, name), "utf8")).join("\n");

const missing = [];
for (const name of [...rpcUsage.keys()].sort()) {
  const definition = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "i");
  if (!definition.test(migrationSql)) missing.push(name);
}

const requiredExtensions = new Set();
for (const match of migrationSql.matchAll(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/gi)) {
  requiredExtensions.add(match[1].toLowerCase());
}

console.log(`RPC calls referenced by src/: ${rpcUsage.size}`);
for (const [name, files] of [...rpcUsage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(` - ${name}: ${[...new Set(files)].join(", ")}`);
}
console.log(`Canonical migrations: ${migrationFiles.length}`);
console.log(`Extensions declared by migrations: ${[...requiredExtensions].sort().join(", ") || "none"}`);

if (missing.length) {
  console.error(`Missing canonical RPC definitions: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("PASS all frontend RPC references have canonical migration definitions");
