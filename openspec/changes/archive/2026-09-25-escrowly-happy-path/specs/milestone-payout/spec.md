# Delta for milestone-payout

## ADDED Requirements

### Requirement: Payout on client approval

When a milestone transitions from `in_review` to `approved`, the system SHALL compute a single platform commission of 10% of the milestone amount in integer minor units. The remaining 90% SHALL be paid to the seller via a Stripe `Transfer` to the seller's CONNECTED account. The commission calculation MUST be the single source of truth for the split (no other code path recomputes it).

#### Scenario: Approval triggers commission + transfer

- GIVEN a milestone is `in_review` and the caller is the client of its contract
- WHEN the client approves the milestone
- THEN the system MUST compute a 10% platform commission in integer cents from the milestone amount
- AND MUST create a Stripe `Transfer` of the remaining 90% to the seller's connected account
- AND the milestone status MUST become `paid`

#### Scenario: Ledger balances after payout

- GIVEN a funded milestone is approved and paid
- WHEN the payout is recorded
- THEN two `LedgerEntry` rows MUST exist that sum to the milestone amount: a platform commission credit and a seller transfer credit
- AND the sum of credits for the milestone MUST equal the milestone amount

### Requirement: Payout is idempotent

Approval plus any subsequent webhook re-delivery MUST NOT produce a second commission, a second transfer, or additional ledger rows for the same milestone. The system MUST treat a duplicate payout attempt against an already-`paid` milestone as a no-op on money.

#### Scenario: Duplicate approval is a no-op

- GIVEN a milestone is already `paid`
- WHEN the client attempts to approve it again
- THEN the system MUST reject the request
- AND MUST NOT create a new `Transfer` or new `LedgerEntry`

#### Scenario: Re-delivered transfer event is a no-op

- GIVEN a milestone is `paid` and its `transfer.created` (or `transfer.failed`) event was already processed
- WHEN the same Stripe event id is delivered again
- THEN the system MUST NOT write additional `LedgerEntry` rows
- AND the milestone status MUST remain `paid`

### Requirement: Missing connected account is handled gracefully

If the seller has no connected account able to receive funds at the moment of payout, the `Transfer` MUST fail gracefully: the milestone SHALL remain `approved`, the error SHALL be surfaced in the API response and logged, and the system MUST NOT mark the milestone `paid`.

#### Scenario: No connected account

- GIVEN a milestone is `approved` and the seller has no usable connected account
- WHEN the system attempts the payout
- THEN the `Transfer` MUST fail
- AND the milestone status MUST remain `approved`
- AND the error MUST be returned to the caller and recorded in logs
- AND no seller-side `LedgerEntry` MUST be written
