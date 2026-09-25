export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  status?: number;
}

export function isApiError(err: unknown): err is ApiError {
  return typeof err === "object" && err !== null && "code" in err && "message" in err;
}

export function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && "code" in body && "message" in body) {
    return {
      code: String((body as Record<string, unknown>).code),
      message: String((body as Record<string, unknown>).message),
      details: (body as Record<string, unknown>).details as Record<string, string[]> | undefined,
      status,
    };
  }

  return {
    code: `HTTP_${status}`,
    message: typeof body === "string" ? body : "Unknown error",
    status,
  };
}

export function networkError(message: string): ApiError {
  return {
    code: "NETWORK_ERROR",
    message,
  };
}
