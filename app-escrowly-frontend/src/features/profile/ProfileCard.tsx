import Badge from "../../components/atoms/Badge";
import type { paths } from "../../lib/api/types.generated";

type Profile = paths["/users/me"]["get"]["responses"][200]["content"]["application/json"];

interface ProfileCardProps {
  profile: Profile;
  onEdit: () => void;
}

export default function ProfileCard({ profile, onEdit }: ProfileCardProps) {
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <button
          onClick={onEdit}
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          data-testid="edit-profile-button"
        >
          Edit
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Name
          </label>
          <p className="mt-1 text-base text-foreground" data-testid="profile-name">
            {profile.name}
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Email
          </label>
          <p
            className="mt-1 text-base text-neutral-500"
            data-testid="profile-email"
          >
            {profile.email}
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Role
          </label>
          <div className="mt-1" data-testid="profile-role">
            <Badge variant={profile.role} className="capitalize">
              {profile.role}
            </Badge>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Member since
          </label>
          <p className="mt-1 text-base text-neutral-500" data-testid="profile-member-since">
            {memberSince}
          </p>
        </div>
      </div>
    </div>
  );
}
