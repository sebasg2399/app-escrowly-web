import Badge from "../../components/atoms/Badge";
import { formatCents } from "../../lib/money";
import type { Milestone } from "../contracts/contracts-types";
import { actionsFor, type MilestoneAction, type ViewerRole } from "./milestone-role";

interface MilestoneRowProps {
  index: number;
  milestone: Pick<Milestone, "id" | "title" | "amount" | "status" | "stripeTransferId">;
  viewerRole: ViewerRole;
  /** Called when the user activates the row's primary action. */
  onAction: (action: MilestoneAction, milestoneId: string) => void;
  /** Disable the action button while a mutation is in flight for this row. */
  actionPending?: boolean;
  /**
   * When true, the Fund action is rendered enabled and `onAction` is called
   * when the user clicks it. Set by the detail page once the funding flow is
   * available. Defaults to false so the placeholder remains a placeholder.
   */
  enableFunding?: boolean;
}

function statusLabel(status: Milestone["status"]): string {
  return status.replace("_", " ");
}

export default function MilestoneRow({
  index,
  milestone,
  viewerRole,
  onAction,
  actionPending = false,
  enableFunding = false,
}: MilestoneRowProps) {
  const action = actionsFor(milestone, viewerRole);

  return (
    <li
      className="flex items-center justify-between gap-4 py-3"
      data-testid={`detail-milestone-row-${index}`}
      data-milestone-id={milestone.id}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
          {index + 1}
        </span>
        <p
          className="text-sm font-medium text-foreground truncate"
          data-testid={`detail-milestone-title-${index}`}
        >
          {milestone.title}
        </p>
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
          {statusLabel(milestone.status)}
        </Badge>
        <MilestoneActionButton
          action={action}
          index={index}
          pending={actionPending}
          enableFunding={enableFunding}
          onActivate={() => onAction(action, milestone.id)}
        />
      </div>
    </li>
  );
}

interface MilestoneActionButtonProps {
  action: MilestoneAction;
  index: number;
  pending: boolean;
  enableFunding: boolean;
  onActivate: () => void;
}

/**
 * Renders the action button for a row. The shape of the rendered element is
 * driven by `action.kind`:
 *
 * - `submit` / `approve` / `retry-payout`: primary button, fires the mutation.
 * - `fund`: disabled button with a tooltip (placeholder for the FUNDING slice).
 * - `paid`: muted badge-style label with `stripeTransferId` reference.
 * - `none`: renders nothing.
 */
function MilestoneActionButton({
  action,
  index,
  pending,
  enableFunding,
  onActivate,
}: MilestoneActionButtonProps) {
  if (action.kind === "none") return null;

  if (action.kind === "fund") {
    if (!enableFunding) {
      return (
        <button
          type="button"
          disabled
          title={action.reason}
          aria-label={`${action.label} (${action.reason})`}
          data-testid={`milestone-action-fund-${index}`}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-400 cursor-not-allowed"
        >
          {action.label}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onActivate}
        disabled={pending}
        aria-label={action.label}
        data-testid={`milestone-action-fund-${index}`}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {action.label}
      </button>
    );
  }

  if (action.kind === "paid") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium text-success-fg"
        data-testid={`milestone-action-paid-${index}`}
        title={
          action.stripeTransferId ? `Paid · Stripe transfer ${action.stripeTransferId}` : "Paid"
        }
      >
        <Badge variant="paid" className="capitalize">
          {action.label}
        </Badge>
        {action.stripeTransferId ? (
          <span
            className="font-mono text-[10px] text-neutral-500"
            data-testid={`milestone-transfer-id-${index}`}
          >
            {action.stripeTransferId}
          </span>
        ) : null}
      </span>
    );
  }

  // submit, approve, retry-payout — all primary buttons
  const label = action.label;
  const testid = `milestone-action-${action.kind}-${index}`;

  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={pending}
      aria-label={label}
      data-testid={testid}
      className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
