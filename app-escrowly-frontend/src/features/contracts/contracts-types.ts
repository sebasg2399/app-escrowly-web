/**
 * Types for the contracts feature.
 *
 * The response shapes now come from the backend OpenAPI spec (declared as
 * `schema.response` so `pnpm gen:api` produces real types). We derive our
 * domain types from `paths` and keep only the `ViewerRole` helper here.
 */

import type { paths } from "../../lib/api/types.generated";

/** A single contract with its relations (participants + milestones). */
export type Contract = NonNullable<
  paths["/contracts/{id}"]["get"]["responses"][200]["content"]["application/json"]
>;

export type Milestone = Contract["milestones"][number];
export type ContractStatus = Contract["status"];
export type MilestoneStatus = Milestone["status"];

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
