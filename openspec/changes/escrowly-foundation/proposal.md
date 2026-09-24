# Proposal: Escrowly Foundation (backend-only)

## Intent

Escrowly is a B2B escrow platform that holds funds and releases them only on deliverable approval. This change lays the backend foundation: a modular-monolith Fastify/TypeScript service, self-managed auth, local PostgreSQL + Prisma, an OpenAPI contract seed, and test/lint setup.

## Scope

### In Scope
- Backend scaffold: Fastify + TypeScript, modular-monolith structure, env/config, error middleware, zod validation, logging.
- Local PostgreSQL (docker-compose) + Prisma with initial `Users` model.
- Self-managed auth: register, login, logout, current-user; password hashing; roles (`client`, `seller`, `admin`).
- OpenAPI contract baseline for auth/users (contract-first seed).
- Vitest + ESLint/Prettier setup.

### Out of Scope
- All frontend work (React/Vite/Tailwind/Stitch) — later change.
- Stripe Connect and all payments — later changes.
- Milestone/escrow state machine, funds, notifications.
- Any AWS/LocalStack/Step Functions infrastructure.

## Capabilities

### New Capabilities
- `api-foundations`: API conventions — error envelope, zod boundary validation, logging, OpenAPI contract baseline.
- `user-auth`: register, login, logout, current-user; password hashing; role assignment.
- `user-accounts`: `Users` persistence model and account read/update surface.

### Modified Capabilities
None (no existing specs).

## Approach

Stand up `app-escrowly-backend/` as a domain-first modular monolith, infrastructure behind mocked ports/adapters. Auth is self-managed; money rules are deferred to the payments change. The OpenAPI contract is authored with specs, implemented by the backend, consumed later by Stitch and frontend.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app-escrowly-backend/` | New | Scaffold: bootstrap, config, http middleware, zod validation, test/lint setup |
| `app-escrowly-backend/src/modules/auth/` | New | register/login/logout/me, hashing, roles |
| `app-escrowly-backend/src/modules/users/` | New | users module |
| `app-escrowly-backend/prisma/schema.prisma` | New | `Users` model |
| `app-escrowly-backend/docker-compose.yml` | New | local PostgreSQL |
| `app-escrowly-backend/openapi.yaml` | New | contract baseline |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep into frontend/payments | Medium | Explicit out-of-scope list; deferred |
| Auth security gaps (self-managed) | Medium | Argon2/bcrypt, httpOnly cookies, rate-limit hooks in specs |
| Long-term fund holding | Low | No money handling here; flagged for payments change |

## Rollback Plan

Greenfield, no existing code to protect. If the foundation is wrong, delete `app-escrowly-backend/` and the `escrowly-foundation` change artifacts and re-propose. `docker-compose down -v` removes the local DB.

## Dependencies

- Node + pnpm and Docker; Vitest, Prisma, Fastify, zod, ESLint, Prettier.

## Success Criteria

- [ ] `pnpm dev` boots the Fastify server with config and logging.
- [ ] Auth flows work end-to-end against local Postgres.
- [ ] Passwords hashed; roles persist; unauthorized requests return the standard error envelope.
- [ ] OpenAPI contract matches implemented auth/users routes.
- [ ] Vitest suite is green; ESLint and Prettier pass.
