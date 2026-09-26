import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api/client";

export interface FundMilestoneResponse {
  id: string;
  clientSecret: string;
}

export function useFundMilestone() {
  return useMutation({
    mutationFn: (vars: { contractId: string; milestoneId: string }) =>
      api.post<FundMilestoneResponse>(
        `/contracts/${vars.contractId}/milestones/${vars.milestoneId}/fund`,
      ),
  });
}
