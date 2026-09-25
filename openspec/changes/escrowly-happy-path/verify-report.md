# Verification Report

**Change**: escrowly-happy-path
**Version**: N/A (delta specs, no explicit version)
**Mode**: Standard Verify (`strict_tdd: false` in `openspec/config.yaml`)
**Artifact store**: openspec
**Verified at**: 2026-09-25 (re-run after PR #16 `a712d1a` / merge `a911206`)
**Executor**: sdd-verify (read-only; no fixes applied)
**Baseline**: previous `verify-report.md` (verdict FAIL, CRITICAL-1 + WARNINGs 2–5)

---

## 1. Completeness

### Tasks

| Metric | Value |
|--------|-------|
| Tasks total | 33 |
| Tasks complete `[x]` | 33 |
| Tasks incomplete `[ ]` | 0 |

**Phase 8 present and complete.** PR #16 added `## Phase 8: Connect onboarding (verify gap)` with
tasks 8.1–8.10, all `[x]`. The original 23 tasks (Phases 1–7) are also all `[x]`. The stale
"DEFERRED to payout slice" text on 4.1/4.2 has been corrected. `tasks.md` now covers all six
capabilities:

| Spec capability | Tasks present? | Implementation present? |
|-----------------|----------------|--------------------------|
| `contracts` | Yes (3.1–3.3) | Yes |
| `milestones` | Yes (4.1–4.2) | Yes |
| `milestone-funding` | Yes (5.1) | Yes |
| `milestone-payout` | Yes (6.1–6.3) | Yes |
| `connect-onboarding` | **Yes (8.1–8.4, 8.9)** | **Yes** (module, routes, OpenAPI, tests) |
| `stripe-webhooks` | Yes (5.2–5.4, 8.6) | Yes |

---

## 2. Build & Tests Execution

All commands run in `app-escrowly-backend/`. No build/dev-server/commit was run.

**Type check** (`pnpm exec tsc --noEmit`): ✅ Passed — exit code 0, no output.

**OpenAPI** (`pnpm openapi`): ✅ Passed — exit code 0, `openapi.yaml generated`.
Regenerated file was **byte-identical** to the committed file (`git diff --stat` empty), so the
contract is in sync with the implemented routes. `grep -n connect openapi.yaml` →
`/connect/onboarding-link` (line 324) and `/connect/status` (line 331); 14 total paths.

**Tests** (`pnpm test` → `vitest run`): ✅ **128 passed / 0 failed / 0 skipped**, exit code 0,
13 test files, ~17.8 s.

```
 ✓ src/modules/milestones/milestones.approve.routes.test.ts (15 tests)
 ✓ src/modules/contracts/contracts.routes.test.ts            (17 tests)
 ✓ src/modules/milestones/milestones.routes.test.ts          (18 tests)
 ✓ src/modules/auth/auth.routes.test.ts                      (16 tests)
 ✓ src/plugins/stripe-webhooks.flow.test.ts                  (10 tests)
 ✓ src/modules/users/users.routes.test.ts                    (7 tests)
 ✓ src/modules/connect/connect.routes.test.ts                (7 tests)
 ✓ src/plugins/stripe-webhooks.test.ts                       (7 tests)
 ✓ src/modules/auth/auth.schemas.test.ts                     (13 tests)
 ✓ src/modules/auth/tokens.test.ts                           (6 tests)
 ✓ src/modules/auth/password.test.ts                         (4 tests)
 ✓ src/plugins/error-handler.test.ts                         (4 tests)
 ✓ src/modules/payments/commission.test.ts                   (4 tests)
 Test Files  13 passed (13)
      Tests  128 passed (128)
```

**Delta vs baseline**: 12 → 13 test files; 116 → 128 tests (all green).

**Coverage**: ➖ Not available — no coverage script/tool configured and
`rules.verify.coverage_threshold` is unset in `openspec/config.yaml`.

---

## 3. Spec Compliance Matrix

Every requirement/scenario across all six delta specs, cross-referenced to the executed test run.
`connect-onboarding` reflects the **updated** spec (any authenticated user, 401 for unauthenticated).

### `contracts/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Create contract as the authenticated client | Successful contract creation | `contracts.routes.test.ts > creates a contract with milestones atomically` | ✅ COMPLIANT |
| Create contract as the authenticated client | Empty milestone list | `contracts.routes.test.ts > rejects empty milestone list with 400` | ✅ COMPLIANT |
| Create contract as the authenticated client | Non-positive or non-integer milestone amount | `contracts.routes.test.ts > rejects zero amount with 400` / `rejects negative amount with 400` / `rejects non-integer amount with 400` | ✅ COMPLIANT |
| Contract read access restricted to participants | Participant reads a contract | `contracts.routes.test.ts > returns the contract with milestones to the client` / `returns the contract to the seller` | ✅ COMPLIANT |
| Contract read access restricted to participants | Non-participant reads a contract | `contracts.routes.test.ts > returns 403 to non-participant` | ✅ COMPLIANT |
| Contract read access restricted to participants | List returns only the caller's contracts | `contracts.routes.test.ts > returns only the caller's contracts` | ✅ COMPLIANT |
| Contract status transitions | New contract starts in draft | `contracts.routes.test.ts > creates a contract with milestones atomically` (asserts `status === "draft"`) | ✅ COMPLIANT |
| Contract status transitions | Contract becomes active on first funding | `stripe-webhooks.flow.test.ts > transitions pending → funded … sets contract active on first funded` | ✅ COMPLIANT |
| Contract status transitions | Contract becomes completed when all milestones paid | `milestones.approve.routes.test.ts > transitions in_review → paid … completes the contract on the last paid milestone` (+ `does NOT complete … when other unpaid milestones remain`) | ✅ COMPLIANT |

### `milestones/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Milestone model | Milestone persisted with required fields | `contracts.routes.test.ts > creates a contract with milestones atomically` | ✅ COMPLIANT |
| Milestone state machine (happy path) | Seller submits delivery | `milestones.routes.test.ts > transitions funded → in_review when called by the seller` | ✅ COMPLIANT |
| Milestone state machine (happy path) | Client approves delivery | `milestones.approve.routes.test.ts > transitions in_review → paid …` (returns `paid`; literal `approved` asserted only on the failure/retry paths) | ⚠️ PARTIAL |
| Invalid transitions are rejected | Invalid transition rejected | `milestones.routes.test.ts > returns 409 when the milestone is in pending status` + `milestones.approve.routes.test.ts > returns 409 when … pending` | ✅ COMPLIANT |
| Invalid transitions are rejected | Wrong role rejected | `milestones.routes.test.ts > returns 403 when called by a non-seller participant (the client)` | ✅ COMPLIANT |
| Invalid transitions are rejected | Skip-step transition rejected | `milestones.approve.routes.test.ts > returns 409 when the milestone is in funded status (skip-step)` | ✅ COMPLIANT |
| Disputed state is reserved | Disputed not reachable | `milestones.routes.test.ts > submit on a disputed milestone returns 409` / `approve on a disputed milestone returns 409` / `fund on a disputed milestone returns 409` (status stays `disputed`) | ✅ COMPLIANT |

> PARTIAL note (WARNING-2, still open): `approve` performs `in_review → approved` and then
> `approved → paid` inside one request and returns the terminal `paid`. `milestones/spec.md`
> still states the client-approval transition "MUST become `approved`". The literal `approved`
> state is asserted by the failure/retry tests (`returns 502 … stays approved`,
> `allows the payout to be RETRIED …`) but never on the successful approval path. This is a
> spec/design tension, not a money defect; behavior is coherent with `milestone-payout/spec.md`
> ("the milestone status MUST become `paid`"). See WARNING-2.

> Disputed note (previously WARNING-4): **resolved** — three regression tests now assert the
> reserved `disputed` status cannot be advanced via submit/approve/fund.

### `milestone-funding/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Funding a pending milestone | Client initiates funding | `milestones.routes.test.ts > creates a PaymentIntent on the platform account, stores the id, and returns the clientSecret` | ✅ COMPLIANT |
| Funding a pending milestone | Successful payment moves milestone to funded | `stripe-webhooks.flow.test.ts > transitions pending → funded, writes platform_receipt ledger, and sets contract active on first funded` | ✅ COMPLIANT |
| Funding a pending milestone | Failed payment leaves milestone pending | `stripe-webhooks.flow.test.ts > leaves the milestone pending and writes no ledger row` | ✅ COMPLIANT |
| Funding is idempotent | Re-fund a funded milestone | `milestones.routes.test.ts > returns 409 on a re-fund attempt (no second PaymentIntent, no extra ledger row)` + `returns 409 when the milestone is already funded` | ✅ COMPLIANT |
| Funding is idempotent | Webhook re-delivery is a no-op | `stripe-webhooks.flow.test.ts > is idempotent on re-delivery: 1 ledger row, 1 webhook row, status stable, both 2xx` | ✅ COMPLIANT |
| Funding requires participant role | Non-client cannot fund | `milestones.routes.test.ts > returns 403 when called by the seller` + `returns 403 to a non-participant (outsider)` | ✅ COMPLIANT |

### `milestone-payout/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Payout on client approval | Approval triggers commission + transfer | `milestones.approve.routes.test.ts > transitions in_review → paid, writes 2 ledger rows summing to amount …` (+ `splits odd cents exactly: … 999 cents`) | ✅ COMPLIANT |
| Payout on client approval | Ledger balances after payout | same tests: `sum === 12345`; odd-cents `commission 99 + transfer 900 === 999` | ✅ COMPLIANT |
| Payout is idempotent | Duplicate approval is a no-op | `milestones.approve.routes.test.ts > returns 409 on a duplicate approval …` (`fake.transferCount() === 1`) | ✅ COMPLIANT |
| Payout is idempotent | Re-delivered transfer event is a no-op | `stripe-webhooks.flow.test.ts > records transfer.created in stripe_webhook_events so re-delivery is a no-op` + `records transfer.failed in stripe_webhook_events so re-delivery is a no-op` | ✅ COMPLIANT (was ⚠️ PARTIAL) |
| Missing connected account is handled gracefully | No connected account | `milestones.approve.routes.test.ts > returns 409 … when the seller has no connected account` + `returns 502 … payouts are not enabled` + `returns 502 … when the Stripe Transfer throws` + `allows the payout to be RETRIED …` | ✅ COMPLIANT |

### `connect-onboarding/spec.md` (updated spec — any authenticated user)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Users can start Connect onboarding | Authenticated user requests an onboarding link | `connect.routes.test.ts > creates a Connect Express account, stores it on the user, and returns a hosted URL` (+ `reuses an existing account on subsequent calls (no duplicate create)`) | ✅ COMPLIANT |
| Users can start Connect onboarding | Unauthenticated request is rejected | `connect.routes.test.ts > returns 401 without auth` (POST) | ✅ COMPLIANT |
| Users can check onboarding status | Onboarding complete with payouts enabled | `connect.routes.test.ts > returns onboardingComplete=true after a fresh account is created` | ✅ COMPLIANT |
| Users can check onboarding status | Onboarding incomplete | `connect.routes.test.ts > returns hasAccount=false and all flags false for a user with no account` + `refreshes the persisted flags from retrieveAccount when they drift` | ✅ COMPLIANT |
| Account updates reflect payouts enabled | account.updated enables payouts | `stripe-webhooks.flow.test.ts > updates the user's payout flags` | ✅ COMPLIANT |
| Account updates reflect payouts enabled | Re-delivered account.updated is a no-op | `stripe-webhooks.flow.test.ts > is a no-op on re-delivery` | ✅ COMPLIANT |

### `stripe-webhooks/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Single webhook endpoint | Signed event is accepted | `stripe-webhooks.flow.test.ts` (signed events → 200) | ✅ COMPLIANT |
| Single webhook endpoint | Unsigned or bad-signature event is rejected | `stripe-webhooks.test.ts > rejects requests without a signature with 400 (not 500)` + `rejects requests with a tampered signature with 400 (not 500)` | ✅ COMPLIANT |
| Webhook processing is idempotent | Re-delivered payment_intent.succeeded | `stripe-webhooks.flow.test.ts > is idempotent on re-delivery …` | ✅ COMPLIANT |
| Webhook processing is idempotent | Re-delivered account.updated | `stripe-webhooks.flow.test.ts > (account.updated) is a no-op on re-delivery` | ✅ COMPLIANT |
| Handled event types | payment_intent.succeeded | `stripe-webhooks.flow.test.ts > transitions pending → funded …` | ✅ COMPLIANT |
| Handled event types | payment_intent.payment_failed | `stripe-webhooks.flow.test.ts > leaves the milestone pending and writes no ledger row` | ✅ COMPLIANT |
| Unknown events are acknowledged and ignored | Unknown event type | `stripe-webhooks.test.ts > acknowledges unknown event types with 200 and never 5xx` | ✅ COMPLIANT |
| Duplicate and unknown events never 5xx | Duplicate is acknowledged | `stripe-webhooks.test.ts > treats the second delivery of the same event as a no-op` | ✅ COMPLIANT |

### Compliance summary (before → after)

| Status | Before (FAIL) | After (this run) |
|--------|---------------|------------------|
| ✅ COMPLIANT | 34 | **40** |
| ⚠️ PARTIAL | 2 | **1** |
| ❌ UNTESTED | 1 | **0** |
| ❌ MISSING (unimplemented) | 4 | **0** |
| ❌ FAILING | 0 | **0** |
| **Total scenarios** | **41** | **41** |

**40 / 41 scenarios compliant.** All money-critical scenarios are compliant. The single PARTIAL
is the documented `approved`/`paid` spec tension (WARNING-2), not a runtime failure.

---

## 3.1 Money-Critical Evidence (re-confirmed)

| Behavior | Evidence (test) | Result |
|---|---|---|
| Funding idempotency | `milestones.routes.test.ts > returns 409 on a re-fund attempt (no second PaymentIntent, no extra ledger row)` — same `stripePaymentIntentId`, status stays `pending`, `ledgerEntry.count() === 0` | ✅ PASS |
| Webhook idempotency (duplicate = no-op) | `stripe-webhooks.flow.test.ts > is idempotent on re-delivery: 1 ledger row, 1 webhook row, status stable, both 2xx` | ✅ PASS |
| transfer.* idempotency (NEW guard) | `records transfer.created in stripe_webhook_events so re-delivery is a no-op` + `transfer.failed` variant — second delivery leaves exactly 1 `stripe_webhook_events` row, 0 ledger rows | ✅ PASS |
| 10% split exactness (`commission + transfer === amount`) | `payments/commission.test.ts` + `milestones.approve.routes.test.ts > splits odd cents exactly (99 + 900 === 999)`; `Math.floor`, integers only | ✅ PASS |
| Payout idempotency (no double transfer) | `returns 409 on a duplicate approval … fake.transferCount() === 1`, ledger stays 2 rows, `stripeTransferId` unchanged | ✅ PASS |
| Failure leaves no partial state | `returns 502 … when the Stripe Transfer throws` (status `approved`, `stripeTransferId`/`paidAt` null, 0 ledger rows, contract not completed) + no-account / payouts-not-enabled variants | ✅ PASS |
| Payout retry after onboarding | `allows the payout to be RETRIED once the seller connects an account` — first 409 + `approved` + 0 ledger; after account attach, second 200 + `paid` + 2 ledger rows | ✅ PASS |

**Single source of truth**: `src/modules/payments/commission.ts::splitCommission`
(`commission = Math.floor(amount * 0.10)`, `transfer = amount - commission`). No other code path
recomputes the split (verified by grep). The real Stripe adapter `createPaymentIntent` sends no
`transfer_data` — funds settle on the platform balance as required.

---

## 4. Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Contract creation + N integer-cents milestones | ✅ Implemented | `contracts.schemas.ts` zod `.int().positive()`; `ContractsService.create` in a `$transaction`; seller must exist (404) and differ (400). |
| Participant-only read access | ✅ Implemented | `ContractsService.getForUser` uses shared `assertParticipant`; `listByUser` scoped. Non-participant → 403. |
| Contract draft/active/completed transitions | ✅ Implemented | Default `draft`; webhook activates on first funded; approve completes when all milestones paid. `cancelled` unreachable. |
| Milestone model + state machine | ✅ Implemented | Prisma enum + `transitionStatusIf` compare-and-set. Seller-only submit; client-only approve. |
| Invalid transitions rejected | ✅ Implemented | Compare-and-set guards → 409; role guards → 403. |
| Disputed reserved | ✅ Implemented + **tested** | Enum member exists; no route accepts a target status; 3 regression tests assert it stays `disputed`. |
| Funding on platform account | ✅ Implemented | `createPaymentIntent` with only `amount/currency/metadata`; PI id stored; status stays `pending` until webhook. |
| Funding idempotency | ✅ Implemented | `stripePaymentIntentId @unique` + status guard + Stripe idempotency key `fund:${mid}`. |
| Webhook signature verification | ✅ Implemented | Encapsulated `application/json` buffer parser + `constructWebhookEvent`; bad/missing sig → 400. |
| Webhook idempotency | ✅ Implemented | `StripeWebhookEvent.eventId @unique` inserted in the same `$transaction`; duplicate → no-op. |
| 5 handled event types | ✅ Implemented | `payment_intent.succeeded/payment_failed`, `account.updated` do work; `transfer.created/failed` now insert a dedup row (see WARNING-3 resolved). |
| Payout 10% commission + 90% transfer | ✅ Implemented | `splitCommission` + `createTransfer(transfer)` with idempotency key `transfer:${mid}`; ledger rows `commission_credit` + `transfer_credit`. |
| Payout idempotency | ✅ Implemented | `paid` → 409; `stripeTransferId @unique`; ledger `idempotencyKey @unique`. |
| Graceful payout failure | ✅ Implemented | Missing/disabled account → 409/502 before transfer; Stripe throw → 502; milestone stays `approved`, no seller ledger. Retry supported. |
| **Connect onboarding API** | ✅ **Implemented** | `src/modules/connect/` with `POST /connect/onboarding-link` + `GET /connect/status`; wired in `src/app.ts`; `UserRepository.setStripeAccountId` persists the Express account id; OpenAPI has both paths. |
| `account.updated` state update | ✅ Implemented | `handleAccountUpdated` updates `stripeAccountPayoutsEnabled`/`stripeAccountDetailsSubmitted`, deduped by event id. |
| Money as integer minor units | ✅ Implemented | `Int` columns; no float arithmetic. |
| Standard error envelope | ✅ Implemented | `error-handler.ts` maps codes/status; 400/401/403/404/409/502 all use the envelope. |

---

## 5. Coherence (Design)

| Decision (design.md) | Followed? | Notes |
|---|---|---|
| 1. Prisma normalized + enums; uniques on PI/transfer/ledger-key/eventId; FK indexes | ✅ Yes | Verified in `schema.prisma` + migration. `User` now also carries `stripeAccountId` (nullable). |
| 2. `StripeClient` port method-per-use-case; real + fake with `fake.webhook.emit` | ✅ Yes | Port/adapters unchanged; connect service consumes `createExpressAccount`/`createAccountLink`/`retrieveAccount` (no longer dead code). |
| 3. Raw body via parser; sig failure → 400 (not 500) | ✅ Yes | Custom `addContentTypeParser("application/json", {parseAs:"buffer"})` inside the encapsulated plugin. |
| 4. Idempotency = DB uniques | ✅ Yes | `fund:${mid}`, `transfer:${mid}`, `pi:${eventId}`, `transfer:${mid}:comm/xf`, and now transfer/account event ids in `stripe_webhook_events`. |
| 5. `$transaction` per op; transfer outside tx | ✅ Yes | Funding, webhook, and post-transfer finalization all in transactions; `createTransfer` outside. |
| 6. Commission typed module, exactly-summing split | ✅ Yes | `payments/commission.ts::splitCommission`. |
| 7. Authorization = shared helper `assertParticipant`/`assertRole` | ✅ Yes (**was ⚠️ Deviated**) | `assertParticipant` now imported by `contracts.service.ts` and `milestones.service.ts`; unused `assertRole` removed. See SUGGESTION-1 for a different dead helper. |
| 8. Endpoints per Interfaces table (incl. `/connect/*`) | ✅ Yes → resolved | Both `/connect/*` routes now exist and are in OpenAPI. **Stale-design note**: the Interfaces table still lists `role=seller` for `/connect/*`, while the updated spec and implementation allow **any authenticated user**. Spec is authoritative; the design row should be refreshed. |
| 9. Env = Zod, Stripe optional in test | ✅ Yes | `config/env.ts` includes `STRIPE_CONNECT_REFRESH_URL`/`STRIPE_CONNECT_RETURN_URL`; non-test boot fails without Stripe vars. |
| 10. Testing = mocked port + `escrowly_test` DB | ✅ Yes | Fake wired in `buildApp` under test; `truncateTables()` covers the new tables; new `connect.routes.test.ts`. |

---

## 6. Issues Found

### CRITICAL (must fix before archive)

**None.** CRITICAL-1 from the baseline is resolved: `POST /connect/onboarding-link` and
`GET /connect/status` exist, are wired in `src/app.ts`, appear in `openapi.yaml`, and are covered
by 7 passing tests (create+store, account reuse, onboarding-complete, incomplete, status refresh
from `retrieveAccount`, unauthenticated 401 on both routes). The `connect-onboarding` spec was
updated to "any authenticated user" and now matches the implementation.

### WARNING (should fix)

1. **WARNING-2 (carried over): milestone "Client approves delivery" collapses to `paid`; literal
   intermediate `approved` unasserted on success.** `approve` performs `in_review → approved` then
   `approved → paid` in one request and returns `paid`, while `milestones/spec.md` still says the
   client approval transition "MUST become `approved`". `approved` is asserted only on the
   failure/retry paths. Behavior is coherent with `milestone-payout/spec.md` ("MUST become `paid`"),
   so this is a spec/design tension, not a defect — but the spec text and implementation still
   diverge and should be reconciled or explicitly documented. → scenario marked ⚠️ PARTIAL.

### SUGGESTION (nice to have)

1. **New dead code**: `UserRepository.updateStripeAccountFlags` is declared in the port and
   implemented in the Prisma adapter but **never called** — the webhook handler and connect
   service write flags via `tx.user.update` / `prisma.user.update` directly. Either adopt it or
   remove it (same class of issue as the previously-fixed `authorization.ts`).
2. No behavioral test asserts the real adapter's `createExpressAccount` payload
   (`settings.payouts.schedule = { interval: "manual" }`, `type: "express"`, country `"US"`); the
   fake does not model these options. Verified statically only (would need live/mock-SDK coverage).
3. No coverage tooling configured; consider `vitest --coverage` with a threshold for the money
   modules.
4. No test covers a DB-transaction failure *after* a successful Stripe transfer (process-crash
   window). The Stripe idempotency key protects against a double transfer, but this recovery path
   is unverified (unchanged from the baseline SUGGESTION-9).

### Resolved from the baseline report

| Baseline issue | Status |
|---|---|
| CRITICAL-1 — connect-onboarding API unimplemented | ✅ Resolved (module + routes + OpenAPI + 7 tests) |
| WARNING-3 — `transfer.*` not recorded in `stripe_webhook_events` | ✅ Resolved (`handleTransferEvent` uses `tryInsert` in a `$transaction`; dedup tests added) |
| WARNING-4 — disputed-unreachable untested | ✅ Resolved (3 regression tests) |
| WARNING-5 — real `createExpressAccount` used `delay_days` | ✅ Resolved (only `{ interval: "manual" }`; `grep delay_days` → none) |
| SUGGESTION-6 — `tasks.md` stale / omitted connect | ✅ Resolved (Phase 8 added; 4.1/4.2 text corrected) |
| SUGGESTION-7 — `authorization.ts` dead code | ✅ Resolved (`assertParticipant` adopted; `assertRole` removed; `assertRole` grep → none) |

---

## 7. Verdict

**PASS WITH WARNINGS**

All six capabilities are now implemented and behaviorally verified. `pnpm exec tsc --noEmit`
clean, `pnpm openapi` produces a byte-identical spec (now including `/connect/*`), and
`pnpm test` is **128/128 green**. The full spec compliance matrix improved from
**34/41 (FAIL)** to **40/41 compliant, 0 untested, 0 missing, 0 failing**, with all money-critical
invariants (funding idempotency, webhook idempotency, exact 10% split, payout idempotency, no
double transfer, failure leaves no partial state, payout retry) re-confirmed by passing tests.
The previously-blocking CRITICAL-1 and WARNINGs 3–5 are resolved. The only remaining divergence is
WARNING-2 (the `approved`/`paid` spec tension), which is non-blocking and should be reconciled or
documented before archive. Not a FAIL.
