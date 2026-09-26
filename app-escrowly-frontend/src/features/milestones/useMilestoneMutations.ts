/**
 * TanStack Query mutations for milestone transitions:
 *
 * - `useSubmitMilestone(contractId, milestoneId)` → POST `.../submit`
 *   (seller transitions a `funded` milestone to `in_review`).
 *
 * - `useApproveMilestone(contractId, milestoneId)` → POST `.../approve`
 *   (client transitions an `in_review` milestone to `approved → paid`;
 *   on payout failure the milestone stays `approved` and a subsequent
 *   approve retries the transfer — see `actionsFor`).
 *
 * Both:
 *  - Invalidate the contract query on success so the row re-renders with the
 *    new status (and the poll stops once no milestones are pending).
 *  - Invalidate the contracts list query so list rows refresh.
 *  - Map 409 → `isInvalidTransition`, 403 → `isForbidden` via `error.code`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import { isApiError } from "../../lib/api/errors";
import type { paths } from "../../lib/api/types.generated";
import { contractQueryKey } from "../contracts/useContract";
import { contractsQueryKey } from "../contracts/useContracts";

type MilestoneDto =
  paths["/contracts/{id}/milestones/{mid}/submit"]["post"]["responses"][200]["content"]["application/json"];

/** Stable error codes surfaced to the row for banner messages. */
export type MilestoneMutationErrorCode =
  "INVALID_TRANSITION" | "FORBIDDEN" | "NOT_FOUND" | "NETWORK" | "UNKNOWN";

export class MilestoneMutationError extends Error {
  readonly code: MilestoneMutationErrorCode;
  readonly status?: number;
  constructor(code: MilestoneMutationErrorCode, message: string, status?: number) {
    super(message);
    this.name = "MilestoneMutationError";
    this.code = code;
    this.status = status;
  }
}

function toMutationError(err: unknown): MilestoneMutationError {
  if (isApiError(err)) {
    if (err.status === 409) {
      return new MilestoneMutationError(
        "INVALID_TRANSITION",
        err.message || "Invalid transition",
        409,
      );
    }
    if (err.status === 403) {
      return new MilestoneMutationError("FORBIDDEN", err.message || "Not allowed", 403);
    }
    if (err.status === 404) {
      return new MilestoneMutationError("NOT_FOUND", err.message || "Not found", 404);
    }
    return new MilestoneMutationError("UNKNOWN", err.message, err.status);
  }
  return new MilestoneMutationError("NETWORK", "Network error");
}

/** Friendly, non-blocking banner copy per error code. */
export function bannerMessageFor(
  code: MilestoneMutationErrorCode,
  verb: "submit" | "approve",
): string {
  switch (code) {
    case "INVALID_TRANSITION":
      return `Cannot ${verb} in its current status`;
    case "FORBIDDEN":
      return "Not allowed";
    case "NOT_FOUND":
      return "Milestone not found";
    case "NETWORK":
      return "Network error — please try again";
    default:
      return "Something went wrong — please try again";
  }
}

function useMilestoneMutation(contractId: string, milestoneId: string, verb: "submit" | "approve") {
  const queryClient = useQueryClient();
  const path = `/contracts/${contractId}/milestones/${milestoneId}/${verb}` as const;

  return useMutation<MilestoneDto, MilestoneMutationError, void>({
    mutationFn: async () => {
      try {
        return await api.post<MilestoneDto>(path);
      } catch (err) {
        throw toMutationError(err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractQueryKey(contractId) });
      queryClient.invalidateQueries({ queryKey: contractsQueryKey });
    },
  });
}

export function useSubmitMilestone(contractId: string, milestoneId: string) {
  return useMilestoneMutation(contractId, milestoneId, "submit");
}

export function useApproveMilestone(contractId: string, milestoneId: string) {
  return useMilestoneMutation(contractId, milestoneId, "approve");
}
