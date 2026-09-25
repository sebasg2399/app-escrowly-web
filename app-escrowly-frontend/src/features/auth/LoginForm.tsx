import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useAuth } from "./useAuth";
import { loginSchema, type LoginInput } from "./auth-schemas";
import TextField from "../../components/molecules/TextField";
import Button from "../../components/atoms/Button";
import Banner from "../../components/molecules/Banner";
import { isApiError } from "../../lib/api/errors";

export default function LoginForm() {
  const { login } = useAuth();
  const [nonFieldError, setNonFieldError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setNonFieldError(null);
    setRateLimited(false);
    try {
      await login(data);
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 429) {
          setRateLimited(true);
          return;
        }
        // login errors → non-field only
        setNonFieldError(err.message);
      }
    }
  };

  if (rateLimited) {
    return (
      <Banner variant="warning">Too many attempts. Please wait a moment and try again.</Banner>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {nonFieldError && (
        <Banner variant="error" data-testid="non-field-error">
          {nonFieldError}
        </Banner>
      )}
      <TextField
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        disabled={isSubmitting || rateLimited}
        required
        {...register("email")}
      />
      <TextField
        label="Password"
        type="password"
        placeholder="Your password"
        error={errors.password?.message}
        disabled={isSubmitting || rateLimited}
        required
        {...register("password")}
      />
      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        disabled={rateLimited}
        className="w-full"
      >
        Sign in
      </Button>
    </form>
  );
}
