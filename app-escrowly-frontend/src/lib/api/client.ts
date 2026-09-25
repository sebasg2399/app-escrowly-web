import { toApiError, networkError } from "./errors";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

let accessToken: string | null = null;
let refreshPromise: Promise<void> | null = null;
let onSessionExpired: ((message: string) => void) | null = null;

// A 401 from these endpoints must NOT trigger the silent-refresh interceptor
// (e.g. a wrong-password login would otherwise surface as "session expired").
const AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]);

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearSession(): void {
  accessToken = null;
  refreshPromise = null;
}

export function registerOnSessionExpired(cb: (message: string) => void): void {
  onSessionExpired = cb;
}

function buildUrl(path: string): string {
  if (BASE_URL) {
    return `${BASE_URL.replace(/\/$/, "")}${path}`;
  }
  return path;
}

async function doRefresh(): Promise<void> {
  const res = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    clearSession();
    const err = res.status === 401
      ? new Error("SESSION_EXPIRED")
      : new Error("REFRESH_FAILED");
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const data = await res.json();
  setAccessToken(data.accessToken);
}

async function refreshOnce(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

interface RequestOptions {
  body?: unknown;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  options?: RequestOptions,
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const init: RequestInit = {
    method,
    credentials: "include",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  };

  let res: Response;
  try {
    res = await fetch(buildUrl(path), init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw networkError("Network request failed");
    }
    throw err;
  }

  if (res.status === 401 && !retried && !AUTH_PATHS.has(path)) {
    try {
      await refreshOnce();
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        const msg = "Your session expired. Please sign in again.";
        onSessionExpired?.(msg);
        const sessionErr = new Error(msg) as Error & { code: string; status: number };
        sessionErr.code = "SESSION_EXPIRED";
        sessionErr.status = 401;
        throw sessionErr;
      }
      throw err;
    }
    return request<T>(method, path, options, true);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = res.statusText;
    }
    throw toApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, { body });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, { body });
  },
};

export { refreshOnce };
