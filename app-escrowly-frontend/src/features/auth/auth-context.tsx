import { useState, useCallback, useEffect, type ReactNode } from "react";
import { api, setAccessToken, clearSession, registerOnSessionExpired } from "../../lib/api/client";
import { AuthContext } from "./auth-types";
import type { AuthStatus, Profile } from "./auth-types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  // Session-expired callback: transition to guest and stash the message for
  // the next /login render. Navigation is performed by AuthGuard (which is
  // the only component that knows the original location.pathname) so the
  // sessionExpiredMessage survives the redirect.
  useEffect(() => {
    registerOnSessionExpired((message: string) => {
      clearSession();
      setProfile(null);
      setStatus("guest");
      setSessionExpiredMessage(message);
    });
  }, []);

  const restore = useCallback(async () => {
    try {
      const res = await api.post<{ accessToken: string }>("/auth/refresh");
      setAccessToken(res.accessToken);
      const me = await api.get<Profile>("/users/me");
      setProfile(me);
      setStatus("authed");
      setSessionExpiredMessage(null);
    } catch {
      clearSession();
      setStatus("guest");
    }
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string }) => {
    const res = await api.post<{ accessToken: string }>("/auth/register", data);
    setAccessToken(res.accessToken);
    const me = await api.get<Profile>("/users/me");
    setProfile(me);
    setStatus("authed");
    setSessionExpiredMessage(null);
  }, []);

  const login = useCallback(async (data: { email: string; password: string }) => {
    const res = await api.post<{ accessToken: string }>("/auth/login", data);
    setAccessToken(res.accessToken);
    const me = await api.get<Profile>("/users/me");
    setProfile(me);
    setStatus("authed");
    setSessionExpiredMessage(null);
  }, []);

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
    <AuthContext.Provider
      value={{
        status,
        profile,
        sessionExpiredMessage,
        register,
        login,
        logout,
        restore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
