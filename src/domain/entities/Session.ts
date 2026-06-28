export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF",
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name?: string;
}

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; session: AuthenticatedSession }
  | { status: "error"; error: Error };

export interface AuthenticatedSession {
  user: User;
}

// Permission model — single source of truth for role capabilities.
//
// IMPORTANT: This must stay consistent with the route-level enforcement in
// `src/route-guards.tsx`. In v1.0, admin-only sections (reports, settings,
// branding, notifications) are guarded by `RequireAdmin` (ADMIN role only),
// and the sidebar hides `adminOnly` items for non-ADMIN users. Therefore the
// permission sets below grant reports/settings to ADMIN only — MANAGER and
// STAFF share operational (day-to-day) permissions and do NOT include the
// admin-only sections. Do not re-add reports/settings to MANAGER without also
// loosening `RequireAdmin`, or the two layers will drift apart.

// Operational permissions shared by STAFF and MANAGER (additive).
const STAFF_PERMISSIONS = new Set([
  "appointments.view",
  "appointments.create",
  "appointments.update",
  "appointments.delete",
  "customers.view",
  "customers.create",
  "customers.update",
  "services.view",
  "products.view",
  "pos.checkout",
]);

// MANAGER currently has the same operational scope as STAFF. Admin-only
// sections remain ADMIN-exclusive to match `RequireAdmin`.
const MANAGER_PERMISSIONS = new Set<string>([]);

export function can(sessionState: SessionState, permission: string): boolean {
  if (sessionState.status !== "authenticated") return false;

  const role = sessionState.session.user.role;

  if (role === UserRole.ADMIN) return true;

  if (role === UserRole.MANAGER) {
    return MANAGER_PERMISSIONS.has(permission) || STAFF_PERMISSIONS.has(permission);
  }

  if (role === UserRole.STAFF) {
    return STAFF_PERMISSIONS.has(permission);
  }

  return false;
}
