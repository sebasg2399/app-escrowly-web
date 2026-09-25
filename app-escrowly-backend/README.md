# Escrowly Backend

API backend for Escrowly — a milestone-based escrow service for freelancers and clients.

## Prerequisites

- **Node.js** >= 20.12
- **pnpm** >= 10
- **Docker** + Docker Compose (local Postgres)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and adjust if needed
cp .env.example .env

# 3. Start Postgres (published on host port 5433)
docker compose up -d

# 4. Run Prisma migrations
pnpm prisma migrate dev

# 5. Start dev server
pnpm dev
```

The API runs at `http://localhost:3000`. Swagger UI at `http://localhost:3000/docs` (non-production).

## Scripts

| Script              | Description                                |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Start dev server with hot reload           |
| `pnpm test`         | Run test suite                             |
| `pnpm test:watch`   | Run tests in watch mode                    |
| `pnpm build`        | Compile TypeScript                         |
| `pnpm openapi`      | Generate `openapi.yaml` from route schemas |
| `pnpm lint`         | Run ESLint                                 |
| `pnpm format`       | Format code with Prettier                  |
| `pnpm format:check` | Check formatting without writing           |

## Testing

Tests use Vitest with `app.inject()` for route-level integration testing. A separate test database (`escrowly_test`) is used:

```bash
# Ensure the test DB exists (run once)
docker compose up -d
DATABASE_URL="postgresql://escrowly:escrowly@localhost:5433/escrowly_test" pnpm prisma migrate dev

# Run tests
pnpm test
```

> **Note**: Local Postgres is published on **port 5433** (not the default 5432) to avoid conflicts with a system PostgreSQL.

## Architecture

Modular monolith with domain-first organization:

```
src/
├── app.ts                      # buildApp() — registers plugins + modules
├── server.ts                   # bootstrap / listen
├── config/env.ts               # zod-validated environment
├── plugins/                    # cross-cutting concerns (auth, error envelope, logging, rate-limit)
├── ports/                      # repository interface contracts
├── adapters/prisma/            # Prisma implementations of ports
└── modules/
    ├── auth/                   # register, login, logout, refresh
    └── users/                  # GET/PATCH /users/me
```

## API Contract

The OpenAPI contract (`openapi.yaml`) is generated from zod schemas and committed to the repo. Regenerate after route changes:

```bash
pnpm openapi
```
