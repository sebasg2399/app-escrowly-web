# Delta for stripe-webhooks

## ADDED Requirements

### Requirement: Single webhook endpoint

The system SHALL expose a single endpoint that receives Stripe webhook events. The endpoint MUST verify the Stripe signature using the configured webhook secret before processing the event. Requests with an invalid or missing signature MUST be rejected and MUST NOT mutate state.

#### Scenario: Signed event is accepted

- GIVEN a Stripe event is delivered with a valid signature for the configured test-mode webhook secret
- WHEN it reaches the webhook endpoint
- THEN the system MUST verify the signature
- AND MUST process the event

#### Scenario: Unsigned or bad-signature event is rejected

- GIVEN a Stripe event is delivered without a signature, or with a signature that does not match the configured secret
- WHEN it reaches the webhook endpoint
- THEN the system MUST reject the request
- AND MUST NOT process the event or mutate any state

### Requirement: Webhook processing is idempotent

Processing SHALL be idempotent keyed by the Stripe event id. If an event id has already been processed, the system MUST treat the re-delivery as a no-op and MUST NOT write additional ledger rows, transition milestone state, or change onboarding state.

#### Scenario: Re-delivered payment_intent.succeeded

- GIVEN a `payment_intent.succeeded` event id has already been processed and the milestone is `funded`
- WHEN the same event id is delivered again
- THEN the system MUST NOT write an additional `LedgerEntry`
- AND the milestone status MUST remain `funded`

#### Scenario: Re-delivered account.updated

- GIVEN an `account.updated` event id has already been processed
- WHEN the same event id is delivered again
- THEN the system MUST NOT mutate onboarding state a second time

### Requirement: Handled event types

The webhook handler SHALL process `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `transfer.created`, and `transfer.failed`. Each type MUST map to its corresponding flow (funding, payout, onboarding) without leaking handler behavior into unrelated capabilities.

#### Scenario: payment_intent.succeeded

- GIVEN a `payment_intent.succeeded` event for a milestone's `PaymentIntent`
- WHEN it is processed
- THEN the milestone MUST transition to `funded`
- AND a `LedgerEntry` MUST be written

#### Scenario: payment_intent.payment_failed

- GIVEN a `payment_intent.payment_failed` event for a milestone's `PaymentIntent`
- WHEN it is processed
- THEN the milestone MUST remain `pending`
- AND no `LedgerEntry` MUST be written

### Requirement: Unknown events are acknowledged and ignored

An event whose type is not in the handled list SHALL be acknowledged to Stripe (HTTP 2xx) and MUST NOT mutate state, MUST NOT write ledger rows, and MUST NOT produce a 5xx response.

#### Scenario: Unknown event type

- GIVEN Stripe delivers an event with a type outside the handled list
- WHEN it reaches the webhook endpoint
- THEN the endpoint MUST respond 2xx
- AND MUST NOT mutate any state
- AND MUST NOT produce a 5xx response

### Requirement: Duplicate and unknown events never 5xx

A duplicate event (already processed) or an unknown event type MUST NOT produce HTTP 5xx. Webhook delivery reliability depends on a 2xx acknowledgement; any other outcome would cause Stripe to retry and amplify load.

#### Scenario: Duplicate is acknowledged

- GIVEN an event id that has already been processed
- WHEN it is delivered again
- THEN the endpoint MUST respond 2xx
- AND MUST NOT produce a 5xx
