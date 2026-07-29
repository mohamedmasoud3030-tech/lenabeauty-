import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "./context/AppContext";
import { UserRole } from "./domain/entities/Session";
import { PageLoader } from "./shared/components/PageLoader";

export function RequireAuth() {
  const { isInitialized, sessionState, user } = useAppContext();
  const location = useLocation();

  if (!isInitialized || sessionState.status === "loading") {
    return <PageLoader />;
  }

  if (sessionState.status === "error" && sessionState.error.message.includes("not configured")) {
    return <Navigate to="/login" replace />;
  }

  if (sessionState.status === "anonymous" || !user) {
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

  if (sessionState.status === "error" && sessionState.error.message.includes("not configured")) {
    return <Navigate to="/login" replace />;
  }

  if (sessionState.status === "anonymous" || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Only ADMIN role can access admin-guarded routes
  if (user.role !== UserRole.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
