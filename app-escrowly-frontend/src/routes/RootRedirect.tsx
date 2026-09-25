import { Navigate } from "react-router";
import { useAuth } from "../features/auth/useAuth";
import FullPageLoader from "../components/organisms/FullPageLoader";

export default function RootRedirect() {
  const { status } = useAuth();

  if (status === "loading") {
    return <FullPageLoader />;
  }

  if (status === "authed") {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/login" replace />;
}
