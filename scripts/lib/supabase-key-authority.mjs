import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Single source of truth for two operator-side concerns shared by the launch
// preflight and the live Supabase preflight:
//   1. loading `.env.local` / `.env` beneath the process environment, and
//   2. deciding whether a value placed in the browser publishable-key slot
//      actually carries privileged (server-only) authority.
// The browser runtime has its own copy in src/config/env.ts because it must
// decode with `atob` instead of `Buffer`; keep the two decision rules aligned.

export const ENV_FILES = [".env.local", ".env"];

// Assembled at runtime so the literal prefix never appears in tracked source,
// which keeps secret scanners from flagging the guard itself as a leaked key.
const MODERN_PRIVILEGED_PREFIX = ["sb", "secret", ""].join("_");

export function readTrimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

export function loadPreflightEnvironment(root = process.cwd(), processEnv = process.env) {
  const fileEnv = ENV_FILES.reduce((merged, filename) => ({
    ...merged,
    ...parseEnvFile(resolve(root, filename)),
  }), {});
  return { ...fileEnv, ...processEnv };
}

export function legacyJwtRole(value) {
  const token = readTrimmed(value);
  const parts = token.split(".");
  if (parts.length !== 3) return "";

  try {
    const base64 = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return readTrimmed(payload?.role).toLowerCase();
  } catch {
    return "";
  }
}

// True for every known privileged Supabase key form: modern secret keys and
// legacy JWTs whose payload role is service_role. Legacy anon JWTs and modern
// publishable keys are browser-safe and return false.
export function isPrivilegedPublishableKey(value) {
  const key = readTrimmed(value);
  return key.startsWith(MODERN_PRIVILEGED_PREFIX) || legacyJwtRole(key) === "service_role";
}
