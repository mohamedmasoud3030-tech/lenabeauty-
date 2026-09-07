import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const envFiles = [".env.local", ".env"];

function read(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseEnvFile(path) {
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
  const fileEnv = envFiles.reduce((merged, filename) => ({
    ...merged,
    ...parseEnvFile(resolve(root, filename)),
  }), {});
  return { ...fileEnv, ...processEnv };
}

function jwtRole(value) {
  const token = read(value);
  const parts = token.split(".");
  if (parts.length !== 3) return "";

  try {
    const base64 = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return read(payload?.role).toLowerCase();
  } catch {
    return "";
  }
}

export function isPrivilegedPublishableKey(value) {
  const publishableKey = read(value);
  const modernPrivilegedPrefix = ["sb", "secret", ""].join("_");
  return publishableKey.startsWith(modernPrivilegedPrefix) || jwtRole(publishableKey) === "service_role";
}

async function runCli() {
  const env = loadPreflightEnvironment();
  if (isPrivilegedPublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    console.error("FAIL VITE_SUPABASE_PUBLISHABLE_KEY must be browser-safe and must not carry service-role authority");
    process.exitCode = 1;
    return;
  }

  await import("./supabase-live-preflight.mjs");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli();
}
