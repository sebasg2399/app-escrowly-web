# Proposal: Escrowly Frontend Foundation

## Intent

First frontend change: scaffold `app-escrowly-frontend/` and build the buildable-now slice — app shell, auth (register/login/logout/silent restore), and profile (view/edit) — against the OpenAPI contract. Backend is archived; this delivers a working web entry point.

## Scope

### In Scope
- Scaffold `app-escrowly-frontend/` (React + Vite + TypeScript + Tailwind, pnpm).
- App shell + routing (`/login`, `/register`, `/app`, `/app/profile`, 404) with auth guard.
- Auth: register, login, logout, silent `POST /auth/refresh` on boot and on 401.
- Profile: `GET /users/me` view + `PATCH /users/me` edit (name only; email/role disabled).
- Global states: loading, error/retry, 429 banner, session-expired, not-found.
- Typed API client derived from `openapi.yaml` (in-memory token, credentials, error mapping).

### Out of Scope
Contracts, milestones, funding (Stripe), deliverables, approval/dispute, wallet/payouts, premium, admin, mobile. No money handled → no fund-holding risk (rules.proposal).

## Capabilities

### New Capabilities
- `web-app-shell`: routing, layout, auth guard, global loading/error/rate-limit/session-expired/not-found states.
- `web-auth`: register, login, logout, silent restore UI + token/session model.
- `web-profile`: profile view and edit (name only).
- `web-api-client`: typed client generated from OpenAPI; in-memory token; credentials; error-envelope mapping; silent refresh.

### Modified Capabilities
None. (Credentialed CORS is deferred to a future production/cross-origin change; local dev uses a same-origin Vite proxy, so the backend is untouched.)

## Approach

Contract-first. Scaffold with Vite; extract Stitch tokens into Tailwind/CSS variables (Inter, 8px radii, indigo `#4338CA`/`#5148d8`); re-implement screens as atomic-design React components — never paste Stitch HTML. Generate client types from `openapi.yaml`; keep access token in memory only, refresh token in httpOnly cookie.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app-escrowly-frontend/` | New | App: `src/` components, routes, api client, tokens |
| `app-escrowly-backend/` | None | Backend untouched; dev uses a same-origin Vite proxy |
| `app-escrowly-backend/openapi.yaml` | None | Contract unchanged (CORS is transport, not schema) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Proxy misconfig breaks session cookie | Med | Vite proxy is path-passthrough (no rewrite) so `path=/auth` + `SameSite=Strict` work same-origin |
| Stitch HTML pasted verbatim → unmaintainable | Med | Tokens → CSS vars; React components only |
| Client drifts from API shapes | Low | Types generated from `openapi.yaml` |

## Rollback Plan

Delete `app-escrowly-frontend/` and revert the backend CORS commit. No migration or contract change → clean revert.

## Dependencies

- Backend running at `http://localhost:3000` (done). Dev traffic goes through the Vite same-origin proxy.

## Success Criteria

- [ ] Register → login → logout → restore loop works against :3000.
- [ ] Profile view/edit persists name; email/role non-editable.
- [ ] 401 triggers silent refresh; 409/429/500 map to correct UI states.
- [ ] `pnpm build` passes; no Stitch HTML pasted.
