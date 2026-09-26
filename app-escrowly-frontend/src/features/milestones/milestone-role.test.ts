import { describe, it, expect } from "vitest";
import { actionsFor, deriveViewerRole, hasPendingMilestones } from "./milestone-role";
import type { Contract, Milestone, ViewerRole } from "../contracts/contracts-types";

function ms(overrides: Partial<Milestone> = {}): Pick<Milestone, "status" | "stripeTransferId"> {
  return { status: "pending", stripeTransferId: null, ...overrides };
}

describe("deriveViewerRole", () => {
  const contract = {
    client: { id: "c1", email: "c@x.com", name: "Client" },
    seller: { id: "s1", email: "s@x.com", name: "Seller" },
  } as const;

  it("returns 'client' when the viewer id matches the contract client", () => {
    expect(deriveViewerRole("c1", contract)).toBe("client");
  });

  it("returns 'seller' when the viewer id matches the contract seller", () => {
    expect(deriveViewerRole("s1", contract)).toBe("seller");
  });

  it("returns 'none' when the viewer is not a participant", () => {
    expect(deriveViewerRole("z9", contract)).toBe("none");
  });

  it("returns 'none' when the viewer id is undefined", () => {
    expect(deriveViewerRole(undefined, contract)).toBe("none");
  });
});

describe("actionsFor — client", () => {
  const role: ViewerRole = "client";

  it("pending → disabled Fund placeholder with reason", () => {
    const action = actionsFor(ms({ status: "pending" }), role);
    expect(action.kind).toBe("fund");
    if (action.kind !== "fund") return;
    expect(action.label).toBe("Fund");
    expect(action.disabled).toBe(true);
    expect(action.reason).toMatch(/coming soon/i);
  });

  it("funded → no action (the seller submits)", () => {
    expect(actionsFor(ms({ status: "funded" }), role).kind).toBe("none");
  });

  it("in_review → primary 'Approve & pay'", () => {
    const action = actionsFor(ms({ status: "in_review" }), role);
    expect(action.kind).toBe("approve");
    if (action.kind !== "approve") return;
    expect(action.label).toBe("Approve & pay");
    expect(action.disabled).toBe(false);
  });

  it("approved → 'Payout failed — retry' (client retries payout)", () => {
    const action = actionsFor(ms({ status: "approved" }), role);
    expect(action.kind).toBe("retry-payout");
    if (action.kind !== "retry-payout") return;
    expect(action.label).toBe("Payout failed — retry");
    expect(action.disabled).toBe(false);
  });

  it("paid → muted 'Paid' label", () => {
    const action = actionsFor(ms({ status: "paid" }), role);
    expect(action.kind).toBe("paid");
    if (action.kind !== "paid") return;
    expect(action.label).toBe("Paid");
    expect(action.disabled).toBe(true);
  });

  it("paid → exposes stripeTransferId when present", () => {
    const action = actionsFor(ms({ status: "paid", stripeTransferId: "tr_abc123" }), role);
    if (action.kind !== "paid") throw new Error("expected paid action");
    expect(action.stripeTransferId).toBe("tr_abc123");
  });

  it("disputed → no action", () => {
    expect(actionsFor(ms({ status: "disputed" }), role).kind).toBe("none");
  });
});

describe("actionsFor — seller", () => {
  const role: ViewerRole = "seller";

  it("pending → no action (the client funds)", () => {
    expect(actionsFor(ms({ status: "pending" }), role).kind).toBe("none");
  });

  it("funded → primary 'Submit work'", () => {
    const action = actionsFor(ms({ status: "funded" }), role);
    expect(action.kind).toBe("submit");
    if (action.kind !== "submit") return;
    expect(action.label).toBe("Submit work");
    expect(action.disabled).toBe(false);
  });

  it("in_review → no action (the client approves)", () => {
    expect(actionsFor(ms({ status: "in_review" }), role).kind).toBe("none");
  });

  it("approved → no action (only the client retries the payout)", () => {
    expect(actionsFor(ms({ status: "approved" }), role).kind).toBe("none");
  });

  it("paid → muted 'Paid' label (still visible to both participants)", () => {
    expect(actionsFor(ms({ status: "paid" }), role).kind).toBe("paid");
  });

  it("disputed → no action", () => {
    expect(actionsFor(ms({ status: "disputed" }), role).kind).toBe("none");
  });
});

describe("actionsFor — viewer is not a participant", () => {
  const role: ViewerRole = "none";

  it.each(["pending", "funded", "in_review", "approved", "disputed"] as const)(
    "status '%s' → no action for non-participant",
    (status) => {
      expect(actionsFor(ms({ status }), role).kind).toBe("none");
    },
  );

  it("status 'paid' → muted 'Paid' label (terminal state is visible to anyone who can see the contract)", () => {
    const action = actionsFor(ms({ status: "paid" }), role);
    expect(action.kind).toBe("paid");
  });
});

describe("hasPendingMilestones", () => {
  it("returns true when at least one milestone is pending", () => {
    const c: Pick<Contract, "milestones"> = {
      milestones: [
        { status: "funded" },
        { status: "pending" },
        { status: "paid" },
      ] as Contract["milestones"],
    };
    expect(hasPendingMilestones(c)).toBe(true);
  });

  it("returns false when no milestones are pending", () => {
    const c: Pick<Contract, "milestones"> = {
      milestones: [
        { status: "funded" },
        { status: "in_review" },
        { status: "paid" },
        { status: "approved" },
        { status: "disputed" },
      ] as Contract["milestones"],
    };
    expect(hasPendingMilestones(c)).toBe(false);
  });

  it("returns false for an empty milestones list", () => {
    const c: Pick<Contract, "milestones"> = { milestones: [] };
    expect(hasPendingMilestones(c)).toBe(false);
  });
});
