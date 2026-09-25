# Delta for user-auth

## ADDED Requirements

### Requirement: User registration

A visitor MUST be able to register with a `name`, email, and password. On success the system SHALL create an account and return an authenticated token. The `name` MUST be a non-empty string of 1–100 characters (after trim).

#### Scenario: Successful registration

- GIVEN a visitor provides a valid name, a valid unused email, and a strong password
- WHEN they register
- THEN the account MUST be created
- AND the response SHALL include an authenticated token

#### Scenario: Missing or empty name

- GIVEN a visitor submits a registration without a name or with a blank/whitespace-only name
- WHEN they register
- THEN the API MUST reject it with HTTP 400 and field-level details

### Requirement: Email uniqueness

The system MUST enforce email uniqueness. Registering with an email that is already in use SHALL fail.

#### Scenario: Duplicate email

- GIVEN an account already exists for `a@example.com`
- WHEN a new registration uses `a@example.com`
- THEN the API MUST reject it with HTTP 409

### Requirement: Password strength

The system MUST enforce a minimum password strength. A password below the minimum MUST be rejected at registration.

#### Scenario: Weak password

- GIVEN a visitor submits a password below the minimum strength
- WHEN they register
- THEN the API MUST reject it with HTTP 400 and field-level details

### Requirement: Password hashing and secrecy

The system MUST store passwords only in hashed form. Plaintext passwords MUST NEVER be stored, logged, or returned in any response.

#### Scenario: Password is never exposed

- GIVEN any successful auth flow
- WHEN the system stores or returns user data
- THEN no plaintext password MUST appear in storage, logs, or responses

### Requirement: Login

A user MUST be able to log in with email and password. Valid credentials SHALL return an authenticated token; invalid credentials MUST return HTTP 401.

#### Scenario: Successful login

- GIVEN a registered user provides correct credentials
- WHEN they log in
- THEN the system MUST return an authenticated token

#### Scenario: Wrong password

- GIVEN a registered user provides an incorrect password
- WHEN they log in
- THEN the API MUST return HTTP 401

### Requirement: Logout

A user MUST be able to log out. After logout the token SHALL no longer be usable.

#### Scenario: Logout invalidates session

- GIVEN an authenticated user
- WHEN they log out
- THEN the previous token MUST be rejected on subsequent requests

### Requirement: Current user

An authenticated request MUST be able to retrieve the current user's profile.

#### Scenario: Fetch current user

- GIVEN a valid token
- WHEN the current-user endpoint is called
- THEN the API MUST return the authenticated user's profile

### Requirement: Roles

The system MUST support the roles `client`, `seller`, and `admin`. New accounts SHALL default to `client` unless otherwise assigned.

#### Scenario: Default role on registration

- GIVEN a new registration without explicit role assignment
- WHEN the account is created
- THEN the role MUST be `client`

### Requirement: Token/session lifecycle

Authentication tokens MUST expire. An expired or malformed token SHALL be rejected with HTTP 401.

#### Scenario: Expired token

- GIVEN a token past its expiry
- WHEN it is used on a protected endpoint
- THEN the API MUST return HTTP 401

### Requirement: Rate limiting on auth endpoints

The system MUST apply basic rate limiting to authentication endpoints to slow brute-force attempts.

#### Scenario: Excessive auth attempts

- GIVEN a client exceeds the auth rate limit
- WHEN it makes another auth request
- THEN the API MUST reject it with HTTP 429
