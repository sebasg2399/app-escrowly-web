import { useState } from "react";
import { useProfile } from "../../features/profile/useProfile";
import ProfileCard from "../../features/profile/ProfileCard";
import ProfileEditForm from "../../features/profile/ProfileEditForm";
import FullPageLoader from "../../components/organisms/FullPageLoader";

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return <FullPageLoader message="Loading profile..." />;
  }

  if (!profile) {
    return null;
  }

  if (editing) {
    return <ProfileEditForm profile={profile} onCancel={() => setEditing(false)} />;
  }

  return <ProfileCard profile={profile} onEdit={() => setEditing(true)} />;
}
