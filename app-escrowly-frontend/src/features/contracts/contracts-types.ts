/**
 * Local types for the contracts feature.
 *
 * The OpenAPI spec at `app-escrowly-backend/openapi.yaml` declares request
 * bodies for `/contracts` and `/contracts/{id}` but does NOT declare response
 * schemas. As a result, `paths["/contracts/{id}"]["get"]["responses"][200]
 * ["content"]` is `never` in the generated `types.generated.ts`.
 *
 * These local types are the frontend's source of truth for the response
 * shape, mirroring `openspec/specs/contracts/spec.md` and
 * `openspec/specs/milestones/spec.md`. They will be replaced by generated
 * types once the backend adds response schemas.
 */

export type MilestoneStatus = "pending" | "funded" | "in_review" | "disputed" | "approved" | "paid";

export type ContractStatus = "draft" | "active" | "completed" | "cancelled";

export interface Participant {
  id: string;
  email: string;
  name: string;
}

export interface Milestone {
  id: string;
  title: string;
  /** Integer cents — never floats. */
  amount: number;
  status: MilestoneStatus;
}

export interface Contract {
  id: string;
  status: ContractStatus;
  client: Participant;
  seller: Participant;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export type ViewerRole = "client" | "seller" | "none";

export function deriveViewerRole(
  viewerId: string | undefined,
  contract: Pick<Contract, "client" | "seller">,
): ViewerRole {
  if (!viewerId) return "none";
  if (contract.client.id === viewerId) return "client";
  if (contract.seller.id === viewerId) return "seller";
  return "none";
}
