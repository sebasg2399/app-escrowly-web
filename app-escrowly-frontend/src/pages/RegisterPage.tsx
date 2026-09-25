import { useEffect } from "react";
import { useNavigate } from "react-router";
import RegisterForm from "../features/auth/RegisterForm";
import { useAuth } from "../features/auth/useAuth";

function PostRegisterRedirect() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authed") {
      navigate("/app", { replace: true });
    }
  }, [status, navigate]);

  return null;
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </div>

        <RegisterForm />
        <PostRegisterRedirect />
      </div>
    </div>
  );
}
