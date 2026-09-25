import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import type { Contract } from "./contracts-types";

export const contractsQueryKey = ["contracts"] as const;

export function useContracts() {
  return useQuery<Contract[]>({
    queryKey: contractsQueryKey,
    queryFn: () => api.get<Contract[]>("/contracts"),
  });
}
