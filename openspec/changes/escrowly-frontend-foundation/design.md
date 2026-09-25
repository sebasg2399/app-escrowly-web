# Design: Escrowly Frontend Foundation

## Technical Approach

Greenfield scaffold of `app-escrowly-frontend/` (React + Vite + TS + Tailwind, pnpm), contract-first against `openapi.yaml`. Stitch tokens → CSS variables → Tailwind `@theme`; screens rebuilt as atomic React components (never pasted HTML). Auth: in-memory access token + httpOnly refresh cookie, silent restore/refresh.

## Architecture Decisions

| # | Decision | Option / tradeoff | Choice + rationale |
|---|----------|--------------------|--------------------|
| 1 | Router | React Router vs TanStack Router vs custom | **React Router v7 (library mode)**. Six routes; `<Navigate>` + `state.from` gives redirect-back free. TanStack type-safety pays off only at scale. |
| 2 | Server state | TanStack Query vs fetch+context | **TanStack Query**. Caching, dedupe, `invalidateQueries(["profile"])` after PATCH, loading/error/retry states. |
| 3 | Forms | react-hook-form+zod vs controlled | **react-hook-form + zod**. Mirrors backend schema; `setError` maps `details` to fields. Satisfies `rules.apply` (zod at boundary). |
| 4 | API types | openapi-typescript vs hand-written | **openapi-typescript** generates `types.generated.ts` from `openapi.yaml` (single source of truth) + thin typed `fetch` wrapper. Hand-written types drift. |
| 5 | Tailwind | v4 (CSS-first) vs v3 (config.js) | **v4** (`@tailwindcss/vite`). `@theme` maps tokens → CSS vars natively. |
| 6 | Auth state | store/context vs ad-hoc | **Module-scoped token + context for status/profile** (Interfaces). Token never in React state/storage. |
| 7 | CORS vs proxy | Vite proxy vs `@fastify/cors` | **Vite dev proxy, path-passthrough, no backend change.** Cookie `path="/auth"` + `sameSite=strict` makes cross-origin fragile; proxy = same-origin (cookies + strict work). Prod CORS deferred. |
| 8 | Testing | Vitest+RTL+MSW | **Vitest + Testing Library + MSW**; interceptor tested by counting refresh calls. |

> `rules.design` milestone state machine + funding/dispute/payout diagrams do not apply — those flows are out of scope.

## Folder Structure

```
app-escrowly-frontend/
├─ package.json  vite.config.ts  tsconfig.json  index.html  .env.example
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ routes/           index.tsx  AuthGuard.tsx  RootRedirect.tsx
│  ├─ pages/            LoginPage  RegisterPage  NotFoundPage
│  │  └─ app/           AppLayout  HomePage  ProfilePage
│  ├─ features/
│  │  ├─ auth/          auth-context.tsx  useAuth.ts  LoginForm  RegisterForm
│  │  └─ profile/       useProfile.ts  ProfileCard  ProfileEditForm
│  ├─ components/{atoms,molecules,organisms}/
│  │   atoms: Button Input Badge Spinner Skeleton
│  │   molecules: TextField Banner Toast
│  │   organisms: NavBar AppShell FullPageLoader
│  ├─ lib/api/          client.ts  errors.ts  types.generated.ts
│  ├─ lib/query-client.ts
│  ├─ styles/           index.css (@theme)  tokens.css (CSS vars)
│  └─ test/             setup.ts  mocks/handlers.ts
```

## Data Flow

**Boot restore:**

```
main.tsx → AuthProvider → status=loading → FullPageLoader
  → POST /auth/refresh ──200──▶ setAccessToken → GET /users/me → authed → /app
                        └─401─▶ guest → /login
```

**401 → silent refresh → retry (single-flight):**

```
request() → 401 → refreshOnce():
   refreshPromise exists? await it (coalesce)
   else: refreshPromise = POST /auth/refresh
        ├─200─▶ setAccessToken → retry original once
        └─401─▶ clearSession() → /login ("session expired")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app-escrowly-frontend/` (above) | Create | Full scaffold |
| `vite.config.ts` | Create | `@tailwindcss/vite` + proxy `/auth`,`/users`,`/health` → `:3000` (no rewrite) |
| `src/lib/api/types.generated.ts` | Create | Generated from `openapi.yaml` |
| backend | — | Unchanged |

## Interfaces / Contracts

```ts
type ApiError = { code: string; message: string; details?: Record<string, string[]> };

type Profile = { id: string; email: string; name: string;
  role: "client" | "seller" | "admin"; createdAt: string; updatedAt: string };

const api = {
  get<T>(path): Promise<T>;
  post<T>(path, body?): Promise<T>;
  patch<T>(path, body?): Promise<T>;
}; // credentials:"include"; 401 → refreshOnce() → retry once

type AuthStatus = "loading" | "authed" | "guest";
interface AuthStore {
  status: AuthStatus; profile: Profile | null;
  register({name,email,password}): Promise<void>;
  login({email,password}): Promise<void>;
  logout(): Promise<void>;   // POST /auth/logout → clear token → /login
  restore(): Promise<void>;  // boot silent refresh
} // token in module scope, never state/storage

VITE_API_URL=  // empty → same-origin (dev proxy); absolute in prod
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `errors.ts` mapping; zod schemas; token never persisted | Vitest |
| Integration | Interceptor: MSW 401-then-200 asserts exactly one `/auth/refresh` + one retry; concurrent 401s coalesce; refresh-fail clears session + redirects | Vitest + RTL + MSW |
| Integration | Register/login/logout/profile; 429 disables submit + banner; guard redirect-back | RTL + MSW |

## Migration / Rollout

Greenfield — no migration. Delete `app-escrowly-frontend/` to roll back; backend untouched.

## Open Questions

- [x] **Production CORS**: resolved — dev uses the Vite same-origin proxy; no backend change. Cross-origin production CORS (`sameSite=None` + origin allowlist) is deferred to a future change and is NOT a requirement of this change.
- [x] **Contract location**: resolved — generate types from the live `../app-escrowly-backend/openapi.yaml` to avoid drift.
