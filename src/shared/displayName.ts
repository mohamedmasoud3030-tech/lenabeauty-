/**
 * Safe display-name and initials helpers.
 *
 * The production crash `undefined is not an object (evaluating 't.username[0]')`
 * came from components reading the first character of nullable profile fields
 * (`username[0]`, `name[0]`, `description[0]`). These helpers centralise that
 * rendering so every employee, customer, user, appointment, receipt, avatar and
 * header path uses one deterministic, crash-proof fallback chain.
 *
 * The functions are pure and dependency-free so they can be unit-tested without
 * i18n. Callers pass a localised fallback string (e.g. `t("Unnamed")`).
 */

export interface DisplayablePerson {
  name?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export type NameInput = DisplayablePerson | string | null | undefined;

/** First trimmed non-empty string from the candidates, else null. */
function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

/** Name-like fields only — never derive initials from a phone number. */
function resolveNameForInitials(source: NameInput): string | null {
  if (source == null) return null;
  if (typeof source === "string") return firstNonEmpty([source]);
  return firstNonEmpty([
    source.name,
    source.username,
    source.firstName,
    source.lastName,
  ]);
}

/** Full display chain: name-like fields, then phone as a last resort. */
function resolveNameForDisplay(source: NameInput): string | null {
  const nameLike = resolveNameForInitials(source);
  if (nameLike) return nameLike;
  if (source == null || typeof source === "string") return nameLike;
  return firstNonEmpty([source.phone]);
}

/**
 * Deterministic display name from the actually-available profile fields.
 * Order: name → username → firstName → lastName → phone → fallback.
 * Handles missing, empty, whitespace-only and partially-loaded records.
 */
export function getDisplayName(source: NameInput, fallback: string): string {
  return resolveNameForDisplay(source) ?? fallback;
}

/**
 * Safe initials (at most two) for avatars. Uses `Array.from` so multi-byte
 * scripts such as Arabic shape correctly. Returns a neutral fallback when no
 * usable name exists. Never throws.
 */
export function getInitials(source: NameInput, fallback = "·"): string {
  const name = resolveNameForInitials(source);
  if (!name) return fallback;

  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return fallback;

  const initials = tokens
    .slice(0, 2)
    .map((token) => Array.from(token)[0] ?? "")
    .join("");

  const result = initials.trim();
  return result.length > 0 ? result.toUpperCase() : fallback;
}
