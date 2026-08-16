import { describe, it, expect } from "vitest";
import { deriveDefaultEnvironment, EnvironmentConfigurationError, parseEnv } from "../config/env";

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
