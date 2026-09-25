# Verification Report

**Change**: escrowly-happy-path
**Version**: N/A (delta specs, no explicit version)
**Mode**: Standard Verify (`strict_tdd: false` in `openspec/config.yaml`)
**Artifact store**: openspec
**Verified at**: 2026-09-25
**Executor**: sdd-verify (read-only; no fixes applied)

---

## 1. Completeness

### Tasks

| Metric | Value |
|--------|-------|
| Tasks total | 23 |
| Tasks complete `[x]` | 23 |
| Tasks incomplete `[ ]` | 0 |

All 23 tasks in `tasks.md` are marked complete. However, task completion is
misleading in two ways:

1. **Phase 4 tasks 4.1/4.2 are marked `[x]` but their text still says
   "DEFERRED to payout slice (PR 4)".** The deferred `approve` work is in fact
   implemented (PR 4, commit `4ee8650`) and covered by
   `milestones.approve.routes.test.ts`. The checkmark is legitimate; the text is stale.
2. **`tasks.md` never contained a task for the `connect` module.** Design
   (`design.md` — File Changes row `src/modules/{contracts,milestones,connect}/…`
   and the Interfaces table rows `POST /connect/onboarding-link` /
   `GET /connect/status`) requires it, and the `connect-onboarding` spec requires
   it, but the task breakdown silently dropped it. This is the root cause of the
   CRITICAL finding below.

### Spec coverage of tasks

| Spec capability | Tasks present? | Implementation present? |
|-----------------|----------------|--------------------------|
| `contracts` | Yes (3.1–3.3) | Yes |
| `milestones` | Yes (4.1–4.2) | Yes |
| `milestone-funding` | Yes (5.1) | Yes |
| `milestone-payout` | Yes (6.1–6.3) | Yes |
| `connect-onboarding` | **NO dedicated task** | **NO** (only webhook `account.updated` half) |
| `stripe-webhooks` | Yes (5.2–5.4) | Yes |

**Explicit connect-onboarding note**: the capability is only one-third implemented.
`account.updated` (webhook requirement) works and is tested, but the two
seller-facing API requirements — "Sellers can start Connect onboarding" and
"Sellers can check onboarding status" — have **no routes, no service, no module,
no OpenAPI entries, and no tests**. See CRITICAL-1.

---

## 2. Build & Tests Execution

All commands run in `app-escrowly-backend/`. No build/dev-server/commit was run.

**Type check** (`pnpm exec tsc --noEmit`): ✅ Passed — exit code 0, no output.

**OpenAPI** (`pnpm openapi`): ✅ Passed — exit code 0, `openapi.yaml generated`.
Regenerated file was **byte-identical** to the committed file (`git diff --stat`
empty), so the contract is in sync with the implemented routes.

**Tests** (`pnpm test` → `vitest run`): ✅ **116 passed / 0 failed / 0 skipped**,
exit code 0, 12 test files, 15.02 s.

```
 ✓ src/modules/milestones/milestones.approve.routes.test.ts (15 tests)
 ✓ src/modules/contracts/contracts.routes.test.ts            (17 tests)
 ✓ src/modules/milestones/milestones.routes.test.ts          (15 tests)
 ✓ src/modules/auth/auth.routes.test.ts                      (16 tests)
 ✓ src/plugins/stripe-webhooks.flow.test.ts                  (8 tests)
 ✓ src/modules/users/users.routes.test.ts                    (7 tests)
 ✓ src/plugins/stripe-webhooks.test.ts                       (7 tests)
 ✓ src/modules/auth/password.test.ts                         (4 tests)
 ✓ src/plugins/error-handler.test.ts                         (4 tests)
 ✓ src/modules/auth/auth.schemas.test.ts                     (13 tests)
 ✓ src/modules/auth/tokens.test.ts                           (6 tests)
 ✓ src/modules/payments/commission.test.ts                   (4 tests)
 Test Files  12 passed (12)
      Tests  116 passed (116)
```

**Coverage**: ➖ Not available — no coverage script/tool configured and
`rules.verify.coverage_threshold` is unset in `openspec/config.yaml`.

---

## 3. Spec Compliance Matrix

Every requirement/scenario across all six delta specs, cross-referenced to the
executed test run. `connect-onboarding` is included and marked MISSING where the
implementation does not exist.

### `contracts/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Create contract as the authenticated client | Successful contract creation | `contracts.routes.test.ts > creates a contract with milestones atomically` | ✅ COMPLIANT |
| Create contract as the authenticated client | Empty milestone list | `contracts.routes.test.ts > rejects empty milestone list with 400` | ✅ COMPLIANT |
| Create contract as the authenticated client | Non-positive or non-integer milestone amount | `contracts.routes.test.ts > rejects zero/negative/non-integer amount with 400` (3 tests) | ✅ COMPLIANT |
| Contract read access restricted to participants | Participant reads a contract | `contracts.routes.test.ts > returns the contract with milestones to the client` / `returns the contract to the seller` | ✅ COMPLIANT |
| Contract read access restricted to participants | Non-participant reads a contract | `contracts.routes.test.ts > returns 403 to non-participant` | ✅ COMPLIANT |
| Contract read access restricted to participants | List returns only the caller's contracts | `contracts.routes.test.ts > returns only the caller's contracts` | ✅ COMPLIANT |
| Contract status transitions | New contract starts in draft | `contracts.routes.test.ts > creates a contract with milestones atomically` (asserts `status === "draft"`) | ✅ COMPLIANT |
| Contract status transitions | Contract becomes active on first funding | `stripe-webhooks.flow.test.ts > transitions pending → funded … sets contract active on first funded` | ✅ COMPLIANT |
| Contract status transitions | Contract becomes completed when all milestones paid | `milestones.approve.routes.test.ts > transitions in_review → paid … completes the contract on the last paid milestone` (+ negative test when unpaid remain) | ✅ COMPLIANT |

### `milestones/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Milestone model | Milestone persisted with required fields | `contracts.routes.test.ts > creates a contract with milestones atomically` | ✅ COMPLIANT |
| Milestone state machine (happy path) | Seller submits delivery | `milestones.routes.test.ts > transitions funded → in_review when called by the seller` | ✅ COMPLIANT |
| Milestone state machine (happy path) | Client approves delivery | `milestones.approve.routes.test.ts > transitions in_review → paid … last paid milestone` | ⚠️ PARTIAL |
| Invalid transitions are rejected | Invalid transition rejected | `milestones.routes.test.ts > returns 409 when the milestone is in pending status` + `milestones.approve.routes.test.ts > returns 409 when … pending` | ✅ COMPLIANT |
| Invalid transitions are rejected | Wrong role rejected | `milestones.routes.test.ts > returns 403 when called by a non-seller participant (the client)` | ✅ COMPLIANT |
| Invalid transitions are rejected | Skip-step transition rejected | `milestones.approve.routes.test.ts > returns 409 when the milestone is in funded status (skip-step)` | ✅ COMPLIANT |
| Disputed state is reserved | Disputed not reachable | (none found) | ❌ UNTESTED |

> PARTIAL note: the implementation collapses `in_review → approved → paid` into a
> single `POST …/approve` call and returns the terminal `paid` status. The
> intermediate `approved` state is only observed on the *failure/retry* paths
> (`returns 502 … stays approved`, `allows the payout to be RETRIED …`). No test
> asserts the literal "status MUST become approved" on the successful approval
> scenario. See WARNING-2.
>
> UNTESTED note: no test attempts to set a milestone to `disputed`. The state is
> unreachable *by construction* (no endpoint accepts a target status), so this is
> a missing regression guard, not a code defect. See WARNING-4.

### `milestone-funding/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Funding a pending milestone | Client initiates funding | `milestones.routes.test.ts > creates a PaymentIntent on the platform account, stores the id, and returns the clientSecret` | ✅ COMPLIANT |
| Funding a pending milestone | Successful payment moves milestone to funded | `stripe-webhooks.flow.test.ts > transitions pending → funded, writes platform_receipt ledger, and sets contract active` | ✅ COMPLIANT |
| Funding a pending milestone | Failed payment leaves milestone pending | `stripe-webhooks.flow.test.ts > (payment_failed) leaves the milestone pending and writes no ledger row` | ✅ COMPLIANT |
| Funding is idempotent | Re-fund a funded milestone | `milestones.routes.test.ts > returns 409 on a re-fund attempt (no second PaymentIntent, no extra ledger row)` + `returns 409 when the milestone is already funded` | ✅ COMPLIANT |
| Funding is idempotent | Webhook re-delivery is a no-op | `stripe-webhooks.flow.test.ts > is idempotent on re-delivery: 1 ledger row, 1 webhook row, status stable` | ✅ COMPLIANT |
| Funding requires participant role | Non-client cannot fund | `milestones.routes.test.ts > returns 403 when called by the seller` + `returns 403 to a non-participant (outsider)` | ✅ COMPLIANT |

### `milestone-payout/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Payout on client approval | Approval triggers commission + transfer | `milestones.approve.routes.test.ts > transitions in_review → paid, writes 2 ledger rows summing to amount …` (+ `splits odd cents exactly: … 999 cents`) | ✅ COMPLIANT |
| Payout on client approval | Ledger balances after payout | same tests: `sum === 12345`; odd-cents `commission 99 + transfer 900 === 999` | ✅ COMPLIANT |
| Payout is idempotent | Duplicate approval is a no-op | `milestones.approve.routes.test.ts > returns 409 on a duplicate approval … (no second Transfer, no extra ledger)` (`fake.transferCount() === 1`) | ✅ COMPLIANT |
| Payout is idempotent | Re-delivered transfer event is a no-op | `stripe-webhooks.flow.test.ts > acknowledges transfer.created/transfer.failed with 200 and writes no ledger` (single delivery only) | ⚠️ PARTIAL |
| Missing connected account is handled gracefully | No connected account | `milestones.approve.routes.test.ts > returns 409 … when the seller has no connected account` + `returns 502 … payouts are not enabled` + `returns 502 … when the Stripe Transfer throws` | ✅ COMPLIANT |

> PARTIAL note: `transfer.*` events are acknowledged-only (log line, no ledger,
> no status change), so re-delivery is trivially a no-op — but there is no
> dedicated re-delivery test, and `transfer.*` events are **not** inserted into
> `stripe_webhook_events` (no dedup record). See WARNING-3.

### `connect-onboarding/spec.md` — ⚠️ CRITICAL: mostly MISSING

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Sellers can start Connect onboarding | Seller requests an onboarding link | (none — no `POST /connect/onboarding-link`, no `src/modules/connect/`) | ❌ MISSING / UNTESTED |
| Sellers can start Connect onboarding | Non-seller cannot start onboarding | (none — no route) | ❌ MISSING / UNTESTED |
| Sellers can check onboarding status | Onboarding complete with payouts enabled | (none — no `GET /connect/status`) | ❌ MISSING / UNTESTED |
| Sellers can check onboarding status | Onboarding incomplete | (none — no route) | ❌ MISSING / UNTESTED |
| Account updates reflect payouts enabled | account.updated enables payouts | `stripe-webhooks.flow.test.ts > updates the user's payout flags` | ✅ COMPLIANT |
| Account updates reflect payouts enabled | Re-delivered account.updated is a no-op | `stripe-webhooks.flow.test.ts > is a no-op on re-delivery` | ✅ COMPLIANT |

### `stripe-webhooks/spec.md`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Single webhook endpoint | Signed event is accepted | `stripe-webhooks.flow.test.ts` (signed `payment_intent.succeeded` etc. → 200) | ✅ COMPLIANT |
| Single webhook endpoint | Unsigned or bad-signature event is rejected | `stripe-webhooks.test.ts > rejects requests without a signature with 400` + `rejects requests with a tampered signature with 400` | ✅ COMPLIANT |
| Webhook processing is idempotent | Re-delivered payment_intent.succeeded | `stripe-webhooks.flow.test.ts > is idempotent on re-delivery …` | ✅ COMPLIANT |
| Webhook processing is idempotent | Re-delivered account.updated | `stripe-webhooks.flow.test.ts > (account.updated) is a no-op on re-delivery` | ✅ COMPLIANT |
| Handled event types | payment_intent.succeeded | `stripe-webhooks.flow.test.ts > transitions pending → funded …` | ✅ COMPLIANT |
| Handled event types | payment_intent.payment_failed | `stripe-webhooks.flow.test.ts > leaves the milestone pending and writes no ledger row` | ✅ COMPLIANT |
| Unknown events are acknowledged and ignored | Unknown event type | `stripe-webhooks.test.ts > acknowledges unknown event types with 200 and never 5xx` | ✅ COMPLIANT |
| Duplicate and unknown events never 5xx | Duplicate is acknowledged | `stripe-webhooks.test.ts > treats the second delivery of the same event as a no-op` | ✅ COMPLIANT |

### `api-foundations/spec.md` (baseline touched by this change)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Standard error envelope | Error returns standard envelope | `plugins/error-handler.test.ts` (4 tests) + new routes assert `body.code` (FORBIDDEN/CONFLICT/NOT_FOUND/VALIDATION_ERROR) | ✅ COMPLIANT |
| Validation failures return 400 | Malformed request body | `contracts.routes.test.ts` 400 tests + `stripe-webhooks.test.ts > malformed JSON … 400` | ✅ COMPLIANT |
| Money is integer minor units | Future amount field | `contracts.schemas.ts` zod `.int().positive()`; `contracts.routes.test.ts > rejects non-integer amount with 400` | ✅ COMPLIANT |

### Compliance summary

| Status | Count |
|--------|-------|
| ✅ COMPLIANT | 34 |
| ⚠️ PARTIAL | 2 |
| ❌ UNTESTED | 1 |
| ❌ MISSING (unimplemented) | 4 |
| ❌ FAILING | 0 |
| **Total scenarios** | **41** |

**34 / 41 scenarios compliant.** All money-critical scenarios are compliant.

---

## 3.1 Money-Critical Evidence (explicitly requested)

| Behavior | Evidence (test) | Result |
|---|---|---|
| Funding idempotency | `milestones.routes.test.ts > returns 409 on a re-fund attempt (no second PaymentIntent, no extra ledger row)` — asserts same `stripePaymentIntentId`, status stays `pending`, `ledgerEntry.count() === 0` | ✅ PASS |
| Webhook idempotency (duplicate = no-op) | `stripe-webhooks.flow.test.ts > is idempotent on re-delivery: 1 ledger row, 1 webhook row, status stable, both 2xx` | ✅ PASS |
| 10% split exactness (`commission + transfer === amount`) | `payments/commission.test.ts` (999/100/1/9/11/123/7777/12345) + `milestones.approve.routes.test.ts > splits odd cents exactly (99 + 900 === 999)`; no floats (`Math.floor`, integers) | ✅ PASS |
| Payout idempotency (no double transfer) | `milestones.approve.routes.test.ts > returns 409 on a duplicate approval … fake.transferCount() === 1`, ledger still 2 rows, `stripeTransferId` unchanged | ✅ PASS |
| Failure leaves no partial state | `returns 502 … when the Stripe Transfer throws` (status `approved`, `stripeTransferId`/`paidAt` null, 0 ledger rows, contract not completed) + no-account / payouts-not-enabled variants | ✅ PASS |
| Payout retry after onboarding | `milestones.approve.routes.test.ts > allows the payout to be RETRIED once the seller connects an account` — first 409 + `approved` + 0 ledger; after account attach, second 200 + `paid` + 2 ledger rows | ✅ PASS |

**Single source of truth**: `src/modules/payments/commission.ts::splitCommission`
(`commission = Math.floor(amount * 0.10)`, `transfer = amount - commission`). No
other code path recomputes the split (verified by grep). The real Stripe adapter
`createPaymentIntent` sends no `transfer_data` — funds settle on the platform
balance as required.

---

## 4. Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Contract creation + N integer-cents milestones | ✅ Implemented | `contracts.schemas.ts` zod `.int().positive()`; `ContractsService.create` in a `$transaction`; seller must exist (404) and differ (400). |
| Participant-only read access | ✅ Implemented | `ContractsService.getForUser`/`listByUser`; non-participant → 403 with standard envelope. |
| Contract draft/active/completed transitions | ✅ Implemented | Default `draft`; webhook activates on first funded; approve completes when all milestones paid. `cancelled` unreachable. |
| Milestone model + state machine | ✅ Implemented | Prisma enum + `transitionStatusIf` compare-and-set. Seller-only submit; client-only approve. |
| Invalid transitions rejected | ✅ Implemented | Compare-and-set guards → 409; role guards → 403. |
| Disputed reserved | ✅ Implemented (structurally) | Enum member exists; no route accepts a target status; no transition writes `disputed`. No test. |
| Funding on platform account | ✅ Implemented | `createPaymentIntent` with only `amount/currency/metadata`; PI id stored on milestone; status stays `pending` until webhook. |
| Funding idempotency | ✅ Implemented | `stripePaymentIntentId @unique` + status guard + Stripe idempotency key `fund:${mid}`. |
| Webhook signature verification | ✅ Implemented | Encapsulated `application/json` buffer parser + `constructWebhookEvent`; bad/missing sig → 400. |
| Webhook idempotency | ✅ Implemented | `StripeWebhookEvent.eventId @unique` inserted in the same `$transaction`; duplicate → no-op. |
| 5 handled event types | ✅ Implemented | `payment_intent.succeeded/payment_failed`, `account.updated` do work; `transfer.created/failed` are acknowledge-only (log). |
| Payout 10% commission + 90% transfer | ✅ Implemented | `splitCommission` + `createTransfer(transfer)` with idempotency key `transfer:${mid}`; ledger rows `commission_credit` + `transfer_credit`. |
| Payout idempotency | ✅ Implemented | `paid` → 409; `stripeTransferId @unique`; ledger `idempotencyKey @unique`. |
| Graceful payout failure | ✅ Implemented | Missing/disabled account → 4xx/502 before transfer; Stripe throw → 502; milestone stays `approved`, no seller ledger. |
| **Connect onboarding API** | ❌ **Missing** | No `src/modules/connect/`, no `/connect/*` routes, no OpenAPI entries. Port + real/fake adapter methods exist but are **dead code**. |
| `account.updated` state update | ✅ Implemented | `handleAccountUpdated` updates `stripeAccountPayoutsEnabled`/`stripeAccountDetailsSubmitted`, deduped by event id. |
| Money as integer minor units | ✅ Implemented | `Int` columns; no float arithmetic. |
| Standard error envelope | ✅ Implemented | `error-handler.ts` maps codes/status; 400/401/403/404/409/502 all use the envelope. |

---

## 5. Coherence (Design)

| Decision (design.md) | Followed? | Notes |
|---|---|---|
| 1. Prisma normalized + enums; uniques on PI/transfer/ledger-key/eventId; FK indexes | ✅ Yes | Verified in `schema.prisma` + migration SQL exactly as specified. |
| 2. `StripeClient` port method-per-use-case; real + fake with `fake.webhook.emit` | ✅ Yes | `ports/stripe-client.ts`, `adapters/stripe/stripe-client.ts`, `stripe-client.fake.ts`. |
| 3. Raw body via parser; sig failure → 400 (not 500) | ✅ Yes | Custom `addContentTypeParser("application/json", {parseAs:"buffer"})` inside the encapsulated plugin (the design explicitly allowed either approach). |
| 4. Idempotency = DB uniques | ✅ Yes | `fund:${mid}`, `transfer:${mid}`, `pi:${eventId}`, `transfer:${mid}:comm/xf`. |
| 5. `$transaction` per op; transfer outside tx | ✅ Yes | Funding, webhook, and post-transfer finalization all in transactions; `createTransfer` outside. |
| 6. Commission typed module, exactly-summing split | ✅ Yes | `payments/commission.ts::splitCommission`. |
| 7. Authorization = shared helper `assertParticipant`/`assertRole` | ⚠️ Deviated | `src/lib/authorization.ts` exists but is **never imported**. Services inline their own `forbidden()` checks. Behavior is correct; the shared helper is dead code. |
| 8. Endpoints per Interfaces table (incl. `/connect/*`) | ⚠️ Deviated | All contracts/milestones/webhook routes exist; **both `/connect/*` routes are absent** (CRITICAL-1). |
| 9. Env = Zod, Stripe optional in test | ✅ Yes | `config/env.ts`; non-test boot fails without Stripe vars. |
| 10. Testing = mocked port + `escrowly_test` DB | ✅ Yes | Fake wired in `buildApp` under test; `truncateTables()` covers the 4 new tables. |

---

## 6. Issues Found

### CRITICAL (must fix before archive)

1. **`connect-onboarding` API requirements are unimplemented.**
   - `connect-onboarding/spec.md` Requirements 1 and 2 (4 scenarios) have no
     implementation: no `src/modules/connect/`, no `POST /connect/onboarding-link`,
     no `GET /connect/status`, and `grep -c connect openapi.yaml` returns **0**.
   - The `StripeClient` port and real/fake adapters implement
     `createExpressAccount` / `createAccountLink` / `retrieveAccount`, but nothing
     in production code calls them — dead code.
   - `design.md` File Changes and the Interfaces table both require the `connect`
     module; `tasks.md` never listed it. `proposal.md` Success Criteria
     ("Connect Express onboarding link returns URL") is unmet.
   - Impact: sellers cannot onboard / check status. The payout flow therefore
     depends on out-of-band manual flag setting, not on an implemented capability.

### WARNING (should fix)

2. **Milestone "Client approves delivery" collapses to `paid`; literal
   intermediate `approved` unasserted on success.** `approve` performs
   `in_review → approved → paid` in one request and returns `paid`, while
   `milestones/spec.md` states the client approval transition "MUST become
   `approved`". `approved` is only asserted on failure/retry paths. Spec/design
   tension to reconcile or DOCUMENT explicitly.
3. **`transfer.created` / `transfer.failed` are acknowledge-only stubs.** They
   are not inserted into `stripe_webhook_events`, so there is no dedup record, and
   the `milestone-payout` scenario "Re-delivered transfer event is a no-op" has no
   dedicated test. Behavior is trivially idempotent today (no side effects), but
   the payout accounting is fully synchronous in `approve` — the spec's "Each type
   MUST map to its corresponding flow (payout)" is only nominally satisfied.
4. **"Disputed not reachable" is untested.** Structurally unreachable (no endpoint
   accepts a target status), but no regression test guards it. Cheap to add.
5. **Real Stripe `createExpressAccount` uses `settings.payouts.schedule =
   { delay_days: 7, interval: "manual" }`.** Stripe's manual schedule normally
   rejects `delay_days`; `interval: "manual"` is the manual-payout switch. This
   path is dead code today (no connect route) and cannot be confirmed without live
   Stripe, but it is a latent bug if/when connect is wired.

### SUGGESTION (nice to have)

6. `tasks.md` is stale/misleading: 4.1/4.2 are `[x]` yet their text says
   "DEFERRED"; more importantly the file omits the connect module entirely — the
   root cause of CRITICAL-1. Update tasks to include connect, or explicitly move
   it to a follow-up change.
7. `src/lib/authorization.ts` is dead code (never imported). Either adopt the
   shared helper in the services (design decision 7) or remove it.
8. No coverage tooling configured; consider `vitest --coverage` with a threshold
   for the money modules.
9. No test covers a DB-transaction failure *after* a successful Stripe transfer
   (process crash window). The Stripe idempotency key protects against a double
   transfer, but this recovery path is unverified.

---

## 7. Verdict

**FAIL**

The five money-critical flows (funding idempotency, webhook idempotency, exact
10% split, payout idempotency, graceful failure + retry) are all implemented and
proven by passing tests — 116/116 green, typecheck clean, OpenAPI in sync
(34/41 scenarios compliant, 0 failing). However, the **`connect-onboarding`
capability's two seller-facing API requirements are entirely unimplemented**
(no routes, no module, no OpenAPI, no tests), which is a CRITICAL missing
requirement and blocks archive. Resolve CRITICAL-1 (implement the connect
endpoints, or formally split them into a follow-up change and remove them from
this change's specs/design) before archiving.
