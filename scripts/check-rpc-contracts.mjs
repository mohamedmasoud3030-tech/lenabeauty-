import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const srcDir = resolve(root, "src");
const migrationsDir = resolve(root, "supabase/migrations");
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/;
const RPC_PATTERN = /\.rpc\(\s*["'`]([^"'`]+)["'`]/g;
const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const EXTENSION_PATTERN = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+([\w]+)/gi;
const compareText = (left, right) => left.localeCompare(right);
const compareEntries = ([left], [right]) => compareText(left, right);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk(srcDir).filter((path) => SOURCE_FILE_PATTERN.test(path));
const rpcUsage = new Map();
for (const path of sourceFiles) {
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(RPC_PATTERN)) {
    const name = match[1];
    const hits = rpcUsage.get(name) ?? [];
    hits.push(relative(root, path));
    rpcUsage.set(name, hits);
  }
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort(compareText);
const migrationSql = migrationFiles.map((name) => readFileSync(resolve(migrationsDir, name), "utf8")).join("\n");

const missing = [];
for (const name of [...rpcUsage.keys()].sort(compareText)) {
  const escapedName = name.replace(REGEXP_SPECIAL_CHARS, String.raw`\$&`);
  const definition = new RegExp(String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?${escapedName}\s*\(`, "i");
  if (!definition.test(migrationSql)) missing.push(name);
}

const requiredExtensions = new Set();
for (const match of migrationSql.matchAll(EXTENSION_PATTERN)) {
  requiredExtensions.add(match[1].toLowerCase());
}

console.log(`RPC calls referenced by src/: ${rpcUsage.size}`);
for (const [name, files] of [...rpcUsage.entries()].sort(compareEntries)) {
  console.log(` - ${name}: ${[...new Set(files)].join(", ")}`);
}
console.log(`Canonical migrations: ${migrationFiles.length}`);
console.log(`Extensions declared by migrations: ${[...requiredExtensions].sort(compareText).join(", ") || "none"}`);

if (missing.length) {
  console.error(`Missing canonical RPC definitions: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("PASS all frontend RPC references have canonical migration definitions");
