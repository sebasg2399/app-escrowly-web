import { useEffect, useRef } from "react";
import { Outlet } from "react-router";
import { AuthProvider } from "../features/auth/auth-context";
import { useAuth } from "../features/auth/useAuth";

function BootRestore() {
  const { status, restore } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoking effects in dev, which
    // would fire two /auth/refresh requests on boot.
    if (status === "loading" && !calledRef.current) {
      calledRef.current = true;
      restore();
    }
  }, [status, restore]);

  return null;
}

export default function RootProviders() {
  return (
    <AuthProvider>
      <BootRestore />
      <Outlet />
    </AuthProvider>
  );
}
