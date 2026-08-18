import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "./context/AppContext";
import { UserRole } from "./domain/entities/Session";
import { PageLoader } from "./shared/components/PageLoader";

/**
 * Route guards.
 *
 * Fail-safe behavior: ANY session problem (loading, stale/invalid role,
 * failed center-membership verification, environment misconfiguration)
 * resolves to the Login screen — never to a broken half-initialized app.
 * Unauthenticated / error states carry the attempted location so the user
 * can be returned there after a successful login.
 */
export function RequireAuth() {
  const { isInitialized, sessionState, user } = useAppContext();
  const location = useLocation();

  if (!isInitialized || sessionState.status === "loading") {
    return <PageLoader />;
  }

  if (sessionState.status !== "authenticated" || !user) {
    // Covers: anonymous, stale sessions, invalid roles, membership failures,
    // and any other bootstrap error — all exit safely to Login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { isInitialized, sessionState, user } = useAppContext();
  const location = useLocation();

  if (!isInitialized || sessionState.status === "loading") {
    return <PageLoader />;
  }

  if (sessionState.status !== "authenticated" || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Only ADMIN role can access admin-guarded routes.
  //
  // This is the authorization boundary. Navigation hides admin destinations
  // from non-admins as a courtesy, but this guard is what actually blocks
  // direct URL entry, deep links and browser history.
  //
  // The refusal carries a reason so the destination screen can explain what
  // happened; a bare redirect is indistinguishable from a broken link.
  if (user.role !== UserRole.ADMIN) {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ navigationNotice: "admin-only", attemptedPath: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
