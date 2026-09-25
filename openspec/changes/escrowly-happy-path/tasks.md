# Tasks: Escrowly Happy Path

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,600–3,200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | P1–P2 Prisma + ports + Stripe fake + env + raw body | PR 1 | independent |
| 2 | P3–P4 contracts + milestones | PR 2 | base PR 1 |
| 3 | P5 funding + webhooks | PR 3 | base PR 2 |
| 4 | P6–P7 payout + commission + hardening | PR 4 | base PR 3 |

## Phase 1: Foundation

- [x] 1.1 Extend `prisma/schema.prisma`: models `Contract`, `Milestone`, `LedgerEntry`, `StripeWebhookEvent`; enums `ContractStatus`, `MilestoneStatus`, `LedgerEntryKind/Side`; `User` payout fields; uniques + FK indexes.
- [x] 1.2 `pnpm prisma migrate dev --name escrowly_happy_path`; commit SQL.
- [x] 1.3 Create `src/ports/{contract,milestone,ledger,webhook-event}-repository.ts` interfaces.
- [x] 1.4 Create `src/adapters/prisma/{contract,milestone,ledger,webhook-event}-repository.ts` factories (existing pattern).
- [x] 1.5 Create `src/lib/authorization.ts`: `assertParticipant` + `assertRole` → 403.
- [x] 1.6 Extend `src/test/helpers.ts` `truncateTables()` for the 4 new tables.

## Phase 2: Stripe Plumbing

- [x] 2.1 Add `STRIPE_*` (secret, webhook secret, API version, connect URLs) to `src/config/env.ts` (Zod, optional in test) + `.env.example`.
- [x] 2.2 Create `src/ports/stripe-client.ts`: `createPaymentIntent`, `createExpressAccount`, `createAccountLink`, `retrieveAccount`, `createTransfer`, `constructWebhookEvent`.
- [x] 2.3 Create `src/adapters/stripe/stripe-client.ts` (add `stripe` dep) + `stripe-client.fake.ts` with `fake.webhook.emit`.
- [x] 2.4 Add `addContentTypeParser("application/json",{parseAs:"buffer"})` inside an encapsulated Stripe webhooks plugin (no package — verified), preserving global JSON parsing; malformed JSON in the webhook route still yields 400.

## Phase 3: Contracts Module

- [x] 3.1 Create `src/modules/contracts/{schemas,service,routes}.ts`: `POST /contracts` client-first, seller by email, integer-cents; empty/non-integer → 400; `draft` + `pending`.
- [x] 3.2 `GET /contracts` participant-scoped + `GET /contracts/:id` participant-only (403).
- [x] 3.3 Wire in `src/app.ts`; test creation, 400s, 403, list scoping (contracts spec).

## Phase 4: Milestones + State Machine

- [x] 4.1 Create `src/modules/milestones/{schemas,service,routes}.ts`: `submit` (seller, `funded→in_review`) — DEFERRED: `approve` (client, `in_review→approved`→payout) belongs to the payout slice (PR 4).
- [ ] 4.2 ~~Enforce transitions/roles; reject skip-step, wrong role, `disputed`; test milestones spec scenarios.~~ **DEFERRED to payout slice (PR 4)**: `approve` is the entry point to the Stripe transfer and ledger writes, so it ships with the payout/commission phase. The submit-only half (seller + skip-step + wrong-role + non-`funded` + 409) is already covered by the tests in `src/modules/milestones/milestones.routes.test.ts`.

## Phase 5: Funding + Webhooks

- [ ] 5.1 `POST .../milestones/:mid/fund` (client, `pending`, no `transfer_data`): `createPaymentIntent("fund:${mid}")` → persist id, return `{id,client_secret}`; non-pending → 409.
- [ ] 5.2 Create `src/plugins/stripe-webhooks.ts`: signature check (bad → 400), dispatch 5 types, unknown → 2xx no-op.
- [ ] 5.3 `payment_intent.succeeded` tx: webhook row + `funded` + `platform_receipt` ledger + contract `active`; `payment_failed` → stays `pending`.
- [ ] 5.4 `account.updated` → onboarding state; tests: signature, duplicate → 200 no-op, 1 ledger row, never 5xx.

## Phase 6: Payout + Commission

- [ ] 6.1 Create `src/modules/payments/commission.ts` `splitCommission`; unit-test odd cents/zero.
- [ ] 6.2 Approval: `createTransfer("transfer:${mid}")` → tx `paid` + commission/transfer ledgers + contract `completed`; duplicate approval no-op.
- [ ] 6.3 Failure: fake throws → stays `approved`, 502, no seller ledger; credits sum = amount (payout spec).

## Phase 7: Hardening

- [ ] 7.1 Run `pnpm exec tsc --noEmit` + `pnpm test` + `pnpm openapi`; commit regenerated `openapi.yaml`.