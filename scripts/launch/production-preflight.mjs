const DEMO_SUPABASE_PROJECT_REF = "tuzzvqsnbtzvkffmazyf";
const DEMO_SUPABASE_HOST = `${DEMO_SUPABASE_PROJECT_REF}.supabase.co`;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_REF_RE = /^[a-z0-9]{20}$/;

function read(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
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

function isPrivilegedBrowserKey(value) {
  const key = read(value);
  return key.startsWith("sb_secret_") || jwtRole(key) === "service_role";
}

export function validateProductionEnvironment(env) {
  const errors = [];
  const environment = read(env.VITE_ENVIRONMENT).toLowerCase();
  const backend = read(env.VITE_DATA_BACKEND).toLowerCase();
  const branchMode = read(env.VITE_BRANCH_MODE).toLowerCase();
  const supabaseUrl = read(env.VITE_SUPABASE_URL);
  const publishableKey = read(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const centerId = read(env.VITE_CENTER_ID);
  const productionProjectRef = read(env.PRODUCTION_SUPABASE_PROJECT_REF).toLowerCase();
  const demoOptIn = read(env.VITE_USE_DEMO_CREDENTIALS).toLowerCase();

  if (environment !== "production") {
    errors.push("VITE_ENVIRONMENT must be production");
  }
  if (backend !== "supabase") {
    errors.push("VITE_DATA_BACKEND must be supabase");
  }
  if (branchMode !== "single") {
    errors.push("VITE_BRANCH_MODE must be single for the first-customer production deployment");
  }

  if (!PROJECT_REF_RE.test(productionProjectRef)) {
    errors.push("PRODUCTION_SUPABASE_PROJECT_REF must be an explicit 20-character Supabase project ref");
  } else if (productionProjectRef === DEMO_SUPABASE_PROJECT_REF) {
    errors.push("Production project ref must not equal the Lena Demo project");
  }

  const host = hostOf(supabaseUrl);
  if (!host || !supabaseUrl.startsWith("https://")) {
    errors.push("VITE_SUPABASE_URL must be a valid HTTPS URL");
  } else {
    if (host === DEMO_SUPABASE_HOST) {
      errors.push("Production must not target the Lena Demo Supabase project");
    }
    if (PROJECT_REF_RE.test(productionProjectRef) && host !== `${productionProjectRef}.supabase.co`) {
      errors.push("VITE_SUPABASE_URL must match PRODUCTION_SUPABASE_PROJECT_REF");
    }
  }

  if (!publishableKey) {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY is required");
  } else if (isPrivilegedBrowserKey(publishableKey)) {
    errors.push("A Supabase privileged/service-role key must never be exposed as VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  if (!UUID_RE.test(centerId) || centerId === NIL_UUID) {
    errors.push("VITE_CENTER_ID must be a real non-placeholder UUID");
  }

  if (demoOptIn === "true") {
    errors.push("VITE_USE_DEMO_CREDENTIALS must not be enabled in Production");
  }

  const privilegedBrowserVars = Object.keys(env).filter((key) =>
    key.startsWith("VITE_")
    && /(SERVICE_ROLE|DB_PASSWORD|DATABASE_PASSWORD|MANAGEMENT_TOKEN|SUPABASE_TOKEN)/i.test(key)
    && read(env[key]),
  );
  if (privilegedBrowserVars.length > 0) {
    errors.push(`Privileged server credentials are exposed to the browser: ${privilegedBrowserVars.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      environment,
      backend,
      branchMode,
      productionProjectRef: PROJECT_REF_RE.test(productionProjectRef) ? productionProjectRef : null,
      supabaseHost: host || null,
      centerId: UUID_RE.test(centerId) && centerId !== NIL_UUID ? centerId : null,
    },
  };
}

function runCli() {
  const result = validateProductionEnvironment(process.env);
  if (!result.ok) {
    console.error("FIRST CUSTOMER PRODUCTION PREFLIGHT: FAIL");
    for (const error of result.errors) console.error(` - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("FIRST CUSTOMER PRODUCTION PREFLIGHT: PASS");
  console.log(` - environment: ${result.summary.environment}`);
  console.log(` - backend: ${result.summary.backend}`);
  console.log(` - branch mode: ${result.summary.branchMode}`);
  console.log(` - production project ref: ${result.summary.productionProjectRef}`);
  console.log(` - Supabase host: ${result.summary.supabaseHost}`);
  console.log(` - center id: ${result.summary.centerId}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli();
}
