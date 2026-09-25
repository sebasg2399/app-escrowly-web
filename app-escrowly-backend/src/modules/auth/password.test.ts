import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password", () => {
  it("hashes a password", async () => {
    const hash = await hashPassword("SecurePass1");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("SecurePass1");
    expect(hash).toContain("$argon2");
  });

  it("verifies a correct password", async () => {
    const password = "SecurePass1";
    const hash = await hashPassword(password);
    const valid = await verifyPassword(hash, password);
    expect(valid).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("SecurePass1");
    const valid = await verifyPassword(hash, "WrongPass1");
    expect(valid).toBe(false);
  });

  it("produces different hashes for same password", async () => {
    const h1 = await hashPassword("SecurePass1");
    const h2 = await hashPassword("SecurePass1");
    expect(h1).not.toBe(h2); // salt differs
  });
});
