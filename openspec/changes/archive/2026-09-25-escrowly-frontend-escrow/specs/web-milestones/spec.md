# Delta for web-milestones

> Delta for the new `web-milestones` UI capability. The milestone spec at `openspec/specs/milestones/spec.md` is the source of truth for the state machine and role rules; this delta defines how the **UI** renders and drives them.

## ADDED Requirements

### Requirement: Viewer role derived per-contract

For each contract the UI SHALL derive a `viewerRole` (`client` | `seller` | `none`) by comparing the authenticated profile's id against the contract's `client.id` and `seller.id`. The UI MUST NOT rely on the profile's global `role` to decide per-contract actions, because a single user may be the client in one contract and the seller in another.

#### Scenario: Role derived from contract participants

- GIVEN the viewer is the `client` of contract A and the `seller` of contract B
- WHEN the viewer opens contract A's detail page
- THEN the UI MUST treat them as the client for that page
- AND actions reserved for the seller MUST NOT be visible

### Requirement: Status- and role-aware milestone actions

The milestone list MUST render an action button per row selected by `viewerRole` × `milestone.status`: client on `pending` → Fund; seller on `funded` → Submit; client on `in_review` → Approve & pay. `paid` MUST show a terminal "paid" badge; `approved` MUST show an "approved — payout pending" badge (only reached on transfer failure). When the action is not allowed for the current `viewerRole` and `status`, the button MUST be hidden or disabled and MUST NOT be wired to a transition.

#### Scenario: Allowed action renders

- GIVEN a milestone is `funded` and the viewer is the contract's seller
- WHEN the detail page renders
- THEN a "Submit" button MUST be visible and enabled

#### Scenario: Disallowed action is not wired

- GIVEN a milestone is `funded` and the viewer is the contract's client
- WHEN the detail page renders
- THEN no Submit button MUST be shown
- AND no transition request MUST be issued from this view

#### Scenario: Terminal states render badges

- GIVEN a milestone is `paid`
- WHEN the detail page renders
- THEN the row MUST show a "paid" badge and MUST NOT show any action button

### Requirement: Submit and approve reflect state changes

Submit MUST call `POST /contracts/:id/milestones/:mid/submit`; Approve MUST call `POST /contracts/:id/milestones/:mid/approve`. On success the UI MUST refetch the contract and reflect the new status. A 409 (invalid transition) or 403 (wrong role) MUST surface as a non-blocking error and MUST leave the milestone in its current status.

#### Scenario: Successful submit advances status

- GIVEN the seller clicks Submit on a `funded` milestone
- WHEN `POST .../submit` returns 200
- THEN the contract MUST be refetched
- AND the milestone MUST render as `in_review`

#### Scenario: Invalid transition surfaces error

- GIVEN the seller clicks Submit on a milestone that is not `funded`
- WHEN the API returns 409
- THEN a non-blocking error MUST be shown
- AND the milestone status MUST remain unchanged

### Requirement: Refetch while a milestone is pending funding

The detail page MUST refetch the contract on a polling interval while any milestone in the contract is `pending`. Polling MUST stop once every milestone has moved past `pending` (or the user leaves the page). This is the mechanism by which the UI reflects the webhook-driven `pending → funded` transition.

#### Scenario: Pending milestone triggers polling

- GIVEN a contract has at least one `pending` milestone
- WHEN the detail page is mounted
- THEN the contract MUST be refetched on a polling interval

#### Scenario: Polling stops after webhook funding

- GIVEN polling is active because a milestone is `pending`
- WHEN the contract is refetched and all milestones are past `pending`
- THEN polling MUST stop