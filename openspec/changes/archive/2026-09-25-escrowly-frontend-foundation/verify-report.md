# Verification Report

**Change**: escrowly-frontend-foundation
**Version**: N/A (openspec delta specs, no version field)
**Mode**: Standard (strict_tdd: false — `openspec/config.yaml`)
**Artifact store**: openspec
**Verified at**: 2026-09-25
**Verified commit**: `d7e9ddd` (Merge PR #11 `test/frontend-verify-gaps`) — working tree clean
**Scope verified**: `app-escrowly-frontend/` (backend out of scope — CORS capability dropped in favor of Vite same-origin proxy)
**Re-verified after**: PR #11 test-hardening (commit `2f81d57`) that closed the gaps in the previous report

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 39 |
| Tasks complete | 39 |
| Tasks incomplete | 0 |

All checkboxes in `tasks.md` are `[x]` (Phases 1–7, tasks 1.1–7.12). No incomplete tasks. Phase 7 ("Verification gaps") adds 12 tasks on top of the original 27; all were shipped in PR #11.

---

## Build & Tests Execution

**Typecheck**: ✅ Passed — `pnpm typecheck` (`tsc -b --noEmit`), exit 0, no diagnostics.

**Build**: ✅ Passed — `pnpm build` (`tsc -b && vite build`), exit 0. 1843 modules transformed, built in 2.75s.
```
dist/index.html                   0.67 kB │ gzip:   0.37 kB
dist/assets/index-CoPNRfor.css   19.55 kB │ gzip:   4.51 kB
dist/assets/index-DlTuhzuH.js   534.67 kB │ gzip: 165.33 kB
(!) Some chunks are larger than 500 kB after minification. (non-blocking warning)
```
Only bundler warnings come from third-party `zod` `@__PURE__` comments positioned where Rollup cannot interpret them.

**Tests**: ✅ 50 passed / ❌ 0 failed / ⚠️ 0 skipped — `pnpm test` (`vitest run`), exit 0, 8 files, duration 3.13s.

| Test file | Tests |
|-----------|-------|
| `src/styles/theme-guard.test.ts` | 1 |
| `src/lib/api/errors.test.ts` | 6 |
| `src/lib/api/client.test.ts` | 13 |
| `src/App.test.tsx` | 1 |
| `src/features/auth/auth-context.test.tsx` | 6 |
| `src/router.test.tsx` | 1 |
| `src/shell-and-profile.test.tsx` | 9 |
| `src/router-behavior.test.tsx` | 13 |
| **Total** | **50** |

PR #11 added 15 tests (35 → 50): 13 in `router-behavior.test.tsx`, 1 in `theme-guard.test.ts`, 1 in `client.test.ts`.

Note: `auth-context.test.tsx` still emits `The current testing environment is not configured to support act(...)` to stderr on several tests. Tests still pass; see SUGGESTION-3.

**Lint**: ✅ Passed — `pnpm lint` (`eslint .`), exit 0, no violations.

**Format**: ✅ Passed — `pnpm format:check`, "All matched files use Prettier code style!".

**Coverage**: ➖ Not available — no coverage tool configured in `package.json` and no `rules.verify.coverage_threshold` in `openspec/config.yaml`.

---

## Spec Compliance Matrix

A scenario is COMPLIANT only when a passing test proves the behavior at runtime. Static code presence alone is not counted as compliance.

### web-app-shell

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Public and protected route structure | Root redirect | `shell-and-profile.test.tsx` > "RootRedirect > redirects authed user from / to /app" + "redirects guest from / to /login" | ✅ COMPLIANT |
| R2 Auth guard redirects unauthenticated access | Protected route without session | `shell-and-profile.test.tsx` > "AuthGuard — redirect to login > redirects guest visiting /app/profile to /login" (+ `router-behavior.test.tsx` round-trip proves intended path was remembered) | ✅ COMPLIANT |
| R2 Auth guard redirects unauthenticated access | Return to intended path after login | `router-behavior.test.tsx` > "AuthGuard redirect-back (web-app-shell R2) > redirects a guest from /app/profile to /login, then returns to /app/profile after login" | ✅ COMPLIANT |
| R3 Global loading state during session restore | Boot shows loader until restore resolves | `shell-and-profile.test.tsx` > "Boot loader > shows loader while status is loading" + `router-behavior.test.tsx` > "Boot loader (web-app-shell R3) > shows the loader while status is loading and does not flash protected content" | ✅ COMPLIANT |
| R4 Unknown route renders not-found state | Unknown path | `shell-and-profile.test.tsx` > "NotFound > renders 404 for unknown path" | ✅ COMPLIANT |
| R5 Session-expired state | Expired session redirects with message | `router-behavior.test.tsx` > "Session-expired redirect (web-app-shell R5, web-auth R7) > redirects to /login AND renders 'Your session expired. Please sign in again.'" | ✅ COMPLIANT |

### web-auth

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Registration | Successful registration lands in app | `router-behavior.test.tsx` > "Login navigation (web-auth R1/R4/R5) > successful register navigates to /app" + `auth-context.test.tsx` > "register > sets authed status and profile on success" | ✅ COMPLIANT |
| R2 Registration validation errors | Invalid registration shows field errors | `router-behavior.test.tsx` > "Register validation (web-auth R2) > renders inline field errors from the API details envelope AND keeps form values" | ✅ COMPLIANT |
| R3 Duplicate email | Duplicate email on register | `router-behavior.test.tsx` > "Duplicate email (web-auth R3) > renders the duplicate-email error on the EMAIL field only" | ✅ COMPLIANT |
| R4 Login | Successful login lands in app | `router-behavior.test.tsx` > "Login navigation (web-auth R1/R4/R5) > successful login navigates to /app" + `auth-context.test.tsx` > "login > sets authed status and profile on success" | ✅ COMPLIANT |
| R4 Login | Wrong credentials show non-field error | `router-behavior.test.tsx` > "Wrong credentials (web-auth R4) > login 401 shows a single non-field error that is NOT the session-expired message" | ✅ COMPLIANT |
| R5 Logout | Logout clears session and returns to login | `router-behavior.test.tsx` > "Login navigation (web-auth R1/R4/R5) > logout navigates to /login" + `auth-context.test.tsx` > "logout > clears session and sets guest status" | ✅ COMPLIANT |
| R6 Silent session restore on boot | Restore with valid refresh cookie | `auth-context.test.tsx` > "restore > transitions to authed on successful refresh + profile fetch" | ✅ COMPLIANT |
| R6 Silent session restore on boot | Restore without refresh cookie | `auth-context.test.tsx` > "restore > transitions to guest when refresh fails (401)" | ✅ COMPLIANT |
| R7 Silent refresh on 401 | 401 triggers refresh and retry | `client.test.ts` > "401 → refresh → retry > triggers exactly one refresh and retries the original request" | ✅ COMPLIANT |
| R7 Silent refresh on 401 | Failed refresh hard-fails to login | `router-behavior.test.tsx` > "Session-expired redirect (web-app-shell R5, web-auth R7)" + `client.test.ts` > "refresh failure > clears session and throws SESSION_EXPIRED on refresh 401" | ✅ COMPLIANT |
| R8 Rate-limited auth | 429 disables submit and shows banner | `router-behavior.test.tsx` > "Rate limited (web-auth R8) > login 429 shows the rate-limit banner and hides/disables the submit control" | ✅ COMPLIANT (see WARNING-2) |

### web-profile

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Profile view | Profile shows allowed fields | `shell-and-profile.test.tsx` > "Profile view > shows name, email, role, member-since and omits password" | ✅ COMPLIANT |
| R2 Edit restricted to name | Email and role are non-editable | `router-behavior.test.tsx` > "Profile R2/R4 > role is not editable via the edit form (no role input, role rendered as read-only span)" + `shell-and-profile.test.tsx` > "Profile edit > edits name only, email and role are disabled" | ✅ COMPLIANT |
| R3 Name validation errors | Invalid name shows inline error | `shell-and-profile.test.tsx` > "Profile edit > shows inline error for empty name" + "shows inline error for 400 API response" | ✅ COMPLIANT |
| R4 Successful profile update | Name update persists and confirms | `router-behavior.test.tsx` > "Profile R2/R4 > after a successful PATCH the view reflects the persisted name (refetched, not just the toast)" | ✅ COMPLIANT |

### web-api-client

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Typed client from OpenAPI contract | Client types match contract | `pnpm typecheck` (compile-time; `types.generated.ts` generated from `../app-escrowly-backend/openapi.yaml` and consumed by client/query/components; no runtime test) | ✅ COMPLIANT (compile-time evidence) |
| R2 Access token in memory only | Token never persisted | `client.test.ts` > "token management > never writes token to localStorage or sessionStorage" | ✅ COMPLIANT |
| R3 Requests include credentials | Requests send credentials | `client.test.ts` > "credentials (web-api-client R3) > sends credentials: 'include' on every request (GET / POST refresh)" — credentials proven for GET/POST/PATCH, but "MUST target the configured API origin" is NOT asserted | ⚠️ PARTIAL |
| R4 Error envelope mapping | Non-2xx maps to envelope | `errors.test.ts` > "toApiError > maps a backend error envelope" + `client.test.ts` > "error mapping > throws ApiError with details on 400 / status 409 / status 429" | ✅ COMPLIANT |
| R5 Single in-flight refresh | Concurrent 401s share one refresh | `client.test.ts` > "401 → refresh → retry > coalesces concurrent 401s into a single refresh" | ✅ COMPLIANT |

**Compliance summary**: 25/26 scenarios fully compliant · 1 PARTIAL · 0 UNTESTED · 0 FAILING.

Additional (beyond-spec) behavior confirmed: `client.test.ts` > "refresh scope > does NOT trigger a refresh on a 401 from an auth endpoint" — ✅ COMPLIANT and passing.

**Delta vs previous report** (baseline: 11 COMPLIANT / 9 PARTIAL / 6 UNTESTED / 0 FAILING):

| Previously | Now |
|-----------|-----|
| 6 UNTESTED | 0 UNTESTED |
| 9 PARTIAL | 1 PARTIAL |
| 11 COMPLIANT | 25 COMPLIANT |

All five previously-identified UNTESTED scenario expectations are resolved except the origin half of `web-api-client R3` (credentials proven, origin not). All nine previously-PARTIAL scenarios are now fully proven (see below).

---

## Production-bug coverage (PR #11 claim check)

The two latent bugs fixed alongside the tests are genuinely covered by a passing test:

| Bug | Fix location | Covering test | Status |
|-----|--------------|---------------|--------|
| Session-expired message read from `window.history.state?.usr` (always `null` under a memory router → banner never rendered) | `LoginPage.tsx` now reads `useLocation().state?.sessionExpiredMessage` | `router-behavior.test.tsx` > "Session-expired redirect … renders 'Your session expired. Please sign in again.'" | ✅ Proven |
| `AuthGuard`'s `<Navigate to="/login" state={{ from }}>` overwrote `AuthProvider`'s `navigate` state, dropping the message | `auth-context.tsx` stores `sessionExpiredMessage` in context; `AuthGuard.tsx` threads it into its own `Navigate` state; cleared on successful login/register/restore | same `router-behavior.test.tsx` test (message survives the guard redirect and renders on `/login`) | ✅ Proven |

Both fixes are minimal and localized; no unrelated behavior changed.

## Regression-test coverage (PR #11 claim check)

| Runtime bug | Regression test | Status |
|-------------|-----------------|--------|
| Double `/auth/refresh` on boot under StrictMode | `router-behavior.test.tsx` > "StrictMode single boot refresh (regression) > fires exactly one POST /auth/refresh on boot in StrictMode" | ✅ Passes |
| `@theme` custom `--spacing-*` keys clobbering `max-w-md` (layout bug) | `theme-guard.test.ts` > "styles/index.css @theme token contract > does not declare custom --spacing-* keys" | ✅ Passes |

All three previously-uncovered runtime-bug fixes from `d31b509` now have dedicated regression tests (the body-less POST fix already had one).

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| web-app-shell R1 route structure | ✅ Implemented | `routes/routes.tsx` declares `/`, `/login`, `/register`, `/app` (guard → layout → index/profile), `*`. |
| web-app-shell R2 auth guard | ✅ Implemented | `AuthGuard.tsx` → `/login` with `state={{ from, sessionExpiredMessage? }}`; `LoginPage`'s `PostLoginRedirect` reads `state.from.pathname` and navigates back. Behavior proven. |
| web-app-shell R3 boot loader | ✅ Implemented | `AuthGuard`/`RootRedirect` render `FullPageLoader` while `status === "loading"`; boot restore guarded by `calledRef` in `RootProviders.tsx`. No-flash proven. |
| web-app-shell R4 not-found | ✅ Implemented | `NotFoundPage` renders 404, message, and `<Link to="/app">Go back home</Link>`. |
| web-app-shell R5 session-expired | ✅ Implemented | `client.ts` calls `onSessionExpired(msg)`; `auth-context.tsx` stores message + sets guest; `AuthGuard` handles navigation; `LoginPage` renders message. Proven end-to-end. |
| web-auth R1 registration | ✅ Implemented | `auth-context.register` POSTs, sets in-memory token, loads `/users/me`, status authed; `PostRegisterRedirect` navigates `/app`. Proven. |
| web-auth R2 register validation | ✅ Implemented | `RegisterForm` maps `err.details` to `setError(field, …)`; values preserved (RHF). Proven. |
| web-auth R3 duplicate email | ✅ Implemented | `RegisterForm` maps `409` to `setError("email", …)`. Proven. |
| web-auth R4 login | ✅ Implemented | `login()` sets token + profile; `LoginForm` maps non-429/`isApiError` to a single non-field `Banner`; auth paths excluded from refresh so 401 surfaces as non-field. Proven. |
| web-auth R5 logout | ✅ Implemented | `logout()` POSTs `/auth/logout`, then `clearSession()`, profile null, guest; `AppLayout.handleLogout` navigates `/login`. Proven. |
| web-auth R6 silent restore | ✅ Implemented | `RootProviders.BootRestore` calls `restore()` once (ref guard); `restore()` POSTs `/auth/refresh` then `GET /users/me`. Proven. |
| web-auth R7 silent refresh | ✅ Implemented | `client.ts` 401 → `refreshOnce()` → retry once; refresh failure throws typed `SESSION_EXPIRED` + clears + `onSessionExpired`. Auth paths excluded via `AUTH_PATHS`. Proven. |
| web-auth R8 rate-limited auth | ✅ Implemented | `RegisterForm`/`LoginForm` set `rateLimited` on `status === 429` and render the warning banner with exact required text; inputs `disabled` and the submit button is `disabled`/replaced. Proven. |
| web-profile R1 view | ✅ Implemented | `ProfileCard` shows name, email, role `Badge`, member-since; no password field rendered. |
| web-profile R2 edit restricted | ✅ Implemented | `ProfileEditForm` edits name only; email `disabled`; role rendered as `<span>`; `useUpdateProfileName` sends only `{ name }`. Proven. |
| web-profile R3 name validation | ✅ Implemented | `profileNameSchema` min(1)/max(100); `ProfileEditForm` maps 400 `details` to inline name error. Proven. |
| web-profile R4 update persists | ✅ Implemented | `useUpdateProfileName` PATCHes `/users/me` then `invalidateQueries(["profile"])`; success `Toast`; refetch reflects persisted name. Proven. |
| web-api-client R1 typed contract | ✅ Implemented | `types.generated.ts` header marks `openapi-typescript`; `gen:api` script points at `../app-escrowly-backend/openapi.yaml`; types consumed with passing `tsc`. |
| web-api-client R2 in-memory token | ✅ Implemented | `accessToken` is a module-scoped `let` in `client.ts`; no `localStorage`/`sessionStorage` write anywhere in `src/`. Proven. |
| web-api-client R3 credentials | ✅ Implemented | Every `fetch` in `client.ts` (`doRefresh` and `request`) sets `credentials: "include"`; `buildUrl` targets `VITE_API_URL` when set. Credentials half proven; origin half not asserted. |
| web-api-client R4 error envelope | ✅ Implemented | `toApiError` maps `{code,message,details}`; fallback `HTTP_{status}`; `networkError` for fetch `TypeError`. Proven. |
| web-api-client R5 single-flight refresh | ✅ Implemented | `refreshPromise` module-scoped; `refreshOnce` returns the in-flight promise and clears in `finally`. Proven. |

No missing implementation found. The sole remaining gap is behavioral proof of the configured-origin clause, not an absent feature.

---

## Coherence (Design)

| Decision / Design artifact | Followed? | Notes |
|----------------------------|-----------|-------|
| D1 Router: React Router (library mode); `<Navigate>` + `state.from` | ⚠️ Deviated | Library mode used, `Navigate`/`state.from` implemented, but dependency is `react-router@^8.4.0` — design says v7. Version bump beyond design; behavior consistent. |
| D2 Server state: TanStack Query | ✅ Yes | `@tanstack/react-query@^5`; `query-client.ts`, `useProfile` + `invalidateQueries(["profile"])`. |
| D3 Forms: react-hook-form + zod | ✅ Yes | `@hookform/resolvers`, `react-hook-form`, `zod`; schemas at boundary; `setError` maps `details`. |
| D4 API types: openapi-typescript generated | ✅ Yes | `gen:api` script + `types.generated.ts` from backend `openapi.yaml`. |
| D5 Tailwind v4 CSS-first `@theme` | ✅ Yes | `@tailwindcss/vite`, `@theme` in `styles/index.css` maps tokens → CSS vars. Now guarded by `theme-guard.test.ts`. |
| D6 Auth state: module token + context for status/profile | ✅ Yes | Token module-scoped in `client.ts`; `AuthContext` holds status/profile; `sessionExpiredMessage` added to context to carry the message across the guard redirect. Token never in React state/storage. |
| D7 CORS vs proxy: Vite dev proxy path-passthrough, no backend change | ✅ Yes | `vite.config.ts` proxies `/auth`,`/users`,`/health` → `:3000` via `changeOrigin`, no rewrite. Backend untouched. Prod CORS correctly deferred/out of scope. |
| D8 Testing: Vitest + RTL + MSW | ✅ Yes | All three present; behavioral tests now drive the real route tree via `createMemoryRouter(appRoutes)`; interceptor tested by counting refresh calls. |
| Folder structure: `src/main.tsx App.tsx` | ⚠️ Deviated | `App.tsx` absent; composition root is `routes/index.tsx` (`createBrowserRouter`) + `routes/routes.tsx` + `routes/RootProviders.tsx`. Benign split. |
| Folder structure: `src/styles/tokens.css` | ⚠️ Deviated | No separate `tokens.css`; tokens live in `index.css` `@theme`. Benign. |
| File changes table: `vite.config.ts`, `types.generated.ts`, backend unchanged | ✅ Yes | All match. |
| Data flow: boot restore + single-flight 401 refresh | ✅ Yes | Matches design sequence; `AUTH_PATHS` exclusion is an added safeguard; session-expired now flows through context instead of a second navigation. |
| Testing strategy: unit `errors.ts`, zod, token-not-persisted | ⚠️ Partial | `errors.ts` ✅, token-not-persisted ✅; zod schemas still have no direct unit tests (covered indirectly by form integration tests). |
| Testing strategy: interceptor (one refresh + retry, coalesce, refresh-fail) | ✅ Yes | One-refresh+retry ✅, coalesce ✅, refresh-fail clear + redirect ✅. |
| Testing strategy: register/login/logout/profile; 429 disable+banner; guard redirect-back | ✅ Yes | All now covered by `router-behavior.test.tsx`. |
| Open Question: prod CORS deferred | ✅ Yes | No backend CORS; proxy only. |

---

## Issues Found

**CRITICAL** (must fix before archive):
None. No failing tests, no build/typecheck/lint/format errors, and no missing requirement implementation.

**WARNING** (should fix):
1. **One spec scenario remains PARTIAL** — `web-api-client R3` "Requests send credentials": `client.test.ts` proves `credentials: "include"` on GET/POST/PATCH, but the scenario's second clause "MUST target the configured API origin" has no test. `buildUrl()` reads `VITE_API_URL`, and no test sets/asserts it, so the origin-selection branch is unproven. This is the only remaining behavioral gap.
2. **`web-auth R8` submit handling is "hidden", not "disabled in place"** — when `rateLimited` is true, both `LoginForm` and `RegisterForm` early-return the banner instead of rendering the form, so the submit button is removed entirely rather than rendered with `disabled`. This satisfies the requirement's intent ("disable the submit action") and the test asserts the button is absent, but it is not literally a disabled button. If a future reviewer reads the scenario literally, consider keeping the button mounted with `disabled`.
3. **`act(...)` environment warnings persist.** `auth-context.test.tsx` still prints `The current testing environment is not configured to support act(...)` to stderr on several tests; tests pass but the warnings could mask future flakiness. (Carried over from the previous report.)
4. **Design coherence deviations** (benign but should be acknowledged): `react-router` v8 vs design's v7; design-listed `App.tsx` and `styles/tokens.css` do not exist as such.

**SUGGESTION** (nice to have):
1. Add a test that asserts the configured API origin is used (e.g., stub `VITE_API_URL` and assert the captured `request.url` starts with it), which would close the last PARTIAL scenario.
2. Add a contract assertion that `types.generated.ts` matches the current `openapi.yaml` (e.g., re-run `gen:api` in CI and fail on diff), since R1 compliance rests on compile-time evidence only.
3. Configure the test environment / wrap updates to silence the `act(...)` warnings.
4. Production bundle is 534.67 kB (>500 kB Rollup warning); consider route-level code splitting.
5. Third-party `zod` `@__PURE__` comment warnings appear during build; no action needed in this repo.

---

## Notes on Required Focus Areas

| Focus behavior | Evidence | Status |
|----------------|----------|--------|
| Token never persisted to storage | `client.test.ts` > "never writes token to localStorage or sessionStorage" (spies `Storage.prototype.setItem`); no storage writes in `src/` | ✅ Proven |
| Single-flight refresh coalescing | `client.test.ts` > "coalesces concurrent 401s into a single refresh" (3 concurrent 401s → 1 refresh) | ✅ Proven |
| Refresh NOT triggered on auth endpoints | `client.test.ts` > "refresh scope > does NOT trigger a refresh on a 401 from an auth endpoint" | ✅ Proven |
| Guard redirect-back to intended path | `router-behavior.test.tsx` > guest `/app/profile` → `/login` → login → `/app/profile` | ✅ Proven |
| Session-expired redirect + message | `router-behavior.test.tsx` > `/login` + "Your session expired. Please sign in again." | ✅ Proven |
| Login/Register/Logout navigation | `router-behavior.test.tsx` > login → `/app`, register → `/app`, logout → `/login` | ✅ Proven |
| Boot does not flash protected content | `router-behavior.test.tsx` > loader present, `profile-name` / "Test User" absent while loading | ✅ Proven |
| Profile role non-editable + persisted name | `router-behavior.test.tsx` > no role input, email disabled; refetched name reflected after PATCH | ✅ Proven |
| StrictMode single boot refresh | `router-behavior.test.tsx` > exactly one `POST /auth/refresh` | ✅ Proven |
| `@theme` has no custom `--spacing-*` | `theme-guard.test.ts` | ✅ Proven |
| Requests target the configured API origin | No test asserts `VITE_API_URL`/`buildUrl` origin | ❌ Not proven (PARTIAL) |

---

## Verdict

**PASS WITH WARNINGS**

All 39 tasks are complete; `pnpm typecheck`, `pnpm test` (50/50), `pnpm build`, `pnpm lint`, and `pnpm format:check` all pass. The behavioral-coverage gaps from the previous verification are closed: **0 UNTESTED** (was 6), **1 PARTIAL** (was 9), **0 FAILING**, **25/26 scenarios COMPLIANT**. Both latent production bugs fixed in PR #11 are genuinely covered, and all three previously-uncovered runtime-bug fixes now have passing regression tests. The only remaining gap is the origin half of `web-api-client R3` ("MUST target the configured API origin"), which is a test-assertion gap, not a production defect. No CRITICAL issue was found. Recommend adding the origin assertion and (optionally) the `act(...)` cleanup before archive — neither blocks.
