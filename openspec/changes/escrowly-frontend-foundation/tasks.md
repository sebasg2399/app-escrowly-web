# Tasks: Escrowly Frontend Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 3,000–4,000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 4 chained work units |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold + tokens + tooling | PR 1 | tsc/build/test pass |
| 2 | API + auth client | PR 2 | client, refresh, auth context; MSW tests |
| 3 | Shell + routing + profile | PR 3 | guard, states, profile; integration tests |
| 4 | Cleanup + hardening | PR 4 | lint/format, README, suite green |

## Phase 1: Scaffold

- [x] 1.1 Scaffold `app-escrowly-frontend/` (Vite react-ts, pnpm): package.json, tsconfig.json, index.html
- [x] 1.2 Configure `vite.config.ts`: `@tailwindcss/vite` + proxy `/auth`,`/users`,`/health` → `http://localhost:3000` (no rewrite)
- [x] 1.3 Add `src/styles/tokens.css` (Inter, indigo #4338CA/#5148d8, neutral #64748B, 8px radii) + `src/styles/index.css` `@theme`
- [x] 1.4 Add `.env.example` (`VITE_API_URL=` empty), ESLint + Prettier config
- [x] 1.5 Vitest: `src/test/setup.ts`, MSW server, `pnpm test`
- [x] 1.6 Create `components/{atoms,molecules,organisms}` shells (Button, Input, Badge, Spinner, Skeleton, TextField, Banner, Toast, NavBar, AppShell, FullPageLoader)

## Phase 2: API + Auth

- [x] 2.1 Add openapi-typescript script; generate `src/lib/api/types.generated.ts` from `../app-escrowly-backend/openapi.yaml`
- [x] 2.2 `src/lib/api/errors.ts`: non-2xx → `ApiError {code,message,details}`; unit tests
- [x] 2.3 `src/lib/api/client.ts`: get/post/patch, `credentials:"include"`, Bearer module token, 401 → single-flight refresh → retry once
- [x] 2.4 `src/features/auth/auth-context.tsx` + `useAuth.ts`: status loading/authed/guest; register/login/logout/restore; module-scope token
- [x] 2.5 `LoginForm.tsx` + `RegisterForm.tsx` (RHF+zod): `details`→field errors, 409→email, 401→non-field, 429→disable+banner
- [x] 2.6 Tests: token never persisted; 401s → one refresh; refresh-fail → clear + redirect

## Phase 3: Shell + Routing

- [x] 3.1 `src/routes/index.tsx` + `App.tsx`/`main.tsx`: `/login`,`/register`,`/app`,`/app/profile`,`*`; wrap QueryClientProvider + AuthProvider
- [x] 3.2 `AuthGuard.tsx` → `/login` + `state.from`; `RootRedirect.tsx`: `/` → `/app`|`/login`
- [x] 3.3 Global states: boot FullPageLoader (no protected flash); 404; session-expired → login+msg; 429 banner
- [x] 3.4 `AppLayout.tsx` + NavBar (logo, profile menu, logout); HomePage welcome

## Phase 4: Profile

- [x] 4.1 `src/features/profile/useProfile.ts` (TanStack Query `GET /users/me`, invalidate after PATCH)
- [x] 4.2 `ProfileCard.tsx`: name, email, role badge, member-since; no password
- [x] 4.3 `ProfileEditForm.tsx`: name-only, email/role disabled, zod, 400→inline error, success toast
- [x] 4.4 `ProfilePage.tsx`: view/edit toggle

## Phase 5: Tests

- [x] 5.1 `src/test/mocks/handlers.ts`: MSW for `/auth/*`, `/users/me`, `/health` (updated with PATCH /users/me)
- [x] 5.2 Auth: register 201→app, 400/409 inline; login 200→app, 401 non-field; logout→login; restore
- [x] 5.3 Profile: view, name-only edit, 400 inline, update persists
- [x] 5.4 Shell: root redirect, guard redirect-back, 404, session-expired, 429 lock, boot loader

## Phase 6: Cleanup

- [x] 6.1 Run ESLint + Prettier; fix violations
- [x] 6.2 `app-escrowly-frontend/README.md`: setup, env, proxy, scripts
- [x] 6.3 Verify: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`

## Phase 7: Verification gaps

Test-only slice closing the behavioral-coverage gaps surfaced by `verify-report.md` (12 new tests; 2 production bugs fixed minimally).

- [x] 7.1 Guard redirect-back (web-app-shell R2): guest → /app/profile → /login → after login lands on /app/profile (`router-behavior.test.tsx` > AuthGuard redirect-back)
- [x] 7.2 Boot does not render protected content (web-app-shell R3): loader is up, no protected page content while status=loading (`router-behavior.test.tsx` > Boot loader)
- [x] 7.3 Session-expired redirect + UI (web-app-shell R5, web-auth R7): protected 401 + refresh 401 → /login with "Your session expired…" banner (`router-behavior.test.tsx` > Session-expired redirect) — **fixed production bug**: `AuthGuard`'s `<Navigate>` was racing `AuthProvider`'s `navigate` and overwriting the state; refactored to thread `sessionExpiredMessage` through `AuthContext` and let `AuthGuard` own the navigation so the message survives.
- [x] 7.4 Login/Register/Logout navigation (web-auth R1/R4/R5): login → /app, register → /app, logout → /login (`router-behavior.test.tsx` > Login navigation)
- [x] 7.5 Register validation (web-auth R2): API `details` envelope → inline field errors, form values preserved (`router-behavior.test.tsx` > Register validation)
- [x] 7.6 Duplicate email (web-auth R3): 409 → inline error on the **email** field only (`router-behavior.test.tsx` > Duplicate email)
- [x] 7.7 Wrong credentials (web-auth R4): 401 → single non-field error, NOT session-expired (`router-behavior.test.tsx` > Wrong credentials)
- [x] 7.8 Rate limited (web-auth R8): 429 → exact banner text + submit hidden (`router-behavior.test.tsx` > Rate limited)
- [x] 7.9 Credentials included (web-api-client R3): every request (GET, PATCH, POST refresh) carries `credentials: "include"` (`client.test.ts` > credentials)
- [x] 7.10 Profile R2/R4: role is not editable in the edit form, and after PATCH the view reflects the **refetched** persisted name (`router-behavior.test.tsx` > Profile R2/R4)
- [x] 7.11 StrictMode single boot refresh (regression): exactly one `POST /auth/refresh` on boot under `<StrictMode>` (`router-behavior.test.tsx` > StrictMode single boot refresh)
- [x] 7.12 CSS `@theme` spacing guard (regression): `src/styles/index.css` MUST NOT declare custom `--spacing-*` keys (the cause of the `max-w-md` = 24px layout bug) (`theme-guard.test.ts`)

**Production bugs found and fixed (called out in PR):**

1. **`LoginPage.tsx`** read `window.history.state?.usr?.sessionExpiredMessage`. Under memory router (and any router that does not sync to `window.history`) this is always `null` and the banner never renders. Fixed by reading from `useLocation().state` instead. Caught by 7.3.
2. **`AuthGuard.tsx` + `auth-context.tsx`** — the session-expired callback in `AuthProvider` called `navigate("/login", { state: { sessionExpiredMessage } })`, then `AuthGuard` rendered `<Navigate to="/login" state={{ from: location }}>` on the next render; the second navigation overwrote the first, dropping the message. Refactored: `AuthProvider` now only updates `AuthContext.sessionExpiredMessage`; `AuthGuard` reads it and includes it in its own `Navigate` state. The message is cleared on every successful login/register/restore. Caught by 7.3.