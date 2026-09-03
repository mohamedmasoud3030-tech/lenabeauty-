function read(value) {
  return typeof value === "string" ? value.trim() : "";
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

const publishableKey = read(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const modernPrivilegedPrefix = ["sb", "secret", ""].join("_");

if (publishableKey.startsWith(modernPrivilegedPrefix) || jwtRole(publishableKey) === "service_role") {
  console.error("FAIL VITE_SUPABASE_PUBLISHABLE_KEY must be browser-safe and must not carry service-role authority");
  process.exit(1);
}

await import("./supabase-live-preflight.mjs");
