import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");
const sourceExts = new Set([".ts", ".tsx"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (sourceExts.has(extname(path))) out.push(path);
  }
  return out;
}

const all = walk(SRC).filter((path) => {
  const r = relative(ROOT, path).replaceAll("\\", "/");
  return !r.includes("/__tests__/") && !/\.(test|spec)\.[jt]sx?$/.test(r) && !r.endsWith(".d.ts");
});
const allSet = new Set(all.map((p) => normalize(p)));

function resolveLocal(fromFile, spec) {
  let base;
  if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else if (spec.startsWith("@/")) base = resolve(ROOT, spec.slice(2));
  else return null;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ].map(normalize);
  return candidates.find((candidate) => allSet.has(candidate)) ?? null;
}

const patterns = [
  /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const edges = new Map();
for (const file of all) {
  const text = readFileSync(file, "utf8");
  const deps = new Set();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const dep = resolveLocal(file, match[1]);
      if (dep) deps.add(dep);
    }
  }
  edges.set(normalize(file), deps);
}

const roots = [resolve(SRC, "main.tsx")].map(normalize);
const reached = new Set();
const stack = roots.filter((r) => allSet.has(r));
while (stack.length) {
  const file = stack.pop();
  if (!file || reached.has(file)) continue;
  reached.add(file);
  for (const dep of edges.get(file) ?? []) if (!reached.has(dep)) stack.push(dep);
}

const unreachable = [...allSet]
  .filter((file) => !reached.has(file))
  .map((file) => relative(ROOT, file).replaceAll("\\", "/"))
  .sort();

console.log(`RUNTIME_SOURCE_FILES=${allSet.size}`);
console.log(`RUNTIME_REACHABLE_FILES=${reached.size}`);
console.log(`RUNTIME_UNREACHABLE_FILES=${unreachable.length}`);
for (const file of unreachable) console.log(`UNREACHABLE_RUNTIME:${file}`);
