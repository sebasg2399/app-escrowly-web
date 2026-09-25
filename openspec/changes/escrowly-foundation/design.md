# Design: Escrowly Foundation (backend-only)

## Technical Approach

Greenfield scaffold of `app-escrowly-backend/`: Fastify + TypeScript modular monolith, domain-first, infrastructure behind ports/adapters. Covers proposal capabilities `api-foundations`, `user-auth`, `user-accounts`. Stripe and frontend are out of scope.

`rules.design` note: the milestone state machine (`pending, funded, in_review, disputed, approved, paid`) and funding/approval/dispute/payout sequence diagrams are **not in this change** (deferred to payments/milestone). The required diagram here is the auth lifecycle.

## Architecture Decisions

| Decision | Options | Tradeoff | Decision |
|---|---|---|---|
| Module structure | (a) layered (b) modular monolith, domain-first | (b) isolates domains behind ports for later Stripe/notification mocking | **Modular monolith**: `modules/{auth,users}` → `ports/` → `adapters/prisma/` |
| Token/refresh + logout | (a) stateless JWT (b) JWT access + revocable refresh (c) JWT + Redis denylist | (a) can't invalidate on logout; (c) extra infra | **(b)**: 5-min access JWT (HS256, `sub/role/jti/iat/exp`) + opaque 32-byte refresh, SHA-256-hashed in `Session`, `httpOnly+Secure+SameSite=Strict` cookie, rotated each refresh. Logout sets `revoked_at=now()`; auth plugin does one indexed `access_jti` lookup per request and rejects revoked sessions — access token unusable immediately |
| OpenAPI generation | (a) hand-written yaml (b) generate from zod via `@fastify/swagger` | (a) drifts; (b) single source of truth | **(b)**: routes declare zod schemas as Fastify JSON Schemas; `pnpm openapi` dumps committed `openapi.yaml` — route ⇒ schema ⇒ regenerated contract, no drift |
| ORM/migrations | Prisma (locked) | — | `prisma migrate dev` locally; `migrate deploy` later |
| Test DB isolation | (a) transaction rollback (b) separate test database | (a) breaks when routes open own `$transaction` | **(b)**: `escrowly_test` via `DATABASE_URL` override; truncate between tests; routes tested via `app.inject()` |

## Folder Structure

```
app-escrowly-backend/
├── package.json  tsconfig.json  vitest.config.ts  .env.example
├── eslint.config.js  .prettierrc
├── docker-compose.yml
├── prisma/schema.prisma  prisma/migrations/
├── openapi.yaml
└── src/
    ├── server.ts
    ├── app.ts
    ├── config/env.ts
    ├── plugins/{error-handler,auth,logger,rate-limit}.ts
    ├── ports/{user-repository,session-repository}.ts
    ├── adapters/prisma/{user-repository,session-repository}.ts
    └── modules/
        ├── auth/{auth.routes,auth.service,auth.schemas,password}.ts
        └── users/{users.routes,users.service,users.schemas}.ts
```

## Data Flow

```
Client          Route           Auth           DB
│ register (zod) ──▶ hash Argon2id ──▶ create User ───────│
│◀── 201 user+accessToken + refresh cookie ───────────────│
│ login ──────────▶ verify hash ──────▶ find user ────────│
│◀── 200 user+accessToken + refresh cookie ───────────────│
│ /users/me ───────▶ verify JWT + access_jti revoked? ────│
│◀── 200 profile ─────────────────────────────────────────│
│ refresh ────────▶ validate hash → rotate session ──────│
│◀── 200 accessToken + new refresh cookie ────────────────│
│ logout (cookie) ─▶ session.revoked_at=now() ────────────│
│◀── 204 ─────────────────────────────────────────────────│
```

## Prisma Users Model

```prisma
enum Role { client seller admin }

model User {
  id                 String   @id @default(uuid())
  email              String   @unique
  name               String   @map("name")
  passwordHash       String   @map("password_hash")
  role               Role     @default(client)
  stripeCustomerId   String?  @map("stripe_customer_id")
  stripeAccountId    String?  @map("stripe_account_id")
  subscriptionStatus String?  @map("subscription_status")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  sessions           Session[]
  @@map("users")
}

model Session {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id])
  refreshHash String    @map("refresh_token_hash")
  accessJti   String    @map("access_jti") @unique
  expiresAt   DateTime  @map("expires_at")
  revokedAt   DateTime? @map("revoked_at")
  createdAt   DateTime  @default(now())
  @@index([userId])
  @@map("sessions")
}
```

## File Changes

| File | Action | Description |
|---|---|---|
| `app-escrowly-backend/package.json` | Create | fastify, zod, @fastify/swagger, @prisma/client, argon2, pino; dev: prisma, typescript, vitest, eslint, prettier |
| `app-escrowly-backend/src/server.ts` | Create | bootstrap listen |
| `app-escrowly-backend/src/app.ts` | Create | `buildApp()` registers plugins + modules |
| `app-escrowly-backend/src/config/env.ts` | Create | zod-validated env |
| `app-escrowly-backend/src/plugins/*.ts` | Create | envelope, JWT+revocation, correlation id, rate-limit (429) |
| `app-escrowly-backend/src/modules/auth/*` | Create | routes/service/schemas/Argon2id |
| `app-escrowly-backend/src/modules/users/*` | Create | profile read/update |
| `app-escrowly-backend/src/ports/*` + `adapters/prisma/*` | Create | ports + Prisma impl |
| `app-escrowly-backend/prisma/schema.prisma` | Create | `User`, `Session` |
| `app-escrowly-backend/docker-compose.yml` | Create | local Postgres |
| `app-escrowly-backend/openapi.yaml` | Create | contract baseline |

## Interfaces / Contracts

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | no |
| POST | `/auth/register` | no |
| POST | `/auth/login` | no |
| POST | `/auth/logout` | yes |
| POST | `/auth/refresh` | refresh cookie |
| GET | `/users/me` | yes |
| PATCH | `/users/me` | yes |

Error envelope (all non-2xx): `{ "code", "message", "details"? }` where `code` ∈ `VALIDATION_ERROR, UNAUTHORIZED, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL` and `details` maps field→error.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Argon2id hash/verify, zod schemas, token encode/decode | Vitest, pure functions |
| Integration | Every route via `app.inject()`; envelope; auth rejection | `buildApp()` + test DB, truncate between tests |
| E2E | — | **Not applicable** (no frontend) |

## Migration / Rollout

Greenfield — **no migration required**. `docker-compose up` + `prisma migrate dev`; delete `app-escrowly-backend/` to roll back.

## Open Questions

- [x] Profile reads are unified on `GET /users/me`. `GET /auth/me` is NOT created. The `user-auth` "Current user" requirement is satisfied by `GET /users/me`.
- [x] Refresh-token TTL is **7 days, persistent** across browser restarts (rolling on rotation).
