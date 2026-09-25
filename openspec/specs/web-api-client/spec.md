# Web API Client Specification

## Purpose

Define the contract for the typed HTTP client used by the Escrowly web application: token storage, credential handling, error-envelope mapping, and single-flight refresh behavior.

## Requirements

### Requirement: Typed client from OpenAPI contract

The API client MUST be derived from the OpenAPI contract so request and response shapes are typed from the single source of truth.

#### Scenario: Client types match contract

- GIVEN the OpenAPI contract defines auth and users endpoints
- WHEN the client is generated
- THEN request bodies and responses MUST match the contract shapes

### Requirement: Access token in memory only

The access token MUST be kept in memory only and MUST NEVER be persisted to `localStorage`, `sessionStorage`, or any persistent browser store.

#### Scenario: Token never persisted

- GIVEN a successful register or login
- WHEN the access token is stored
- THEN it MUST live only in memory
- AND MUST NOT appear in `localStorage` or `sessionStorage`

### Requirement: Requests include credentials

All API requests MUST be sent with credentials included so the httpOnly refresh cookie is transmitted cross-origin.

#### Scenario: Requests send credentials

- GIVEN any API request is made
- WHEN the request is constructed
- THEN it MUST include credentials
- AND MUST target the configured API origin

### Requirement: Error envelope mapping

Every non-2xx response MUST be mapped to the standard error envelope `{code, message, details}`, and the client SHALL surface these fields to callers.

#### Scenario: Non-2xx maps to envelope

- GIVEN the API returns a non-2xx status
- WHEN the client processes the response
- THEN it MUST produce a typed error with `code`, `message`, and optional `details`

### Requirement: Single in-flight refresh

The client MUST coalesce concurrent refresh attempts so only one refresh request is in flight at a time; it SHALL NOT issue parallel refresh requests (refresh storms).

#### Scenario: Concurrent 401s share one refresh

- GIVEN multiple requests return 401 concurrently
- WHEN the client triggers refresh
- THEN only one refresh request MUST be issued
- AND all requests SHALL await the same result