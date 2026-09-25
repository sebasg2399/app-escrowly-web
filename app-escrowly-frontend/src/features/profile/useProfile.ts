import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import type { paths } from "../../lib/api/types.generated";

type Profile = paths["/users/me"]["get"]["responses"][200]["content"]["application/json"];

const PROFILE_QUERY_KEY = ["profile"] as const;

export function useProfile() {
  return useQuery<Profile>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => api.get<Profile>("/users/me"),
  });
}

export function useUpdateProfileName() {
  const queryClient = useQueryClient();

  return useMutation<Profile, unknown, { name: string }>({
    mutationFn: ({ name }) => api.patch<Profile>("/users/me", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    },
  });
}
