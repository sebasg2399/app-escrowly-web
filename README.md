# Escrowly

Milestone-based escrow platform for freelancers and clients.

## Monorepo Layout

| Directory | Status | Description |
|-----------|--------|-------------|
| `openspec/` | Active | Spec-driven development artifacts |
| `app-escrowly-backend/` | **Done** | Fastify API (auth, users, contracts, milestones, Stripe Connect + payouts, OpenAPI contract) |
| `app-escrowly-frontend/` | **Done** | React + Vite web app (shell, auth, profile, contracts, milestones, Stripe funding, Connect onboarding) |

## Current Status

The happy-path MVP is complete end to end:

- **Backend**: authentication (JWT access token + revocable refresh sessions), user profiles, contracts with milestones, Stripe Connect Express onboarding (manual payouts), milestone funding on the platform balance via PaymentIntent, client approval that pays the seller (10% commission / 90% Transfer), an idempotent Stripe webhook dispatcher, and a committed OpenAPI contract with full response schemas.
- **Frontend**: app shell and routing with an auth guard, register/login/logout with silent session restore, contracts list/create/detail, milestone actions (submit / approve) with role-aware gating and 5s polling while any milestone is pending, Stripe Payment Element funding modal, and a Connect onboarding page.

Next: disputes / refunds, Premium subscription (2% commission), deliverable file storage.

Setup guides: `app-escrowly-backend/README.md` and `app-escrowly-frontend/README.md`.
