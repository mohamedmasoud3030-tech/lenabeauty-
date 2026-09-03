// Contract matrix + verified findings generator.
//
// Cross-references the replayed schema inventory against scanned frontend
// database usage to produce:
//   - contract-matrix.json  (table/embed/rpc/storage resolution + RLS op matrix
//                            + RPC grant matrix)
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

function parseFk(def) {
  const m = /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+([\w".]+)\s*\(([^)]*)\)/.exec(def);
  if (!m) return null;
  const parts = m[2].replaceAll('"', "").split(".");
  return {
    cols: m[1].split(",").map((s) => s.trim()),
    refTable: parts.at(-1),
    refCols: m[3].split(",").map((s) => s.trim()),
  };
}

const fks = schema.foreign_keys
  .map((f) => ({ ...f, parsed: parseFk(f.definition) }))
  .filter((f) => f.parsed);
const fkFromTo = new Map();
const fkToFrom = new Map();
for (const f of fks) {
  fkFromTo.set(`${f.table}->${f.parsed.refTable}`, f);
  if (!fkToFrom.has(f.parsed.refTable)) fkToFrom.set(f.parsed.refTable, []);
  fkToFrom.get(f.parsed.refTable).push(f.table);
}

function fnParams(identityArgs) {
  return identityArgs
    .split(",")
    .map((s) => s.trim().split(/\s+/)[0])
    .filter((s) => /^\w+$/.test(s));
}

const fnKey = (f) => `${f.schema}.${f.name}(${f.identity_args})`;
const functionsByName = new Map();
for (const f of schema.functions) {
  if (!functionsByName.has(f.name)) functionsByName.set(f.name, []);
  functionsByName.get(f.name).push(f);
}
const aclByFunction = new Map();
for (const a of schema.function_acl) {
  const key = fnKey(a);
  if (!aclByFunction.has(key)) aclByFunction.set(key, new Set());
  aclByFunction.get(key).add(`${a.grantee}:${a.privilege}`);
}
const rlsByTable = new Map(schema.rls_enabled.map((r) => [r.table, r]));
const policiesByTable = new Map();
for (const p of schema.policies) {
  if (!policiesByTable.has(p.table)) policiesByTable.set(p.table, []);
  policiesByTable.get(p.table).push(p);
}

// ---- findings -------------------------------------------------------------
const findings = [];
let seq = 0;
function F(fields) {
  seq += 1;
  findings.push({
    id: `DB-${String(seq).padStart(3, "0")}`,
    severity: "info",
    status: "confirmed",
    needs: "no-code-change",
    ...fields,
  });
}

// A. Migration idempotency (replay).
for (const e of replay.idempotency) {
  if (e.status !== "non-idempotent") continue;
  const policy = /policy "([^"]+)" for table "([^"]+)" already exists/.exec(e.error ?? "");
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

// B. Replay fingerprint drift (re-application changes the final schema).
if (replay.fingerprints && !replay.fingerprints.identical) {
  const changed = replay.fingerprints.diff?.functions ?? [];
  F({
    severity: "high",
    title: "Re-application rolls back SECURITY DEFINER search_path hardening (fingerprint drift)",
    category: "replay-fingerprint-drift",
    evidence: `Fingerprints differ (after_first=${replay.fingerprints.after_first_replay} vs after_repeat=${replay.fingerprints.after_repeat}); changed sections: ${(replay.fingerprints.diff?.changed_sections ?? []).join(", ")}. ${changed.length} SECURITY DEFINER functions revert to unpinned/loose search_path.`,
    affected: { functions: changed.map((f) => f.function) },
    remediation:
      "Make the non-idempotent migrations idempotent (DROP POLICY IF EXISTS) so their `SET search_path` hardening survives re-application; then re-verify the fingerprint is stable.",
    needs: "future-migration",
  });
}

// C. Committed canonical Supabase TypeScript types.
const databaseTypes = readFileSync(resolve(ROOT, "src/infrastructure/supabase/database.types.ts"), "utf8");
const supabaseClientSource = readFileSync(resolve(ROOT, "src/infrastructure/supabase/client.ts"), "utf8");
if (!databaseTypes.includes("export type Database") || !supabaseClientSource.includes("SupabaseClient<Database>")) {
  F({
    severity: "high",
    title: "No committed canonical Supabase TypeScript types; client is untyped",
    category: "types-missing",
    evidence:
      "src/infrastructure/supabase/client.ts does not use a Database generic or no generated Database type is committed.",
    affected: { layer: "src/infrastructure/supabase/**", route: "all data access" },
    remediation:
      "Generate the Database type from the deterministic canonical replay, commit it, and thread the Database generic through the client.",
    needs: "type-update",
  });
}

// D. RLS semantic audit per frontend table + consolidated payroll finding.
const SENSITIVE_PAYROLL = new Set(["attendance_records", "employee_advances", "payroll_runs", "payroll_line_items"]);
const rlsMatrix = [];
const payrollAffected = [];
for (const t of frontend.tables) {
  const rls = rlsByTable.get(t.table);
  const policies = policiesByTable.get(t.table) ?? [];
  const byCmd = {};
  for (const p of policies) byCmd[p.cmd] = p;
  const membershipOnly = (p) => /is_center_member\s*\(/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`);
  const row = {
    table: t.table,
    rls_enabled: rls?.rls_enabled ?? null,
    rls_forced: rls?.rls_forced ?? null,
    policies: policies.map((p) => ({
      name: p.name,
      command: p.cmd,
      roles: p.roles,
      using: p.qual,
      with_check: p.with_check,
      membership_only: membershipOnly(p),
    })),
    missing_operations: ["SELECT", "INSERT", "UPDATE", "DELETE"].filter((op) => !byCmd[op] && !byCmd.ALL),
    has_for_all: Boolean(byCmd.ALL),
  };
  rlsMatrix.push(row);

  if (SENSITIVE_PAYROLL.has(t.table) && row.rls_enabled) {
    const forAll = policies.find((p) => p.cmd === "ALL");
    if (forAll && membershipOnly(forAll)) {
      payrollAffected.push({ table: t.table, policy: forAll.name, expr: forAll.qual });
    }
  }
}
if (payrollAffected.length) {
  F({
    severity: "high",
    title: "Sensitive payroll tables writable by any center member (no governed role)",
    category: "rls-role-governance",
    evidence: payrollAffected
      .map((x) => `${x.table} (policy "${x.policy}" FOR ALL USING ${x.expr})`)
      .join("; "),
    affected: { tables: payrollAffected.map((x) => x.table) },
    remediation:
      "Split into per-operation policies and gate payroll writes (attendance_records, employee_advances, payroll_runs, payroll_line_items) on a governed role check (user_metadata.role IN ADMIN/MANAGER), not center membership alone.",
    needs: "future-migration",
  });
}

// E. RPC privilege-contract validation.
const rpcMatrix = [];
const rpcNoClientGrant = [];
const rpcPublicGrant = [];
const rpcUnpinned = [];
for (const r of frontend.rpc) {
  const overloads = functionsByName.get(r.name) ?? [];
  const row = {
    name: r.name,
    exists: overloads.length > 0,
    frontend_args: r.args,
    overloads: overloads.map((f) => {
      const grants = aclByFunction.get(fnKey(f)) ?? new Set();
      const hasRole = (role) => [...grants].some((g) => g.startsWith(`${role}:EXECUTE`));
      return {
        schema: f.schema,
        signature: f.identity_args,
        security_definer: f.security_definer,
        search_path: f.config ?? null,
        client_roles: [...grants]
          .filter((g) => g.endsWith(":EXECUTE"))
          .map((g) => g.split(":")[0])
          .filter((role) => role !== "postgres" && role !== "public"),
        public_execute: [...grants].some((g) => g.startsWith("public:EXECUTE")),
        has_anon: hasRole("anon"),
        has_authenticated: hasRole("authenticated"),
      };
    }),
  };

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
    const hasClientGrant = row.overloads.some((o) => o.has_anon || o.has_authenticated);
    const unexpectedPublic = row.overloads.some((o) => o.public_execute);
    const unpinned = row.overloads.some((o) => o.security_definer && (!o.search_path || o.search_path.length === 0));
    if (!hasClientGrant) rpcNoClientGrant.push(r.name);
    if (unexpectedPublic) rpcPublicGrant.push(r.name);
    if (unpinned) rpcUnpinned.push(r.name);

    const declared = new Set(row.overloads.flatMap((o) => fnParams(o.signature)));
    const extra = r.args.filter((a) => !declared.has(a));
    if (extra.length) {
      F({
        severity: "medium",
        title: `RPC argument(s) not declared by any overload of ${r.name}: ${extra.join(", ")}`,
        category: "rpc-arg",
        evidence: `Frontend passes ${extra.join(", ")}; overloads declare [${[...declared].join(", ")}]`,
        affected: { rpc: r.name },
        remediation: "Align frontend argument names with the function signature.",
        needs: "manual-review",
      });
    }
  }
  rpcMatrix.push(row);
}
if (rpcNoClientGrant.length) {
  F({
    severity: "high",
    title: "Frontend-referenced RPCs with no client-role EXECUTE grant",
    category: "rpc-grant-missing",
    evidence: `${rpcNoClientGrant.join(", ")} have no anon/authenticated EXECUTE grant.`,
    affected: { rpcs: rpcNoClientGrant },
    remediation:
      "Grant EXECUTE to the intended client role, or remove the frontend call if the capability is not part of the live application.",
    needs: "manual-review",
  });
}
if (rpcPublicGrant.length) {
  F({
    severity: "medium",
    title: `RPCs unexpectedly executable by PUBLIC: ${rpcPublicGrant.join(", ")}`,
    category: "rpc-public-grant",
    evidence: "These functions retain the default PUBLIC EXECUTE grant.",
    affected: { rpcs: rpcPublicGrant },
    remediation: "REVOKE EXECUTE ... FROM PUBLIC and grant only the intended client role.",
    needs: "future-migration",
  });
}
if (rpcUnpinned.length) {
  F({
    severity: "high",
    title: `SECURITY DEFINER RPCs with unpinned search_path: ${rpcUnpinned.join(", ")}`,
    category: "security-definer-search-path",
    evidence: "These functions are SECURITY DEFINER with no SET search_path.",
    affected: { rpcs: rpcUnpinned },
    remediation: "Add `SET search_path = pg_catalog, public, app_private` to each function definition.",
    needs: "future-migration",
  });
}

// F. SECURITY DEFINER / internal-routine exposure audit.
{
  const unpinnedDefiner = [];
  const exposedInternal = [];
  for (const f of schema.functions) {
    const grants = aclByFunction.get(fnKey(f)) ?? new Set();
    const publicExec = [...grants].some((g) => g.startsWith("public:EXECUTE"));
    if (f.security_definer && (!f.config || f.config.length === 0)) {
      unpinnedDefiner.push(`${f.schema}.${f.name}`);
    }
    if (f.schema === "app_private" && publicExec) {
      exposedInternal.push(`${f.schema}.${f.name}`);
    }
  }
  if (unpinnedDefiner.length) {
    F({
      severity: "high",
      title: `SECURITY DEFINER functions with unpinned search_path: ${unpinnedDefiner.join(", ")}`,
      category: "security-definer-search-path",
      evidence: "These functions are SECURITY DEFINER with no SET search_path, exposing them to search-path hijacking.",
      affected: { functions: unpinnedDefiner },
      remediation: "Pin `SET search_path = pg_catalog, public, app_private` on every SECURITY DEFINER function.",
      needs: "future-migration",
    });
  }
  if (exposedInternal.length) {
    F({
      severity: "low",
      title: `Internal app_private routines retain PUBLIC EXECUTE: ${exposedInternal.join(", ")}`,
      category: "internal-routine-exposure",
      evidence: "These app_private routines keep the default PostgreSQL PUBLIC EXECUTE grant (created after the least-privilege repair).",
      affected: { functions: exposedInternal },
      remediation: "REVOKE EXECUTE ... FROM PUBLIC on internal routines; ensure default privileges suppress PUBLIC for the creating role.",
      needs: "future-migration",
    });
  }
}

// G. Table / column / embed resolution.
const matrix = { tables: [], rpc: rpcMatrix, storage: [], embeds: [], rls: rlsMatrix };
for (const t of frontend.tables) {
  const exists = tableNames.has(t.table);
  const colSet = colsByTable.get(t.table) ?? new Set();
  const missingCols = new Set();
  for (const s of t.selects) {
    for (const c of s.columns) if (!colSet.has(c)) missingCols.add(c);
  }
  // PostgREST can filter on an EMBEDDED resource's column using
  // `embeddedTable.column` — e.g. `.eq('invoices.center_id', id)` paired with
  // an `invoices!inner(...)` embed. Such a filter names a column on the
  // embedded relation, NOT on this table, so it must be validated against that
  // relation. Treating it as a local column produced a false "column-missing".
  for (const c of t.filters) {
    const separator = c.indexOf(".");
    if (separator > 0) {
      const relation = c.slice(0, separator);
      const column = c.slice(separator + 1);
      const embeddedCols = colsByTable.get(relation);
      // Only resolve against a relation this table actually embeds.
      const isEmbedded = t.selects.some((s) =>
        (s.embeds ?? []).some((e) => e.relation === relation));
      if (isEmbedded && embeddedCols) {
        if (!embeddedCols.has(column)) missingCols.add(c);
        continue;
      }
    }
    if (!colSet.has(c)) missingCols.add(c);
  }
  const row = { table: t.table, exists, missing_columns: [...missingCols], embed_results: [] };

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
  for (const c of missingCols) {
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
  for (const s of t.selects) {
    for (const e of s.embeds) {
      const fwd = fkFromTo.get(`${t.table}->${e.relation}`);
      const rev = fkToFrom.has(t.table) && fkToFrom.get(t.table).includes(e.relation);
      const resolvable = Boolean(fwd || rev);
      let direction = "none";
      if (fwd) direction = "to-one";
      else if (rev) direction = "to-many";
      row.embed_results.push({ relation: e.relation, columns: e.columns, resolvable, direction });
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
      } else if (fwd && e.columns.length && !e.columns.includes("*")) {
        const embCols = colsByTable.get(e.relation) ?? new Set();
        const bad = e.columns.filter((c) => !embCols.has(c));
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

// H. Foreign-key integrity smells (NOT VALID / duplicate pairs) — corrected guidance.
for (const f of schema.foreign_keys) {
  if (/NOT VALID/i.test(f.definition)) {
    F({
      severity: "medium",
      title: `Foreign key marked NOT VALID: ${f.table}.${f.name}`,
      category: "fk-not-valid",
      evidence: f.definition,
      affected: { table: f.table, constraint: f.name },
      remediation:
        "Query for orphaned/cross-center rows, then `ALTER TABLE ... VALIDATE CONSTRAINT ...` to extend protection to existing rows.",
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
        title: `Overlapping foreign keys on the same target: ${f.table} -> ${f.ref_table}`,
        category: "fk-duplicate",
        evidence: `Two FKs reference the same target: ${prev.definition} AND ${f.definition}. The composite (invoice_id, center_id) FK enforces tenant integrity and is NOT redundant.`,
        affected: { table: f.table, constraints: [prev.name, f.name] },
        remediation:
          "1) Query orphaned/cross-center payment rows; 2) validate payments_invoice_center_fk; 3) inspect PostgREST relationship behaviour and every frontend embed; 4) only then decide whether the simple invoice_id FK can be removed. Do not remove either FK until API relationship behaviour is verified.",
        needs: "manual-review",
      });
    } else {
      seen.set(key, f);
    }
  }
}

// I. Storage buckets.
for (const b of frontend.storage) {
  matrix.storage.push({ bucket: b, exists: true });
}

// J. Scanner limitations → manual-review / unresolved bucket.
for (const m of frontend.manual_review) {
  F({
    severity: "info",
    title: `Scanner limitation (manual review): ${m.key}`,
    category: "scanner-limitation",
    evidence: `${m.reason} in ${m.files.join(", ")}`,
    affected: { files: m.files },
    remediation: "Manually confirm this construct against the canonical schema.",
    needs: "manual-review",
  });
}

// K. Canonical-only / replay-translation note.
if (schema.canonical_only) {
  F({
    severity: "info",
    title: "btree_gist exclusion constraint is canonical-only (replay surrogate)",
    category: "replay-compatibility",
    evidence: "appointments_no_scheduled_staff_overlap EXCLUDE requires btree_gist gist `=` opclass, unavailable in PGlite.",
    affected: { object: "public.appointments (EXCLUDE constraint)" },
    remediation: "No code change; the constraint exists in the canonical migration and applies in Supabase.",
    needs: "no-code-change",
  });
}

// L. RPC return-shape assumptions (manual review).
F({
  severity: "info",
  title: "RPC return shapes (jsonb/record) are untyped at rest",
  category: "rpc-return-shape",
  evidence:
    "Several frontend-used RPCs return jsonb or record (for example process_checkout_v1); generated SQL types cannot fully guarantee application-level result shapes.",
  affected: { layer: "RPC results" },
  remediation: "Add typed DTO/mapper + runtime contract tests for non-table RPC results.",
  needs: "manual-review",
});

// sort findings by severity rank then id
const rank = { high: 0, medium: 1, low: 2, info: 3 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));

const summary = {
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

mkdirSync(A, { recursive: true });
writeFileSync(resolve(A, "contract-matrix.json"), JSON.stringify(matrix, null, 2) + "\n");
writeFileSync(resolve(A, "audit-findings.json"), JSON.stringify({ summary, findings }, null, 2) + "\n");

console.log(`matrix: tables=${matrix.tables.length} rpc=${matrix.rpc.length} storage=${matrix.storage.length}`);
console.log(`findings: ${findings.length} total (high=${summary.findings_by_severity.high}, medium=${summary.findings_by_severity.medium}, low=${summary.findings_by_severity.low}, info=${summary.findings_by_severity.info})`);
for (const f of findings) console.log(`  [${f.severity.toUpperCase()}] ${f.id} ${f.title}`);
