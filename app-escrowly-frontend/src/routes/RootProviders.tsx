import { useEffect } from "react";
import { Outlet } from "react-router";
import { AuthProvider, useAuth } from "../features/auth/auth-context";

function BootRestore() {
  const { status, restore } = useAuth();

  useEffect(() => {
    if (status === "loading") {
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
