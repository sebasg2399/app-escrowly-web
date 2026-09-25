# Delta for connect-onboarding

## ADDED Requirements

### Requirement: Sellers can start Connect onboarding

A user with role `seller` MAY request a Stripe Connect Express onboarding link. The system MUST create an Express account with `payouts={schedule: manual}` (manual payouts) and return a hosted onboarding URL.

#### Scenario: Seller requests an onboarding link

- GIVEN an authenticated user with role `seller`
- WHEN they request an onboarding link
- THEN the system MUST create (or reuse) a Stripe Connect Express account with manual payouts
- AND MUST return a hosted onboarding URL

#### Scenario: Non-seller cannot start onboarding

- GIVEN an authenticated user with role `client` or `admin`
- WHEN they request an onboarding link
- THEN the system MUST reject the request with HTTP 403

### Requirement: Sellers can check onboarding status

A user with role `seller` MAY check the onboarding status of their own connected account. The response SHALL indicate whether onboarding is complete and whether payouts are enabled.

#### Scenario: Onboarding complete with payouts enabled

- GIVEN an authenticated seller who has finished Stripe onboarding
- WHEN they request their onboarding status
- THEN the response MUST report onboarding complete and payouts enabled

#### Scenario: Onboarding incomplete

- GIVEN an authenticated seller who has not finished Stripe onboarding
- WHEN they request their onboarding status
- THEN the response MUST report onboarding incomplete and payouts not enabled

### Requirement: Account updates reflect payouts enabled

When Stripe delivers an `account.updated` event, the system MUST update the seller's stored onboarding state to reflect whether payouts are enabled. The update MUST be keyed by the Stripe event id so a re-delivery is a no-op.

#### Scenario: account.updated enables payouts

- GIVEN a seller's stored onboarding state reports payouts disabled
- WHEN Stripe delivers an `account.updated` event reporting payouts enabled
- THEN the stored state MUST be updated to report payouts enabled
- AND exactly one `LedgerEntry`/state change MUST be written for that event id

#### Scenario: Re-delivered account.updated is a no-op

- GIVEN an `account.updated` event id has already been processed
- WHEN the same event id is delivered again
- THEN the system MUST NOT mutate onboarding state a second time
- AND MUST NOT write additional rows
