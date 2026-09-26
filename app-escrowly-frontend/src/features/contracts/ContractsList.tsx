import Badge from "../../components/atoms/Badge";
import Skeleton from "../../components/atoms/Skeleton";
import { formatCents, sumCents } from "../../lib/money";
import type { Contract, ViewerRole } from "./contracts-types";

interface ContractsListProps {
  contracts: Contract[];
  viewerId: string | undefined;
  onSelect: (id: string) => void;
}

function counterpartyLabel(contract: Contract, viewerRole: ViewerRole): string {
  if (viewerRole === "client") return contract.seller.name || contract.seller.email;
  if (viewerRole === "seller") return contract.client.name || contract.client.email;
  return "";
}

function formatCreatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ContractsListSkeleton() {
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-surface divide-y divide-neutral-100"
      data-testid="contracts-list-skeleton"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between p-4">
          <div className="space-y-2">
            <Skeleton width="w-40" height="h-4" />
            <Skeleton width="w-24" height="h-3" />
          </div>
          <div className="space-y-2">
            <Skeleton width="w-16" height="h-4" />
            <Skeleton width="w-20" height="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ContractsEmptyStateProps {
  onCreate: () => void;
}

export function ContractsEmptyState({ onCreate }: ContractsEmptyStateProps) {
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-surface p-8 text-center"
      data-testid="contracts-empty-state"
    >
      <p className="text-lg font-medium text-foreground">No contracts yet.</p>
      <p className="mt-2 text-sm text-neutral-500">
        Create your first contract to start an escrow with a seller.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover transition-colors"
        data-testid="empty-state-new-contract"
      >
        New contract
      </button>
    </div>
  );
}

export default function ContractsList({ contracts, viewerId, onSelect }: ContractsListProps) {
  return (
    <ul className="rounded-xl border border-neutral-200 bg-surface divide-y divide-neutral-100">
      {contracts.map((contract) => {
        const totalCents = sumCents(contract.milestones.map((m) => m.amount));
        const paidCount = contract.milestones.filter((m) => m.status === "paid").length;
        const viewerRole: ViewerRole =
          viewerId === contract.client.id
            ? "client"
            : viewerId === contract.seller.id
              ? "seller"
              : "none";
        const counterparty = counterpartyLabel(contract, viewerRole);

        return (
          <li key={contract.id}>
            <button
              type="button"
              onClick={() => onSelect(contract.id)}
              className="w-full text-left flex items-center justify-between gap-4 p-4 hover:bg-neutral-50 transition-colors"
              data-testid={`contract-row-${contract.id}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className="text-sm font-medium text-foreground truncate"
                  data-testid={`contract-counterparty-${contract.id}`}
                >
                  {counterparty}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={contract.status} className="capitalize">
                    {contract.status}
                  </Badge>
                  <span className="text-xs text-neutral-500">
                    {paidCount} of {contract.milestones.length} milestones paid
                  </span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p
                  className="text-base font-semibold text-foreground"
                  data-testid={`contract-total-${contract.id}`}
                >
                  {formatCents(totalCents)}
                </p>
                <p className="text-xs text-neutral-500">
                  Created {formatCreatedDate(contract.createdAt)}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
