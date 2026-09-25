# Milestone Funding Specification

## Purpose

Defines how a contract's client funds a `pending` milestone through a Stripe `PaymentIntent` created on the PLATFORM account (no `transfer_data`, so funds settle in the platform balance), how the milestone advances to `funded` on a `payment_intent.succeeded` event, and the idempotency guarantees that make funding safe to retry and re-deliver.

## Requirements

### Requirement: Funding a pending milestone

The contract's `client` MAY initiate funding of a `pending` milestone. Funding SHALL create a Stripe `PaymentIntent` on the PLATFORM account. The `PaymentIntent` MUST NOT carry `transfer_data`, so funds settle in the platform balance. The milestone SHALL remain `pending` until the corresponding `payment_intent.succeeded` event is processed. A failed `PaymentIntent` SHALL leave the milestone `pending`.

#### Scenario: Client initiates funding

- GIVEN an authenticated client of a contract and a `pending` milestone belonging to it
- WHEN the client requests to fund that milestone
- THEN the system MUST create a Stripe `PaymentIntent` on the platform account
- AND the milestone status MUST remain `pending` until the success event arrives

#### Scenario: Successful payment moves milestone to funded

- GIVEN a `PaymentIntent` has been created for a `pending` milestone
- WHEN the `payment_intent.succeeded` event is processed
- THEN the milestone status MUST become `funded`
- AND a `LedgerEntry` MUST be written recording the platform-side receipt of the milestone amount

#### Scenario: Failed payment leaves milestone pending

- GIVEN a `PaymentIntent` has been created for a `pending` milestone
- WHEN the `payment_intent.payment_failed` event is processed
- THEN the milestone status MUST remain `pending`
- AND no `LedgerEntry` MUST be written for the failed attempt

### Requirement: Funding is idempotent

Re-funding a milestone that is already `funded`, `in_review`, `approved`, or `paid` MUST NOT create a new `PaymentIntent` and MUST NOT create additional `LedgerEntry` rows. A second attempt against the same non-pending milestone SHALL be rejected as a conflict (no-op on the money side).

#### Scenario: Re-fund a funded milestone

- GIVEN a milestone is `funded`
- WHEN the client attempts to fund it again
- THEN the system MUST reject the request
- AND no new `PaymentIntent` MUST be created
- AND no additional `LedgerEntry` MUST be written

#### Scenario: Webhook re-delivery is a no-op

- GIVEN the `payment_intent.succeeded` event for a milestone has already been processed and the milestone is `funded`
- WHEN the same Stripe event id is delivered again
- THEN the system MUST NOT write an additional `LedgerEntry`
- AND the milestone status MUST remain `funded`

### Requirement: Funding requires participant role

Funding SHALL only be initiated by the contract's `client`. The contract's `seller`, any other participant of a different contract, or any non-participant MUST NOT be able to fund a milestone.

#### Scenario: Non-client cannot fund

- GIVEN an authenticated user is not the client of a contract
- WHEN they attempt to fund one of its milestones
- THEN the system MUST reject the request with HTTP 403