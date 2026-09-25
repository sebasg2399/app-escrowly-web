/**
 * Single source of truth for the platform commission split.
 *
 *   commission = floor(amountCents * 0.10)
 *   transfer   = amountCents - commission
 *
 * The `transfer` half absorbs any odd cent so `commission + transfer` is
 * always exactly `amountCents` in integer cents. No other code in the
 * codebase may recompute the split — every approval payout reads from here.
 */

export interface CommissionSplit {
  commission: number;
  transfer: number;
}

export function splitCommission(amountCents: number): CommissionSplit {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("amountCents must be a non-negative integer");
  }
  const commission = Math.floor(amountCents * 0.10);
  const transfer = amountCents - commission;
  return { commission, transfer };
}
