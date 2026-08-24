import { useCases } from "../../app/composition/useCases";

// Helper to bridge Domain errors into Promise rejects for simple UI catching
// This should really be at the Application Layer but here it prevents duplication across pages.
export async function unwrap<T>(promise: Promise<{ok: boolean, data?: T, error?: any}>): Promise<T> {
  const res = await promise;
  if (res.ok) {
    return res.data as T;
  }
  throw res.error;
}

export function formatError(err: any): string {
  // Backend implementation state is an internal concern. Users need a useful
  // recovery message, not deployment vocabulary such as "under development".
  if (err && err.code === "BACKEND_METHOD_UNSUPPORTED") {
    return "An unexpected error occurred. Please try again.";
  }
  // Structured validation errors carry per-field i18n keys — return the first
  // key so callers can translate it to a specific, localized message.
  if (err && err.code === "VALIDATION_ERROR" && Array.isArray(err.issues) && err.issues.length > 0) {
    return err.issues[0].key;
  }
  return err?.message || String(err) || "An unexpected error occurred. Please try again.";
}
