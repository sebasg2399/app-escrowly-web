# Delta for web-api-client

> Delta on the existing `web-api-client` spec. The typed client, in-memory token, credential handling, error envelope mapping, and single-flight refresh behavior are unchanged. This delta only adds the regeneration requirement for the new endpoints.

## ADDED Requirements

### Requirement: Types regenerated from frozen OpenAPI contract

The typed API client MUST expose request and response types for the new endpoints (`/contracts`, `/contracts/:id`, `/contracts/:id/milestones/:mid/{fund,submit,approve}`, `/connect/onboarding-link`, `/connect/status`). Types MUST be regenerated from the frozen `app-escrowly-backend/openapi.yaml` via the existing `pnpm gen:api` script and MUST match that contract as the single source of truth. The client's HTTP behavior (token in memory, credentials, error envelope, single-flight refresh) is unchanged.

#### Scenario: Generated types include new endpoints

- GIVEN `pnpm gen:api` is run against the frozen `openapi.yaml`
- WHEN the generated `types.generated.ts` is committed
- THEN it MUST include typed `paths` entries for `/contracts`, `/contracts/:id`, the milestone transitions, and the connect endpoints

#### Scenario: Client behavior is unchanged

- GIVEN the regenerated types are adopted
- WHEN the client is used
- THEN its 401-refresh behavior, in-memory token handling, error envelope mapping, and credential sending MUST remain identical to the existing client