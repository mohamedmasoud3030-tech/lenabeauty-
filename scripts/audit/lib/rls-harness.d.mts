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

export interface HarnessDatabase {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

export interface HarnessRoleContext {
  role?: string;
  uid?: string | null;
}

export type RoleResult<T = Record<string, any>> =
  | { outcome: "ok"; rows: T[]; code?: undefined; message?: undefined }
  | { outcome: "denied"; code: "42501"; message: string; rows?: undefined }
  | { outcome: "error"; code: string | null; message: string; rows?: undefined };

export function createAuthorizationHarness(): Promise<{
  db: HarnessDatabase;
  failures: string[];
}>;

export function asRole<T = Record<string, any>>(
  db: HarnessDatabase,
  context: HarnessRoleContext,
  sql: string,
  params?: unknown[],
): Promise<RoleResult<T>>;

export function tablePrivileges(
  db: HarnessDatabase,
  table: string,
  role?: string,
): Promise<string[]>;
