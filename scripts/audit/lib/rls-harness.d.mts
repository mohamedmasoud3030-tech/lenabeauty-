// Type declarations for the executable authorization harness.
//
// The harness itself is plain JS (it is shared with the `scripts/audit/*.mjs`
// tooling, which runs under bare Node without a TypeScript build step). These
// declarations give the Vitest suites real type safety over that boundary.

export interface HarnessFixtures {
  readonly centerA: string;
  readonly centerB: string;
  readonly adminA: string;
  readonly staffA: string;
  readonly adminB: string;
  readonly outsider: string;
  readonly employeeA: string;
  readonly customerA: string;
  readonly customerB: string;
}

export const FIXTURES: HarnessFixtures;

/** Minimal surface of the PGlite instance the harness hands back. */
export interface HarnessDatabase {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

export interface HarnessRoleContext {
  /** Defaults to "authenticated". */
  role?: string;
  /** The value exposed to `auth.uid()`; `null` simulates an anonymous caller. */
  uid?: string | null;
}

/**
 * Result of running a statement as a client role. `denied` means PostgreSQL
 * refused the statement (missing GRANT or a policy with no matching row);
 * `error` means something else went wrong and is always worth investigating.
 */
export type RoleResult<T = Record<string, any>> =
  | { outcome: "ok"; rows: T[]; code?: undefined; message?: undefined }
  | { outcome: "denied"; code: "42501"; message: string; rows?: undefined }
  | { outcome: "error"; code: string | null; message: string; rows?: undefined };

/**
 * Replay the canonical automated migration chain into a fresh PGlite instance
 * and install the deterministic multi-tenant fixture set.
 */
export function createAuthorizationHarness(): Promise<{
  db: HarnessDatabase;
  failures: string[];
}>;

/** Run `sql` exactly as the given Supabase client role and signed-in user. */
export function asRole<T = Record<string, any>>(
  db: HarnessDatabase,
  context: HarnessRoleContext,
  sql: string,
  params?: unknown[],
): Promise<RoleResult<T>>;

/** Effective privileges a client role holds on a table, from the live catalog. */
export function tablePrivileges(
  db: HarnessDatabase,
  table: string,
  role?: string,
): Promise<string[]>;
