# Proposal: Escrowly Happy Path

## Intent

Add the escrow domain and Stripe money flow to the Escrowly backend. Backend-only, contract-first; frontend ships later against this frozen API.

## Scope

### In Scope
- **Contract** model + endpoints (`POST /contracts`, `GET /contracts`, `GET /contracts/:id`): N milestones, each with title + integer-cents amount. The authenticated user creates the contract **as the client** and names the seller by email; the seller joins the contract later. Only participants can read a contract.
- **Milestone** state machine `pending → funded → in_review → disputed → approved → paid`. Happy path only; `disputed` reserved.
- **Funding**: Stripe `PaymentIntent` on **platform account** (no `transfer_data`); funds settle in platform balance. `payment_intent.succeeded` → `funded`.
- **Delivery + approval**: seller `funded → in_review`; client `in_review → approved`.
- **Payout**: on approval, **10% commission**, Stripe `Transfer` 90% to seller's connected account, `→ paid`. Idempotent.
- **Stripe Connect Express** onboarding (`POST /connect/onboarding-link`, `GET /connect/status`); `payouts={schedule: manual}`.
- **Webhooks** `payment_intent.{succeeded,payment_failed}`, `account.updated`, `transfer.{created,failed}` — idempotent via persisted event log.
- Reads + **Ledger** table (debit/credit, reference, `idempotency_key`).

### Out of Scope
`disputed`/refunds/chargebacks; Premium 2%; deliverable storage; admin UI; frontend; live Stripe mode.

## Capabilities

### New Capabilities
- `contracts`: aggregate + endpoints.
- `milestones`: model, state machine, transitions, reads.
- `milestone-funding`: `PaymentIntent` on platform account.
- `milestone-payout`: commission + `Transfer` to seller's connected account.
- `connect-onboarding`: Stripe Connect Express, manual payouts.
- `stripe-webhooks`: idempotent async event handler.

### Modified Capabilities
None. Money-as-integer-minor-units is already in `api-foundations`; commission/Transfer semantics live in the new specs.

## Affected Areas + Approach

Extend the existing ports/adapters modular monolith with new Prisma models `Contract`, `Milestone`, `LedgerEntry`, `StripeWebhookEvent`. New `StripeClient` port (real + Vitest mock). New modules follow `routes/service/schemas`. Integer cents; every financial write carries `idempotency_key` + `ledger_entry`. OpenAPI regenerated via `pnpm openapi`.

| Area | Impact |
|------|--------|
| `app-escrowly-backend/prisma/schema.prisma` | + `Contract`, `Milestone`, `LedgerEntry`, `StripeWebhookEvent` |
| `app-escrowly-backend/src/modules/{contracts,milestones,connect,payments}/` | New |
| `app-escrowly-backend/src/ports/` | + `contract-repository`, `milestone-repository`, `ledger-repository`, `stripe-client` |
| `app-escrowly-backend/src/adapters/prisma/` | + Prisma adapters |
| `app-escrowly-backend/src/plugins/stripe-webhooks.ts` | New |
| `app-escrowly-backend/src/config/env.ts` | + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_ACCOUNT_ID` |
| `app-escrowly-backend/openapi.yaml` | Regenerated |

## Risks

| Risk | Mitigation |
|------|------------|
| Holding client funds on platform balance = regulatory/liability exposure | Flagged known limitation for a test-mode portfolio MVP; manual payouts keep funds on platform; revisit before any real-money rollout |
| Webhook re-delivery duplicates ledger entries | `stripe_webhook_events` keyed by Stripe event id; already-processed = no-op |
| Mocks diverge from real Stripe SDK / money math errors | Vitest mocks SDK; integer cents + single typed commission function + ledger-balanced assertions |

## Rollback Plan

1. Revert the migration adding `Contract`, `Milestone`, `LedgerEntry`, `StripeWebhookEvent`.
2. Delete `src/modules/{contracts,milestones,connect,payments}/`, new `src/ports/*` + `src/adapters/prisma/*`, and `src/plugins/stripe-webhooks.ts`.
3. Drop `STRIPE_*` from `config/env.ts` + `.env.example`; restore prior `openapi.yaml` from git.
4. Stripe test mode only — no real payouts, no production data touched.

## Success Criteria

- [ ] Contract creation with N integer-cents milestones works.
- [ ] Funding creates `PaymentIntent` on platform account; `payment_intent.succeeded` moves `pending → funded` + ledger entry; duplicate webhook is a no-op.
- [ ] `funded → in_review` (seller), `in_review → approved` (client); backend computes 10% commission + `Transfer`s 90% to seller's connected account; milestone `paid`; ledger balances.
- [ ] Connect Express onboarding link returns URL; `account.updated` enables payouts.
- [ ] `pnpm test` + `pnpm openapi` pass; `api-foundations`, `user-auth`, `user-accounts` specs stay green.