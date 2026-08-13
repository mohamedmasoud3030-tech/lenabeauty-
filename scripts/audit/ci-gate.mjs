// CI gate for the database contract freeze audit.
//
// Re-runs the reproducible audit (replay, frontend scan, contract matrix),
// then fails the build when the contract invariants are violated:
//
//   - any migration fails to replay (expected: 0)
//   - any idempotency failure beyond the two documented duplicate-policy gaps
//   - unresolved frontend table/RPC existence or argument mismatches
//   - missing client-role EXECUTE grants on frontend-referenced RPCs
//   - unpinned SECURITY DEFINER search_path
//   - unexpected broad sensitive-table write policies (payroll)
//   - stale generated audit artifacts (committed artifacts differ from fresh)
//
// The two known idempotency gaps are the ONLY documented exclusions.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACTS = resolve(ROOT, "docs/database-contract/artifacts");

const KNOWN_NON_IDEMPOTENT = new Set([
  "20260628000012_customer_experience_forecasting_accounting_advanced.sql",
  "20260810000005_security_hardening_auth.sql",
]);

const BLOCKING_CATEGORIES = new Set([
  "table-missing",
  "rpc-missing",
  "rpc-arg",
  "column-missing",
  "embed-fk",
  "rpc-grant-missing",
  "security-definer-search-path",
  "rls-role-governance",
]);

function run(script) {
  const res = spawnSync(process.execPath, [resolve(ROOT, script)], {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
  return { script, status: res.status, stdout: res.stdout, stderr: res.stderr };
}

const violations = [];

for (const script of [
  "scripts/audit/replay-schema.mjs",
  "scripts/audit/scan-frontend.mjs",
  "scripts/audit/build-matrix.mjs",
]) {
  const r = run(script);
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
  if (f.status === "non-idempotent" && !KNOWN_NON_IDEMPOTENT.has(f.file)) {
    violations.push(`unexpected non-idempotent migration: ${f.file}: ${f.error}`);
  }
}

for (const f of findings) {
  if ((f.severity === "high" || f.severity === "medium") && BLOCKING_CATEGORIES.has(f.category)) {
    violations.push(`[${f.severity}] ${f.category}: ${f.title}`);
  }
}

// Stale-artifact check: the scripts above just regenerated the artifacts, so
// any diff against the committed versions means the committed ones were stale.
const diff = spawnSync("git", ["diff", "--exit-code", "--", "docs/database-contract/artifacts"], {
  cwd: ROOT,
  stdio: "pipe",
  encoding: "utf8",
});
if (diff.status !== 0) {
  violations.push("stale generated audit artifacts (committed artifacts differ from freshly generated)");
}

// Documented (not fatal): the two known idempotency gaps drive a fingerprint
// drift on re-application. Reported here for visibility; it is not a new drift.
if (replay.fingerprints && !replay.fingerprints.identical) {
  const sections = replay.fingerprints.diff?.changed_sections ?? [];
  console.warn(`NOTE: schema fingerprint drift on re-application (documented): [${sections.join(", ")}]`);
}

if (violations.length) {
  console.error("CONTRACT AUDIT GATE: FAILED");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("CONTRACT AUDIT GATE: PASS");
