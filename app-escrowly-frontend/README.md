# Escrowly Frontend

Web app for Escrowly — milestone-based escrow for freelancers and clients. This is the buildable-now slice: app shell, authentication (register, login, logout, silent session restore) and the user profile.

## Prerequisites

- **Node.js** >= 20.12
- **pnpm** >= 10
- The backend running at `http://localhost:3000` (see `../app-escrowly-backend/README.md`)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env template
cp .env.example .env

# 3. Make sure the backend is up (in another terminal)
#    cd ../app-escrowly-backend && pnpm dev

# 4. Start the dev server
pnpm dev
```

The app runs at `http://localhost:5173`.

## How the API is reached (dev proxy)

The Vite dev server proxies `/auth`, `/users` and `/health` to `http://localhost:3000` **without rewriting the path**. This keeps the browser same-origin, which matters because the refresh token lives in an `httpOnly` cookie scoped to `path=/auth` with `SameSite=Strict` — cross-origin cookies of that shape are fragile. Because of the proxy, no backend CORS is needed in development.

`VITE_API_URL` is empty by default (same-origin). Set it to an absolute URL only if you need to point at a different API origin.

## Scripts

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Start the dev server (with the API proxy)          |
| `pnpm build`        | Type-check and build for production                |
| `pnpm preview`      | Preview the production build                       |
| `pnpm test`         | Run the test suite (Vitest)                        |
| `pnpm test:watch`   | Run tests in watch mode                            |
| `pnpm typecheck`    | Type-check without emitting                        |
| `pnpm lint`         | Run ESLint                                         |
| `pnpm lint:fix`     | Run ESLint and fix                                 |
| `pnpm format`       | Format with Prettier                               |
| `pnpm format:check` | Check formatting                                   |
| `pnpm gen:api`      | Regenerate API types from the backend OpenAPI file |

## Architecture

Atomic design plus feature modules, contract-first against the backend OpenAPI spec.

```
src/
├─ main.tsx                 # entry: QueryClientProvider + RouterProvider
├─ routes/                  # route config, RootProviders, AuthGuard, RootRedirect
├─ pages/                   # route screens (Login, Register, NotFound, app/*)
├─ features/
│  ├─ auth/                 # AuthProvider, useAuth, forms, zod schemas
│  └─ profile/              # useProfile (TanStack Query), ProfileCard, ProfileEditForm
├─ components/              # atoms, molecules, organisms (design-system components)
├─ lib/
│  ├─ api/                  # typed client, error mapping, generated types
│  └─ query-client.ts
└─ styles/index.css         # Tailwind v4 @theme with the design tokens
```

Notes:

- **Design tokens** live in `src/styles/index.css` under Tailwind v4 `@theme` (Inter, indigo primary, 8px radii, semantic colors). This is the single source of truth for tokens.
- **API types** are generated from `../app-escrowly-backend/openapi.yaml` (`pnpm gen:api`) and committed. Do not hand-write response shapes.
- **Auth model**: the access token is kept **in memory only** (never `localStorage`/`sessionStorage`); the refresh token is an `httpOnly` cookie. On boot the app calls `POST /auth/refresh` once; on a `401` from a protected request it performs a single-flight silent refresh and retries once.
- **Session expiry**: a failed refresh transitions to guest and routes to `/login` with a message.

## Testing

Tests run with Vitest + Testing Library and mock the API with MSW.

```bash
pnpm test
```
