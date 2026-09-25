# Milestones Specification

## Purpose

Defines the milestone model and its happy-path state machine (`pending → funded → in_review → approved → paid`), the role-driven transition guards (seller submits, client approves), and the rules that keep the `disputed` state reserved without being reachable through any public transition in this change.

## Requirements

### Requirement: Milestone model

A milestone MUST belong to exactly one contract and SHALL carry a non-empty `title` and an integer-cents `amount` (integer minor units). Floating-point money SHALL NOT be used. A milestone SHALL expose a `status` field with the valid values `pending`, `funded`, `in_review`, `disputed`, `approved`, and `paid`.

#### Scenario: Milestone persisted with required fields

- GIVEN a milestone is created as part of a contract
- WHEN it is persisted
- THEN it MUST carry a non-empty title, a positive integer-cents amount, and a status

### Requirement: Milestone state machine (happy path)

The milestone status SHALL follow the linear happy path `pending → funded → in_review → approved → paid`. The `disputed` state is reserved and SHALL NOT be reached by any transition in this change. Each transition SHALL be triggered only by the owning participant role: `funded → in_review` by the seller, and `in_review → approved → paid` by the client (approval atomically triggers the payout; the milestone remains `approved` only when the payout fails). The `pending → funded` transition SHALL be triggered by the funding flow on a successful payment event.

#### Scenario: Seller submits delivery

- GIVEN a milestone is `funded` and the caller is the seller of its contract
- WHEN the seller triggers the `funded → in_review` transition
- THEN the milestone status MUST become `in_review`

#### Scenario: Client approves delivery

- GIVEN a milestone is `in_review` and the caller is the client of its contract
- WHEN the client approves the delivery
- THEN the milestone MUST leave `in_review`, passing through `approved`
- AND it MUST settle as `paid` when the payout succeeds (or remain `approved` if the payout fails)

### Requirement: Invalid transitions are rejected

The system MUST reject any transition that is not permitted by the state machine or that is requested by a user who is not the owning participant role. An invalid transition SHALL return an error and MUST NOT silently change state.

#### Scenario: Invalid transition rejected

- GIVEN a milestone is `pending`
- WHEN anyone other than the funding flow attempts to transition it
- THEN the system MUST reject the request
- AND the milestone status MUST remain `pending`

#### Scenario: Wrong role rejected

- GIVEN a milestone is `funded`
- WHEN the client attempts the `funded → in_review` transition
- THEN the system MUST reject the request
- AND the milestone status MUST remain `funded`

#### Scenario: Skip-step transition rejected

- GIVEN a milestone is `funded`
- WHEN the client attempts to transition it directly to `approved`
- THEN the system MUST reject the request
- AND the milestone status MUST remain `funded`

### Requirement: Disputed state is reserved

The `disputed` status SHALL exist in the enum to preserve future compatibility, but no transition in this change SHALL produce it. Any attempt to set a milestone to `disputed` via the public API MUST be rejected.

#### Scenario: Disputed not reachable

- GIVEN any milestone
- WHEN a caller attempts to transition it to `disputed`
- THEN the system MUST reject the request
- AND the milestone status MUST NOT become `disputed`