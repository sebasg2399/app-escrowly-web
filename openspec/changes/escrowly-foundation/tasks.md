# Tasks: Escrowly Foundation (backend-only)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1400–1800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

1. Scaffold + DB + health (PR 1): tooling, env, docker, prisma migration, server/app, plugins, `/health`. Verify: `pnpm dev` boots + /health 200.
2. Auth domain (PR 2, base=PR1): hashing, ports/adapters, auth service/schemas/routes, plugins, cookies. Verify: inject tests.
3. Users domain (PR 3, base=PR2): service/schemas/routes, `GET/PATCH /users/me`, role guard. Verify: profile tests.
4. Contract + hardening (PR 4, base=PR3): `pnpm openapi` → openapi.yaml, lint/format, README. Verify: suite green.

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Create `app-escrowly-backend/package.json` (fastify, @fastify/swagger, zod, @prisma/client, argon2, pino; dev: prisma, typescript, vitest, eslint, prettier)
- [x] 1.2 Create `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`
- [x] 1.3 Create `src/config/env.ts` (zod env, incl. `escrowly_test` DATABASE_URL)
- [x] 1.4 Create `docker-compose.yml` (PostgreSQL)
- [x] 1.5 Create `prisma/schema.prisma` (`Role` enum; `User`, `Session` per design)
- [ ] 1.6 Run `pnpm prisma migrate dev` → initial `prisma/migrations/` *(skip: must be run locally by user — `pnpm install && docker compose up -d && pnpm prisma migrate dev --name init`)*
- [x] 1.7 Create `src/app.ts` (`buildApp()`) and `src/server.ts`
- [x] 1.8 Create `src/plugins/error-handler.ts` (envelope `code/message/details`) and `src/plugins/logger.ts` (pino, correlation id, redaction)
- [x] 1.9 Add `GET /health` returning 200

## Phase 2: Core Implementation

- [x] 2.1 Create `src/modules/auth/password.ts` (argon2id hash/verify)
- [x] 2.2 Create `src/ports/user-repository.ts` + `session-repository.ts` and `src/adapters/prisma/` impls
- [x] 2.3 Create `src/modules/auth/auth.schemas.ts` (register/login/refresh zod, password strength)
- [x] 2.4 Create `src/modules/auth/auth.service.ts` (dup email → 409; bad login → 401; 5-min JWT + opaque refresh, rotate; logout sets `revoked_at`)
- [x] 2.5 Create `src/plugins/auth.ts` (JWT HS256 verify + `access_jti` revocation lookup) and `src/plugins/rate-limit.ts` (→ 429)
- [x] 2.6 Create `src/modules/auth/auth.routes.ts` (register/login/logout/refresh; httpOnly+Secure+SameSite=Strict cookie)
- [ ] 2.7 Create `src/modules/users/users.schemas.ts` + `users.service.ts` (profile omits `passwordHash`; PATCH rejects role/`passwordHash`)
- [ ] 2.8 Create `src/modules/users/users.routes.ts` (`GET /users/me`, `PATCH /users/me`)

## Phase 3: Integration / Wiring

- [~] 3.1 Register plugins + modules in `buildApp()` (logger, error-handler, rate-limit, auth, routes) — auth wired; users/swagger pending
- [ ] 3.2 Wire `@fastify/swagger` from route zod schemas; add `pnpm openapi` dumping `openapi.yaml`

## Phase 4: Testing

- [x] 4.1 Test-DB helper: `escrowly_test` via `DATABASE_URL`, truncate between tests
- [x] 4.2 Unit tests: password hash/verify, token encode/decode, zod validation
- [x] 4.3 `app.inject()`: register → 201 + token; duplicate email → 409; weak password → 400 + field details
- [x] 4.4 Login: valid → token; wrong password → 401
- [x] 4.5 Logout: revoked session → access rejected 401
- [ ] 4.6 `/users/me`: no `passwordHash`; PATCH field persists; role-escalation rejected
- [x] 4.7 Expired/malformed token → 401; unauthenticated route → 401 envelope; unknown route → 404
- [x] 4.8 Excessive auth attempts → 429
- [ ] 4.9 Verify `openapi.yaml` describes health, auth, users routes

## Phase 5: Cleanup

- [ ] 5.1 Run ESLint + Prettier; fix findings
- [ ] 5.2 Add README (`pnpm dev`/`test`/`openapi`); confirm no password/token in logs
