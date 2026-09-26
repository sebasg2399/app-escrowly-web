import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import type { Contract } from "./contracts-types";
import { contractsQueryKey } from "./useContracts";
import { hasPendingMilestones } from "../milestones/milestone-role";

export function contractQueryKey(id: string) {
  return ["contract", id] as const;
}

const PENDING_REFETCH_INTERVAL_MS = 5000;

export function useContract(id: string | undefined) {
  return useQuery<Contract>({
    queryKey: id ? contractQueryKey(id) : ["contract", "__missing__"],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
    // Poll while ANY milestone is still `pending` (webhook-driven
    // `pending → funded` transition). Stop polling once every milestone has
    // moved past `pending` — the next mutation will refetch on demand.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return hasPendingMilestones(data) ? PENDING_REFETCH_INTERVAL_MS : false;
    },
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation<
    Contract,
    unknown,
    { sellerEmail: string; milestones: { title: string; amount: number }[] }
  >({
    mutationFn: (body) => api.post<Contract>("/contracts", body),
    onSuccess: (created) => {
      // Invalidate list + seed the per-id cache so the detail page renders
      // instantly after the create-navigate.
      queryClient.invalidateQueries({ queryKey: contractsQueryKey });
      queryClient.setQueryData(contractQueryKey(created.id), created);
    },
  });
}
