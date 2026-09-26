import { useNavigate } from "react-router";
import { useAuth } from "../../features/auth/useAuth";
import Button from "../../components/atoms/Button";

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.name?.split(" ")[0] ?? "User";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Welcome, {firstName}.</h1>
        <p className="mt-1 text-neutral-600">Your contracts and milestones will appear here.</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-surface p-8 text-center">
        <p className="text-lg font-medium text-foreground">No contracts yet</p>
        <p className="mt-2 text-sm text-neutral-500">Create your first contract to get started.</p>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => navigate("/app/contracts/new")}
          data-testid="home-new-contract"
        >
          New contract
        </Button>
      </div>
    </div>
  );
}
