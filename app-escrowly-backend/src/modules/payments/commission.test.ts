import { describe, it, expect } from "vitest";
import { splitCommission } from "./commission.js";

describe("splitCommission", () => {
  it("returns integer commission + transfer for a round amount", () => {
    expect(splitCommission(10_000)).toEqual({ commission: 1_000, transfer: 9_000 });
  });

  it("absorbs odd cents on the transfer half so the two parts sum to the amount", () => {
    const cases = [999, 100, 1, 9, 11, 123, 7_777];
    for (const amount of cases) {
      const { commission, transfer } = splitCommission(amount);
      expect(Number.isInteger(commission)).toBe(true);
      expect(Number.isInteger(transfer)).toBe(true);
      expect(commission).toBe(Math.floor(amount * 0.10));
      expect(transfer).toBe(amount - commission);
      expect(commission + transfer).toBe(amount);
    }
  });

  it("returns zero on both sides when the amount is zero", () => {
    expect(splitCommission(0)).toEqual({ commission: 0, transfer: 0 });
  });

  it("rejects non-integer and negative amounts", () => {
    expect(() => splitCommission(10.5)).toThrow();
    expect(() => splitCommission(-100)).toThrow();
  });
});
