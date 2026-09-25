import { http } from "msw";

export const handlers = [
  http.get("/health", () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
];
