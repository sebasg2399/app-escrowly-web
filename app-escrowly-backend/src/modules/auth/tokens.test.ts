import { describe, it, expect } from "vitest";
import {
  generateRefreshSecret,
  hashRefreshSecret,
  generateAccessJti,
  buildRefreshCookieValue,
  parseRefreshCookieValue,
} from "./tokens.js";

describe("tokens", () => {
  it("generates a 64-char hex refresh secret", () => {
    const secret = generateRefreshSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(secret)).toBe(true);
  });

  it("hashes refresh secret with SHA-256", () => {
    const secret = generateRefreshSecret();
    const hash = hashRefreshSecret(secret);
    expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it("produces deterministic hash for same secret", () => {
    const secret = "abc123";
    expect(hashRefreshSecret(secret)).toBe(hashRefreshSecret(secret));
  });

  it("generates a 32-char hex accessJti", () => {
    const jti = generateAccessJti();
    expect(jti).toHaveLength(32);
  });

  it("builds and parses refresh cookie value", () => {
    const sessionId = "sess-123";
    const secret = "secret-456";
    const cookieValue = buildRefreshCookieValue(sessionId, secret);
    expect(cookieValue).toBe("sess-123.secret-456");

    const parsed = parseRefreshCookieValue(cookieValue);
    expect(parsed).toEqual({ sessionId: "sess-123", secret: "secret-456" });
  });

  it("returns null for malformed cookie value", () => {
    expect(parseRefreshCookieValue("noseparator")).toBeNull();
    expect(parseRefreshCookieValue("")).toBeNull();
    expect(parseRefreshCookieValue("a.b.c")).toBeNull();
  });
});
