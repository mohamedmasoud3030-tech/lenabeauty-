import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Repository-wide secrets scan (Group 6 — "verify no secrets exist in git
 * history/current files within the scope accessible to you").
 *
 * Checks every tracked-looking file for:
 *   - Supabase service-role keys (sb_secret_...);
 *   - JWTs whose payload declares the `service_role` claim;
 *   - private key material (BEGIN ... PRIVATE KEY);
 *   - postgres connection strings that embed a real-looking password.
 *
 * Deliberately allowed:
 *   - the publishable anon key in src/config/env.ts (public by design) and
 *     the defensive `sb_secret_` string checks in env.ts / preflight /
 *     substrate.test.ts (they are guards, not credentials);
 *   - documentation examples with placeholder passwords (password, xxxx...).
 */

const ROOT = resolve(process.cwd());

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
  "target",
]);

const DEFENSIVE_SB_SECRET_FILES = new Set([
  join(ROOT, "src", "config", "env.ts"),
  join(ROOT, "src", "__tests__", "substrate.test.ts"),
  join(ROOT, "scripts", "supabase-live-preflight.mjs"),
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (st.isFile() && !full.endsWith(".map")) {
      out.push(full);
    }
  }
  return out;
}

function isBinary(file: string): boolean {
  const buf = readFileSync(file).subarray(0, 4096);
  return buf.includes(0);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

describe("repository secrets scan", () => {
  it("contains no service-role Supabase keys or private key material", () => {
    const violations: string[] = [];
    const files = walk(ROOT);

    for (const file of files) {
      if (DEFENSIVE_SB_SECRET_FILES.has(file) || isBinary(file)) continue;

      let content: string;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue; // unreadable/binary edge cases
      }

      const relative = file.slice(ROOT.length + 1);

      // 1. Supabase service-role key prefix
      if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(content)) {
        violations.push(`${relative}: contains sb_secret_ (service-role key material)`);
      }

      // 2. Private key material
      if (/BEGIN (RSA |OPENSSH |EC |ENCRYPTED |DSA )?PRIVATE KEY/.test(content)) {
        violations.push(`${relative}: contains private key material`);
      }

      // 3. JWTs whose role claim is service_role
      const jwtRe = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
      for (const match of content.match(jwtRe) ?? []) {
        const payload = decodeJwtPayload(match);
        if (payload && payload.role === "service_role") {
          violations.push(`${relative}: contains a JWT with role=service_role`);
        }
      }

      // 4. Postgres URLs with a real-looking embedded password
      const pgRe = /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s/]+)@/g;
      for (const match of content.matchAll(pgRe)) {
        const password = match[1];
        if (/^(password|xxxx+|yoursecret|changeme|postgres|admin|1234*)$/i.test(password)) {
          continue; // documentation placeholder
        }
        violations.push(`${relative}: contains a postgres URL with an embedded password`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("tracks no .env files with real values", () => {
    const files = walk(ROOT).filter((f) => /(^|[/\\])\.env([^/\\]*)?$/.test(f));
    const tracked = files.filter((f) => !f.includes(`${sep}.env.example`));
    expect(tracked).toEqual([]);
  });
});
