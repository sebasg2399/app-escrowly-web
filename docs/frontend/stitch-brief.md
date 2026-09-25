# Escrowly — Frontend MVP Flows (Stitch Brief)

> Design brief for generating the frontend screens in Stitch. This is NOT a spec; the source of truth is `openspec/specs/`. It will be the input for the `sdd-explore` of the frontend change.

## Purpose

Design the **buildable-now** slice of the Escrowly web app: the app shell, authentication (register, login, logout, session restore) and the user profile. Every screen maps to an endpoint that already exists in the backend, so the UI is designed against real shapes (contract-first). Contract and milestone screens are intentionally out of scope.

## Actors (this slice)

| Actor | Role | Can do now |
|-------|------|------------|
| Client (buyer) | `client` | Register, log in, view/edit profile. Default role on signup. |
| Seller (freelancer) | `seller` | Same as client; role set later (no self-service role switch in this slice). |
| Admin | `admin` | Not in this slice (no admin UI yet). |

Role is shown in the UI (badge) but does not change navigation yet.

## Product voice

Trustworthy, calm, financial-grade but not cold. Clear labels, no jargon. Money and identity are sensitive: the UI must never look "cute" about security.

## Scope

**In:** app shell + navigation, register, login, logout, silent session restore, profile read/update, global loading/error/rate-limit states, session-expired handling.

**Out (future flows, designed later once the backend exists):** contracts, milestones, funding (Stripe), deliverables, approval/dispute, seller wallet/payouts, premium subscription, admin/moderation.

## API contract this slice consumes

Base URL (dev): `http://localhost:3000`

| Method | Path | Auth | Request body | Success | Notes |
|--------|------|------|--------------|---------|-------|
| POST | `/auth/register` | no | `{ name, email, password }` | 201 `{ accessToken }` | Sets refresh cookie. User is logged in immediately. |
| POST | `/auth/login` | no | `{ email, password }` | 200 `{ accessToken }` | Sets refresh cookie. |
| POST | `/auth/refresh` | refresh cookie | — | 200 `{ accessToken }` | Rotates the cookie. Used for silent restore. |
| POST | `/auth/logout` | yes | — | 204 | Revokes the session; clears the cookie. |
| GET | `/users/me` | yes | — | 200 profile | Profile without `passwordHash`. |
| PATCH | `/users/me` | yes | `{ name }` | 200 profile | Only `name` is updatable. |
| GET | `/health` | no | — | 200 `{ status, timestamp }` | Not user-facing; for diagnostics. |

### Profile shape

```ts
type Profile = {
  id: string;          // uuid
  email: string;
  name: string;
  role: "client" | "seller" | "admin";
  createdAt: string;   // ISO date-time
  updatedAt: string;   // ISO date-time
  // stripeCustomerId / stripeAccountId / subscriptionStatus exist
  // but are null and NOT surfaced in this slice
};
```

### Auth model the UI must implement

- **Access token**: short-lived JWT, kept **in memory only** (never `localStorage`). Sent as `Authorization: Bearer <token>`.
- **Refresh token**: opaque, in an `httpOnly` cookie (path `/auth`). The UI never reads it.
- **Session restore**: on app load, call `POST /auth/refresh` once. If it returns a token, the user is authenticated; if 401, show the login screen.
- **401 on any request**: attempt one silent `POST /auth/refresh`; if that fails, clear session and redirect to login.
- **CORS/credentials**: requests must be sent with credentials included (cookies) against the configured API origin.

### Error envelope (all non-2xx)

```json
{ "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": { "field": ["..."] } }
```

| HTTP | code | UI treatment |
|------|------|--------------|
| 400 | `VALIDATION_ERROR` | Inline field errors using `details`; keep the form filled. |
| 401 | `UNAUTHORIZED` | Login form error (bad credentials) or session-expired redirect. |
| 403 | `FORBIDDEN` | Non-blocking toast: action not allowed. |
| 404 | `NOT_FOUND` | Generic "not found" screen/state. |
| 409 | `CONFLICT` | Field error on `email`: "already registered". |
| 429 | `RATE_LIMITED` | Banner: "Too many attempts, try again in a moment." Disable submit briefly. |
| 500 | `INTERNAL` | Generic error state with retry. |

Password rules to show as helper text: min 8 chars, at least one uppercase, one lowercase and one number.

## Navigation map

```
Public                         Protected (app shell)
  /login      ──success──▶        /app            (dashboard / home placeholder)
  /register   ──success──▶        /app/profile    (view + edit profile)
  /          ─redirect─▶          /app/*          (requires session)
```

- Unknown path → 404 state.
- Visiting a protected route without a session → redirect to `/login` (remember intended path).

## Screens to design

| # | Screen | Route | States to design |
|---|--------|-------|------------------|
| 1 | **Register** | `/register` | default, per-field validation errors, submitting, duplicate email (409), rate-limited (429) |
| 2 | **Login** | `/login` | default, wrong credentials (401), submitting, rate-limited (429) |
| 3 | **App shell** | `/app/*` | authenticated nav (logo, profile menu, logout), role badge, mobile/desktop |
| 4 | **Home (placeholder)** | `/app` | empty-state "Welcome, {name}" + what's coming next |
| 5 | **Profile — view** | `/app/profile` | loading skeleton, loaded, error/retry |
| 6 | **Profile — edit** | `/app/profile` (edit mode) | default, saving, success toast, validation error, forbidden (403) |
| 7 | **Session expired** | any protected | modal or redirect to login with a message |
| 8 | **Not found** | any unknown | 404 state with a link back |
| 9 | **Auth boot** | app start | full-page loader while `POST /auth/refresh` resolves |

### Flow details

**Register** — fields: Name, Email, Password (with rules helper). Primary action "Create account". On 201, store the access token in memory, load the profile, land on `/app`. Link to Login. On 409, highlight the Email field.

**Login** — fields: Email, Password. Primary "Sign in". On 200, same as register. On 401, a single non-field error ("Email or password is incorrect"). Link to Register.

**Logout** — from the profile menu: call `POST /auth/logout`, clear in-memory token, redirect to `/login`.

**Profile view** — read-only card with Name, Email, Role, Member since (`createdAt`). Button "Edit profile".

**Profile edit** — only Name is editable. Email and Role are shown **disabled** with a hint ("Email and role can't be changed here"). Save → `PATCH /users/me`. Success → return to view with a toast. On 400, inline error. On 403, toast.

## Design system tokens to define in Stitch

| Token group | What we need |
|-------------|--------------|
| Color | Primary, neutral scale, semantic: success, error, warning, info; surface/background; text on each surface. Light mode first. |
| Typography | 1 family (e.g. Inter), scale for display / heading / body / label / caption, weights. |
| Spacing | A 4-based scale (4, 8, 12, 16, 24, 32...). |
| Shape | Corner radii (inputs, buttons, cards), border widths. |
| Elevation | Card, modal, dropdown shadows. |
| Components | Button (primary/secondary/ghost/danger + states), TextField (default/focus/error/disabled + helper + error text), Select/Combobox (role, later), Card, Badge (role), Toast/Alert (info/success/error), Modal, Skeleton, Empty state, Nav bar / sidebar, Avatar/menu. |
| Iconography | An icon set and sizes. |

## Accessibility requirements

- Every field has a visible label tied to the input; errors are announced and tied via `aria-describedby`.
- Keyboard navigable: focus order, visible focus rings, Escape closes modals.
- Color is never the only signal (errors use text + icon, not just red).
- Contrast at least WCAG AA.

## Copy to use

- Register title: "Create your Escrowly account"
- Login title: "Sign in to Escrowly"
- Password helper: "At least 8 characters, with uppercase, lowercase and a number."
- Empty home: "Welcome, {name}. Contracts and milestones are coming next."
- 429: "Too many attempts. Please wait a moment and try again."
- Session expired: "Your session expired. Please sign in again."

## How to use this brief in Stitch

1. Create the design system first from the **tokens** table (colors, typography, radius, components).
2. Generate screens from the **screen inventory** + **flow details**, one at a time, using the real field names and copy above.
3. Keep the shapes from the **API contract** section — do not invent extra profile fields.
4. Review: the design must not add features outside **Scope**.
