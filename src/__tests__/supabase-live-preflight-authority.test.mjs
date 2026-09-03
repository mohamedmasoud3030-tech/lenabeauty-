import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isPrivilegedPublishableKey,
  loadPreflightEnvironment,
} from "../../scripts/supabase-live-preflight-entry.mjs";

const tempDirs = [];

function legacyJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `header.${payload}.signature`;
}

function modernPrivilegedKey() {
  return ["sb", "secret", "server-only"].join("_");
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe("live Supabase preflight browser-key authority guard", () => {
  it("rejects modern privileged keys and legacy service-role JWTs", () => {
    expect(isPrivilegedPublishableKey(modernPrivilegedKey())).toBe(true);
    expect(isPrivilegedPublishableKey(legacyJwt("service_role"))).toBe(true);
    expect(isPrivilegedPublishableKey(legacyJwt("anon"))).toBe(false);
  });

  it("loads the same tracked-out env-file sources before applying the guard", () => {
    const root = mkdtempSync(join(tmpdir(), "lena-preflight-"));
    tempDirs.push(root);
    writeFileSync(join(root, ".env"), `VITE_SUPABASE_PUBLISHABLE_KEY=${legacyJwt("service_role")}\n`);

    const env = loadPreflightEnvironment(root, {});
    expect(isPrivilegedPublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY)).toBe(true);
  });

  it("lets explicit process environment override file configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "lena-preflight-"));
    tempDirs.push(root);
    writeFileSync(join(root, ".env"), `VITE_SUPABASE_PUBLISHABLE_KEY=${legacyJwt("service_role")}\n`);

    const anonKey = legacyJwt("anon");
    const env = loadPreflightEnvironment(root, { VITE_SUPABASE_PUBLISHABLE_KEY: anonKey });
    expect(env.VITE_SUPABASE_PUBLISHABLE_KEY).toBe(anonKey);
    expect(isPrivilegedPublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY)).toBe(false);
  });
});
