import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envFiles = [".env.local", ".env"];
const schemaPath = resolve(root, "docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql");
const seedPath = resolve(root, "docs/SUPABASE_STAGING_SEED_10A5.sql");
const checkoutActivationPath = resolve(root, "docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql");

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
  "service_categories",
  "services",
  "employees",
  "products",
  "expenses",
];

const forbiddenCheckoutArtifacts = [
  "process_checkout_v1",
  "CREATE TABLE public.invoices",
  "CREATE TABLE public.invoice_items",
  "CREATE TABLE public.payments",
];

const requiredCheckoutArtifacts = [
  "CREATE TABLE IF NOT EXISTS public.invoices",
  "CREATE TABLE IF NOT EXISTS public.invoice_items",
  "CREATE OR REPLACE FUNCTION public.process_checkout_v1",
  "ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY",
  "GRANT EXECUTE ON FUNCTION public.process_checkout_v1",
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

if (!existsSync(schemaPath)) {
  fail("docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql is missing");
} else {
  pass("docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql exists");
  const schema = readFileSync(schemaPath, "utf8");

  for (const table of requiredTables) {
    if (!schema.includes(`CREATE TABLE public.${table}`)) {
      fail(`bootstrap schema missing public.${table}`);
    } else {
      pass(`bootstrap schema includes public.${table}`);
    }
  }

  for (const artifact of forbiddenCheckoutArtifacts) {
    if (schema.includes(artifact)) {
      fail(`bootstrap schema must not include checkout artifact: ${artifact}`);
    }
  }
}

if (!existsSync(seedPath)) {
  fail("docs/SUPABASE_STAGING_SEED_10A5.sql is missing");
} else {
  pass("docs/SUPABASE_STAGING_SEED_10A5.sql exists");
  const seed = readFileSync(seedPath, "utf8");

  for (const requiredSeedFragment of [
    "INSERT INTO public.centers",
    "INSERT INTO public.profiles",
    "INSERT INTO public.center_memberships",
    'SELECT center_id AS "VITE_CENTER_ID"',
  ]) {
    if (!seed.includes(requiredSeedFragment)) {
      fail(`staging seed missing required fragment: ${requiredSeedFragment}`);
    } else {
      pass(`staging seed includes ${requiredSeedFragment}`);
    }
  }

  for (const artifact of forbiddenCheckoutArtifacts) {
    if (seed.includes(artifact)) {
      fail(`staging seed must not include checkout artifact: ${artifact}`);
    }
  }
}

if (!existsSync(checkoutActivationPath)) {
  fail("docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql is missing");
} else {
  pass("docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql exists");
  const checkoutActivation = readFileSync(checkoutActivationPath, "utf8");

  for (const artifact of requiredCheckoutArtifacts) {
    if (!checkoutActivation.includes(artifact)) {
      fail(`checkout activation missing required artifact: ${artifact}`);
    } else {
      pass(`checkout activation includes ${artifact}`);
    }
  }
}

if (process.exitCode) {
  console.error("Supabase live preflight failed.");
} else {
  console.log("Supabase live preflight passed.");
}
