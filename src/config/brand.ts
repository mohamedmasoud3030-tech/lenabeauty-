/**
 * Fixed product identity — the ONE place these strings are allowed to live.
 *
 * Two identities exist in this product and they must never be confused:
 *
 *   FIXED (this file)
 *     The product and its developer. "Lara Beauty" is the software the salon
 *     runs; "LENA Digital House" developed it. These are constants because no
 *     customer setting may rewrite who made the product.
 *
 *   SALON-CONFIGURED (center_settings, via BrandingSettingsPage)
 *     The salon's own name and logo. Once configured, they replace every
 *     salon-facing surface — sidebar, mobile header, document title, receipts,
 *     printed documents. Values here are only the FALLBACK used before an
 *     operator configures the salon.
 *
 * The fallbacks deliberately carry the product name rather than a hard-coded
 * salon name, so an unconfigured deployment never claims to be a specific
 * business.
 */

export const PRODUCT_NAME = "Lara Beauty";
export const PRODUCT_NAME_AR = "لارا بيوتي";
export const PRODUCT_DESCRIPTION_AR = "نظام إدارة مركز التجميل";

/** The developer. Fixed by contract — never derived from a customer setting. */
export const PARENT_HOUSE_NAME = "LENA Digital House";
export const PARENT_HOUSE_URL = "https://lenadigital.vercel.app";

/**
 * Fixed developer credit used in document footers (receipts, printed
 * invoices). Like the developer identity itself, it is fixed by contract:
 * no customer setting, stored value, or imported branding snapshot may
 * rewrite who made the product. The Branding page therefore has no editable
 * footer field, and every boundary (save, import, cache, print) applies these
 * constants instead of any salon-provided text.
 */
export const DEVELOPER_FOOTER_TEXT = `Powered by ${PARENT_HOUSE_NAME}`;
export const DEVELOPER_FOOTER_TEXT_AR = `بتقنية ${PARENT_HOUSE_NAME}`;

/**
 * Name of the INSTALLED app (PWA manifest, OS share sheets).
 *
 * A manifest is static build output, so it cannot follow a runtime setting.
 * Delivery is one build per salon, so an operator can brand the installed app
 * per client with VITE_APP_NAME; without it the product name is used.
 */
export function appName(): string {
  const configured = import.meta.env?.VITE_APP_NAME;
  return typeof configured === "string" && configured.trim() ? configured.trim() : PRODUCT_NAME;
}
