import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useAuth } from "./useAuth";
import { registerSchema, type RegisterInput } from "./auth-schemas";
import TextField from "../../components/molecules/TextField";
import Button from "../../components/atoms/Button";
import Banner from "../../components/molecules/Banner";
import { isApiError } from "../../lib/api/errors";

export default function RegisterForm() {
  const { register: registerAuth } = useAuth();
  const [nonFieldError, setNonFieldError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (data: RegisterInput) => {
    setNonFieldError(null);
    setRateLimited(false);
    try {
      await registerAuth(data);
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 429) {
          setRateLimited(true);
          return;
        }
        if (err.status === 409) {
          setError("email", { type: "server", message: "An account with this email already exists" });
          return;
        }
        if (err.details) {
          for (const [field, messages] of Object.entries(err.details)) {
            setError(field as keyof RegisterInput, {
              type: "server",
              message: messages[0],
            });
          }
        }
        if (!err.details && err.message) {
          setNonFieldError(err.message);
        }
      }
    }
  };

  if (rateLimited) {
    return (
      <Banner variant="warning">
        Too many attempts. Please wait a moment and try again.
      </Banner>
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
        label="Name"
        type="text"
        placeholder="Your name"
        error={errors.name?.message}
        disabled={isSubmitting || rateLimited}
        required
        {...register("name")}
      />
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
        placeholder="At least 8 characters"
        error={errors.password?.message}
        helper="Min 8 chars, uppercase, lowercase, and a number"
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
        Create account
      </Button>
    </form>
  );
}
