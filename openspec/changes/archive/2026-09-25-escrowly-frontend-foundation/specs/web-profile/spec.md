# Delta for Web Profile

## ADDED Requirements

### Requirement: Profile view

An authenticated user MUST be able to view their profile. The view SHALL show name, email, role, and member-since (creation timestamp), and MUST NEVER display a password or password hash.

#### Scenario: Profile shows allowed fields

- GIVEN an authenticated user opens the profile view
- WHEN the profile loads
- THEN it MUST show name, email, role, and member-since
- AND MUST NOT show any password field

### Requirement: Edit restricted to name

Profile editing SHALL allow the `name` field only. Email and role MUST be rendered read-only/disabled with a hint that they cannot be changed here.

#### Scenario: Email and role are non-editable

- GIVEN an authenticated user opens the profile edit form
- WHEN the form renders
- THEN only the name field MUST be editable
- AND email and role MUST be disabled

### Requirement: Name validation errors

An empty or oversized name MUST be rejected inline. A 400 response SHALL be mapped to an inline error on the name field, keeping the form filled.

#### Scenario: Invalid name shows inline error

- GIVEN a user submits an empty or oversized name
- WHEN the update returns 400 with `details`
- THEN the app MUST show an inline error on the name field

### Requirement: Successful profile update

A successful name update MUST be persisted and SHALL show a confirmation, returning the user to the read-only view.

#### Scenario: Name update persists and confirms

- GIVEN an authenticated user submits a valid name
- WHEN the update returns 200
- THEN the change MUST be persisted and reflected in the view
- AND the app MUST show a confirmation message
