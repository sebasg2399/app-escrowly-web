import { http, HttpResponse } from "msw";

const VALID_TOKEN = "test-access-token";

export const handlers = [
  http.get("/health", () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  }),

  http.post("/auth/register", async ({ request }) => {
    const body = await request.json() as Record<string, string>;
    if (body.email === "exists@example.com") {
      return HttpResponse.json(
        { code: "CONFLICT", message: "Email already exists" },
        { status: 409 },
      );
    }
    return HttpResponse.json({ accessToken: VALID_TOKEN }, { status: 201 });
  }),

  http.post("/auth/login", async ({ request }) => {
    const body = await request.json() as Record<string, string>;
    if (body.email !== "user@example.com" || body.password !== "Correct1") {
      return HttpResponse.json(
        { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        { status: 401 },
      );
    }
    return HttpResponse.json({ accessToken: VALID_TOKEN });
  }),

  http.post("/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/auth/refresh", () => {
    return HttpResponse.json({ accessToken: VALID_TOKEN });
  }),

  http.get("/users/me", ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "user@example.com",
      name: "Test User",
      role: "client",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
  }),
];
