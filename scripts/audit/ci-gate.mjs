// CI gate for the database contract freeze audit.
//
// Re-runs the reproducible audit (replay, frontend scan, contract matrix),
// then fails the build when the contract invariants are violated:
//
//   - any migration fails to replay (expected: 0)
//   - any idempotency failure
//   - unresolved frontend table/RPC existence or argument mismatches
//   - missing client-role EXECUTE grants on frontend-referenced RPCs
//   - unpinned SECURITY DEFINER search_path
//   - unexpected broad sensitive-table write policies (payroll)
//   - stale generated audit artifacts (committed artifacts differ from fresh)
//
// No idempotency exclusion is permitted in the current canonical chain.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACTS = resolve(ROOT, "docs/database-contract/artifacts");

const BLOCKING_CATEGORIES = new Set([
  "table-missing",
  "rpc-missing",
  "rpc-arg",
  "column-missing",
  "embed-fk",
  "rpc-grant-missing",
  "rpc-dormant-exposed",
  "security-definer-search-path",
  "rls-role-governance",
]);

function runAudit(script) {
  const res = spawnSync(process.execPath, [resolve(ROOT, script)], {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
  return { script, status: res.status, stdout: res.stdout, stderr: res.stderr };
}

/** Snapshot current artifact contents (before regeneration). */
function snapshotArtifacts() {
  const files = readdirSync(ARTIFACTS).filter((f) => f.endsWith(".json")).sort();
  const map = new Map();
  for (const f of files) map.set(f, readFileSync(resolve(ARTIFACTS, f), "utf8"));
  return map;
}

/**
 * `frontend-usage.json.files` is scanner telemetry: the total number of source
 * files walked. Splitting a pure React component or domain port changes that
 * number without changing a single database dependency. Keep freshness strict
 * for the actual contract surface while ignoring this non-semantic counter.
 */
function semanticArtifact(name, content) {
  if (name !== "frontend-usage.json") return content;
  const parsed = JSON.parse(content);
  delete parsed.files;
  return JSON.stringify(parsed);
}

const violations = [];
const before = snapshotArtifacts();

for (const script of [
  "scripts/audit/replay-schema.mjs",
  "scripts/audit/scan-frontend.mjs",
  "scripts/audit/build-matrix.mjs",
]) {
  const r = runAudit(script);
  if (r.status !== 0) {
    violations.push(`audit step failed (exit ${r.status}): ${script}\n${r.stderr ?? r.stdout}`);
  }
}

const replay = JSON.parse(readFileSync(resolve(ARTIFACTS, "replay-report.json"), "utf8"));
const findings = JSON.parse(readFileSync(resolve(ARTIFACTS, "audit-findings.json"), "utf8")).findings;

for (const f of replay.replay) {
  if (f.status === "failed") violations.push(`replay failure: ${f.file}: ${f.error}`);
}
for (const f of replay.idempotency) {
  if (f.status === "non-idempotent") {
    violations.push(`unexpected non-idempotent migration: ${f.file}: ${f.error}`);
  }
}

for (const f of findings) {
  if ((f.severity === "high" || f.severity === "medium") && BLOCKING_CATEGORIES.has(f.category)) {
    violations.push(`[${f.severity}] ${f.category}: ${f.title}`);
  }
}

// Stale-artifact check: compare committed (pre-regeneration) vs fresh artifacts.
// The source-file count is explicitly metadata, not part of the DB contract.
const after = snapshotArtifacts();
let stale = false;
for (const [name, content] of before) {
  if (semanticArtifact(name, after.get(name)) !== semanticArtifact(name, content)) stale = true;
}
if (stale) violations.push("stale generated audit artifacts (committed artifacts differ from freshly generated)");

if (replay.fingerprints && !replay.fingerprints.identical) {
  const sections = replay.fingerprints.diff?.changed_sections ?? [];
  violations.push(`schema fingerprint drift on re-application: [${sections.join(", ")}]`);
}

if (violations.length) {
  console.error("CONTRACT AUDIT GATE: FAILED");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("CONTRACT AUDIT GATE: PASS");
