# Delta for contracts

## ADDED Requirements

### Requirement: Create contract as the authenticated client

An authenticated user MAY create a contract naming the seller by email and providing N milestones. The caller SHALL be persisted as the contract `client`; the `seller` is the user account identified by the provided email. The seller account MUST exist at creation time (the seller "joins later" only means the contract is readable by them once their account exists). Each milestone MUST have a non-empty title and a positive integer-cents amount. The milestone list SHALL NOT be empty. All milestone amounts MUST be integer minor units; floating-point money SHALL NOT be accepted.

#### Scenario: Successful contract creation

- GIVEN an authenticated user submits a seller email that matches an existing account and one or more milestones with positive integer-cents amounts
- WHEN they POST to `/contracts`
- THEN the contract MUST be persisted with the caller as `client`
- AND each milestone MUST be persisted with status `pending`

#### Scenario: Empty milestone list

- GIVEN an authenticated user submits a contract with an empty milestone list
- WHEN they POST to `/contracts`
- THEN the API MUST reject the request with HTTP 400

#### Scenario: Non-positive or non-integer milestone amount

- GIVEN an authenticated user submits a milestone whose amount is zero, negative, or non-integer
- WHEN they POST to `/contracts`
- THEN the API MUST reject the request with HTTP 400

### Requirement: Contract read access is restricted to participants

A contract SHALL be readable only by its `client` or `seller`. A non-participant MUST NOT be able to read a contract and SHALL receive HTTP 403 or 404. The list endpoint MUST return only contracts in which the caller is a participant.

#### Scenario: Participant reads a contract

- GIVEN an authenticated user is the client or seller of a contract
- WHEN they request the contract by id
- THEN the API MUST return the contract and its milestones

#### Scenario: Non-participant reads a contract

- GIVEN an authenticated user is not a participant in a contract
- WHEN they request the contract by id
- THEN the API MUST respond with HTTP 403 or 404
- AND the response body MUST use the standard error envelope

#### Scenario: List returns only the caller's contracts

- GIVEN an authenticated user participates in some contracts and not others
- WHEN they request the contracts list
- THEN the response MUST contain only the contracts they participate in

### Requirement: Contract status transitions

A contract SHALL expose a status field with valid values `draft`, `active`, `completed`, and `cancelled`. A contract MUST be created in `draft`. The status SHALL transition to `active` when at least one milestone is funded. The status SHALL transition to `completed` when every milestone is `paid`. The `cancelled` state is reserved for later changes and SHALL NOT be reachable in this change.

#### Scenario: New contract starts in draft

- GIVEN an authenticated user creates a contract
- WHEN the contract is persisted
- THEN its status MUST be `draft`

#### Scenario: Contract becomes active on first funding

- GIVEN a contract is `draft`
- WHEN any of its milestones becomes `funded`
- THEN the contract status MUST transition to `active`

#### Scenario: Contract becomes completed when all milestones are paid

- GIVEN a contract is `active` and every milestone is `paid`
- WHEN the last milestone transitions to `paid`
- THEN the contract status MUST transition to `completed`
