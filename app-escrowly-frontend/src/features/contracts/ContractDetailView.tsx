import Badge from "../../components/atoms/Badge";
import Button from "../../components/atoms/Button";
import Banner from "../../components/molecules/Banner";
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
        <ul className="divide-y divide-neutral-100">
          {contract.milestones.map((milestone, index) => (
            <li
              key={milestone.id}
              className="flex items-center justify-between gap-4 py-3"
              data-testid={`detail-milestone-row-${index}`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-foreground truncate">{milestone.title}</p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="text-sm font-semibold text-foreground tabular-nums"
                  data-testid={`detail-milestone-amount-${index}`}
                >
                  {formatCents(milestone.amount)}
                </span>
                <Badge
                  variant={milestone.status}
                  className="capitalize"
                  data-testid={`detail-milestone-status-${index}`}
                >
                  {milestone.status.replace("_", " ")}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
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
