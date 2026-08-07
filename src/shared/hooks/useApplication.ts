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
  if (err && err.code === "BACKEND_METHOD_UNSUPPORTED") {
    return "BACKEND_METHOD_UNSUPPORTED"; // Key for translation
  }
  // Structured validation errors carry per-field i18n keys — return the first
  // key so callers can translate it to a specific, localized message.
  if (err && err.code === "VALIDATION_ERROR" && Array.isArray(err.issues) && err.issues.length > 0) {
    return err.issues[0].key;
  }
  return err?.message || String(err) || "An unexpected error occurred";
}
