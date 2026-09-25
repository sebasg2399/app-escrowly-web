# Delta for api-foundations

## ADDED Requirements

### Requirement: Standard error envelope

Every non-2xx HTTP response MUST use a single standard error envelope. The envelope SHALL contain a machine-readable `code` and a human-readable `message`, and MAY contain field-level `details`.

#### Scenario: Error returns standard envelope

- GIVEN the API encounters any error condition
- WHEN it responds with a non-2xx status
- THEN the body MUST include a `code` and a `message`
- AND `details` MAY be present when the error is field-specific

### Requirement: Validation failures return 400

The system MUST validate all request input at the boundary. Invalid input SHALL return HTTP 400 with field-level details describing each failing field.

#### Scenario: Malformed request body

- GIVEN a client submits a payload missing a required field
- WHEN the request reaches the API
- THEN the API MUST respond 400
- AND the error envelope MUST list the failing field

### Requirement: Authentication failures return 401

Requests to protected endpoints that lack or carry invalid credentials MUST return HTTP 401, never a generic 500.

#### Scenario: Unauthenticated access to protected route

- GIVEN a protected endpoint
- WHEN a request arrives without a valid credential
- THEN the API MUST respond 401 with the standard error envelope

### Requirement: Unknown routes return 404

Requests to routes that do not exist MUST return HTTP 404.

#### Scenario: Request to undefined path

- GIVEN the API has no route for `/does-not-exist`
- WHEN a client requests it
- THEN the API MUST respond 404

### Requirement: Health check endpoint

The API MUST expose a health-check endpoint that reports service liveness. A healthy service SHALL return HTTP 200.

#### Scenario: Healthy service

- GIVEN the service is running
- WHEN the health-check endpoint is called
- THEN the API MUST respond 200

### Requirement: Structured logging

The system MUST emit structured logs and SHALL attach a request identifier to each request for traceability. The system MUST NOT log secrets, passwords, or authentication tokens.

#### Scenario: Request is logged with correlation id

- GIVEN any incoming request
- WHEN the request is processed
- THEN a structured log entry MUST include a request identifier
- AND the entry MUST NOT contain a plaintext password or token

### Requirement: OpenAPI contract baseline

The project MUST maintain an OpenAPI contract describing implemented auth and users routes. The contract SHALL stay in sync with implemented routes; any route change MUST update the contract in the same change.

#### Scenario: Contract matches routes

- GIVEN an implemented auth or users route
- WHEN the contract is inspected
- THEN the contract MUST describe that route and its responses

### Requirement: Money is integer minor units

This change handles no money. Any field added later that implies an amount of money MUST store the value as integer minor units (e.g. cents); floating-point money SHALL NOT be used.

#### Scenario: Future amount field

- GIVEN a future field representing an amount of money
- WHEN the field is modeled
- THEN it MUST be an integer in minor units, never a float
