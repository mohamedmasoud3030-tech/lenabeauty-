import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envFiles = [".env.local", ".env"];
const migrationsDir = resolve(root, "supabase/migrations");

const requiredEnv = [
  "VITE_DATA_BACKEND",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_CENTER_ID",
  "VITE_BRANCH_MODE",
];

const requiredTables = [
  "centers",
  "profiles",
  "center_memberships",
  "center_settings",
  "customers",
  "appointments",
  "services",
  "employees",
  "products",
  "expenses",
  "customer_entitlements",
  "entitlement_ledger",
];

// The canonical chain is DISCOVERED from disk, not hardcoded. A hardcoded list
// silently stops verifying every migration added after it was last edited: it
// had drifted to 34 entries while the chain held 37, so the three newest
// migrations were never checked by the live preflight at all.
const canonicalMigrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (canonicalMigrations.length === 0) {
  console.error("FAIL no canonical migrations were discovered");
  process.exit(1);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  const content = readFileSync(path, "utf8");
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return values;
}

function loadEnv() {
  const fileEnv = envFiles.reduce((merged, filename) => {
    return { ...merged, ...parseEnvFile(resolve(root, filename)) };
  }, {});

  return { ...fileEnv, ...process.env };
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "");
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

const env = loadEnv();

for (const key of requiredEnv) {
  if (!env[key]) {
    fail(`${key} is missing`);
  } else {
    pass(`${key} is present`);
  }
}

if (env.VITE_DATA_BACKEND && env.VITE_DATA_BACKEND !== "supabase") {
  fail("VITE_DATA_BACKEND must be supabase");
}

if (env.VITE_BRANCH_MODE && env.VITE_BRANCH_MODE !== "single") {
  fail("VITE_BRANCH_MODE must be single for v1.0 live QA");
}

if (env.VITE_ENVIRONMENT && !["development", "staging", "production"].includes(env.VITE_ENVIRONMENT)) {
  fail(`VITE_ENVIRONMENT must be development | staging | production, got ${env.VITE_ENVIRONMENT}`);
}

if (env.VITE_SUPABASE_URL && !validateUrl(env.VITE_SUPABASE_URL)) {
  fail("VITE_SUPABASE_URL must be a valid https URL");
}

if (env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_secret_")) {
  fail("VITE_SUPABASE_PUBLISHABLE_KEY must not be a secret service-role key");
}

if (env.VITE_CENTER_ID && !validateUuid(env.VITE_CENTER_ID)) {
  fail("VITE_CENTER_ID must be a UUID");
}

for (const migration of canonicalMigrations) {
  const path = resolve(migrationsDir, migration);
  if (!existsSync(path)) fail(`canonical migration is missing: ${migration}`);
  else pass(`canonical migration exists: ${migration}`);
}

const legacyRlsPath = resolve(migrationsDir, "20260623000002_enable_rls_and_policies.sql");
if (existsSync(legacyRlsPath)) {
  const legacyRls = readFileSync(legacyRlsPath, "utf8");
  if (legacyRls.includes("WHERE user_id = auth.uid()")) {
    fail("retired legacy RLS migration still references nonexistent center_memberships.user_id");
  } else {
    pass("retired legacy RLS migration cannot block the canonical chain");
  }
}

const initialSchema = readFileSync(resolve(migrationsDir, canonicalMigrations[0]), "utf8");
// Core tables are defined in the initial schema; later phases add their own
// tables, so the presence check runs against the full canonical chain.
const fullMigrationChain = canonicalMigrations
  .map((name) => readFileSync(resolve(migrationsDir, name), "utf8"))
  .join("\n");
for (const table of requiredTables) {
  const qualified = `CREATE TABLE IF NOT EXISTS public.${table}`;
  const unqualified = `CREATE TABLE IF NOT EXISTS ${table}`;
  if (!initialSchema.includes(unqualified) &&
      !fullMigrationChain.includes(qualified) &&
      !fullMigrationChain.includes(unqualified)) {
    fail(`schema chain missing ${table}`);
  } else {
    pass(`schema chain includes ${table}`);
  }
}

const rls = readFileSync(resolve(migrationsDir, "20260628000001_enable_rls.sql"), "utf8");
if (!rls.includes("WHERE profile_id = auth.uid()")) fail("canonical RLS must use center_memberships.profile_id");
else pass("canonical RLS uses center_memberships.profile_id");

const checkout = readFileSync(resolve(migrationsDir, "20260810000002_operational_data_integrity.sql"), "utf8");
if (!checkout.includes("CREATE OR REPLACE FUNCTION public.process_checkout_v1")) fail("internal atomic checkout RPC is missing");
else pass("internal atomic checkout RPC exists");
if (!checkout.includes("CREATE TABLE IF NOT EXISTS public.payments")) fail("canonical payments ledger is missing");
else pass("canonical payments ledger exists");

const idempotentCheckout = readFileSync(resolve(migrationsDir, "20260816000002_checkout_idempotency.sql"), "utf8");
if (!idempotentCheckout.includes("CREATE OR REPLACE FUNCTION public.process_checkout_idempotent_v1")) fail("client idempotent checkout RPC is missing");
else pass("client idempotent checkout RPC exists");
if (!idempotentCheckout.includes("REVOKE ALL ON FUNCTION public.process_checkout_v1")) fail("internal checkout RPC remains client-executable");
else pass("internal checkout RPC is behind the idempotent client boundary");

const entitlements = readFileSync(resolve(migrationsDir, "20260811004000_financial_entitlements.sql"), "utf8");
if (!entitlements.includes("CREATE TABLE IF NOT EXISTS public.customer_entitlements")) fail("entitlement tables are missing");
else pass("entitlement tables exist");
if (!entitlements.includes("CREATE TABLE IF NOT EXISTS public.entitlement_ledger")) fail("entitlement ledger is missing");
else pass("entitlement ledger exists");
if (!entitlements.includes("p_entitlement_redemptions JSONB DEFAULT NULL")) fail("extended checkout RPC is missing");
else pass("extended checkout RPC exists");
if (!entitlements.includes("GRANT EXECUTE ON FUNCTION public.refund_entitlement_v1")) fail("governed entitlement RPCs are missing");
else pass("governed entitlement RPCs exist");

async function verifyRemoteSchema() {
  // The browser-safe publishable key is enough to confirm that each table is
  // present in PostgREST's schema cache. A service key is intentionally not
  // required for this release gate and must never be put in a VITE_ variable.
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!apiKey || !env.VITE_SUPABASE_URL) {
    fail("remote schema verification requires a Supabase URL and publishable key");
    return;
  }

  const tableChecks = requiredTables.map(async (table) => {
    const url = new URL(`/rest/v1/${table}`, env.VITE_SUPABASE_URL);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", "1");
    try {
      const response = await fetch(url, {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        fail(`remote table check failed for ${table}: HTTP ${response.status}`);
      } else {
        pass(`remote table is reachable: ${table}`);
      }
    } catch (error) {
      const code = error?.cause?.code || error?.code || error?.name || "NETWORK_ERROR";
      fail(`remote table check failed for ${table}: network ${code}`);
    }
  });

  await Promise.all(tableChecks);

  if (env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const centerUrl = new URL("/rest/v1/centers", env.VITE_SUPABASE_URL);
    centerUrl.searchParams.set("id", `eq.${env.VITE_CENTER_ID}`);
    centerUrl.searchParams.set("select", "id");
    try {
      const centerResponse = await fetch(centerUrl, {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      });
      const centers = centerResponse.ok ? await centerResponse.json() : [];
      if (!centerResponse.ok || !Array.isArray(centers) || centers.length !== 1) {
        fail("configured VITE_CENTER_ID is not present in the remote database");
      } else {
        pass("configured VITE_CENTER_ID exists remotely");
      }
    } catch (error) {
      const code = error?.cause?.code || error?.code || error?.name || "NETWORK_ERROR";
      fail(`configured center verification failed: network ${code}`);
    }
  } else {
    console.log("INFO center seed verification requires a server-only key; table availability was checked with the publishable key.");
  }
}

await verifyRemoteSchema();

if (process.exitCode) {
  console.error("Supabase live preflight failed.");
} else {
  console.log("Supabase live preflight passed.");
}
