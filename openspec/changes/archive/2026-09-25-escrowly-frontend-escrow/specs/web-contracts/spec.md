# Delta for web-contracts

> Delta for the new `web-contracts` UI capability. The backend contract spec at `openspec/specs/contracts/spec.md` is the source of truth for shapes and rules; this delta defines how the **UI** exposes them.

## ADDED Requirements

### Requirement: Contracts list scoped to the viewer

The contracts list page SHALL call `GET /contracts` and render only the contracts in which the authenticated viewer participates. The page MUST show a loading skeleton while the request is in flight, an empty state when the viewer has no contracts, and a loaded list when the response resolves. Each row MUST show counterparty name, the contract total formatted as USD from the integer-cents sum of its milestone amounts, the contract status, and milestone progress (paid count over total count).

#### Scenario: List renders rows for a participant

- GIVEN an authenticated viewer with two participant contracts
- WHEN the contracts list page mounts
- THEN it MUST render a row per contract
- AND each row MUST show counterparty, total in USD, status, and milestone progress

#### Scenario: Empty state for a viewer with no contracts

- GIVEN an authenticated viewer with no contracts
- WHEN the contracts list page mounts
- THEN it MUST show an empty state with a call-to-action to create a contract

### Requirement: Create contract with integer-cents milestones

The create-contract page SHALL accept a seller email and a list of milestones, each with a `title` and a positive integer-cents `amount`. Amounts SHALL be captured in dollars on the UI and converted to integer cents WITHOUT floating-point math (cents = round(dollars × 100)). Client-side validation MUST reject an empty milestone list and any non-positive amount before submission. On submit, the page SHALL call `POST /contracts` and navigate to the new contract's detail page on success.

#### Scenario: Successful create navigates to detail

- GIVEN an authenticated viewer submits a seller email that matches an existing account and at least one milestone with a positive integer-cents amount
- WHEN the create form submits
- THEN the page MUST call `POST /contracts` with integer-cents amounts
- AND on a 200 response MUST navigate to the new contract's detail page

#### Scenario: Unknown seller email surfaces inline error

- GIVEN the seller email does not match any account
- WHEN `POST /contracts` returns 404
- THEN the create form MUST show an inline error on the seller-email field
- AND MUST NOT navigate away

#### Scenario: 400 details map to field errors

- GIVEN the request body fails server validation
- WHEN `POST /contracts` returns 400 with `details`
- THEN each field error in `details` MUST render inline on the matching field
- AND entered values MUST remain in the form

#### Scenario: Empty milestone list rejected client-side

- GIVEN the viewer submits with zero milestones
- WHEN they attempt to submit
- THEN the page MUST block submission and show an inline error

#### Scenario: Non-positive amount rejected client-side

- GIVEN a milestone amount of zero or negative
- WHEN the viewer edits the field
- THEN the page MUST show an inline error on that milestone row

### Requirement: Contract detail is participant-only

The contract detail page SHALL call `GET /contracts/:id` and render the contract header and milestones for participants. A non-participant (HTTP 403 or 404) MUST see an error state with a link back to the list; the page MUST NOT render the contract's milestones or amounts.

#### Scenario: Participant sees header and milestones

- GIVEN an authenticated viewer who is the client or seller of the contract
- WHEN the detail page mounts
- THEN it MUST render the contract header and milestone list

#### Scenario: Non-participant sees error state

- GIVEN the viewer is not a participant in the contract
- WHEN `GET /contracts/:id` returns 403 or 404
- THEN the page MUST show an error state with a back link
- AND MUST NOT render milestone amounts or titles