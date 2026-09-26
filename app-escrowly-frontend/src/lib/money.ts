/**
 * Money helpers for the Escrowly frontend.
 *
 * Money is always stored, transmitted, and rendered as integer minor units
 * (cents for USD). Floating-point dollars are ONLY used at the user-input
 * boundary, and only inside `dollarsToCents` — every other path works in cents.
 */

/**
 * Parse a user-entered dollar string ("12.34", "$12.34", ".5") into integer
 * cents. Rounds to the nearest cent using banker's-free half-up rounding
 * (`Math.round`), which is the only place floating-point math is allowed to
 * touch money.
 *
 * Returns `NaN` for non-numeric input; callers should validate before calling.
 */
export function dollarsToCents(input: string): number {
  if (typeof input !== "string") return Number.NaN;
  const trimmed = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (trimmed === "" || trimmed === "." || trimmed === "-") return Number.NaN;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return Number.NaN;
  // Math.round on Number handles half-to-even-ish cases; for money input this
  // is the closest match to what users expect.
  return Math.round(parsed * 100);
}

/**
 * Format an integer-cents amount as a localized currency string.
 *
 * Uses `Intl.NumberFormat` with USD by default. The input MUST be an integer;
 * non-integers throw to surface accidental float leakage in development.
 */
export function formatCents(cents: number, currency: string = "usd"): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`formatCents expected an integer, got ${cents}`);
  }
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  return formatter.format(cents / 100);
}

/**
 * Sum a list of integer cents. Throws on non-integer input to surface
 * accidental float leakage. Returns 0 for an empty list.
 */
export function sumCents(list: readonly number[]): number {
  let total = 0;
  for (const cents of list) {
    if (!Number.isInteger(cents)) {
      throw new Error(`sumCents expected integers only, got ${cents}`);
    }
    total += cents;
  }
  return total;
}
