import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../features/auth/useAuth";
import FullPageLoader from "../components/organisms/FullPageLoader";

export default function AuthGuard() {
  const { status, sessionExpiredMessage } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageLoader />;
  }

  if (status === "guest") {
    const state: Record<string, unknown> = { from: location };
    if (sessionExpiredMessage) {
      state.sessionExpiredMessage = sessionExpiredMessage;
    }
    return <Navigate to="/login" state={state} replace />;
  }

  return <Outlet />;
}
