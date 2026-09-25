# Escrowly

Milestone-based escrow platform for freelancers and clients.

## Monorepo Layout

| Directory | Status | Description |
|-----------|--------|-------------|
| `openspec/` | Active | Spec-driven development artifacts |
| `app-escrowly-backend/` | **Done** | Fastify API (auth, users, OpenAPI contract) |
| `app-escrowly-frontend/` | **Done** | React + Vite web app (shell, auth, profile) |

## Current Status

The foundation is complete end to end:

- **Backend**: authentication (JWT access token + revocable refresh sessions), user profiles, structured logging, rate limiting, a standard error envelope and a committed OpenAPI contract.
- **Frontend**: app shell and routing with an auth guard, register/login/logout with silent session restore, profile view/edit, and a design system (Stitch tokens) mapped to Tailwind.

Next: the contracts and milestones domain (funding, approval, payouts).

Setup guides: `app-escrowly-backend/README.md` and `app-escrowly-frontend/README.md`.
