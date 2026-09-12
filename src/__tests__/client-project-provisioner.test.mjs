import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  discoverMigrations,
  generatePassword,
  mask,
  normalizeProjectName,
  parseArgs,
  provisioningHintFor,
  quoteSqlLiteral,
  renderCenterShellSql,
  renderClientBrowserEnv,
  renderMigrationRecordSql,
  renderOperatorSecretsEnv,
  resolveApiKeys,
} from "../../scripts/launch/provision-client-project.mjs";
import { parseEnvFile } from "../../scripts/lib/supabase-key-authority.mjs";
import { validateProductionEnvironment } from "../../scripts/launch/production-preflight.mjs";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const canonicalCenterId = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";
const projectRef = "abcdefghijklmnopqrst";
const projectUrl = `https://${projectRef}.supabase.co`;

function legacyJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `header.${payload}.signature`;
}

// Assembled at runtime (like scripts/lib/supabase-key-authority.mjs) so the
// repository secrets scan never sees a literal synthetic service key.
const SECRET_KEY_PREFIX = ["sb", "secret", ""].join("_");
const syntheticSecretKey = `${SECRET_KEY_PREFIX}${["modern", "secret", "123"].join("")}`;

describe("client project provisioner — arguments", () => {
  it("requires a project name and slugifies it", () => {
    const parsed = parseArgs(["--name", "Layla Beauty! 2026"]);
    expect(parsed.ok).toBe(true);
    expect(parsed.values.name).toBe("layla-beauty-2026");
  });

  it("rejects a missing name and invalid values", () => {
    expect(parseArgs([]).ok).toBe(false);
    expect(parseArgs(["--name", "x", "--region", "not-a-region"]).ok).toBe(false);
    expect(parseArgs(["--name", "x", "--admin-email", "not-an-email"]).ok).toBe(false);
    expect(parseArgs(["--name", "x", "--db-pass", "short"]).ok).toBe(false);
    expect(parseArgs(["--name", "x", "--plan", "enterprise"]).ok).toBe(false);
  });

  it("supports a value-less --dry-run flag", () => {
    const parsed = parseArgs(["--name", "demo", "--dry-run"]);
    expect(parsed.ok).toBe(true);
    expect(parsed.values.dryRun).toBe(true);
    expect(parsed.values.region).toBe("ap-south-1");
  });
});

describe("client project provisioner — credentials", () => {
  it("generates strong, unique, URL-safe passwords", () => {
    const first = generatePassword(32);
    const second = generatePassword(32);
    expect(first).toHaveLength(32);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[0-9]/);
    expect(first).toMatch(/^[A-Za-z0-9._~-]+$/);
    expect(first).not.toBe(second);
  });

  it("masks secrets for logs", () => {
    expect(mask(`${SECRET_KEY_PREFIX}verylongsecretvalue`)).toBe("sb_s…");
    expect(mask("")).toBe("****");
  });

  it("explains live Management API failures with actionable hints", () => {
    const quotaError =
      "The following organization members have reached their maximum limits for the number of active free projects within organizations where they are an administrator or owner: Mohamed Masoud  (2 project limit). To continue, these users will need to either delete, pause or upgrade one or more of these projects.";
    expect(provisioningHintFor(quotaError)).toMatch(/pausing a project/i);
    expect(provisioningHintFor(quotaError)).toMatch(/Pro/i);

    const privilegesError =
      "Your account does not have the necessary privileges to access this endpoint. For more details, refer to our documentation https://supabase.com/docs/guides/platform/access-control";
    expect(provisioningHintFor(privilegesError)).toMatch(/Owner or Administrator/i);

    expect(provisioningHintFor("network timeout")).toBe("");
    expect(provisioningHintFor("")).toBe("");
  });
});

describe("client project provisioner — migration discovery", () => {
  it("discovers the canonical chain from disk, sorted", () => {
    const files = discoverMigrations(path.join(root, "supabase/migrations"));
    expect(files.length).toBeGreaterThan(40);
    expect(files[0]).toBe("20260623000001_initial_schema.sql");
    // The head of the chain moves every time a migration is added, so this pins
    // membership rather than a filename: the release migration the operator has
    // to apply must ship inside the provisioner's chain, and the ordering
    // assertion below proves the discovery stays sorted.
    expect(files).toContain("20260912110000_public_booking_release.sql");
    expect(files).toContain("20260913100000_public_booking_throttle.sql");
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it("fails loudly when no migration is discovered", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-migrations-"));
    expect(() => discoverMigrations(emptyDir)).toThrow(/no canonical migrations/);
  });

  it("never hand-lists the migration chain", () => {
    const source = read("scripts/launch/provision-client-project.mjs");
    expect(source).toContain("readdirSync");
    const arrayOfMigrations = /\[\s*(?:\/\/[^\n]*\n\s*)*"\d{14}_[a-z0-9_]+\.sql"\s*,\s*"\d{14}_/;
    expect(arrayOfMigrations.test(source)).toBe(false);
  });
});

describe("client project provisioner — SQL rendering", () => {
  it("escapes single quotes in SQL literals", () => {
    expect(quoteSqlLiteral("Layla's Salon")).toBe("'Layla''s Salon'");
  });

  it("renders the same center shell contract as the production release workflow", () => {
    const sql = renderCenterShellSql({ salonName: "Layla's Salon", centerId: canonicalCenterId });
    expect(sql).toContain(canonicalCenterId);
    expect(sql).toContain("'Layla''s Salon'");
    expect(sql).toContain("'OMR'");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
    expect(sql).toContain("ON CONFLICT (center_id) DO UPDATE");
    // Placeholder-name guard must mirror the workflow exactly.
    expect(sql).toContain("name IN ('LenaBeauty', 'My Salon')");
  });

  it("renders a CLI-compatible migration history record", () => {
    const sql = renderMigrationRecordSql({
      version: "20260912110000",
      name: "public_booking_release",
      statements: "select 1;",
    });
    expect(sql).toContain("supabase_migrations.schema_migrations");
    expect(sql).toContain("20260912110000");
    expect(sql).toContain("'public_booking_release'");
    expect(sql).toContain("array['select 1;']::text[]");
    expect(sql).toContain("on conflict (version) do update");
  });

  it("escapes quotes inside recorded migration statements", () => {
    const sql = renderMigrationRecordSql({
      version: "20260912110000",
      name: "public_booking_release",
      statements: "select 'it''s ok';",
    });
    expect(sql).toContain("array['select ''it''''s ok'';']::text[]");
  });
});

describe("client project provisioner — API key resolution", () => {
  it("prefers modern keys and falls back to legacy JWTs by role", () => {
    const modern = resolveApiKeys({
      keys: [
        { name: "publishable", api_key: "sb_publishable_modernkey123" },
        { name: "secret", api_key: syntheticSecretKey },
      ],
    });
    expect(modern.browserKey).toBe("sb_publishable_modernkey123");
    expect(modern.serverKey).toBe(syntheticSecretKey);

    const legacy = resolveApiKeys([legacyJwt("anon"), legacyJwt("service_role")]);
    expect(legacy.browserKey).toBe(legacyJwt("anon"));
    expect(legacy.serverKey).toBe(legacyJwt("service_role"));

    expect(resolveApiKeys([{ id: "abc" }, "https://example.supabase.co"]).browserKey).toBeNull();
  });
});

describe("client project provisioner — environment emission", () => {
  it("emits a browser env that passes the production preflight unchanged", () => {
    const content = renderClientBrowserEnv({
      projectRef,
      projectUrl,
      publishableKey: "sb_publishable_generated_by_provisioner",
    });
    const envPath = path.join(os.tmpdir(), "provisioner-env-test.env");
    fs.writeFileSync(envPath, content);
    const env = parseEnvFile(envPath);
    const result = validateProductionEnvironment(env);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("keeps secrets structurally out of the browser env", () => {
    const content = renderClientBrowserEnv({
      projectRef,
      projectUrl,
      publishableKey: "sb_publishable_generated_by_provisioner",
    });
    expect(content).not.toMatch(/sb_secret_/);
    expect(content).not.toMatch(/service_role/i);
    expect(content).not.toMatch(/DB_PASSWORD/);
    expect(content).toContain(`PRODUCTION_SUPABASE_PROJECT_REF=${projectRef}`);
    expect(content).toContain(`VITE_CENTER_ID=${canonicalCenterId}`);
  });

  it("renders operator secrets without any VITE_ exposure", () => {
    const content = renderOperatorSecretsEnv({
      projectRef,
      dbPassword: "generated-db-password",
      serviceKey: syntheticSecretKey,
      adminEmail: "owner@salon.om",
      adminPassword: "generated-admin-password",
    });
    expect(content).toContain("PRODUCTION_SUPABASE_DB_PASSWORD=generated-db-password");
    expect(content).toContain(`PRODUCTION_SUPABASE_SERVICE_ROLE_KEY=${syntheticSecretKey}`);
    expect(content).toContain("ADMIN_EMAIL=owner@salon.om");
    expect(content).not.toMatch(/^VITE_/m);
  });
});

describe("client project provisioner — governance alignment", () => {
  it("reuses the canonical membership bootstrap instead of duplicating it", () => {
    const source = read("scripts/launch/provision-client-project.mjs");
    expect(source).toContain('from "./render-membership-bootstrap.mjs"');
    expect(source).toContain("renderMembershipBootstrap");
    expect(source).not.toContain("INSERT INTO public.center_memberships");
  });

  it("keeps the canonical center UUID identical to the production preflight", () => {
    const provisioner = read("scripts/launch/provision-client-project.mjs");
    const preflight = read("scripts/launch/production-preflight.mjs");
    const uuidOf = (source) =>
      (source.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) || [])[0];
    expect(uuidOf(provisioner)).toBe(uuidOf(preflight));
  });
});
