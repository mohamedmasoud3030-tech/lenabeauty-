export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export interface AuthError extends Error {
  code: "AUTH_NOT_CONFIGURED" | "UNAUTHORIZED" | "INVALID_CREDENTIALS" | "INFRASTRUCTURE_ERROR";
}

export interface DomainError extends Error {
  code: "NOT_FOUND" | "VALIDATION_ERROR" | "INFRASTRUCTURE_ERROR" | "BACKEND_METHOD_UNSUPPORTED";
}
