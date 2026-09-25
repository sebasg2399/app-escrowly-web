# Delta for Web App Shell

## ADDED Requirements

### Requirement: Public and protected route structure

The app MUST expose public routes `/login` and `/register`, and protected routes under `/app`. Protected routes SHALL require an authenticated session. The root path `/` SHALL redirect to `/app` when authenticated and to `/login` otherwise.

#### Scenario: Root redirect

- GIVEN a visitor opens the root path `/`
- WHEN the app resolves the route
- THEN it MUST redirect to `/app` when authenticated
- AND MUST redirect to `/login` when unauthenticated

### Requirement: Auth guard redirects unauthenticated access

An unauthenticated visitor navigating to a protected route MUST be redirected to `/login`. After a successful login, the user SHALL be returned to the originally requested path.

#### Scenario: Protected route without session

- GIVEN a visitor with no session requests `/app/profile`
- WHEN the auth guard runs
- THEN the app MUST redirect to `/login`
- AND MUST remember `/app/profile` as the intended path

#### Scenario: Return to intended path after login

- GIVEN a user logged in after being redirected from `/app/profile`
- WHEN login succeeds
- THEN the app MUST navigate to `/app/profile`

### Requirement: Global loading state during session restore

While the app restores the session on boot, it MUST render a global loading state and SHALL NOT flash protected content to an unauthenticated user.

#### Scenario: Boot shows loader until restore resolves

- GIVEN the app is starting
- WHEN session restore is in flight
- THEN the app MUST show a full-page loading state
- AND MUST NOT render protected content until restore resolves

### Requirement: Unknown route renders not-found state

Navigating to an unknown path MUST render a not-found state. The state SHALL include a link back to a known route.

#### Scenario: Unknown path

- GIVEN a visitor navigates to an undefined path
- WHEN the router cannot match the route
- THEN the app MUST render a not-found state with a link back

### Requirement: Session-expired state

When the session expires, the app MUST clear the session and redirect to `/login` with a message indicating the session expired.

#### Scenario: Expired session redirects with message

- GIVEN an authenticated user whose session has expired
- WHEN the app detects the session is no longer valid
- THEN it MUST clear the session and redirect to `/login`
- AND MUST display the message "Your session expired. Please sign in again."
