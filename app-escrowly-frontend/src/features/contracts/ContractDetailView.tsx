import { useState } from "react";
import Badge from "../../components/atoms/Badge";
import Button from "../../components/atoms/Button";
import Banner from "../../components/molecules/Banner";
import MilestoneRow from "../milestones/MilestoneRow";
import {
  bannerMessageFor,
  useApproveMilestone,
  useSubmitMilestone,
  type MilestoneAction,
  MilestoneMutationError,
} from "../milestones";
import { formatCents, sumCents } from "../../lib/money";
import type { Contract, ViewerRole } from "./contracts-types";

interface ContractDetailViewProps {
  contract: Contract;
  viewerRole: ViewerRole;
  onBack: () => void;
}

function formatCreatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function viewerRoleLabel(role: ViewerRole, contract: Contract): string {
  if (role === "client") return `You are the client (with ${contract.seller.name})`;
  if (role === "seller") return `You are the seller (with ${contract.client.name})`;
  return "You are viewing this contract as a non-participant.";
}

export default function ContractDetailView({
  contract,
  viewerRole,
  onBack,
}: ContractDetailViewProps) {
  const totalCents = sumCents(contract.milestones.map((m) => m.amount));
  const paidCount = contract.milestones.filter((m) => m.status === "paid").length;
  const counterparty =
    viewerRole === "client" ? contract.seller : viewerRole === "seller" ? contract.client : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm font-medium text-neutral-500 hover:text-foreground transition-colors"
          data-testid="back-to-list"
        >
          &larr; Back to contracts
        </button>
      </div>

      <header className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p
              className="text-lg font-semibold text-foreground"
              data-testid="contract-counterparty"
            >
              {counterparty ? counterparty.name : "Contract"}
            </p>
            <p className="text-xs text-neutral-500">
              Created {formatCreatedDate(contract.createdAt)}
            </p>
          </div>
          <Badge variant={contract.status} className="capitalize" data-testid="contract-status">
            {contract.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total</p>
            <p className="mt-1 text-xl font-semibold text-foreground" data-testid="contract-total">
              {formatCents(totalCents)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Milestones paid
            </p>
            <p
              className="mt-1 text-xl font-semibold text-foreground"
              data-testid="contract-progress"
            >
              {paidCount} of {contract.milestones.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Your role
            </p>
            <p className="mt-1 text-sm font-medium text-foreground" data-testid="viewer-role">
              {viewerRoleLabel(viewerRole, contract)}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Milestones</h2>
        <MilestonesList contract={contract} viewerRole={viewerRole} />
      </section>
    </div>
  );
}

interface MilestonesListProps {
  contract: Contract;
  viewerRole: ViewerRole;
}

/**
 * Renders the milestone rows with role/status-gated action buttons, plus a
 * non-blocking error banner that surfaces 409/403 transitions without changing
 * the milestone's status. Rows are unchanged after a failed mutation.
 */
function MilestonesList({ contract, viewerRole }: MilestonesListProps) {
  const [banner, setBanner] = useState<string | null>(null);

  return (
    <>
      {banner && (
        <Banner
          variant="error"
          data-testid="milestone-action-banner"
          onClick={() => setBanner(null)}
        >
          {banner}
        </Banner>
      )}
      <ul className="divide-y divide-neutral-100">
        {contract.milestones.map((milestone, index) => (
          <MilestoneRowWithMutation
            key={milestone.id}
            contractId={contract.id}
            index={index}
            milestone={milestone}
            viewerRole={viewerRole}
            onBanner={setBanner}
          />
        ))}
      </ul>
    </>
  );
}

interface MilestoneRowWithMutationProps {
  contractId: string;
  index: number;
  milestone: Contract["milestones"][number];
  viewerRole: ViewerRole;
  onBanner: (message: string) => void;
}

/**
 * Wires a single MilestoneRow to the submit/approve mutations. Each row tracks
 * its own pending state via the mutation's `isPending`. Errors are mapped to
 * non-blocking banner copy; the row's status does not change.
 */
function MilestoneRowWithMutation({
  contractId,
  index,
  milestone,
  viewerRole,
  onBanner,
}: MilestoneRowWithMutationProps) {
  const submit = useSubmitMilestone(contractId, milestone.id);
  const approve = useApproveMilestone(contractId, milestone.id);

  const handleAction = (action: MilestoneAction) => {
    if (action.kind === "none" || action.kind === "paid" || action.kind === "fund") return;

    const verb = action.kind === "submit" ? "submit" : "approve";
    const mutation = action.kind === "submit" ? submit : approve;

    mutation.mutate(undefined, {
      onError: (err) => {
        const code = err instanceof MilestoneMutationError ? err.code : ("UNKNOWN" as const);
        onBanner(bannerMessageFor(code, verb));
      },
    });
  };

  const actionPending = submit.isPending || approve.isPending;

  return (
    <MilestoneRow
      index={index}
      milestone={milestone}
      viewerRole={viewerRole}
      onAction={handleAction}
      actionPending={actionPending}
    />
  );
}

interface ContractDetailErrorProps {
  message: string;
  onBack: () => void;
}

export function ContractDetailError({ message, onBack }: ContractDetailErrorProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="contract-detail-error">
      <button
        onClick={onBack}
        className="text-sm font-medium text-neutral-500 hover:text-foreground transition-colors"
      >
        &larr; Back to contracts
      </button>
      <Banner variant="error" title="Cannot view this contract">
        {message}
      </Banner>
      <Button variant="secondary" onClick={onBack}>
        Back to contracts
      </Button>
    </div>
  );
}
