// Contract matrix + verified findings generator.
//
// Cross-references the replayed schema inventory against scanned frontend
// database usage to produce:
//   - contract-matrix.json  (table/column/embed/rpc/storage resolution results)
//   - audit-findings.json   (stable-ID findings with severity, evidence,
//                            root-cause category, and remediation direction)
//
// Findings are reported only; nothing is fixed in this phase.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const A = resolve(ROOT, "docs/database-contract/artifacts");

const schema = JSON.parse(readFileSync(resolve(A, "schema-inventory.json"), "utf8"));
const frontend = JSON.parse(readFileSync(resolve(A, "frontend-usage.json"), "utf8"));
const replay = JSON.parse(readFileSync(resolve(A, "replay-report.json"), "utf8"));

// ---- indexes --------------------------------------------------------------
const tableNames = new Set(schema.tables.map((t) => t.name));
const colsByTable = new Map();
for (const c of schema.columns) {
  if (!colsByTable.has(c.table)) colsByTable.set(c.table, new Set());
  colsByTable.get(c.table).add(c.name);
}

// FK parsing: pg_get_constraintdef => "FOREIGN KEY (a, b) REFERENCES t(c, d)"
function parseFk(def) {
  const m = /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+([a-zA-Z_0-9".]+)\s*\(([^)]*)\)/.exec(def);
  if (!m) return null;
  return {
    cols: m[1].split(",").map((s) => s.trim()),
    refTable: m[2].replace(/"/g, "").split(".").pop(),
    refCols: m[3].split(",").map((s) => s.trim()),
  };
}
const fks = schema.foreign_keys.map((f) => ({ ...f, parsed: parseFk(f.definition) })).filter((f) => f.parsed);
const fkFromTo = new Map(); // "table -> refTable" set
const fkToFrom = new Map(); // refTable -> [tables]
for (const f of fks) {
  const key = `${f.table}->${f.parsed.refTable}`;
  fkFromTo.set(key, f);
  if (!fkToFrom.has(f.parsed.refTable)) fkToFrom.set(f.parsed.refTable, []);
  fkToFrom.get(f.parsed.refTable).push(f.table);
}

// function parameter names from identity_args ("name type, name type, ...")
function fnParams(identityArgs) {
  return identityArgs
    .split(",")
    .map((s) => s.trim().split(/\s+/)[0])
    .filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s));
}
const fnBySchemaName = new Map(); // "schema.name" -> params
for (const f of schema.functions) {
  fnBySchemaName.set(`${f.schema}.${f.name}`, { params: fnParams(f.identity_args), f });
}

// ---- findings -------------------------------------------------------------
const findings = [];
let seq = 0;
const F = (fields) => {
  seq += 1;
  findings.push({
    id: `DB-${String(seq).padStart(3, "0")}`,
    severity: "info",
    status: "confirmed",
    needs: "no-code-change",
    ...fields,
  });
};

// A. Migration idempotency (replay).
for (const e of replay.idempotency) {
  if (e.status === "non-idempotent") {
    const policy = /policy "([^"]+)" for table "([^"]+)" already exists/.exec(e.error || "");
    F({
      severity: "medium",
      title: `Non-idempotent migration: ${e.file}`,
      category: "migration-idempotency",
      evidence: e.error,
      affected: { migration: e.file, policy: policy?.[1], table: policy?.[2] },
      remediation:
        "Prepend `DROP POLICY IF EXISTS <name> ON <table>;` before the CREATE POLICY so the migration can be re-applied cleanly.",
      needs: "future-migration",
    });
  }
}

// B. Committed Supabase TypeScript types.
F({
  severity: "high",
  title: "No committed Supabase-generated TypeScript types; client is untyped",
  category: "types-missing",
  evidence:
    "src/infrastructure/supabase/client.ts builds `createClient(...)` without a `Database` generic; repository results are read as `any` (no `.returns<T>()`/`.cast<T>()` anywhere in src/). No `Database` type is committed under src/ or a types module.",
  affected: { layer: "src/infrastructure/supabase/**", route: "all data access" },
  remediation:
    "Generate and commit `supabase gen types` output and thread the `Database` generic through the client and repositories.",
  needs: "type-update",
});

// C. Table / column resolution.
const matrix = { tables: [], rpc: [], storage: [], embeds: [] };
for (const t of frontend.tables) {
  const exists = tableNames.has(t.table);
  const missingCols = [];
  const colSet = colsByTable.get(t.table) ?? new Set();
  for (const s of t.selects) {
    for (const c of s.columns) if (!colSet.has(c)) missingCols.push(c);
  }
  for (const c of t.filters) if (!colSet.has(c)) missingCols.push(c);
  const row = {
    table: t.table,
    exists,
    missing_columns: [...new Set(missingCols)],
    embed_results: [],
  };

  if (!exists) {
    F({
      severity: "high",
      title: `Frontend reads a table not present in the replayed schema: ${t.table}`,
      category: "table-missing",
      evidence: `Referenced via .from('${t.table}') in ${t.files.join(", ")}`,
      affected: { table: t.table, files: t.files },
      remediation: "Verify the table is in the canonical migrations; if missing, add a migration (or correct the frontend).",
      needs: "manual-review",
    });
  }
  for (const c of new Set(missingCols)) {
    F({
      severity: "medium",
      title: `Frontend references a column not in replayed schema: ${t.table}.${c}`,
      category: "column-missing",
      evidence: `.select('...${c}...') or filter on ${c} in ${t.files.join(", ")}`,
      affected: { table: t.table, column: c, files: t.files },
      remediation: "Confirm column name against canonical migration; fix frontend mapping or add a migration.",
      needs: "manual-review",
    });
  }

  // Embeds + FK resolvability.
  for (const s of t.selects) {
    for (const e of s.embeds) {
      const fwd = fkFromTo.get(`${t.table}->${e.relation}`);
      // to-many: child table carries the FK back to the parent table.
      const rev = fkToFrom.has(t.table) && fkToFrom.get(t.table).includes(e.relation);
      const resolvable = Boolean(fwd || rev);
      const dir = fwd ? "to-one" : rev ? "to-many" : "none";
      row.embed_results.push({ relation: e.relation, columns: e.columns, resolvable, direction: dir });
      if (!resolvable) {
        F({
          severity: "high",
          title: `Unresolvable PostgREST embed: ${t.table} -> ${e.relation}`,
          category: "embed-fk",
          evidence: `.select('...${e.relation}(${e.columns.join(", ")})...') in ${t.files.join(", ")}; no FK between ${t.table} and ${e.relation}`,
          affected: { table: t.table, embed: e.relation, files: t.files },
          remediation: "Add the missing FK, or correct the embed relation name / join direction.",
          needs: "manual-review",
        });
      } else if (e.columns.length && fwd) {
        // Validate embedded columns exist on the target relation.
        const embCols = colsByTable.get(e.relation) ?? new Set();
        const bad = e.columns.filter((c) => c !== "*" && !embCols.has(c));
        if (bad.length) {
          F({
            severity: "medium",
            title: `Embed column(s) not found on ${e.relation}: ${bad.join(", ")}`,
            category: "column-missing",
            evidence: `${t.table}.select('...${e.relation}(${e.columns.join(", ")})...')`,
            affected: { table: e.relation, column: bad },
            remediation: "Correct embedded column names to match the relation.",
            needs: "frontend-mapping",
          });
        }
      }
    }
  }
  matrix.tables.push(row);
}

// D. RPC resolution.
for (const r of frontend.rpc) {
  const row = { name: r.name, exists: false, args: r.args, schema: null, declared: null, extra: [], missing: [] };
  for (const [key, val] of fnBySchemaName) {
    if (key.endsWith(`.${r.name}`)) {
      row.exists = true;
      row.schema = key.split(".")[0];
      row.declared = val.params;
      break;
    }
  }
  if (!row.exists) {
    F({
      severity: "high",
      title: `RPC referenced by frontend has no canonical definition: ${r.name}`,
      category: "rpc-missing",
      evidence: `.rpc('${r.name}') in ${r.files.join(", ")}`,
      affected: { rpc: r.name, files: r.files },
      remediation: "Add the function in a migration, or remove the frontend call.",
      needs: "manual-review",
    });
  } else {
    const declaredSet = new Set(row.declared);
    row.extra = r.args.filter((a) => !declaredSet.has(a));
    row.missing = row.declared.filter((a) => !r.args.includes(a));
    if (row.extra.length) {
      F({
        severity: "medium",
        title: `RPC argument(s) not declared by ${r.name}: ${row.extra.join(", ")}`,
        category: "rpc-arg",
        evidence: `Frontend passes ${row.extra.join(", ")}; function declares [${row.declared.join(", ")}]`,
        affected: { rpc: r.name },
        remediation: "Align frontend argument names with the function signature.",
        needs: "manual-review",
      });
    }
    if (row.missing.length) {
      F({
        severity: "low",
        title: `RPC declared parameter(s) not supplied by frontend (may be optional/defaulted): ${row.missing.join(", ")}`,
        category: "rpc-arg",
        evidence: `${r.name} declares [${row.declared.join(", ")}]; frontend supplies [${r.args.join(", ")}]`,
        affected: { rpc: r.name },
        remediation: "Confirm the omitted parameters have defaults; otherwise supply them.",
        needs: "manual-review",
      });
    }
  }
  matrix.rpc.push(row);
}

// D2. Foreign-key integrity smells (NOT VALID / duplicate pairs).
for (const f of schema.foreign_keys) {
  if (/NOT VALID/i.test(f.definition)) {
    F({
      severity: "medium",
      title: `Foreign key marked NOT VALID: ${f.table}.${f.name}`,
      category: "fk-not-valid",
      evidence: f.definition,
      affected: { table: f.table, constraint: f.name },
      remediation:
        "Validate the constraint (`ALTER TABLE ... VALIDATE CONSTRAINT ...`) after confirming no orphaned rows; a NOT VALID FK does not protect pre-existing rows.",
      needs: "future-migration",
    });
  }
}
{
  const seen = new Map();
  for (const f of schema.foreign_keys) {
    const key = `${f.table}->${f.ref_table}`;
    if (seen.has(key)) {
      const prev = seen.get(key);
      F({
        severity: "medium",
        title: `Duplicate foreign key pair: ${f.table} -> ${f.ref_table}`,
        category: "fk-duplicate",
        evidence: `Two FKs reference the same target: ${prev.definition} AND ${f.definition}`,
        affected: { table: f.table, constraints: [prev.name, f.name] },
        remediation:
          "Keep the intended FK and drop the redundant one (a composite NOT VALID FK and a simple FK on the same column are usually the legacy + the fix).",
        needs: "future-migration",
      });
    } else {
      seen.set(key, f);
    }
  }
}

// E. Storage buckets.
for (const b of frontend.storage) {
  const row = { bucket: b, exists: schema.canonical_only?.storage_buckets?.includes(b) ?? true };
  matrix.storage.push(row);
}

// F. Canonical-only / replay-translation note.
if (schema.canonical_only) {
  F({
    severity: "info",
    title: "btree_gist exclusion constraint is canonical-only (replay surrogate)",
    category: "replay-compatibility",
    evidence: "appointments_no_scheduled_staff_overlap EXCLUDE requires btree_gist gist `=` opclass, unavailable in PGlite.",
    affected: { object: "public.appointments (EXCLUDE constraint)" },
    remediation: "No code change. Constraint exists in canonical migration and applies in Supabase; PGlite replay records it as canonical-only.",
    needs: "no-code-change",
  });
}

// sort findings by severity rank then id
const rank = { high: 0, medium: 1, low: 2, info: 3 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));

const summary = {
  generated_at: new Date().toISOString(),
  schema: {
    tables: schema.tables.length,
    columns: schema.columns.length,
    enum_types: new Set(schema.enums.map((e) => e.name)).size,
    enum_labels: schema.enums.length,
    constraints: schema.constraints.length,
    foreign_keys: schema.foreign_keys.length,
    indexes: schema.indexes.length,
    triggers: schema.triggers.length,
    views: schema.views.length,
    functions: schema.functions.length,
    policies: schema.policies.length,
    grants: schema.grants.length,
  },
  frontend: { tables: frontend.tables.length, rpc: frontend.rpc.length, storage: frontend.storage.length },
  findings_by_severity: {
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
  },
};

writeFileSync(resolve(A, "contract-matrix.json"), JSON.stringify(matrix, null, 2) + "\n");
writeFileSync(resolve(A, "audit-findings.json"), JSON.stringify({ summary, findings }, null, 2) + "\n");

console.log(`matrix: tables=${matrix.tables.length} rpc=${matrix.rpc.length} storage=${matrix.storage.length}`);
console.log(`findings: ${findings.length} total (high=${summary.findings_by_severity.high}, medium=${summary.findings_by_severity.medium}, low=${summary.findings_by_severity.low}, info=${summary.findings_by_severity.info})`);
for (const f of findings) console.log(`  [${f.severity.toUpperCase()}] ${f.id} ${f.title}`);
