import { describe, it, expect } from "vitest";
import { deriveDefaultEnvironment, EnvironmentConfigurationError, isLenaDemoSupabaseUrl, isPrivilegedSupabaseBrowserKey, parseEnv } from "../config/env";

function legacyJwt(role: string): string {
    const payload = btoa(JSON.stringify({ role }))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
    return `header.${payload}.signature`;
}

function modernPrivilegedKey(): string {
    return ["sb", "secret", "server-only"].join("_");
}

describe("Environment Configuration Tests", () => {
    it("Preview mode is rejected", () => {
        expect(() => parseEnv({
            VITE_DATA_BACKEND: "preview"
        })).toThrowError(EnvironmentConfigurationError);
    });

    it("Missing backend mode is rejected", () => {
        expect(() => parseEnv({})).toThrowError(EnvironmentConfigurationError);
    });

    it("Supabase mode rejects missing VITE_CENTER_ID", () => {
        expect(() => {
            parseEnv({
                VITE_DATA_BACKEND: "supabase",
                VITE_SUPABASE_URL: "https://example.supabase.co",
                VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
                VITE_BRANCH_MODE: "single"
            });
        }).toThrowError("MISSING_SINGLE_BRANCH_CENTER_ID");
    });

    it("Supabase mode rejects invalid VITE_CENTER_ID", () => {
        expect(() => {
            parseEnv({
                VITE_DATA_BACKEND: "supabase",
                VITE_SUPABASE_URL: "https://example.supabase.co",
                VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
                VITE_BRANCH_MODE: "single",
                VITE_CENTER_ID: "invalid-uuid" // Not a UUID
            });
        }).toThrowError("MISSING_SINGLE_BRANCH_CENTER_ID");
    });

    it("Supabase mode uses the configured center id", () => {
        const env = parseEnv({
            VITE_DATA_BACKEND: "supabase",
            VITE_SUPABASE_URL: "https://example.supabase.co",
            VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000" // Valid UUID
        });
        expect(env.centerId).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("derives development environment when VITE_ENVIRONMENT is unset in tests", () => {
        const env = parseEnv({
            VITE_DATA_BACKEND: "supabase",
            VITE_SUPABASE_URL: "https://example.supabase.co",
            VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        });
        expect(env.environment).toBe("development");
    });

    it("classifies an optimized build as staging while no Production data environment exists", () => {
        expect(deriveDefaultEnvironment(true)).toBe("staging");
        expect(deriveDefaultEnvironment(false)).toBe("development");
    });

    it("accepts an explicit staging environment", () => {
        const env = parseEnv({
            VITE_ENVIRONMENT: "staging",
            VITE_DATA_BACKEND: "supabase",
            VITE_SUPABASE_URL: "https://staging.example.supabase.co",
            VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        });
        expect(env.environment).toBe("staging");
        expect(env.supabaseUrl).toBe("https://staging.example.supabase.co");
    });

    it("accepts an explicit production environment", () => {
        const env = parseEnv({
            VITE_ENVIRONMENT: "production",
            VITE_DATA_BACKEND: "supabase",
            VITE_SUPABASE_URL: "https://prod.example.supabase.co",
            VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        });
        expect(env.environment).toBe("production");
    });

    it("recognizes the Lena Demo project regardless of a trailing slash", () => {
        expect(isLenaDemoSupabaseUrl("https://tuzzvqsnbtzvkffmazyf.supabase.co")).toBe(true);
        expect(isLenaDemoSupabaseUrl("https://tuzzvqsnbtzvkffmazyf.supabase.co/")).toBe(true);
        expect(isLenaDemoSupabaseUrl("https://prod.example.supabase.co")).toBe(false);
    });

    it("rejects an explicit Production target that points to the Lena Demo project", () => {
        expect(() => parseEnv({
            VITE_ENVIRONMENT: "production",
            VITE_DATA_BACKEND: "supabase",
            VITE_SUPABASE_URL: "https://tuzzvqsnbtzvkffmazyf.supabase.co/",
            VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        })).toThrowError("PRODUCTION_DEMO_PROJECT_FORBIDDEN");
    });

    it("rejects modern and legacy privileged Supabase keys from browser configuration", () => {
        const modernKey = modernPrivilegedKey();
        expect(isPrivilegedSupabaseBrowserKey(modernKey)).toBe(true);
        expect(isPrivilegedSupabaseBrowserKey(legacyJwt("service_role"))).toBe(true);
        expect(isPrivilegedSupabaseBrowserKey(legacyJwt("anon"))).toBe(false);

        for (const key of [modernKey, legacyJwt("service_role")]) {
            expect(() => parseEnv({
                VITE_ENVIRONMENT: "production",
                VITE_DATA_BACKEND: "supabase",
                VITE_SUPABASE_URL: "https://prod.example.supabase.co",
                VITE_SUPABASE_PUBLISHABLE_KEY: key,
                VITE_BRANCH_MODE: "single",
                VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
            })).toThrowError("INVALID_SUPABASE_CONFIGURATION");
        }
    });

    it("fails closed when an optimized explicit Production target omits its project configuration", () => {
        expect(() => parseEnv({
            VITE_ENVIRONMENT: "production",
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        }, { isProductionBuild: true })).toThrowError("INVALID_SUPABASE_CONFIGURATION");
    });

    it("fails closed when a production build omits Supabase configuration (no demo fallback)", () => {
        // Previously an optimized build defaulted to staging and silently
        // inherited demo credentials. P0.2: a production build must never fall
        // back to demo credentials.
        expect(() => parseEnv({
            VITE_ENVIRONMENT: "staging",
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        }, { isProductionBuild: true })).toThrowError(/INVALID_SUPABASE_CONFIGURATION/);
    });

    it("fails closed even when a production build explicitly requests demo credentials", () => {
        // The demo opt-in is a non-production-build escape hatch only; a
        // production build ignores it and fails closed without explicit values.
        expect(() => parseEnv({
            VITE_ENVIRONMENT: "staging",
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000",
            VITE_USE_DEMO_CREDENTIALS: "true"
        }, { isProductionBuild: true })).toThrowError(/INVALID_SUPABASE_CONFIGURATION/);
    });

    it("fails closed when an explicit production environment requests demo credentials", () => {
        // Even in a non-production build, an explicit `production` environment
        // never uses demo credentials.
        expect(() => parseEnv({
            VITE_ENVIRONMENT: "production",
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000",
            VITE_USE_DEMO_CREDENTIALS: "true"
        })).toThrowError(/INVALID_SUPABASE_CONFIGURATION/);
    });

    it("fails closed in a non-production build without the demo opt-in when configuration is missing", () => {
        expect(() => parseEnv({
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        })).toThrowError(/INVALID_SUPABASE_CONFIGURATION/);
    });

    it("uses demo credentials only when explicitly opted in on a non-production build", () => {
        const env = parseEnv({
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_USE_DEMO_CREDENTIALS: "true"
        });
        expect(env.environment).toBe("development");
        expect(env.backend).toBe("supabase");
        expect(env.supabaseUrl).toMatch(/^https:\/\//);
        expect(env.supabasePublishableKey).toBeTruthy();
        expect(env.centerId).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it("honors the demo opt-in on an explicit staging environment of a non-production build", () => {
        const env = parseEnv({
            VITE_ENVIRONMENT: "staging",
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_USE_DEMO_CREDENTIALS: "true"
        });
        expect(env.environment).toBe("staging");
        expect(env.supabaseUrl).toMatch(/^https:\/\//);
        expect(env.supabasePublishableKey).toBeTruthy();
    });

    it("does not apply demo credentials when the opt-in is not exactly true", () => {
        expect(() => parseEnv({
            VITE_DATA_BACKEND: "supabase",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000",
            VITE_USE_DEMO_CREDENTIALS: "1"
        })).toThrowError(/INVALID_SUPABASE_CONFIGURATION/);
    });

    it("rejects an unsupported VITE_ENVIRONMENT value", () => {
        expect(() => parseEnv({
            VITE_ENVIRONMENT: "preview",
            VITE_DATA_BACKEND: "supabase",
            VITE_SUPABASE_URL: "https://example.supabase.co",
            VITE_SUPABASE_PUBLISHABLE_KEY: "mock-key",
            VITE_BRANCH_MODE: "single",
            VITE_CENTER_ID: "123e4567-e89b-12d3-a456-426614174000"
        })).toThrowError("UNSUPPORTED_ENVIRONMENT");
    });
});