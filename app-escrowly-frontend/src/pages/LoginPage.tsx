import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import LoginForm from "../features/auth/LoginForm";
import { useAuth } from "../features/auth/useAuth";

function PostLoginRedirect() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (status === "authed") {
      const from = (location.state as Record<string, unknown> | null)?.from as
        | { pathname: string }
        | undefined;
      navigate(from?.pathname ?? "/app", { replace: true });
    }
  }, [status, navigate, location]);

  return null;
}

export default function LoginPage() {
  const [sessionExpiredMessage] = useState<string | null>(() => {
    const state = window.history.state?.usr as Record<string, unknown> | null;
    return typeof state?.sessionExpiredMessage === "string"
      ? state.sessionExpiredMessage
      : null;
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Sign in to Escrowly</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Don't have an account?{" "}
            <a href="/register" className="text-primary hover:underline">
              Create one
            </a>
          </p>
        </div>

        {sessionExpiredMessage && (
          <div
            className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-fg"
            data-testid="session-expired-message"
          >
            {sessionExpiredMessage}
          </div>
        )}

        <LoginForm />
        <PostLoginRedirect />
      </div>
    </div>
  );
}
