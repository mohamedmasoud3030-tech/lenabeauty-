#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".mjs"]);
const violations = [];

async function filesUnder(dir) {
  const entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (EXTENSIONS.has(extname(entry.name))) files.push(child);
  }
  return files;
}

for (const dir of SCAN_DIRS) {
  for (const file of await filesUnder(dir)) {
    const source = await readFile(join(ROOT, file), "utf8");

    if (/\b(?:describe|it|test)\.(?:only|skip)\s*\(/.test(source)) {
      violations.push(`${file}: focused/skipped test is not permitted`);
    }

    if (file.startsWith("src/pages/") && source.includes("fixed inset-0")) {
      violations.push(`${file}: page-local fixed overlay bypasses shared accessibility layers`);
    }

    for (const match of source.matchAll(/<button\b[\s\S]*?>/g)) {
      const openingTag = match[0];
      const undersized = /\bh-(?:9|10)\b/.test(openingTag);
      const compensated = /\b(?:min-h-11|touch-target)\b/.test(openingTag);
      if (undersized && !compensated) {
        const line = source.slice(0, match.index).split("\n").length;
        violations.push(`${file}:${line}: button target is below 44px without a touch-target minimum`);
      }
    }
  }
}

const repositories = await readFile(join(ROOT, "src/infrastructure/supabase/repositories.ts"), "utf8");
if (/\.or\s*\(/.test(repositories)) {
  violations.push("src/infrastructure/supabase/repositories.ts: raw PostgREST .or() grammar is not permitted");
}

if (violations.length > 0) {
  console.error("SOURCE POLICY LINT: FAILED");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

const fileCount = (await Promise.all(SCAN_DIRS.map(filesUnder))).flat().length;
console.log(`SOURCE POLICY LINT: PASS (${fileCount} files)`);
