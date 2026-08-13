import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "supabase/migrations");
const compareText = (left, right) => left.localeCompare(right);
const MIGRATION_ID_PATTERN = /^\d{14}$/;
// Extension names may be double-quoted (e.g. CREATE EXTENSION IF NOT EXISTS "pgcrypto").
const EXTENSION_PATTERN = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?([\w]+)"?/gi;
const files = readdirSync(dir).filter((file) => file.endsWith(".sql"));
const sorted = [...files].sort(compareText);

if (files.join("\n") !== sorted.join("\n")) {
  console.log("INFO filesystem enumeration is not lexical; canonical order is lexical filename order");
}

const ids = new Map();
let failed = false;
for (const file of sorted) {
  const id = file.split("_")[0];
  if (!MIGRATION_ID_PATTERN.test(id)) {
    console.error(`FAIL invalid migration prefix: ${file}`);
    failed = true;
  }
  if (ids.has(id)) {
    console.error(`FAIL duplicate migration id ${id}: ${ids.get(id)} and ${file}`);
    failed = true;
  } else {
    ids.set(id, file);
  }
}

const sqlByFile = new Map(sorted.map((file) => [file, readFileSync(resolve(dir, file), "utf8")]));
const extensionCreation = new Map();
for (const file of sorted) {
  for (const match of sqlByFile.get(file).matchAll(EXTENSION_PATTERN)) {
    const extension = match[1].toLowerCase();
    if (!extensionCreation.has(extension)) extensionCreation.set(extension, file);
  }
}

// Extensions that MUST be explicitly created before they are used.
//
// `gen_random_uuid()` is intentionally NOT paired with pgcrypto: since
// PostgreSQL 13 it is a core function (Supabase runs PG 15+), so it requires
// no extension. Only routines that still live in the pgcrypto extension
// (crypt(), pgp_sym_encrypt(), gen_salt(), ...) justify a pgcrypto ordering
// requirement.
const requiredPatterns = [
  ["btree_gist", /EXCLUDE\s+USING\s+gist|gist\s*\(/i],
  ["pgcrypto", /\bcrypt\s*\(|pgp_sym_encrypt\s*\(|gen_salt\s*\(/i],
  ["pg_trgm", /gin_trgm_ops|gist_trgm_ops|similarity\s*\(/i],
];

for (const [extension, pattern] of requiredPatterns) {
  const firstUse = sorted.find((file) => pattern.test(sqlByFile.get(file)));
  if (!firstUse) continue;
  const createdIn = extensionCreation.get(extension);
  if (!createdIn) {
    console.error(`FAIL ${extension} is used in ${firstUse} but never explicitly created`);
    failed = true;
  } else if (sorted.indexOf(createdIn) > sorted.indexOf(firstUse)) {
    console.error(`FAIL ${extension} is first created in ${createdIn}, after first use in ${firstUse}`);
    failed = true;
  } else {
    console.log(`PASS ${extension} created in ${createdIn} before first use ${firstUse}`);
  }
}

console.log(`Canonical migration count: ${sorted.length}`);
if (failed) process.exit(1);
console.log("PASS canonical migration identifiers and extension ordering are valid");
