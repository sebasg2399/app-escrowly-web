import Button from "../../components/atoms/Button";
import Badge from "../../components/atoms/Badge";
import Banner from "../../components/molecules/Banner";
import FullPageLoader from "../../components/organisms/FullPageLoader";
import {
  useConnectStatus,
  useLaunchOnboarding,
  type ConnectStatus,
} from "../../features/connect/useConnectStatus";
import { useQueryClient } from "@tanstack/react-query";
import { connectStatusKey } from "../../features/connect/useConnectStatus";

/**
 * Onboarding page — mirrors the Stitch design. Two states:
 * - Not onboarded → CTA to launch Stripe-hosted onboarding.
 * - Onboarded → success card with read-only status + refresh action.
 */
export default function OnboardingPage() {
  const { data: status, isLoading, error } = useConnectStatus();
  const launch = useLaunchOnboarding();
  const qc = useQueryClient();

  if (isLoading) {
    return <FullPageLoader message="Loading onboarding status..." />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Banner variant="error" title="Could not load onboarding status">
          Please try again in a moment.
        </Banner>
        <Button onClick={() => qc.invalidateQueries({ queryKey: connectStatusKey })}>Retry</Button>
      </div>
    );
  }

  const s = (status ?? {
    hasAccount: false,
    detailsSubmitted: false,
    payoutsEnabled: false,
    onboardingComplete: false,
  }) as ConnectStatus;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Payouts</h1>
        <p className="text-sm text-neutral-500">
          Set up payouts to receive funds when your milestones are approved.
        </p>
      </header>

      {s.onboardingComplete ? (
        <OnboardedCard status={s} />
      ) : (
        <NotOnboardedCard status={s} launch={launch} />
      )}
    </div>
  );
}

function OnboardedCard({ status }: { status: ConnectStatus }) {
  const qc = useQueryClient();
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-4"
      data-testid="onboarding-onboarded"
    >
      <Badge variant="paid">Payouts enabled</Badge>
      <p className="text-sm text-foreground">You’re ready to receive funds.</p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DetailRow label="Account" value="Connected" />
        <DetailRow label="Details submitted" value={status.detailsSubmitted ? "Yes" : "No"} />
        <DetailRow label="Payouts" value={status.payoutsEnabled ? "Enabled" : "Disabled"} />
      </dl>
      <Button
        variant="ghost"
        onClick={() => qc.invalidateQueries({ queryKey: connectStatusKey })}
        data-testid="onboarding-refresh"
      >
        Refresh status
      </Button>
    </div>
  );
}

function NotOnboardedCard({
  status: _status,
  launch,
}: {
  status: ConnectStatus;
  launch: ReturnType<typeof useLaunchOnboarding>;
}) {
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-5"
      data-testid="onboarding-not-onboarded"
    >
      <p className="text-sm text-foreground">
        Escrowly uses Stripe to send your earnings directly to your bank account. This takes a few
        minutes.
      </p>
      <ul className="space-y-2 text-sm text-neutral-600">
        <li>1. Personal details</li>
        <li>2. Bank account</li>
        <li>3. Identity verification</li>
      </ul>
      <Button
        variant="primary"
        loading={launch.isPending}
        onClick={() => launch.mutate()}
        data-testid="onboarding-launch"
      >
        Continue on Stripe
      </Button>
      {launch.isError && (
        <Banner variant="error" data-testid="onboarding-launch-error">
          Could not start onboarding. Please try again.
        </Banner>
      )}
      <p className="text-xs text-neutral-500">
        You’ll be redirected to Stripe to complete onboarding, then returned to Escrowly.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
