import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api/client";

export interface ConnectStatus {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
}

export const connectStatusKey = ["connect", "status"] as const;

export function useConnectStatus() {
  return useQuery<ConnectStatus>({
    queryKey: connectStatusKey,
    queryFn: () => api.get<ConnectStatus>("/connect/status"),
  });
}

export function useLaunchOnboarding() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>("/connect/onboarding-link"),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });
}
