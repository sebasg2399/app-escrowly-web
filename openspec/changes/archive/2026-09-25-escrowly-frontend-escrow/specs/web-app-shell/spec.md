# Delta for web-app-shell

> Delta on the existing `web-app-shell` spec. Existing requirements (route guard, public/protected routes, loading, not-found, session-expired) are unchanged. This delta adds the new nav entry and the new protected escrow routes.

## ADDED Requirements

### Requirement: Contracts navigation entry

The application navigation SHALL expose a `Contracts` entry that routes to `/app/contracts`. The entry MUST be visible to every authenticated user, MUST sit alongside the existing Dashboard link, and MUST navigate via the existing auth-protected layout.

#### Scenario: Authenticated user sees Contracts link

- GIVEN an authenticated user on any `/app/*` page
- WHEN the navigation renders
- THEN a `Contracts` link MUST be visible
- AND clicking it MUST navigate to `/app/contracts`

### Requirement: Protected escrow routes under AuthGuard

The router MUST register `/app/contracts`, `/app/contracts/new`, `/app/contracts/:id`, and `/app/onboarding` as children of the existing `AuthGuard`. Each MUST use the existing `AppLayout`. Unauthenticated access MUST redirect to `/login` with redirect-back, identical to the existing protected routes.

#### Scenario: New routes mount inside the shell

- GIVEN an authenticated user navigates to `/app/contracts/new`
- WHEN the router resolves
- THEN the page MUST render inside `AppLayout`
- AND MUST NOT redirect

#### Scenario: Unauthenticated access redirects with redirect-back

- GIVEN a guest navigates to `/app/contracts/abc`
- WHEN the auth guard runs
- THEN the app MUST redirect to `/login`
- AND MUST remember `/app/contracts/abc` as the intended path
- AND after successful login MUST return the user to `/app/contracts/abc`

### Requirement: Unknown escrow id renders error state, not crash

If `/app/contracts/:id` receives an id the viewer cannot access (403/404 from `GET /contracts/:id`), the route MUST render the contract page's error state rather than the global not-found page, so the viewer can return to the list.

#### Scenario: Non-participant id shows error state

- GIVEN the viewer is not a participant in the contract with the given id
- WHEN the detail page resolves
- THEN it MUST render the contract detail error state with a back link
- AND MUST NOT render the global not-found page