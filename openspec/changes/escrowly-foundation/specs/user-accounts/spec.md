# Delta for user-accounts

## ADDED Requirements

### Requirement: User persistence model

The system MUST persist users with at least the following fields: unique `id`, unique `email`, hashed password, `role`, and creation/update timestamps. Email MUST be unique across all users.

#### Scenario: Required fields present

- GIVEN an account is created
- WHEN it is persisted
- THEN it MUST include `id`, `email`, hashed password, `role`, and timestamps

### Requirement: Read current user profile

An authenticated user MUST be able to read their own profile. The response SHALL NOT include the password hash.

#### Scenario: Profile excludes password hash

- GIVEN an authenticated user
- WHEN they read their profile
- THEN the response MUST include profile fields
- AND MUST NOT include the password hash

### Requirement: Update current user profile

An authenticated user MUST be able to update their own allowed profile fields. The password hash and role SHALL NOT be updatable through this surface.

#### Scenario: Update own profile

- GIVEN an authenticated user
- WHEN they submit an update to an allowed field
- THEN the field MUST be updated
- AND the change MUST be persisted

#### Scenario: Escalation prevented

- GIVEN an authenticated user attempts to change their own role
- WHEN they submit the update
- THEN the API MUST reject the role change

### Requirement: Reserved Stripe fields

The persistence model MAY reserve fields `stripe_customer_id`, `stripe_account_id`, and `subscription_status`. Their behavior is defined by later changes; this change SHALL NOT implement Stripe behavior. Any amount-related field MUST be integer minor units.

#### Scenario: Reserved fields are inert

- GIVEN the reserved Stripe fields exist in the model
- WHEN this change is exercised
- THEN no Stripe integration behavior MUST occur
