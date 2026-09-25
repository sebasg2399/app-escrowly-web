# Verification Report

**Change**: escrowly-frontend-foundation
**Version**: N/A (openspec delta specs, no version field)
**Mode**: Standard (strict_tdd: false — `openspec/config.yaml`)
**Artifact store**: openspec
**Verified at**: 2026-09-25
**Scope verified**: `app-escrowly-frontend/` (backend out of scope — CORS capability dropped in favor of Vite same-origin proxy)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 27 |
| Tasks complete | 27 |
| Tasks incomplete | 0 |

All checkboxes in `tasks.md` are `[x]` (Phases 1–6, tasks 1.1–6.3). No incomplete tasks.

---

## Build & Tests Execution

**Typecheck**: ✅ Passed — `pnpm typecheck` (`tsc -b --noEmit`), exit 0, no diagnostics.

**Build**: ✅ Passed — `pnpm build` (`tsc -b && vite build`), exit 0. 1843 modules transformed, built in 3.50s.
```
dist/index.html                   0.67 kB │ gzip:   0.37 kB
dist/assets/index-seNLN_tY.css   19.53 kB │ gzip:   4.50 kB
dist/assets/index-CwcTE_fH.js   534.66 kB │ gzip: 165.33 kB
(!) Some chunks are larger than 500 kB after minification. (non-blocking warning)
```
Project own code emits no build errors; the only bundler warnings come from third-party `zod` `@__PURE__` comments positioned where Rollup cannot interpret them.

**Tests**: ✅ 35 passed / ❌ 0 failed / ⚠️ 0 skipped — `pnpm test` (`vitest run`), exit 0, 6 files, duration 2.63s.

| Test file | Tests |
|-----------|-------|
| `src/lib/api/errors.test.ts` | 6 |
| `src/lib/api/client.test.ts` | 12 |
| `src/features/auth/auth-context.test.tsx` | 6 |
| `src/App.test.tsx` | 1 |
| `src/router.test.tsx` | 1 |
| `src/shell-and-profile.test.tsx` | 9 |

Note: `auth-context.test.tsx` emits `The current testing environment is not configured to support act(...)` to stderr on several tests. Tests still pass; see SUGGESTION-3.

**Lint**: ✅ Passed — `pnpm lint` (`eslint .`), exit 0, no violations.

**Format**: ✅ Passed — `pnpm format:check`, "All matched files use Prettier code style!".

**Coverage**: ➖ Not available — no coverage tool configured in `package.json` and no `rules.verify.coverage_threshold` in `openspec/config.yaml`.

---

## Spec Compliance Matrix

A scenario is COMPLIANT only when a passing test proves the behavior at runtime. Static code presence alone is not counted as compliance.

### web-app-shell

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Public and protected route structure | Root redirect | `shell-and-profile.test.tsx` > "RootRedirect > redirects authed user from / to /app" + "RootRedirect > redirects guest from / to /login" | ✅ COMPLIANT |
| R2 Auth guard redirects unauthenticated access | Protected route without session | `shell-and-profile.test.tsx` > "AuthGuard — redirect to login > redirects guest visiting /app/profile to /login" (redirect proven; "MUST remember /app/profile as intended path" not asserted) | ⚠️ PARTIAL |
| R2 Auth guard redirects unauthenticated access | Return to intended path after login | (none found) | ❌ UNTESTED |
| R3 Global loading state during session restore | Boot shows loader until restore resolves | `shell-and-profile.test.tsx` > "Boot loader > shows loader while status is loading" (loader proven; "MUST NOT render protected content" not asserted) | ⚠️ PARTIAL |
| R4 Unknown route renders not-found state | Unknown path | `shell-and-profile.test.tsx` > "NotFound > renders 404 for unknown path" | ✅ COMPLIANT |
| R5 Session-expired state | Expired session redirects with message | `client.test.ts` > "refresh failure > clears session and throws SESSION_EXPIRED on refresh 401" (session clear + message string proven; redirect to `/login` + UI message not exercised) | ⚠️ PARTIAL |

### web-auth

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Registration | Successful registration lands in app | `auth-context.test.tsx` > "register > sets authed status and profile on success" (authed + in-memory token proven; navigate to `/app` not asserted) | ⚠️ PARTIAL |
| R2 Registration validation errors | Invalid registration shows field errors | (none found — no RegisterForm integration test) | ❌ UNTESTED |
| R3 Duplicate email | Duplicate email on register | (none found — 409 mapping is tested at client level, form inline error is not) | ❌ UNTESTED |
| R4 Login | Successful login lands in app | `auth-context.test.tsx` > "login > sets authed status and profile on success" (authed + token proven; navigate to `/app` not asserted) | ⚠️ PARTIAL |
| R4 Login | Wrong credentials show non-field error | (none found — no LoginForm 401 test) | ❌ UNTESTED |
| R5 Logout | Logout clears session and returns to login | `auth-context.test.tsx` > "logout > clears session and sets guest status" (clear + guest proven; navigate to `/login` not asserted) | ⚠️ PARTIAL |
| R6 Silent session restore on boot | Restore with valid refresh cookie | `auth-context.test.tsx` > "restore > transitions to authed on successful refresh + profile fetch" | ✅ COMPLIANT |
| R6 Silent session restore on boot | Restore without refresh cookie | `auth-context.test.tsx` > "restore > transitions to guest when refresh fails (401)" | ✅ COMPLIANT |
| R7 Silent refresh on 401 | 401 triggers refresh and retry | `client.test.ts` > "401 → refresh → retry > triggers exactly one refresh and retries the original request" | ✅ COMPLIANT |
| R7 Silent refresh on 401 | Failed refresh hard-fails to login | `client.test.ts` > "refresh failure > clears session and throws SESSION_EXPIRED on refresh 401" (clear + error proven; redirect via `registerOnSessionExpired` not asserted) | ⚠️ PARTIAL |
| R8 Rate-limited auth | 429 disables submit and shows banner | (none found — 429 status mapping tested at client level; form disable + banner text not tested) | ❌ UNTESTED |

### web-profile

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Profile view | Profile shows allowed fields | `shell-and-profile.test.tsx` > "Profile view > shows name, email, role, member-since and omits password" | ✅ COMPLIANT |
| R2 Edit restricted to name | Email and role are non-editable | `shell-and-profile.test.tsx` > "Profile edit > edits name only, email and role are disabled" (email disabled asserted; role rendered as non-input `<span>` so it is non-editable by construction, but no explicit role assertion) | ⚠️ PARTIAL |
| R3 Name validation errors | Invalid name shows inline error | `shell-and-profile.test.tsx` > "Profile edit > shows inline error for empty name" + "shows inline error for 400 API response" | ✅ COMPLIANT |
| R4 Successful profile update | Name update persists and confirms | `shell-and-profile.test.tsx` > "Profile edit > edits name only, email and role are disabled" (confirmation toast asserted; refetched/persisted name in view not asserted) | ⚠️ PARTIAL |

### web-api-client

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Typed client from OpenAPI contract | Client types match contract | `pnpm typecheck` (compile-time; `types.generated.ts` auto-generated from `../app-escrowly-backend/openapi.yaml` and consumed by client/query/components; no runtime test) | ✅ COMPLIANT |
| R2 Access token in memory only | Token never persisted | `client.test.ts` > "token management > never writes token to localStorage or sessionStorage" | ✅ COMPLIANT |
| R3 Requests include credentials | Requests send credentials | (none found — no test asserts `credentials: "include"` or the configured origin) | ❌ UNTESTED |
| R4 Error envelope mapping | Non-2xx maps to envelope | `errors.test.ts` > "toApiError > maps a backend error envelope" + `client.test.ts` > "error mapping > throws ApiError with details on 400 / status 409 / status 429" | ✅ COMPLIANT |
| R5 Single in-flight refresh | Concurrent 401s share one refresh | `client.test.ts` > "401 → refresh → retry > coalesces concurrent 401s into a single refresh" | ✅ COMPLIANT |

**Compliance summary**: 11/26 scenarios fully compliant · 9 PARTIAL · 6 UNTESTED · 0 FAILING.

Additional (beyond-spec) behavior confirmed: `client.test.ts` > "refresh scope > does NOT trigger a refresh on a 401 from an auth endpoint" (refresh-not-on-auth-endpoints) — ✅ COMPLIANT and passing.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| web-app-shell R1 route structure | ✅ Implemented | `routes/routes.tsx` declares `/`, `/login`, `/register`, `/app` (guard → layout → index/profile), `*`. |
| web-app-shell R2 auth guard | ✅ Implemented | `AuthGuard.tsx` → `/login` with `state={{ from: location }}`; `LoginPage` `PostLoginRedirect` reads `state.from.pathname` and navigates back. Behavior untested. |
| web-app-shell R3 boot loader | ✅ Implemented | `AuthGuard`/`RootRedirect` render `FullPageLoader` while `status === "loading"`; boot restore guarded by ref. |
| web-app-shell R4 not-found | ✅ Implemented | `NotFoundPage` renders 404, message, and `<Link to="/app">Go back home</Link>`. |
| web-app-shell R5 session-expired | ✅ Implemented | `client.ts` calls `onSessionExpired(msg)`; `auth-context.tsx` registers callback that clears session, sets guest, and navigates to `/login` with `sessionExpiredMessage`; `LoginPage` renders it. Redirect/UI untested. |
| web-auth R1 registration | ✅ Implemented | `auth-context.register` POSTs, sets in-memory token, loads `/users/me`, status authed; `PostRegisterRedirect` navigates `/app`. |
| web-auth R2 register validation | ✅ Implemented | `RegisterForm` maps `err.details` to `setError(field, …)`; values preserved (RHF). Untested. |
| web-auth R3 duplicate email | ✅ Implemented | `RegisterForm` maps `409` to `setError("email", …)`. Untested. |
| web-auth R4 login | ✅ Implemented | `login()` sets token + profile; `LoginForm` maps non-429/`isApiError` to a single non-field `Banner`. Untested at form level. |
| web-auth R5 logout | ✅ Implemented | `logout()` POSTs `/auth/logout`, then `clearSession()`, profile null, guest; `AppLayout.handleLogout` navigates `/login`. |
| web-auth R6 silent restore | ✅ Implemented | `RootProviders.BootRestore` calls `restore()` once (ref guard); `restore()` POSTs `/auth/refresh` then `GET /users/me`. |
| web-auth R7 silent refresh | ✅ Implemented | `client.ts` 401 → `refreshOnce()` → retry once; refresh failure throws typed `SESSION_EXPIRED` + clears. Auth paths excluded via `AUTH_PATHS`. |
| web-auth R8 rate-limited auth | ✅ Implemented | `RegisterForm`/`LoginForm` set `rateLimited` on `status === 429`, render warning banner with exact required text, disable inputs/submit. Untested. |
| web-profile R1 view | ✅ Implemented | `ProfileCard` shows name, email, role `Badge`, member-since; no password field rendered. |
| web-profile R2 edit restricted | ✅ Implemented | `ProfileEditForm` edits name only; email `disabled`; role rendered as `<span>`; `useUpdateProfileName` sends only `{ name }`. |
| web-profile R3 name validation | ✅ Implemented | `profileNameSchema` min(1)/max(100); `ProfileEditForm` maps 400 `details` to inline name error. |
| web-profile R4 update persists | ✅ Implemented | `useUpdateProfileName` PATCHes `/users/me` then `invalidateQueries(["profile"])`; success `Toast`. |
| web-api-client R1 typed contract | ✅ Implemented | `types.generated.ts` header marks `openapi-typescript`; `gen:api` script points at `../app-escrowly-backend/openapi.yaml`; types consumed with passing `tsc`. |
| web-api-client R2 in-memory token | ✅ Implemented | `accessToken` is a module-scoped `let` in `client.ts`; no `localStorage`/`sessionStorage` write anywhere in `src/` (only the guarding test references them). |
| web-api-client R3 credentials | ✅ Implemented | Every `fetch` in `client.ts` (`doRefresh` and `request`) sets `credentials: "include"`; `buildUrl` targets `VITE_API_URL` when set. Untested. |
| web-api-client R4 error envelope | ✅ Implemented | `toApiError` maps `{code,message,details}`; fallback `HTTP_{status}`; `networkError` for fetch `TypeError`. |
| web-api-client R5 single-flight refresh | ✅ Implemented | `refreshPromise` module-scoped; `refreshOnce` returns the in-flight promise and clears in `finally`. |

No missing implementation found. Every requirement has static structural evidence; the gaps are behavioral-proof gaps, not absent features.

---

## Coherence (Design)

| Decision / Design artifact | Followed? | Notes |
|----------------------------|-----------|-------|
| D1 Router: React Router (library mode); `<Navigate>` + `state.from` | ⚠️ Deviated | Library mode used, `Navigate`/`state.from` implemented, but dependency is `react-router@^8.4.0` — design says v7. Version bump beyond design; behavior consistent. |
| D2 Server state: TanStack Query | ✅ Yes | `@tanstack/react-query@^5`; `query-client.ts`, `useProfile` + `invalidateQueries(["profile"])`. |
| D3 Forms: react-hook-form + zod | ✅ Yes | `@hookform/resolvers`, `react-hook-form`, `zod`; schemas at boundary; `setError` maps `details`. |
| D4 API types: openapi-typescript generated | ✅ Yes | `gen:api` script + `types.generated.ts` from backend `openapi.yaml`. |
| D5 Tailwind v4 CSS-first `@theme` | ✅ Yes | `@tailwindcss/vite`, `@theme` in `styles/index.css` maps tokens → CSS vars. |
| D6 Auth state: module token + context for status/profile | ✅ Yes | Token module-scoped in `client.ts`; `AuthContext` holds status/profile. Token never in React state/storage. |
| D7 CORS vs proxy: Vite dev proxy path-passthrough, no backend change | ✅ Yes | `vite.config.ts` proxies `/auth`,`/users`,`/health` → `:3000` via `changeOrigin`, no rewrite. Backend untouched. Prod CORS correctly deferred/out of scope. |
| D8 Testing: Vitest + RTL + MSW | ✅ Yes | All three present; interceptor tested by counting refresh calls. |
| Folder structure: `src/main.tsx App.tsx` | ⚠️ Deviated | `App.tsx` absent; composition root is `routes/index.tsx` (`createBrowserRouter`) + `routes/routes.tsx` + `routes/RootProviders.tsx`. Benign split. |
| Folder structure: `src/styles/tokens.css` | ⚠️ Deviated | No separate `tokens.css`; tokens live in `index.css` `@theme`. Benign. |
| File changes table: `vite.config.ts`, `types.generated.ts`, backend unchanged | ✅ Yes | All match. |
| Data flow: boot restore + single-flight 401 refresh | ✅ Yes | Matches design sequence; `AUTH_PATHS` exclusion is an added safeguard. |
| Testing strategy: unit `errors.ts`, zod, token-not-persisted | ⚠️ Partial | `errors.ts` ✅, token-not-persisted ✅; zod schemas have no direct unit tests. |
| Testing strategy: interceptor (one refresh + retry, coalesce, refresh-fail) | ⚠️ Partial | One-refresh+retry ✅, coalesce ✅; refresh-fail proves clear+error but not redirect. |
| Testing strategy: register/login/logout/profile; 429 disable+banner; guard redirect-back | ⚠️ Partial | Profile ✅; register/login/logout form flows, 429 disable+banner, and guard redirect-back are NOT covered. |
| Open Question: prod CORS deferred | ✅ Yes | No backend CORS; proxy only. |

---

## Issues Found

**CRITICAL** (must fix before archive):
None. No failing tests, no build/typecheck/lint/format errors, and no missing requirement implementation.

**WARNING** (should fix):
1. **Six spec scenarios have no covering test (UNTESTED)** — each is a spec MUST/behavior without behavioral proof:
   - `web-app-shell R2` → "Return to intended path after login" (guard redirect-back). Explicitly highlighted as a member behavior for this verification.
   - `web-auth R2` → "Invalid registration shows field errors" (400 `details` → inline field errors, form kept filled).
   - `web-auth R3` → "Duplicate email on register" (409 → inline email error).
   - `web-auth R4` → "Wrong credentials show non-field error" (401 → single non-field error, no field disclosure).
   - `web-auth R8` → "429 disables submit and shows banner" (exact required banner text + disabled submit).
   - `web-api-client R3` → "Requests send credentials" (`credentials: "include"` + configured origin).
2. **Nine scenarios only partially proven**; most notably the redirect/UI half is untested:
   - `web-app-shell R5` and `web-auth R7` — session-expired / failed-refresh clear-session is proven, but the `onSessionExpired` → `/login` redirect and the `"Your session expired. Please sign in again."` UI message are not.
   - `web-auth R1/R4/R5` — successful register/login/logout prove `status` + token, but not the actual navigation to `/app` or `/login`.
   - `web-app-shell R2/R3` — intended-path remembering and no-protected-content-flash are not asserted.
   - `web-profile R2/R4` — role non-editability is structural only; persisted-name reflection in the view after PATCH is not asserted.
3. **Regression-test claim not fully supported.** The commit `d31b509` ("correct layout width, body-less POSTs and boot refresh") states it "Added regression tests for the request headers". Only the body-less POST fix has a dedicated regression test (`client.test.ts` > "does NOT send Content-Type on a body-less POST"). The other two runtime bugs have **no** regression test:
   - StrictMode single boot `/auth/refresh` (guard exists in `RootProviders.tsx` `calledRef`, duplicated in the test helper, but no test asserts exactly one refresh on boot).
   - `max-w-md` layout fix (`index.css` spacing keys removed; `max-w-md` restored in `LoginPage`/`RegisterPage`) — no test or assertion.
4. **Design coherence deviations** (benign but should be acknowledged): `react-router` v8 vs design's v7; design-listed `App.tsx` and `styles/tokens.css` do not exist as such.

**SUGGESTION** (nice to have):
1. **No real-browser/e2e coverage** — accepted gap for this change; verification relies on Vitest + Testing Library + MSW. (Per instruction, not a failure.)
2. Add a contract assertion that `types.generated.ts` matches the current `openapi.yaml` (e.g., re-run `gen:api` in CI and fail on diff), since R1 compliance currently rests on compile-time evidence only.
3. `auth-context.test.tsx` emits `act(...)` environment warnings to stderr on several tests; configure the test environment / wrap updates to silence and avoid masking future flakiness.
4. Production bundle is 534.66 kB (>500 kB Rollup warning); consider route-level code splitting.
5. Third-party `zod` `@__PURE__` comment warnings appear during build; no action needed in this repo.

---

## Notes on Required Focus Areas

| Focus behavior | Evidence | Status |
|----------------|----------|--------|
| Token never persisted to storage | `client.test.ts` > "never writes token to localStorage or sessionStorage" (spies `Storage.prototype.setItem`); no storage writes in `src/` | ✅ Proven |
| Single-flight refresh coalescing | `client.test.ts` > "coalesces concurrent 401s into a single refresh" (3 concurrent 401s → 1 refresh) | ✅ Proven |
| Refresh NOT triggered on auth endpoints | `client.test.ts` > "refresh scope > does NOT trigger a refresh on a 401 from an auth endpoint" | ✅ Proven |
| Guard redirect-back to intended path | Redirect to `/login` tested; intended-path remember + return NOT tested | ❌ Verification gap |
| Session-expired redirect | Clear session + message string tested; `/login` redirect + UI message NOT tested | ⚠️ Verification gap |
| Profile omits password / blocks role+email changes | Password omission tested; email `disabled` tested; role non-editable by construction (no explicit assertion) | ✅/⚠️ Mostly proven |

---

## Verdict

**PASS WITH WARNINGS**

All 27 tasks are complete; `pnpm typecheck`, `pnpm test` (35/35), `pnpm build`, `pnpm lint`, and `pnpm format:check` all pass; every requirement has working static implementation and the three highlighted core guards (in-memory token, single-flight refresh, refresh-scope exclusion) are behaviorally proven. The change is functionally sound but the spec's behavioral proof is incomplete: 6 MUST scenarios are UNTESTED, 9 are only PARTIAL, and only 1 of the 3 runtime-bug fixes has a regression test. Recommend adding tests for guard redirect-back, session-expired redirect/UI, register/login form error mapping (400/409/401/429), and `credentials: "include"` before archive; if the project requires a passing test per MUST scenario as an archive gate, this would be read as FAIL. No CRITICAL defect was found.
