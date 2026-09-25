# Web Auth Specification

## Purpose

Define the registration, login, logout, silent restore, silent refresh on 401, and rate-limit behaviors for the Escrowly web application's authentication feature.

## Requirements

### Requirement: Registration

A visitor MUST be able to register with name, email, and password. On success the app SHALL store the access token in memory, load the profile, and land the user in the app at `/app`.

#### Scenario: Successful registration lands in app

- GIVEN a visitor submits a valid name, unused email, and strong password
- WHEN registration returns 201
- THEN the app MUST store the access token in memory
- AND MUST navigate to `/app`

### Requirement: Registration validation errors

Registration validation failures MUST be shown inline, mapped from the error envelope `details`, and the form SHALL remain filled.

#### Scenario: Invalid registration shows field errors

- GIVEN a visitor submits registration with an invalid field
- WHEN the API returns 400 with `details`
- THEN the app MUST show an inline error on each failing field
- AND MUST keep the entered values in the form

### Requirement: Duplicate email

A duplicate-email registration (409) MUST be shown as an inline error on the email field.

#### Scenario: Duplicate email on register

- GIVEN an account already exists for the submitted email
- WHEN registration returns 409
- THEN the app MUST show an inline error on the email field

### Requirement: Login

A user MUST be able to log in with email and password. Valid credentials SHALL land the user in the app; wrong credentials (401) MUST show a single non-field error.

#### Scenario: Successful login lands in app

- GIVEN a registered user submits correct credentials
- WHEN login returns 200
- THEN the app MUST store the access token in memory
- AND MUST navigate to `/app`

#### Scenario: Wrong credentials show non-field error

- GIVEN a user submits incorrect credentials
- WHEN login returns 401
- THEN the app MUST show a single non-field error
- AND MUST NOT reveal which field was wrong

### Requirement: Logout

A user MUST be able to log out. Logout SHALL clear the in-memory session and return the user to `/login`.

#### Scenario: Logout clears session and returns to login

- GIVEN an authenticated user chooses to log out
- WHEN logout completes
- THEN the app MUST clear the in-memory token and session
- AND MUST navigate to `/login`

### Requirement: Silent session restore on boot

On boot the app MUST attempt silent session restore. If a refresh token is present and valid, the user SHALL be authenticated; if absent or 401, the user SHALL be shown `/login`.

#### Scenario: Restore with valid refresh cookie

- GIVEN the app loads with a valid refresh cookie
- WHEN it calls the refresh endpoint
- THEN the user MUST be authenticated and shown the app

#### Scenario: Restore without refresh cookie

- GIVEN the app loads with no refresh cookie (or refresh returns 401)
- WHEN silent restore resolves
- THEN the user MUST be shown `/login`

### Requirement: Silent refresh on 401

When a request returns 401, the app MUST attempt one silent refresh and retry the request once. If the refresh fails, the app SHALL clear the session and redirect to `/login`.

#### Scenario: 401 triggers refresh and retry

- GIVEN an authenticated request returns 401
- WHEN the app performs a silent refresh successfully
- THEN it MUST retry the original request once with the new token

#### Scenario: Failed refresh hard-fails to login

- GIVEN a request returns 401 and the subsequent refresh also fails
- WHEN the refresh is rejected
- THEN the app MUST clear the session and redirect to `/login`

### Requirement: Rate-limited auth

When an auth endpoint returns 429, the app MUST disable the submit action briefly and SHALL show a banner explaining the limit.

#### Scenario: 429 disables submit and shows banner

- GIVEN a user triggers an auth request that returns 429
- WHEN the response arrives
- THEN the app MUST disable the submit button
- AND MUST show the message "Too many attempts. Please wait a moment and try again."