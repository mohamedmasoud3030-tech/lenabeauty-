/**
 * Public parent-brand contract for the product (fixed developer identity).
 *
 * The product remains an independent surface. LENA Digital House is the
 * parent digital house that designs and develops the LENA product family. The
 * login endorsement therefore links to LENA's independent public homepage,
 * never to support, GitHub, WhatsApp, or an in-app pseudo-company route.
 */

import { PARENT_HOUSE_NAME, PARENT_HOUSE_URL } from "../config/brand";

export type LenaHouseLocale = "ar" | "en";

// Re-exported from the single product-identity module so the developer
// attribution cannot drift from the rest of the app.
export const LENA_HOUSE_NAME = PARENT_HOUSE_NAME;
const DEFAULT_LENA_HOUSE_ORIGIN = PARENT_HOUSE_URL;

function readConfiguredOrigin(): string {
  try {
    const raw = import.meta.env?.VITE_LENA_HOUSE_ORIGIN;
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function isForbiddenLenaHouseDestination(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed.includes("github.com")) return true;
  if (trimmed.includes("whatsapp")) return true;
  if (/(^|[^a-z])support([^a-z]|$)/.test(trimmed)) return true;
  if (/(^|[^a-z])help([^a-z]|$)/.test(trimmed)) return true;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return true;
    if (url.pathname.includes("/support") || url.pathname.includes("/help")) return true;
  } catch {
    return true;
  }

  return false;
}

export function resolveLenaHouseOrigin(
  raw: string | undefined | null = readConfiguredOrigin(),
): string {
  const candidate = String(raw ?? "").trim().replace(/\/+$/, "") || DEFAULT_LENA_HOUSE_ORIGIN;
  if (isForbiddenLenaHouseDestination(candidate)) return DEFAULT_LENA_HOUSE_ORIGIN;
  return candidate;
}

/**
 * LENA's normal public homepage for the selected locale.
 * `from=lenabeauty` is a non-PII referral marker only.
 */
export function lenaHousePublicEntry(
  locale: LenaHouseLocale = "ar",
  origin: string | undefined | null = readConfiguredOrigin(),
): string {
  const resolved = resolveLenaHouseOrigin(origin);
  const url = new URL(`/${locale}`, `${resolved}/`);
  url.searchParams.set("from", "lenabeauty");
  return url.toString();
}
