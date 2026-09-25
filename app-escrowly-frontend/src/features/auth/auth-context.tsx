import { createContext, useState, useCallback, type ReactNode } from "react";
import { api, setAccessToken, clearSession } from "../../lib/api/client";
import type { paths } from "../../lib/api/types.generated";

type Profile = paths["/users/me"]["get"]["responses"][200]["content"]["application/json"];

export type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  profile: Profile | null;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export { useAuth } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  const restore = useCallback(async () => {
    try {
      const res = await api.post<{ accessToken: string }>("/auth/refresh");
      setAccessToken(res.accessToken);
      const me = await api.get<Profile>("/users/me");
      setProfile(me);
      setStatus("authed");
    } catch {
      clearSession();
      setStatus("guest");
    }
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; password: string }) => {
      const res = await api.post<{ accessToken: string }>("/auth/register", data);
      setAccessToken(res.accessToken);
      const me = await api.get<Profile>("/users/me");
      setProfile(me);
      setStatus("authed");
    },
    [],
  );

  const login = useCallback(
    async (data: { email: string; password: string }) => {
      const res = await api.post<{ accessToken: string }>("/auth/login", data);
      setAccessToken(res.accessToken);
      const me = await api.get<Profile>("/users/me");
      setProfile(me);
      setStatus("authed");
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post<void>("/auth/logout");
    } catch {
      // ignore — still clear local session
    }
    clearSession();
    setProfile(null);
    setStatus("guest");
  }, []);

  return (
    <AuthContext.Provider value={{ status, profile, register, login, logout, restore }}>
      {children}
    </AuthContext.Provider>
  );
}
