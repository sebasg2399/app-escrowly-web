# Delta for web-connect-onboarding

> Delta for the new `web-connect-onboarding` UI capability. The onboarding spec at `openspec/specs/connect-onboarding/spec.md` is the source of truth for the rules; this delta defines how the **UI** exposes them.

## ADDED Requirements

### Requirement: Start onboarding via hosted link

The onboarding page MUST expose a "Connect with Stripe" action that calls `POST /connect/onboarding-link` and navigates the browser to the returned URL. The action MUST be available to any authenticated user; the UI MUST NOT gate it on the profile's global `role`.

#### Scenario: Authenticated user starts onboarding

- GIVEN any authenticated user opens the onboarding page
- WHEN they click "Connect with Stripe"
- THEN the page MUST call `POST /connect/onboarding-link`
- AND MUST navigate to the returned URL

### Requirement: Show onboarding status

The page MUST call `GET /connect/status` and render one of two states: **not-onboarded** when details submitted / payouts enabled are false, and **onboarded** when both are true. The page MUST expose a "Refresh status" action that refetches `GET /connect/status`.

#### Scenario: Not-onboarded state

- GIVEN the user has not finished Stripe onboarding
- WHEN the page loads
- THEN it MUST render a not-onboarded state with a clear call-to-action to start onboarding

#### Scenario: Onboarded state

- GIVEN Stripe reports `detailsSubmitted = true` and `payoutsEnabled = true`
- WHEN the page loads
- THEN it MUST render an onboarded state with confirmation messaging

#### Scenario: Refresh status refetches

- GIVEN the page is mounted
- WHEN the user clicks "Refresh status"
- THEN the page MUST refetch `GET /connect/status`
- AND MUST re-render based on the fresh response

### Requirement: Unauthenticated access is rejected

The onboarding page MUST require an authenticated session; the auth guard SHALL redirect unauthenticated viewers to `/login` with the original path remembered, identical to other protected routes.

#### Scenario: Guest redirected to login

- GIVEN a visitor without a session navigates to `/app/onboarding`
- WHEN the auth guard runs
- THEN the page MUST redirect to `/login`
- AND MUST remember `/app/onboarding` as the intended path