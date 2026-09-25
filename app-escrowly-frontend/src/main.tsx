import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import App from "./App";
import { AuthProvider, useAuth } from "./features/auth/auth-context";
import FullPageLoader from "./components/organisms/FullPageLoader";
import "./styles/index.css";

function BootRestore({ children }: { children: React.ReactNode }) {
  const { status, restore } = useAuth();

  useEffect(() => {
    restore();
  }, [restore]);

  if (status === "loading") {
    return <FullPageLoader message="Loading..." />;
  }

  return children;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BootRestore>
          <App />
        </BootRestore>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
