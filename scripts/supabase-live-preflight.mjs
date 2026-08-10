import { existsSync, readFileSync } from "node:fs";
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
];

const canonicalMigrations = [
  "20260623000001_initial_schema.sql",
  "20260623000002_enable_rls_and_policies.sql",
  "20260628000001_enable_rls.sql",
  "20260628000002_admin_bootstrap.sql",
  "20260628000003_checkout_rpc.sql",
  "20260628000004_vat_support.sql",
  "20260628000005_tier_discount.sql",
  "20260628000006_public_booking.sql",
  "20260628000007_gift_cards.sql",
  "20260628000008_packages_bundles.sql",
  "20260628000009_no_show_protection.sql",
  "20260628000010_notifications_payment_gateway.sql",
  "20260628000011_client_portal.sql",
  "20260628000012_customer_experience_forecasting_accounting_advanced.sql",
  "20260628000013_booking_reschedule_cancel.sql",
  "20260628000014_client_portal_lockout.sql",
  "20260628000015_attendance_advances_payroll.sql",
  "20260628000016_validation_constraints.sql",
  "20260809000001_delivery_security_hardening.sql",
  "20260810000001_fix_invoice_items_packages.sql",
];

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
for (const table of requiredTables) {
  if (!initialSchema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    fail(`initial schema missing ${table}`);
  } else {
    pass(`initial schema includes ${table}`);
  }
}

const rls = readFileSync(resolve(migrationsDir, "20260628000001_enable_rls.sql"), "utf8");
if (!rls.includes("WHERE profile_id = auth.uid()")) fail("canonical RLS must use center_memberships.profile_id");
else pass("canonical RLS uses center_memberships.profile_id");

const checkout = readFileSync(resolve(migrationsDir, "20260628000008_packages_bundles.sql"), "utf8");
if (!checkout.includes("CREATE OR REPLACE FUNCTION public.process_checkout_v1")) fail("final checkout RPC is missing");
else pass("final checkout RPC exists");

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
    const response = await fetch(url, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      fail(`remote table check failed for ${table}: HTTP ${response.status}`);
    } else {
      pass(`remote table is reachable: ${table}`);
    }
  });

  await Promise.all(tableChecks);

  if (env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const centerUrl = new URL("/rest/v1/centers", env.VITE_SUPABASE_URL);
    centerUrl.searchParams.set("id", `eq.${env.VITE_CENTER_ID}`);
    centerUrl.searchParams.set("select", "id");
    const centerResponse = await fetch(centerUrl, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    });
    const centers = centerResponse.ok ? await centerResponse.json() : [];
    if (!centerResponse.ok || !Array.isArray(centers) || centers.length !== 1) {
      fail("configured VITE_CENTER_ID is not present in the remote database");
    } else {
      pass("configured VITE_CENTER_ID exists remotely");
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
