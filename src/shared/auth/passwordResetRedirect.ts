/**
 * Where Supabase should send the staff member after they tap the recovery email.
 *
 * HashRouter lives after `#`, so the redirect must be origin + pathname + `#/reset-password`.
 * A path-only URL such as `/reset-password` would miss the SPA and look like a broken site.
 */
export function passwordResetRedirectUrl(
  loc: Pick<Location, "origin" | "pathname"> = window.location,
): string {
  const pathname = loc.pathname && loc.pathname.length > 0 ? loc.pathname : "/";
  return `${loc.origin}${pathname}#/reset-password`;
}
