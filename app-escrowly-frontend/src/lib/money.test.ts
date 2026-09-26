import { describe, it, expect } from "vitest";
import { dollarsToCents, formatCents, sumCents } from "./money";

describe("dollarsToCents", () => {
  it("converts plain dollars", () => {
    expect(dollarsToCents("12.34")).toBe(1234);
    expect(dollarsToCents("100")).toBe(10000);
    expect(dollarsToCents("0")).toBe(0);
    expect(dollarsToCents("0.00")).toBe(0);
  });

  it("rounds to the nearest whole cent", () => {
    expect(dollarsToCents("12.005")).toBe(1201);
    expect(dollarsToCents("12.999")).toBe(1300);
    expect(dollarsToCents("0.005")).toBe(1);
    expect(dollarsToCents("0.004")).toBe(0);
  });

  it("strips a leading $ and commas", () => {
    expect(dollarsToCents("$1,234.56")).toBe(123456);
    expect(dollarsToCents("$12.34")).toBe(1234);
    expect(dollarsToCents("1,000")).toBe(100000);
  });

  it("handles a leading decimal point", () => {
    expect(dollarsToCents(".5")).toBe(50);
    expect(dollarsToCents(".99")).toBe(99);
  });

  it("handles values without an integer part", () => {
    expect(dollarsToCents("0.5")).toBe(50);
    expect(dollarsToCents("0.05")).toBe(5);
  });

  it("trims surrounding whitespace", () => {
    expect(dollarsToCents("  12.34  ")).toBe(1234);
  });

  it("avoids classic float accumulation for repeating decimals", () => {
    // 0.1 + 0.2 in floats = 0.30000000000000004; cents must still be 30.
    expect(dollarsToCents("0.30")).toBe(30);
    expect(dollarsToCents("0.1")).toBe(10);
    expect(dollarsToCents("1.10")).toBe(110);
  });

  it("returns NaN for non-numeric input", () => {
    expect(Number.isNaN(dollarsToCents(""))).toBe(true);
    expect(Number.isNaN(dollarsToCents("."))).toBe(true);
    expect(Number.isNaN(dollarsToCents("-"))).toBe(true);
    expect(Number.isNaN(dollarsToCents("abc"))).toBe(true);
    expect(Number.isNaN(dollarsToCents("12.34.56"))).toBe(true);
  });

  it("handles large values without precision loss", () => {
    expect(dollarsToCents("1234567.89")).toBe(123456789);
    expect(dollarsToCents("9999999.99")).toBe(999999999);
  });
});

describe("formatCents", () => {
  it("formats integer cents as USD currency", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(1)).toBe("$0.01");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(1234)).toBe("$12.34");
    expect(formatCents(100000)).toBe("$1,000.00");
  });

  it("formats negative amounts", () => {
    expect(formatCents(-1234)).toBe("-$12.34");
  });

  it("supports non-USD currencies", () => {
    expect(formatCents(1234, "eur")).toBe("€12.34");
    expect(formatCents(1234, "gbp")).toBe("£12.34");
  });

  it("throws on non-integer cents", () => {
    expect(() => formatCents(12.34)).toThrow();
    expect(() => formatCents(0.1)).toThrow();
  });
});

describe("sumCents", () => {
  it("returns 0 for an empty list", () => {
    expect(sumCents([])).toBe(0);
  });

  it("sums integer cents exactly (no float drift)", () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    expect(sumCents([1234, 5678])).toBe(6912);
    expect(sumCents([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(10);
  });

  it("handles a long list of small amounts", () => {
    const list = Array.from({ length: 1000 }, () => 1);
    expect(sumCents(list)).toBe(1000);
  });

  it("throws on non-integer input", () => {
    expect(() => sumCents([10, 20.5])).toThrow();
    expect(() => sumCents([0.1])).toThrow();
  });
});
