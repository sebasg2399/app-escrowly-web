import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import type { Contract } from "./contracts-types";
import { contractsQueryKey } from "./useContracts";

export function contractQueryKey(id: string) {
  return ["contract", id] as const;
}

export function useContract(id: string | undefined) {
  return useQuery<Contract>({
    queryKey: id ? contractQueryKey(id) : ["contract", "__missing__"],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
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
