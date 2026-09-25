import { describe, it, expect } from "vitest";
import { toApiError, networkError, isApiError } from "./errors";

describe("errors.ts", () => {
  describe("toApiError", () => {
    it("maps a backend error envelope", () => {
      const body = {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: { email: ["Invalid email"] },
      };
      const err = toApiError(400, body);
      expect(err).toEqual({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: { email: ["Invalid email"] },
        status: 400,
      });
    });

    it("falls back to HTTP code when body has no envelope", () => {
      const err = toApiError(500, "Internal Server Error");
      expect(err.code).toBe("HTTP_500");
      expect(err.message).toBe("Internal Server Error");
      expect(err.status).toBe(500);
    });

    it("handles empty body", () => {
      const err = toApiError(502, null);
      expect(err.code).toBe("HTTP_502");
      expect(err.message).toBe("Unknown error");
    });
  });

  describe("networkError", () => {
    it("creates a network error with code", () => {
      const err = networkError("fetch failed");
      expect(err.code).toBe("NETWORK_ERROR");
      expect(err.message).toBe("fetch failed");
    });
  });

  describe("isApiError", () => {
    it("returns true for ApiError objects", () => {
      expect(isApiError({ code: "X", message: "Y" })).toBe(true);
    });

    it("returns false for plain errors", () => {
      expect(isApiError(new Error("oops"))).toBe(false);
      expect(isApiError("string")).toBe(false);
      expect(isApiError(null)).toBe(false);
    });
  });
});
