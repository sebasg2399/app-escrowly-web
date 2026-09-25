import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { api, getAccessToken, setAccessToken, clearSession } from "./client";

beforeEach(() => {
  clearSession();
});

describe("api client", () => {
  describe("token management", () => {
    it("attaches Bearer header when token exists", async () => {
      let capturedAuth: string | null = null;
      server.use(
        http.get("/users/me", async ({ request }) => {
          capturedAuth = request.headers.get("Authorization");
          return HttpResponse.json({
            id: "1",
            email: "a@b.com",
            name: "A",
            role: "client",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }),
      );

      setAccessToken("test-token");
      await api.get("/users/me");
      expect(capturedAuth).toBe("Bearer test-token");
    });

    it("does NOT attach Bearer header when no token", async () => {
      let capturedAuth: string | null = "not-checked";
      server.use(
        http.get("/health", async ({ request }) => {
          capturedAuth = request.headers.get("Authorization");
          return HttpResponse.json({
            status: "ok",
            timestamp: new Date().toISOString(),
          });
        }),
      );

      await api.get("/health");
      expect(capturedAuth).toBeNull();
    });

    it("never writes token to localStorage or sessionStorage", async () => {
      const lsSpy = vi.spyOn(Storage.prototype, "setItem");

      server.use(
        http.post("/auth/login", () =>
          HttpResponse.json({ accessToken: "fresh-token" }),
        ),
        http.get("/users/me", () =>
          HttpResponse.json({
            id: "1",
            email: "a@b.com",
            name: "A",
            role: "client",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
      );

      const res = await api.post<{ accessToken: string }>("/auth/login", {
        email: "a@b.com",
        password: "Pass1234",
      });
      setAccessToken(res.accessToken);

      expect(lsSpy).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("fresh-token");

      lsSpy.mockRestore();
    });
  });

  describe("401 → refresh → retry", () => {
    it("triggers exactly one refresh and retries the original request", async () => {
      let refreshCount = 0;
      let meCount = 0;

      server.use(
        http.get("/users/me", async ({ request }) => {
          meCount++;
          const auth = request.headers.get("Authorization");
          if (meCount === 1 || !auth?.includes("new-token")) {
            return HttpResponse.json(
              { code: "UNAUTHORIZED", message: "Token expired" },
              { status: 401 },
            );
          }
          return HttpResponse.json({
            id: "1",
            email: "a@b.com",
            name: "A",
            role: "client",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }),
        http.post("/auth/refresh", () => {
          refreshCount++;
          return HttpResponse.json({ accessToken: "new-token" });
        }),
      );

      const result = await api.get<Record<string, string>>("/users/me");
      expect(refreshCount).toBe(1);
      expect(meCount).toBe(2);
      expect(result.id).toBe("1");
    });

    it("coalesces concurrent 401s into a single refresh", async () => {
      let refreshCount = 0;

      server.use(
        http.get("/users/me", () =>
          HttpResponse.json(
            { code: "UNAUTHORIZED", message: "Token expired" },
            { status: 401 },
          ),
        ),
        http.post("/auth/refresh", () => {
          refreshCount++;
          return HttpResponse.json({ accessToken: "new-token" });
        }),
      );

      await Promise.allSettled([
        api.get("/users/me"),
        api.get("/users/me"),
        api.get("/users/me"),
      ]);

      expect(refreshCount).toBe(1);
    });
  });

  describe("refresh scope", () => {
    it("does NOT trigger a refresh on a 401 from an auth endpoint", async () => {
      let refreshCount = 0;

      server.use(
        http.post("/auth/login", () =>
          HttpResponse.json(
            { code: "UNAUTHORIZED", message: "Invalid credentials" },
            { status: 401 },
          ),
        ),
        http.post("/auth/refresh", () => {
          refreshCount++;
          return HttpResponse.json({ accessToken: "should-not-happen" });
        }),
      );

      await expect(
        api.post("/auth/login", { email: "a@b.com", password: "wrong" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
      expect(refreshCount).toBe(0);
    });
  });

  describe("request headers", () => {
    it("does NOT send Content-Type on a body-less POST", async () => {
      let contentType: string | null = "not-checked";

      server.use(
        http.post("/auth/refresh", ({ request }) => {
          contentType = request.headers.get("Content-Type");
          return HttpResponse.json({ accessToken: "x" });
        }),
      );

      await api.post("/auth/refresh");
      expect(contentType).toBeNull();
    });

    it("sends Content-Type: application/json when a body is present", async () => {
      let contentType: string | null = null;

      server.use(
        http.post("/auth/login", ({ request }) => {
          contentType = request.headers.get("Content-Type");
          return HttpResponse.json({ accessToken: "x" });
        }),
      );

      await api.post("/auth/login", { email: "a@b.com", password: "Pass1234" });
      expect(contentType).toContain("application/json");
    });
  });

  describe("refresh failure", () => {
    it("clears session and throws SESSION_EXPIRED on refresh 401", async () => {
      server.use(
        http.get("/users/me", () =>
          HttpResponse.json(
            { code: "UNAUTHORIZED", message: "Token expired" },
            { status: 401 },
          ),
        ),
        http.post("/auth/refresh", () =>
          HttpResponse.json(
            { code: "UNAUTHORIZED", message: "Refresh token invalid" },
            { status: 401 },
          ),
        ),
      );

      const err = (await api.get("/users/me").catch((e: unknown) => e)) as Error;
      expect(err.message).toBe("Your session expired. Please sign in again.");
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("error mapping", () => {
    it("throws ApiError with details on 400", async () => {
      server.use(
        http.post("/auth/register", () =>
          HttpResponse.json(
            {
              code: "VALIDATION_ERROR",
              message: "Invalid input",
              details: { email: ["Invalid email format"] },
            },
            { status: 400 },
          ),
        ),
      );

      await expect(
        api.post("/auth/register", {
          name: "A",
          email: "bad",
          password: "Pass1234",
        }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        details: { email: ["Invalid email format"] },
      });
    });

    it("throws ApiError with status 409", async () => {
      server.use(
        http.post("/auth/register", () =>
          HttpResponse.json(
            { code: "CONFLICT", message: "Email already exists" },
            { status: 409 },
          ),
        ),
      );

      await expect(
        api.post("/auth/register", {
          name: "A",
          email: "a@b.com",
          password: "Pass1234",
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        status: 409,
      });
    });

    it("throws ApiError with status 429", async () => {
      server.use(
        http.post("/auth/login", () =>
          HttpResponse.json(
            { code: "RATE_LIMITED", message: "Too many attempts" },
            { status: 429 },
          ),
        ),
      );

      await expect(
        api.post("/auth/login", {
          email: "a@b.com",
          password: "Pass1234",
        }),
      ).rejects.toMatchObject({
        code: "RATE_LIMITED",
        status: 429,
      });
    });
  });
});
