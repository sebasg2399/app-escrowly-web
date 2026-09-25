# Escrowly

Milestone-based escrow platform for freelancers and clients.

## Monorepo Layout

| Directory | Status | Description |
|-----------|--------|-------------|
| `openspec/` | Active | Spec-driven development artifacts |
| `app-escrowly-backend/` | **Done** | Fastify API (auth, users, OpenAPI contract) |
| `app-escrowly-frontend/` | Upcoming | Web UI (not yet created) |

## Current Status

Backend foundation is complete: authentication (JWT + refresh tokens with revocation), user profiles, structured logging, rate limiting, error envelope, and a committed OpenAPI contract. Next: frontend scaffolding.

See `app-escrowly-backend/README.md` for backend setup instructions.
