import { createContext } from "react";
import type { paths } from "../../lib/api/types.generated";

export type Profile = paths["/users/me"]["get"]["responses"][200]["content"]["application/json"];

export type AuthStatus = "loading" | "authed" | "guest";

export interface AuthContextValue {
  status: AuthStatus;
  profile: Profile | null;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
