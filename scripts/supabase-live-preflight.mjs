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

// Tables that are expected to be reachable through the ordinary Data API
// preflight. Some newer server-owned tables intentionally deny anon access and
// are checked remotely only when a service-role key is available.
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

const restrictedRecipeTables = [
  "service_recipes",
  "service_recipe_items",
  "inventory_consumptions",
];

const canonicalRequiredTables = [...requiredTables, ...restrictedRecipeTables];

// Discovered from disk, never hand-listed. A hardcoded array silently rots.
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
const fullMigrationChain = canonicalMigrations
  .map((name) => readFileSync(resolve(migrationsDir, name), "utf8"))
  .join("\n");
for (const table of canonicalRequiredTables) {
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

// This migration establishes the idempotent boundary, but it is no longer the
// final checkout signature. The September visit migration below is required to
// prove the current client contract and prevents this older check from masking
// a missing appointment-aware checkout.
const idempotentCheckoutBase = readFileSync(resolve(migrationsDir, "20260816000002_checkout_idempotency.sql"), "utf8");
if (!idempotentCheckoutBase.includes("CREATE OR REPLACE FUNCTION public.process_checkout_idempotent_v1")) fail("base client idempotent checkout RPC is missing");
else pass("base client idempotent checkout RPC exists");
if (!idempotentCheckoutBase.includes("REVOKE ALL ON FUNCTION public.process_checkout_v1")) fail("internal checkout RPC remains client-executable");
else pass("internal checkout RPC is behind the idempotent client boundary");

const visitLifecycle = readFileSync(resolve(migrationsDir, "20260901100838_visit_lifecycle_recipes.sql"), "utf8");
if (!visitLifecycle.includes("p_appointment_id UUID DEFAULT NULL")) fail("current checkout RPC is missing p_appointment_id");
else pass("current checkout RPC is appointment-aware");
if (!visitLifecycle.includes("CREATE TABLE IF NOT EXISTS public.service_recipes")) fail("service_recipes table is missing");
else pass("service_recipes table exists");
if (!visitLifecycle.includes("CREATE TABLE IF NOT EXISTS public.service_recipe_items")) fail("service_recipe_items table is missing");
else pass("service_recipe_items table exists");
if (!visitLifecycle.includes("CREATE TABLE IF NOT EXISTS public.inventory_consumptions")) fail("inventory_consumptions table is missing");
else pass("inventory_consumptions table exists");
if (!visitLifecycle.includes("CREATE OR REPLACE FUNCTION public.transition_visit_v1")) fail("visit transition RPC is missing");
else pass("visit transition RPC exists");
if (!visitLifecycle.includes("CREATE OR REPLACE FUNCTION public.save_service_recipe_v1")) fail("service recipe RPC is missing");
else pass("service recipe RPC exists");

const recipeBoundary = readFileSync(resolve(migrationsDir, "20260901102643_recipe_write_boundary_hardening.sql"), "utf8");
if (!recipeBoundary.includes("REVOKE ALL ON TABLE public.service_recipes FROM anon")) fail("anonymous recipe table access is not revoked");
else pass("anonymous recipe table access is revoked");
if (!recipeBoundary.includes("REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER") ||
    !recipeBoundary.includes("ON TABLE public.service_recipes FROM authenticated") ||
    !recipeBoundary.includes("ON TABLE public.service_recipe_items FROM authenticated")) {
  fail("authenticated direct recipe writes are not revoked");
} else {
  pass("recipe writes are RPC-only for authenticated clients");
}
if (!recipeBoundary.includes("FOR SELECT TO authenticated")) fail("authenticated recipe read policy is missing");
else pass("authenticated recipe reads remain available");

const recipeAggregation = readFileSync(resolve(migrationsDir, "20260901102758_recipe_consumption_aggregation_hardening.sql"), "utf8");
if (!recipeAggregation.includes("SUM(ii.quantity)::NUMERIC AS service_qty") ||
    !recipeAggregation.includes("GROUP BY ii.service_id")) {
  fail("recipe consumption does not aggregate duplicate service lines");
} else {
  pass("recipe consumption aggregates duplicate service lines");
}
if (!recipeAggregation.includes("REVOKE ALL ON FUNCTION app_private.consume_invoice_recipes_v1(UUID, UUID)") ||
    !recipeAggregation.includes("FROM PUBLIC, anon, authenticated")) {
  fail("internal recipe consumer is client-executable");
} else {
  pass("internal recipe consumer is not client-executable");
}

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
  // The browser-safe publishable key is enough for tables intentionally exposed
  // through the Data API. Server-owned recipe tables are checked only when a
  // service-role key is available, because anon access to those tables is
  // intentionally revoked by the canonical security boundary.
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const apiKey = serviceRoleKey || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!apiKey || !env.VITE_SUPABASE_URL) {
    fail("remote schema verification requires a Supabase URL and publishable key");
    return;
  }

  const remoteTables = serviceRoleKey ? canonicalRequiredTables : requiredTables;
  const tableChecks = remoteTables.map(async (table) => {
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

  if (!serviceRoleKey) {
    console.log("INFO server-owned recipe table reachability requires a service-role key and was intentionally not probed with anon credentials.");
  }

  if (serviceRoleKey) {
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
    console.log("INFO center seed verification requires a server-only key; ordinary table availability was checked with the publishable key.");
  }
}

await verifyRemoteSchema();

if (process.exitCode) {
  console.error("Supabase live preflight failed.");
} else {
  console.log("Supabase live preflight passed.");
}
