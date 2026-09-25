# Archive Report — escrowly-frontend-foundation

**Change**: `escrowly-frontend-foundation`
**Archived on**: 2026-09-25
**Archived to**: `openspec/changes/archive/2026-09-25-escrowly-frontend-foundation/`
**Artifact store**: openspec
**Mode**: Standard (`strict_tdd: false`)

---

## What was archived

The first frontend change for the Escrowly project. It scaffolds `app-escrowly-frontend/` (React + Vite + TypeScript + Tailwind, pnpm) and ships the buildable-now slice: app shell with routing, auth (register/login/logout/silent restore/silent refresh on 401), profile (view/edit name only), and a typed OpenAPI-derived API client. No money is handled — no fund-holding risk. The backend was NOT modified; local dev uses a Vite same-origin proxy for the httpOnly refresh cookie.

39/39 tasks complete across Phases 1–7 (scaffold → API/auth → shell/routing/profile → tests → cleanup → verification-gap tests). Verification re-run after PR #11 (test-hardening) closed the gaps from the previous report.

## Spec sync table

Main specs did not exist for these four domains — they are new capabilities. Each delta was converted from delta form (`# Delta for {domain}`, `## ADDED Requirements`) to source-of-truth form (`# {Domain} Specification`, `## Requirements`) and a short `## Purpose` line was added. Every requirement and scenario is preserved verbatim.

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| `web-app-shell` | **Created** (`openspec/specs/web-app-shell/spec.md`) | 5 | 6 |
| `web-auth` | **Created** (`openspec/specs/web-auth/spec.md`) | 8 | 11 |
| `web-profile` | **Created** (`openspec/specs/web-profile/spec.md`) | 4 | 4 |
| `web-api-client` | **Created** (`openspec/specs/web-api-client/spec.md`) | 5 | 5 |
| **Totals** | **4 new specs** | **22** | **26** |

No MODIFIED capabilities. The `api-foundations` CORS delta was dropped by decision (Vite same-origin proxy keeps the backend untouched; cross-origin production CORS is deferred to a future change).

## Archive contents checklist

- `proposal.md` ✅
- `specs/web-app-shell/spec.md` ✅
- `specs/web-auth/spec.md` ✅
- `specs/web-profile/spec.md` ✅
- `specs/web-api-client/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (39/39 tasks complete, all checkboxes `[x]`)
- `verify-report.md` ✅
- `state.yaml` ✅ (preserved for historical reference)
- `archive-report.md` ✅ (this file)

`openspec/changes/` no longer contains the active change — only `openspec/changes/archive/2026-09-25-escrowly-frontend-foundation/` remains from this work.

## Source of truth updated

The following specs now reflect the new behavior and are the canonical contract:

- `openspec/specs/web-app-shell/spec.md` — public/protected route structure, auth guard, boot loader, 404, session-expired redirect.
- `openspec/specs/web-auth/spec.md` — register/login/logout/silent restore, 401→silent refresh→retry, 429 banner.
- `openspec/specs/web-profile/spec.md` — profile view, name-only edit, validation, persisted update.
- `openspec/specs/web-api-client/spec.md` — OpenAPI-typed client, in-memory token, credentials, error-envelope mapping, single-flight refresh.

## Verify verdict

**PASS WITH WARNINGS**

- 25/26 scenarios compliant
- 1 PARTIAL (accepted, documented below)
- 0 UNTESTED
- 0 FAILING
- 0 CRITICAL

Quality gates all green: `pnpm typecheck` ✅, `pnpm test` ✅ (50/50 across 8 files, 3.13s), `pnpm build` ✅, `pnpm lint` ✅, `pnpm format:check` ✅. No failing build, typecheck, lint, format, or test step.

Delta vs. previous verification: UNTESTED 6 → 0, PARTIAL 9 → 1, COMPLIANT 11 → 25. All previously-uncovered runtime-bug fixes have passing regression tests.

## Accepted gap (documented, not fixed)

**`web-api-client` R3 — "Requests send credentials"**: the scenario has a second clause, "MUST target the configured API origin (VITE_API_URL)". `client.test.ts` proves `credentials: "include"` on GET, POST refresh, and PATCH requests. The `buildUrl()` helper does read `VITE_API_URL` and use it as the base, but **no test sets or asserts `VITE_API_URL`**, so the origin-selection branch is unproven. This is a behavioral-coverage gap, not a production defect — the feature is implemented; only the test is missing.

This gap is explicitly **accepted** for archive: it does not block archival (no CRITICAL issue), and closing it is recommended as the first follow-up before any subsequent change that depends on cross-origin deployment (since cross-origin is the only environment where the `VITE_API_URL` branch matters at runtime).

## Notable fixes shipped during the change

**3 runtime bugs found in local testing** (commit `d31b509`):

1. **`@theme` custom `--spacing-*` breaking `max-w-md`** — Tailwind v4's `@theme` block had custom `--spacing-*` keys that clobbered the spacing scale, collapsing `max-w-md` to ~24px and breaking the auth layout. Fixed by removing the custom keys from `src/styles/index.css` and moving those values to non-spacing token names. Regression-guarded by `theme-guard.test.ts`.
2. **Body-less POST sending `Content-Type`** — empty `POST /auth/refresh` was sent with `Content-Type: application/json` and no body, which Fastify rejected with a 500 on JSON parsing. Fixed by skipping the header when `body` is `undefined`. Covered by `client.test.ts` (refresh interceptor).
3. **StrictMode double boot refresh** — under `<StrictMode>`, `RootProviders` mounted twice in dev and fired two `POST /auth/refresh` calls on boot. Fixed with a `calledRef` guard so `restore()` runs exactly once. Regression-guarded by `router-behavior.test.tsx` > "StrictMode single boot refresh".

**2 latent navigation bugs found when writing the verify-gap tests** (PR #11):

4. **`LoginPage.tsx` reading `window.history.state?.usr?.sessionExpiredMessage`** — under `createMemoryRouter` (used in tests) `window.history` is not synced, so the field was always `null` and the session-expired banner never rendered. Fixed by reading from `useLocation().state?.sessionExpiredMessage` instead. Covered by `router-behavior.test.tsx` > "Session-expired redirect".
5. **`AuthGuard.tsx` `<Navigate>` dropping the session-expired message** — `AuthProvider`'s `onSessionExpired` callback called `navigate("/login", { state: { sessionExpiredMessage } })`, then `AuthGuard` rendered `<Navigate to="/login" state={{ from: location }}>` on the next render, overwriting the first navigation's state. Fixed by moving `sessionExpiredMessage` into `AuthContext` and having `AuthGuard` own the navigation so the message survives. Message is cleared on every successful login/register/restore. Covered by the same "Session-expired redirect" test.

## Design deviations (benign)

| Decision | Design | Implementation | Why benign |
|----------|--------|----------------|------------|
| React Router version | v7 | **v8.4** (`react-router@^8.4.0`) | Same library-mode API surface; `<Navigate>` + `state.from` redirect-back pattern used exactly as designed. Bumped beyond design. |
| Folder structure: `src/App.tsx` | listed as `main.tsx` + `App.tsx` | `src/App.tsx` does **not exist** as such; the composition root is `src/routes/index.tsx` (`createBrowserRouter`) + `src/routes/routes.tsx` + `src/routes/RootProviders.tsx` | Same behavior, cleaner split — router, route table, and providers live in `routes/`. |
| Folder structure: `src/styles/tokens.css` | listed as a separate file | No separate `tokens.css`; tokens live in `src/styles/index.css` under `@theme` (Tailwind v4 CSS-first) | Tailwind v4's design intent — `@theme` is the canonical token declaration; a separate `tokens.css` would be redundant. |

All other design decisions (TanStack Query, react-hook-form + zod, openapi-typescript, Vite proxy, module-scoped token, Vitest + RTL + MSW) were implemented as designed.

## PR / commit trail

| PR | Branch | Scope | Notes |
|----|--------|-------|-------|
| **#6** | `feat/frontend-scaffold` | Phase 1 — scaffold + tokens + tooling | Vite + Tailwind v4 + tokens + Vitest + MSW; tsc/build/test green |
| **#7** | `feat/frontend-api-auth` | Phase 2 — API + auth client | OpenAPI types, `client.ts` (single-flight refresh), `auth-context`, RHF+zod forms, MSW tests |
| **#8** | `feat/frontend-shell-profile` | Phases 3–4 — shell + routing + profile | `routes/`, `AuthGuard`, `AppLayout`, `NavBar`, profile view/edit |
| **#9** | backend fix | **Out of scope for this change** | Backend-only fix unrelated to the frontend work |
| **#10** | `chore/frontend-cleanup` | Phase 6 — cleanup | ESLint + Prettier sweep; README; final green |
| **#11** | `test/frontend-verify-gaps` | Phase 7 — verification-gap hardening | 15 new tests; **3 runtime-bug regression tests**; **2 latent navigation-bug fixes** + covering test; closes 6 UNTESTED + 8 of 9 PARTIAL from the previous report |

Merge commit on `main`: `d7e9ddd` (PR #11). Subsequent test-hardening commit: `2f81d57`.

## SDD cycle complete

The change has been fully planned (proposal/spec/design/tasks), implemented across 5 PRs, verified twice (initial + post-hardening re-verify), and archived. Ready for the next change.

Recommended follow-up (non-blocking): add a test that stubs `VITE_API_URL` and asserts the captured `request.url` starts with it, to close the last PARTIAL scenario (`web-api-client` R3 origin clause) before any cross-origin deployment work begins.