import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileNameSchema, type ProfileNameInput } from "./profile-schemas";
import { useUpdateProfileName } from "./useProfile";
import TextField from "../../components/molecules/TextField";
import Button from "../../components/atoms/Button";
import Banner from "../../components/molecules/Banner";
import Toast from "../../components/molecules/Toast";
import { isApiError } from "../../lib/api/errors";
import type { paths } from "../../lib/api/types.generated";

type Profile = paths["/users/me"]["get"]["responses"][200]["content"]["application/json"];

interface ProfileEditFormProps {
  profile: Profile;
  onCancel: () => void;
}

export default function ProfileEditForm({ profile, onCancel }: ProfileEditFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileNameInput>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { name: profile.name },
  });

  const updateName = useUpdateProfileName();
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: ProfileNameInput) => {
    setApiError(null);
    setSuccess(false);
    try {
      await updateName.mutateAsync(data);
      setSuccess(true);
    } catch (err) {
      if (isApiError(err) && err.details) {
        for (const [field, messages] of Object.entries(err.details)) {
          setError(field as keyof ProfileNameInput, {
            type: "server",
            message: messages[0],
          });
        }
      } else if (isApiError(err)) {
        setApiError(err.message);
      }
    }
  };

  if (success) {
    return <Toast variant="success" message="Profile updated successfully." onClose={onCancel} />;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-6"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Edit Profile</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-neutral-500 hover:text-foreground transition-colors"
          data-testid="cancel-edit-button"
        >
          Cancel
        </button>
      </div>

      {apiError && (
        <Banner variant="error" data-testid="profile-api-error">
          {apiError}
        </Banner>
      )}

      <TextField
        label="Name"
        type="text"
        placeholder="Your name"
        error={errors.name?.message}
        disabled={isSubmitting}
        required
        data-testid="profile-name-input"
        {...register("name")}
      />

      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Email
        </label>
        <input
          type="text"
          value={profile.email}
          disabled
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-neutral-500 cursor-not-allowed"
          data-testid="profile-email-disabled"
          aria-label="Email (read-only)"
        />
        <p className="mt-1 text-xs text-neutral-400">Email cannot be changed here.</p>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Role</label>
        <div className="mt-1">
          <span className="inline-block rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-neutral-500 cursor-not-allowed">
            {profile.role}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-400">Role cannot be changed here.</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
