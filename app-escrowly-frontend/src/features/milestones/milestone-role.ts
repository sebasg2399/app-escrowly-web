/**
 * Milestone role + action matrix.
 *
 * `deriveViewerRole` (moved here from contracts-types) decides who the viewer is
 * for a specific contract: `client`, `seller`, or `none`.
 *
 * `actionsFor(milestone, viewerRole)` returns the action to render on a single
 * milestone row based on the (status × role) matrix below:
 *
 *   status      × client          × seller           × none
 *   pending       Fund*            (none)             (none)
 *   funded        (none)           Submit work        (none)
 *   in_review     Approve & pay    (none)             (none)
 *   approved      Payout failed    (none)             (none)
 *                     — retry
 *   paid          Paid (badge)     Paid (badge)       Paid (badge)
 *   disputed      (none)           (none)             (none)
 *
 * * "Fund" is wired in the FUNDING slice (slice #3 of the stacked PR plan). In
 *   this slice we render a disabled placeholder so the matrix stays complete.
 */

import type { Contract, Milestone, ViewerRole } from "../contracts/contracts-types";

export { deriveViewerRole } from "../contracts/contracts-types";
export type { ViewerRole } from "../contracts/contracts-types";

/** A single rendered action on a milestone row. */
export type MilestoneAction =
  | { kind: "fund"; label: string; disabled: true; reason: string }
  | { kind: "submit"; label: string; disabled: false }
  | { kind: "approve"; label: string; disabled: false }
  | {
      kind: "paid";
      label: string;
      disabled: true;
      stripeTransferId: string | null | undefined;
    }
  | { kind: "retry-payout"; label: string; disabled: false }
  | { kind: "none" };

/**
 * Selects the visible action for a milestone row based on the viewer's role
 * and the milestone's current status.
 */
export function actionsFor(
  milestone: Pick<Milestone, "status" | "stripeTransferId">,
  viewerRole: ViewerRole,
): MilestoneAction {
  switch (milestone.status) {
    case "pending":
      if (viewerRole === "client") {
        return {
          kind: "fund",
          label: "Fund",
          disabled: true,
          reason: "Funding coming soon",
        };
      }
      return { kind: "none" };

    case "funded":
      if (viewerRole === "seller") {
        return { kind: "submit", label: "Submit work", disabled: false };
      }
      return { kind: "none" };

    case "in_review":
      if (viewerRole === "client") {
        return { kind: "approve", label: "Approve & pay", disabled: false };
      }
      return { kind: "none" };

    case "approved":
      // `approved` is reached only when the payout attempt after approve failed.
      // The client retries the payout by hitting the same approve endpoint.
      if (viewerRole === "client") {
        return { kind: "retry-payout", label: "Payout failed — retry", disabled: false };
      }
      return { kind: "none" };

    case "paid":
      return {
        kind: "paid",
        label: "Paid",
        disabled: true,
        stripeTransferId: milestone.stripeTransferId ?? null,
      };

    case "disputed":
      // Reserved state — no public transition reaches it in this slice.
      return { kind: "none" };

    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = milestone.status;
      return _exhaustive;
    }
  }
}

/**
 * Returns true while ANY milestone in the contract is `pending`. The detail
 * page refetches on an interval while this is true and stops once it flips
 * false (i.e. all milestones have moved past `pending`).
 */
export function hasPendingMilestones(contract: Pick<Contract, "milestones">): boolean {
  return contract.milestones.some((m) => m.status === "pending");
}
