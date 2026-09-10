#!/usr/bin/env node
// ============================================================================
// Lena Beauty — Client project provisioner
//
// Provisions a brand-new isolated Supabase project for a salon client, end to
// end, through the Supabase Management API:
//
//   1. Create the project inside an organization (region + strong DB password)
//   2. Wait until the project is ACTIVE and the REST API is healthy
//   3. Reveal the API keys (modern publishable/secret, legacy anon/service_role)
//   4. Apply the canonical migration chain (discovered from disk, in order)
//      and record every file in supabase_migrations.schema_migrations so the
//      Supabase CLI / release workflow stays consistent with this project
//   5. Provision the canonical single-center shell (centers + center_settings)
//   6. Create the first ADMIN auth user + membership through the canonical
//      bootstrap contract (scripts/launch/render-membership-bootstrap.mjs)
//   7. Emit the exact environment contract consumed by `npm run launch:preflight`
//      (browser-safe .env) plus a separate operator-secrets file
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... npm run launch:provision -- \
//     --name layla-beauty --salon-name "Layla Beauty" \
//     --admin-email owner@layla.om --admin-name "Layla"
//
//   # Preview without touching the network:
//   npm run launch:provision -- --name layla-beauty --dry-run
//
// Access token: create one at https://supabase.com/dashboard/account/tokens
// (fine-grained tokens need organization + project + database write scopes).
//
// The free Supabase plan allows only a small number of active projects and
// pauses them after inactivity: production salon clients should be on Pro.
// ============================================================================

import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

import { legacyJwtRole } from "../lib/supabase-key-authority.mjs";
import { renderMembershipBootstrap } from "./render-membership-bootstrap.mjs";

const MANAGEMENT_API = "https://api.supabase.com";

// Must stay identical to the canonical UUID enforced by
// scripts/launch/production-preflight.mjs and seeded by the migration chain.
const CANONICAL_SINGLE_CENTER_ID = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";

const DEFAULT_REGION = "ap-south-1"; // closest low-latency region to Oman
const PLACEHOLDER_CENTER_NAMES = "('LenaBeauty', 'My Salon')";

const PROJECT_ACTIVE_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;
const REST_HEALTH_TIMEOUT_MS = 3 * 60 * 1000;
const FIRST_MIGRATION_RETRIES = 5;
const FIRST_MIGRATION_RETRY_DELAY_MS = 15 * 1000;

const BOOLEAN_FLAGS = new Set(["dry-run"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGION_RE = /^[a-z]{2}-[a-z]+-\d+$/;
const MIGRATION_FILE_RE = /^\d{14}_[a-z0-9_]+\.sql$/;
const PROJECT_REF_RE = /^[a-z0-9]{20}$/;

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

export function normalizeProjectName(raw) {
  const name = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{0,38}$/.test(name)) {
    return {
      ok: false,
      error: "project name must be 1-39 chars of lowercase letters, digits and hyphens",
    };
  }
  return { ok: true, name };
}

export function parseArgs(argv) {
  const values = { region: DEFAULT_REGION, dryRun: false };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      errors.push(`unexpected argument: ${token}`);
      continue;
    }
    const key = token.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      values[key.replace(/-(\w)/g, (_, char) => char.toUpperCase())] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      errors.push(`missing value for --${key}`);
      continue;
    }
    values[key] = value;
    index += 1;
  }

  const name = normalizeProjectName(values.name);
  if (!values.name) errors.push("--name is required");
  else if (!name.ok) errors.push(`--name: ${name.error}`);
  else values.name = name.name;

  if (values["salon-name"] && !values["salon-name"].trim()) {
    errors.push("--salon-name must not be empty");
  }
  if (values.region && !REGION_RE.test(values.region)) {
    errors.push(`--region must look like "${DEFAULT_REGION}"`);
  }
  if (values.plan && !["free", "pro"].includes(values.plan)) {
    errors.push("--plan must be free or pro");
  }
  if (values["admin-email"] && !EMAIL_RE.test(values["admin-email"])) {
    errors.push("--admin-email must be a valid email address");
  }
  if (values["db-pass"] && values["db-pass"].length < 16) {
    errors.push("--db-pass must be at least 16 characters");
  }
  if (values["admin-password"] && values["admin-password"].length < 10) {
    errors.push("--admin-password must be at least 10 characters");
  }

  return { ok: errors.length === 0, values, errors };
}

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-._~";

export function generatePassword(length = 32) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const bytes = randomBytes(length);
    let password = "";
    for (const byte of bytes) password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)) {
      return password;
    }
  }
  throw new Error("failed to generate a strong password");
}

/** Discovers the canonical migration chain from disk — never a hand list. */
export function discoverMigrations(migrationsDir) {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(`no canonical migrations were discovered under ${migrationsDir}`);
  }
  for (const file of files) {
    if (!MIGRATION_FILE_RE.test(file)) {
      throw new Error(`migration filename is not canonical (14-digit prefix): ${file}`);
    }
  }
  return files;
}

export function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export const MIGRATION_HISTORY_DDL = `create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version bigint primary key,
  name text not null,
  statements text[]
);`;

export function renderMigrationRecordSql({ version, name, statements }) {
  return `insert into supabase_migrations.schema_migrations (version, name, statements)
values (${Number(version)}, ${quoteSqlLiteral(name)}, array[${quoteSqlLiteral(statements)}]::text[])
on conflict (version) do update
  set name = excluded.name, statements = excluded.statements;`;
}

export function renderCenterShellSql({ salonName, centerId }) {
  const salon = quoteSqlLiteral(salonName);
  const center = quoteSqlLiteral(centerId);
  return `BEGIN;
INSERT INTO public.centers (id, name)
VALUES (${center}::uuid, ${salon})
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.centers.name IN ${PLACEHOLDER_CENTER_NAMES};

INSERT INTO public.center_settings (center_id, name, currency)
VALUES (${center}::uuid, ${salon}, 'OMR')
ON CONFLICT (center_id) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.center_settings.name IN ${PLACEHOLDER_CENTER_NAMES};
COMMIT;`;
}

function collectStrings(value, sink) {
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, sink);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, sink);
  }
}

/**
 * Classifies every key-shaped string found in a Management API keys response.
 * Prefers modern keys (sb_publishable_ / sb_secret_) and falls back to legacy
 * JWTs classified by their payload role (anon / service_role).
 */
export function resolveApiKeys(rawKeys) {
  const strings = [];
  collectStrings(rawKeys, strings);

  let browserKey = null;
  let serverKey = null;
  for (const value of strings) {
    const key = value.trim();
    if (!key || key.includes("://")) continue;
    if (key.startsWith("sb_publishable_") && !browserKey) {
      browserKey = key;
    } else if (key.startsWith("sb_secret_") && !serverKey) {
      serverKey = key;
    } else if (!key.startsWith("sb_")) {
      const role = legacyJwtRole(key);
      if (role === "anon" && !browserKey) browserKey = key;
      else if (role === "service_role" && !serverKey) serverKey = key;
    }
  }
  return { browserKey, serverKey };
}

export function mask(value) {
  const text = String(value || "");
  if (text.length <= 4) return "****";
  return `${text.slice(0, 4)}…`;
}

/**
 * Renders the browser-safe client environment. This builder deliberately
 * receives ONLY browser-safe inputs — it structurally cannot leak the
 * service-role key or the database password into a VITE_* variable.
 * Output is validated against validateProductionEnvironment() in tests.
 */
export function renderClientBrowserEnv({ projectRef, projectUrl, publishableKey }) {
  return `# LenaBeauty — client deployment environment (browser-safe).
# Generated by scripts/launch/provision-client-project.mjs
# Paste into your hosting provider's environment settings (Vercel/Netlify)
# or use as .env for a local production build. Contains NO server secrets —
# the database password and service key live in the operator file only.

VITE_ENVIRONMENT=production
VITE_DATA_BACKEND=supabase
VITE_BRANCH_MODE=single

VITE_SUPABASE_URL=${projectUrl}
VITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}

# Server/operator-only target binding used by npm run launch:preflight.
PRODUCTION_SUPABASE_PROJECT_REF=${projectRef}

# Single-center v1: canonical center UUID seeded by the migration chain.
VITE_CENTER_ID=${CANONICAL_SINGLE_CENTER_ID}

VITE_USE_DEMO_CREDENTIALS=false

# Public home of the parent digital house (login endorsement target).
VITE_LENA_HOUSE_ORIGIN=https://lenadigital.vercel.app
`;
}

export function renderOperatorSecretsEnv({
  projectRef,
  dbPassword,
  serviceKey,
  adminEmail,
  adminPassword,
}) {
  const lines = [
    `# LenaBeauty — OPERATOR SECRETS for project ${projectRef}.`,
    "# NEVER commit this file. NEVER expose these values as VITE_* variables.",
    "# Feed them to the GitHub `production` environment secrets or your own",
    "# deployment secrets store. Rotate immediately if exposed.",
    "",
    "# PostgreSQL direct-connection password (db.<ref>.supabase.co:5432).",
    `PRODUCTION_SUPABASE_DB_PASSWORD=${dbPassword}`,
    "",
    "# Server-only Supabase key (bypasses RLS). Used for admin user provisioning",
    "# and by the production release workflow.",
    `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
  ];
  if (adminEmail) {
    lines.push(
      "",
      "# First ADMIN account handed to the salon owner.",
      "# Require a password change at hand-over.",
      `ADMIN_EMAIL=${adminEmail}`,
    );
    if (adminPassword) lines.push(`ADMIN_PASSWORD=${adminPassword}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Management API client
// ---------------------------------------------------------------------------

function createManagementClient(token) {
  async function request(path, options = {}) {
    const response = await fetch(`${MANAGEMENT_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    let body = null;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      const message =
        (body && typeof body === "object" && (body.message || body.msg || body.error)) ||
        (typeof body === "string" && body.slice(0, 200)) ||
        `${response.status} ${response.statusText}`;
      const error = new Error(`Management API ${path} failed: ${message}`);
      error.status = response.status;
      throw error;
    }
    return body;
  }
  return { request };
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

// ---------------------------------------------------------------------------
// Provisioning flow
// ---------------------------------------------------------------------------

async function resolveOrganization(api, orgArg) {
  const organizations = await api.request("/v1/organizations");
  if (!Array.isArray(organizations) || organizations.length === 0) {
    throw new Error("no Supabase organizations found for this access token");
  }
  if (orgArg) {
    const match = organizations.find((org) => org.slug === orgArg || org.id === orgArg);
    if (!match) {
      const listed = organizations.map((org) => org.slug).join(", ");
      throw new Error(`organization "${orgArg}" not found. Available: ${listed}`);
    }
    return match;
  }
  if (organizations.length === 1) return organizations[0];
  const listed = organizations.map((org) => org.slug).join(", ");
  throw new Error(`multiple organizations found (${listed}); pass --org <slug>`);
}

async function createProject(api, { name, dbPass, organization, region }) {
  const attempts = [
    { name, db_pass: dbPass, organization_slug: organization.slug, region },
    { name, db_pass: dbPass, organization_id: organization.id, region },
  ];
  let lastError = null;
  for (const body of attempts) {
    try {
      return await api.request("/v1/projects", { method: "POST", body: JSON.stringify(body) });
    } catch (error) {
      lastError = error;
      // Retry with the alternate organization identifier only for validation
      // errors; anything else (auth, quota, network) must surface immediately.
      if (![400, 404, 422].includes(error.status)) throw error;
    }
  }
  throw lastError;
}

async function waitUntilProjectActive(api, ref) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < PROJECT_ACTIVE_TIMEOUT_MS) {
    const project = await api.request(`/v1/projects/${ref}`);
    const status = project?.status || "UNKNOWN";
    if (status !== lastStatus) {
      console.log(` - project status: ${status}`);
      lastStatus = status;
    }
    if (status === "ACTIVE") return project;
    if (["PAUSED", "STOPPED", "REMOVED"].includes(status)) {
      throw new Error(`project entered terminal status ${status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`timed out waiting for project ${ref} to become ACTIVE`);
}

async function waitForRestHealthy(projectUrl, browserKey) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < REST_HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetch(`${projectUrl}/rest/v1/`, {
        headers: { apikey: browserKey, Authorization: `Bearer ${browserKey}` },
      });
      if (response.ok) return;
    } catch {
      // network not ready yet — keep polling
    }
    await sleep(5000);
  }
  throw new Error("timed out waiting for the project REST API to become healthy");
}

async function runQuery(api, ref, query) {
  return api.request(`/v1/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query, read_only: false }),
  });
}

async function applyMigrations(api, ref, migrationsDir) {
  const files = discoverMigrations(migrationsDir);
  console.log(` - applying ${files.length} canonical migrations…`);
  await runQuery(api, ref, MIGRATION_HISTORY_DDL);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const version = file.slice(0, 14);
    const name = file.slice(15, -4);

    if (file === files[0]) {
      // The database can still be warming up right after ACTIVE: retry the
      // first migration for a few minutes before giving up.
      let applied = false;
      let lastError = null;
      for (let attempt = 1; attempt <= FIRST_MIGRATION_RETRIES && !applied; attempt += 1) {
        try {
          await runQuery(api, ref, sql);
          applied = true;
        } catch (error) {
          lastError = error;
          console.log(`   retrying ${file} (${attempt}/${FIRST_MIGRATION_RETRIES})…`);
          await sleep(FIRST_MIGRATION_RETRY_DELAY_MS);
        }
      }
      if (!applied) throw lastError;
    } else {
      await runQuery(api, ref, sql);
    }

    await runQuery(
      api,
      ref,
      renderMigrationRecordSql({ version, name, statements: sql }),
    );
    console.log(`   ✓ ${file}`);
  }
}

async function revealApiKeys(api, ref) {
  // 1) Modern keys, if already enabled.
  const modern = resolveApiKeys(await api.request(`/v1/projects/${ref}/api-keys?reveal=true`));
  if (modern.browserKey && modern.serverKey) {
    return { ...modern, browserKeySource: "publishable", serverKeySource: "secret" };
  }

  // 2) Enable modern keys, then reveal again.
  try {
    await api.request(`/v1/projects/${ref}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ type: "publishable", name: "default" }),
    });
    await api.request(`/v1/projects/${ref}/api-keys`, {
      method: "POST",
      body: JSON.stringify({
        type: "secret",
        name: "default",
        secret_jwt_template: { role: "service_role" },
      }),
    });
    const enabled = resolveApiKeys(
      await api.request(`/v1/projects/${ref}/api-keys?reveal=true`),
    );
    if (enabled.browserKey && enabled.serverKey) {
      return { ...enabled, browserKeySource: "publishable", serverKeySource: "secret" };
    }
  } catch {
    // Org may not be entitled to modern keys yet — fall through to legacy.
  }

  // 3) Legacy anon/service_role JWTs.
  const legacy = resolveApiKeys(
    await api.request(`/v1/projects/${ref}/api-keys/legacy?reveal=true`),
  );
  if (legacy.browserKey && legacy.serverKey) {
    return { ...legacy, browserKeySource: "anon", serverKeySource: "service_role" };
  }

  throw new Error(
    "could not reveal API keys via the Management API; " +
      "copy them from the dashboard (Settings → API) and re-run with --dry-run off skipped steps",
  );
}

async function createAdminUser(projectUrl, serverKey, { email, password, fullName }) {
  const headers = {
    apikey: serverKey,
    Authorization: `Bearer ${serverKey}`,
    "Content-Type": "application/json",
  };
  const response = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const body = await response.json().catch(() => null);

  if (response.ok && body?.id) return { id: body.id, created: true };

  const message = String(body?.msg || body?.message || "");
  if (/already (been )?registered/i.test(message) || response.status === 422) {
    // The user already exists: adopt it, but never overwrite their password.
    const listResponse = await fetch(
      `${projectUrl}/auth/v1/admin/users?per_page=1000`,
      { headers },
    );
    const list = await listResponse.json().catch(() => null);
    const existing = (list?.users || []).find((user) => user.email === email);
    if (existing?.id) return { id: existing.id, created: false };
  }
  throw new Error(`admin user creation failed: ${message || response.status}`);
}

async function provisionAdmin(api, ref, projectUrl, serverKey, { email, password, fullName }) {
  console.log(` - creating ADMIN auth user ${email}…`);
  const user = await createAdminUser(projectUrl, serverKey, {
    email,
    password,
    fullName,
  });
  if (!user.created) {
    console.log("   ⚠ email already registered — adopted the existing user (password NOT changed)");
  }

  const bootstrapSql = renderMembershipBootstrap({
    userId: user.id,
    centerId: CANONICAL_SINGLE_CENTER_ID,
    role: "ADMIN",
    fullName,
  });
  await runQuery(api, ref, bootstrapSql);

  const verification = await runQuery(
    api,
    ref,
    `SELECT cm.role FROM public.center_memberships cm WHERE cm.profile_id = ${quoteSqlLiteral(user.id)}::uuid;`,
  );
  const rows = Array.isArray(verification) ? verification : verification?.results || [];
  const firstRow = Array.isArray(rows?.[0]) ? rows[0][0] : rows?.[0];
  const role = firstRow?.role ?? firstRow?.result?.role;
  if (role !== "ADMIN") {
    throw new Error(`membership verification returned role "${role}" instead of ADMIN`);
  }
  return user;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printPlan(values, migrations) {
  console.log("Lena Beauty — client project provisioner");
  console.log("=========================================");
  console.log(` project name : ${values.name}`);
  console.log(` salon name   : ${values["salon-name"] || values.name}`);
  console.log(` region       : ${values.region}`);
  console.log(` plan         : ${values.plan || "organization default"}`);
  console.log(` admin email  : ${values["admin-email"] || "(skipped — bootstrap manually)"}`);
  console.log(` migrations   : ${migrations.length} files (disk discovery)`);
  console.log(` first/last   : ${migrations[0]} … ${migrations[migrations.length - 1]}`);
  console.log("");
}

async function runCli() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error("PROVISION: INVALID ARGUMENTS");
    for (const error of parsed.errors) console.error(` - ${error}`);
    process.exitCode = 2;
    return;
  }
  const values = parsed.values;

  const migrationsDir = resolve(process.cwd(), "supabase/migrations");
  const migrations = discoverMigrations(migrationsDir);
  printPlan(values, migrations);

  if (values.dryRun) {
    console.log("DRY RUN — no API calls were made. Re-run without --dry-run to provision.");
    return;
  }

  const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("PROVISION: FAIL — SUPABASE_ACCESS_TOKEN is required.");
    console.error("Create one at https://supabase.com/dashboard/account/tokens");
    process.exitCode = 2;
    return;
  }
  if (!UUID_RE.test(CANONICAL_SINGLE_CENTER_ID)) {
    throw new Error("canonical center id is not a valid UUID");
  }

  const api = createManagementClient(token);
  const dbPass = values["db-pass"] || generatePassword(32);
  const salonName = (values["salon-name"] || values.name).trim();

  const organization = await resolveOrganization(api, values.org);
  console.log(` ✓ organization: ${organization.slug}`);

  const project = await createProject(api, {
    name: values.name,
    dbPass,
    organization,
    region: values.region,
  });
  const ref = project?.ref || project?.id;
  if (!PROJECT_REF_RE.test(ref || "")) {
    throw new Error(`project creation returned an unexpected ref: ${ref}`);
  }
  console.log(` ✓ project created: ${ref}`);

  await waitUntilProjectActive(api, ref);

  const projectUrl = `https://${ref}.supabase.co`;
  const keys = await revealApiKeys(api, ref);
  console.log(
    ` ✓ api keys revealed (browser: ${keys.browserKeySource} / server: ${keys.serverKeySource})`,
  );

  await waitForRestHealthy(projectUrl, keys.browserKey);
  console.log(" ✓ REST API healthy");

  await applyMigrations(api, ref, migrationsDir);
  console.log(" ✓ migration chain applied + recorded");

  await runQuery(api, ref, renderCenterShellSql({ salonName, centerId: CANONICAL_SINGLE_CENTER_ID }));
  console.log(` ✓ center shell provisioned: ${salonName} (OMR)`);

  let admin = null;
  let adminPassword = null;
  if (values["admin-email"]) {
    adminPassword = values["admin-password"] || generatePassword(20);
    admin = await provisionAdmin(api, ref, projectUrl, keys.serverKey, {
      email: values["admin-email"],
      password: adminPassword,
      fullName: (values["admin-name"] || "Salon Admin").trim(),
    });
    console.log(" ✓ ADMIN membership verified");
  } else {
    console.log(" ⚠ admin skipped — run scripts/launch/render-membership-bootstrap.mjs manually");
  }

  const outDir = values.out || ".launch";
  mkdirSync(outDir, { recursive: true });
  const browserEnvPath = join(outDir, `${values.name}.env`);
  const operatorEnvPath = join(outDir, `${values.name}.operator.env`);
  writeFileSync(
    browserEnvPath,
    renderClientBrowserEnv({
      projectRef: ref,
      projectUrl,
      publishableKey: keys.browserKey,
    }),
  );
  writeFileSync(
    operatorEnvPath,
    renderOperatorSecretsEnv({
      projectRef: ref,
      dbPassword: dbPass,
      serviceKey: keys.serverKey,
      adminEmail: admin ? values["admin-email"] : null,
      adminPassword: admin ? adminPassword : null,
    }),
  );

  console.log("");
  console.log("PROVISION: SUCCESS");
  console.log(` - project ref : ${ref}`);
  console.log(` - project url : ${projectUrl}`);
  console.log(` - center      : ${salonName} (${CANONICAL_SINGLE_CENTER_ID})`);
  if (admin) console.log(` - admin login : ${values["admin-email"]} (password in operator file)`);
  console.log(` - browser env : ${browserEnvPath} (safe for Vercel/VITE_*)`);
  console.log(` - operator env: ${operatorEnvPath} (SECRETS — never commit, never VITE_*)`);
  console.log("");
  console.log("NEXT STEPS");
  console.log(` 1. cp ${browserEnvPath} .env.local && npm run launch:preflight`);
  console.log(" 2. deploy the client build with the browser env (Vercel/Netlify).");
  console.log(" 3. configure the GitHub `production` environment secrets from the operator file");
  console.log("    and run the manual production-supabase-release workflow when needed.");
  console.log(" 4. hand over the admin credentials and require a password change.");
  console.log(" 5. free plan projects pause after inactivity — move paying clients to Pro");
  console.log("    (also enables leaked-password protection; see docs/FREE_PLAN_SECURITY_LIMITATIONS.md).");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli().catch((error) => {
    console.error(`PROVISION: FAIL — ${error.message}`);
    process.exitCode = 1;
  });
}
