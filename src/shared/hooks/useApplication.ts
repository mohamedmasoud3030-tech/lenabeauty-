import { useCases } from "../../app/composition/useCases";
import i18n from "../../i18n";

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
  // `String(undefined)` is the truthy string "undefined", which would render
  // as literal text — an absent error must always produce a real message.
  if (err === undefined || err === null || err === "") {
    return "An unexpected error occurred. Please try again.";
  }
  const message = String(err?.message ?? err);
  // The database raises bare snake_case identifiers for some refusals. They are
  // safe but they are not display text, so the signed-in screens translate them
  // exactly like the public ones do. Any other message is returned untouched.
  const mapped = PUBLIC_ACTION_CODES[message.trim().toLowerCase()];
  if (mapped) return i18n.t(mapped);
  return message;
}

// The public booking/portal RPCs raise deliberate, human-authored messages for
// expected conditions (slot taken, wrong portal code, lockout). Those must keep
// reaching the visitor. What must never reach them is transport/plumbing text:
// PostgREST errors and permission failures name internal objects, e.g.
// `permission denied for function public_center_info_v1` — which was live on
// the anonymous #/book screen.
const INTERNAL_ERROR_PATTERNS: RegExp[] = [
  /query failed in \[/i,
  /row mapping failed in \[/i,
  /permission denied for/i,
  /pgrst\d+/i,
  /could not find the function/i,
  /schema cache/i,
  /relation .+ does not exist/i,
  /column .+ does not exist/i,
  /\b(?:42501|42P01|42703|42883|PGRST\d+)\b/,
  /invalid api key/i,
  /no api key found in request/i,
  /\bjwt\b/i,
];

// snake_case codes raised by the cancel/reschedule RPCs. They are safe (no
// internal detail) but are not display text: each maps to a translation key
// that resolves in Arabic and English.
const PUBLIC_ACTION_CODES: Record<string, string> = {
  appointment_not_found: "We could not find this appointment. Please contact the salon.",
  invalid_portal_credentials: "Invalid portal credentials",
  only_scheduled_can_be_cancelled: "This appointment can no longer be cancelled.",
  cannot_cancel_past_or_started_appointment: "A past or started appointment cannot be cancelled.",
  only_scheduled_can_be_rescheduled: "This appointment can no longer be rescheduled.",
  cannot_reschedule_past_or_started_appointment: "A past or started appointment cannot be rescheduled.",
  new_time_must_be_in_future: "Please choose a time in the future.",
  selected_staff_not_available: "The selected specialist is not available for that time.",
  this_time_slot_is_no_longer_available: "This time slot is no longer available",
  // Raised by the signed-in write functions (reviews, service files,
  // notification events, journal entries, booking leads). A member of staff who
  // lacks the role, or who passes an id from another salon, used to see the raw
  // identifier on screen.
  insufficient_privilege: "You do not have permission to do that.",
  customer_not_in_center: "This client does not belong to this salon.",
  appointment_not_in_center: "This appointment does not belong to this salon.",
  service_not_in_center: "This service does not belong to this salon.",
  admin_role_required: "Only an administrator can do that.",
};

function looksLikeInternalDetail(message: string): boolean {
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Error formatter for the PUBLIC (anonymous) surfaces only: #/book and #/portal.
 *
 * Internal messages are replaced with the caller's localized fallback and the
 * raw detail is logged to the console so operators can still diagnose the
 * deployment. Signed-in screens keep using `formatError`, where the caller
 * already has a session and the detail is actionable.
 */
export function formatPublicError(err: any, fallback: string): string {
  if (err === undefined || err === null || err === "") {
    return fallback;
  }

  const message = formatError(err).trim();

  // Validation failures resolve to i18n keys (e.g. "validation.phone_invalid")
  // and carry no server internals.
  if (message.toLowerCase().startsWith("validation.")) {
    return message;
  }

  const actionKey = PUBLIC_ACTION_CODES[message.toLowerCase()];
  if (actionKey) {
    return i18n.t(actionKey);
  }

  if (looksLikeInternalDetail(message)) {
    console.error("[public-surface] suppressed internal error detail:", message);
    return fallback;
  }

  if (message.length === 0) {
    return fallback;
  }

  // What is left is a deliberate business message raised by a database function
  // (e.g. "Service is not available" when a service is withdrawn between page
  // load and submit). It is not internal detail, so it is shown — but the
  // public screens are Arabic by default and the server writes English, so it
  // goes through the dictionaries first. i18next returns the key unchanged when
  // there is no entry, so an untranslated message still reaches the caller
  // exactly as the server wrote it.
  return i18n.t(message);
}
