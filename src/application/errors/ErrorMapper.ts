/**
 * Maps a domain/infrastructure error to a STABLE i18n key.
 *
 * The UI is responsible for translating the returned key via `t(...)`.
 * Returning keys (not literal Arabic) keeps this layer framework-agnostic
 * and lets both languages resolve correctly. The matching keys are defined
 * in `src/i18n.ts` for both `ar` and `en`.
 */
export function mapErrorToMessageKey(error: any): string {
  if (!error) return "error.unexpected";

  const code = error.code || error.message;

  // Structured validation failures carry per-field i18n keys — surface the
  // first one so the user gets a specific, localized message instead of a
  // generic "invalid input" string.
  if (code === "VALIDATION_ERROR" && Array.isArray(error.issues) && error.issues.length > 0) {
    return error.issues[0].key || "error.validation";
  }

  switch (code) {
    case "AUTH_NOT_CONFIGURED":
      return "error.auth_not_configured";
    case "UNAUTHORIZED":
    case "UNAUTHENTICATED":
      return "error.unauthorized";
    case "FORBIDDEN":
      return "error.forbidden";
    case "NOT_FOUND":
      return "error.not_found";
    case "VALIDATION_ERROR":
      return "error.validation";
    case "CONFLICT":
      return "error.conflict";
    case "INFRASTRUCTURE_ERROR":
    case "BACKEND_METHOD_UNSUPPORTED":
      // Keep internal rollout/adapter state out of user-facing text.
      return "error.infrastructure";
    case "INVALID_CREDENTIALS":
      return "error.invalid_credentials";
    case "UNEXPECTED_ERROR":
    default:
      if (error.message && error.message.includes("not configured")) {
        return "error.auth_not_configured";
      }
      return error.message || "error.unexpected";
  }
}

/**
 * Backwards-compatible helper that resolves an error to a user-facing string
 * using a provided translate function.
 */
export function mapErrorToMessage(error: any, t?: (k: string) => string): string {
  const key = mapErrorToMessageKey(error);
  if (t) return t(key);
  return key;
}
