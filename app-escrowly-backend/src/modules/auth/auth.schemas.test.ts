import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema, refreshSchema } from "./auth.schemas.js";

describe("auth.schemas", () => {
  describe("registerSchema", () => {
    it("accepts valid registration", () => {
      const result = registerSchema.safeParse({
        body: { name: "Test User", email: "test@example.com", password: "SecurePass1" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing name", () => {
      const result = registerSchema.safeParse({
        body: { email: "test@example.com", password: "SecurePass1" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = registerSchema.safeParse({
        body: { name: "", email: "test@example.com", password: "SecurePass1" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects whitespace-only name", () => {
      const result = registerSchema.safeParse({
        body: { name: "   ", email: "test@example.com", password: "SecurePass1" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        body: { email: "not-an-email", password: "SecurePass1" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects short password", () => {
      const result = registerSchema.safeParse({
        body: { email: "test@example.com", password: "short" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(true);
      }
    });

    it("rejects password without uppercase", () => {
      const result = registerSchema.safeParse({
        body: { email: "test@example.com", password: "lowercase1" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without lowercase", () => {
      const result = registerSchema.safeParse({
        body: { email: "test@example.com", password: "UPPERCASE1" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without number", () => {
      const result = registerSchema.safeParse({
        body: { email: "test@example.com", password: "NoNumbers" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts valid login", () => {
      const result = loginSchema.safeParse({
        body: { email: "test@example.com", password: "any" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing email", () => {
      const result = loginSchema.safeParse({
        body: { password: "any" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("refreshSchema", () => {
    it("accepts valid refresh cookie", () => {
      const result = refreshSchema.safeParse({
        cookies: { refresh: "sess-id.secret-value" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing refresh cookie", () => {
      const result = refreshSchema.safeParse({
        cookies: {},
      });
      expect(result.success).toBe(false);
    });
  });
});
