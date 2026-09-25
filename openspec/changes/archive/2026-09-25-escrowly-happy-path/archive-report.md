# Archive Report — escrowly-happy-path

**Change**: `escrowly-happy-path`
**Archived on**: 2026-09-25
**Archived to**: `openspec/changes/archive/2026-09-25-escrowly-happy-path/`
**Artifact store**: openspec
**Mode**: Standard (`strict_tdd: false`)
**Delivery strategy**: `ask-on-risk` (resolved to a 6-PR stacked-to-main chain)

---

## What was archived

The escrow domain and Stripe money flow for the Escrowly backend. Backend-only, contract-first; the frontend change that consumes this API is not part of this archive. The change ships:

- **Contract** aggregate + endpoints (`POST /contracts`, `GET /contracts`, `GET /contracts/:id`): N milestones per contract, integer-cents amounts, client-first creation by email-named seller, participant-only reads, status lifecycle `draft → active → completed`.
- **Milestone** model and happy-path state machine `pending → funded → in_review → approved → paid` with the `disputed` enum value reserved but unreachable.
- **Funding**: Stripe `PaymentIntent` on the **platform account** (no `transfer_data`); `payment_intent.succeeded` advances `pending → funded` and writes a `platform_receipt` ledger row.
- **Delivery + approval**: seller `funded → in_review`; client `in_review → approved → paid`.
- **Payout**: on approval, **10% platform commission + 90% Stripe `Transfer`** to the seller's CONNECTED account. Single source of truth for the split (`payments/commission.ts::splitCommission`). Idempotent end-to-end.
- **Stripe Connect Express** onboarding available to any authenticated user, manual payouts, hosted onboarding link + status endpoint; `account.updated` webhook reflects `payoutsEnabled`.
- **Webhook endpoint** handling `payment_intent.succeeded/payment_failed`, `account.updated`, `transfer.created/failed`, idempotent by Stripe event id (persisted in `stripe_webhook_events`), unknown and duplicate events acknowledged with 2xx.
- **Ledger** table (debit/credit, reference, `idempotency_key @unique`) for the money side.

## Spec sync table

Main specs did not exist for these six domains — every capability is new. Each delta was converted from delta form (`# Delta for {domain}`, `## ADDED Requirements`) to source-of-truth form (`# {Domain} Specification`, `## Requirements`) and a short `## Purpose` line was added. Every requirement and scenario is preserved verbatim.

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| `contracts` | **Created** (`openspec/specs/contracts/spec.md`) | 3 | 9 |
| `milestones` | **Created** (`openspec/specs/milestones/spec.md`) | 4 | 7 |
| `milestone-funding` | **Created** (`openspec/specs/milestone-funding/spec.md`) | 3 | 6 |
| `milestone-payout` | **Created** (`openspec/specs/milestone-payout/spec.md`) | 3 | 5 |
| `connect-onboarding` | **Created** (`openspec/specs/connect-onboarding/spec.md`) | 3 | 6 |
| `stripe-webhooks` | **Created** (`openspec/specs/stripe-webhooks/spec.md`) | 5 | 8 |
| **Totals** | **6 new specs, 0 modified** | **21** | **41** |

No MODIFIED capabilities. Money-as-integer-minor-units was already in `api-foundations`; commission/Transfer semantics live in the new `milestone-payout` spec.

## Archive contents checklist

- `proposal.md` ✅
- `specs/contracts/spec.md` ✅
- `specs/milestones/spec.md` ✅
- `specs/milestone-funding/spec.md` ✅
- `specs/milestone-payout/spec.md` ✅
- `specs/connect-onboarding/spec.md` ✅
- `specs/stripe-webhooks/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (43/43 tasks complete, all checkboxes `[x]` — original Phases 1–7 plus Phase 8 added during re-verify)
- `verify-report.md` ✅
- `state.yaml` ✅ (preserved for historical reference)
- `archive-report.md` ✅ (this file)

`openspec/changes/` no longer contains the active change — only `openspec/changes/archive/2026-09-25-escrowly-happy-path/` remains from this work.

## Source of truth updated

The following specs now reflect the new behavior and are the canonical contract:

- `openspec/specs/contracts/spec.md` — client-first creation by email-named seller, integer-cents milestones, participant-only reads, status lifecycle.
- `openspec/specs/milestones/spec.md` — milestone model + happy-path state machine, role-driven transitions, `disputed` reserved.
- `openspec/specs/milestone-funding/spec.md` — platform-account `PaymentIntent`, `pending → funded` on success, idempotent re-fund + webhook re-delivery.
- `openspec/specs/milestone-payout/spec.md` — 10% commission + 90% `Transfer` on approval, idempotent duplicate approval + `transfer.*` re-delivery, graceful no-account failure that keeps the milestone `approved` and retryable.
- `openspec/specs/connect-onboarding/spec.md` — onboarding link + status for **any authenticated user**, `account.updated` flag update deduped by event id.
- `openspec/specs/stripe-webhooks/spec.md` — single signed endpoint, 5 handled event types, idempotency by event id, 2xx for duplicates and unknown types.

## Verify history

| Run | When | Verdict | Compliance | Notes |
|-----|------|---------|------------|-------|
| Initial | After PR #15 (`feat/happy-path-payout`) | **FAIL** | 34 / 41 compliant, 2 partial, 1 untested, **4 missing**, 0 failing | **CRITICAL-1**: `connect-onboarding` capability was **unimplemented** — the task breakdown had omitted Phase 8 entirely, so `POST /connect/onboarding-link` and `GET /connect/status` did not exist, the `User` addons for `stripeAccountId` were unused, and `createExpressAccount` was dead code in the `StripeClient` port. WARNINGs 2–5 (approved/paid wording, transfer.* not deduped, disputed-unreachable untested, real `createExpressAccount` using `delay_days` with manual payouts) were also open. |
| Re-verify | After PR #16 (`feat/happy-path-connect`, commit `a712d1a`, merge `a911206`) | **PASS WITH WARNINGS** | **40 / 41 compliant, 0 untested, 0 missing, 0 failing**, 1 partial | All money-critical invariants re-confirmed by passing tests. `pnpm exec tsc --noEmit` clean, `pnpm openapi` produces a byte-identical spec (now including `/connect/*`), `pnpm test` is **128/128 green**. CRITICAL-1 and WARNINGs 3–5 are resolved. The single remaining partial is WARNING-2 (the `approved`/`paid` spec tension between `milestones` and `milestone-payout`): behavior is coherent, only the literal intermediate `approved` status is unasserted on the success path. |
| Spec reconciliation | PR #17 (`chore/happy-path-reconcile`, commit `1e89de7`, merge `065f418`) | — | — | WARNING-2 was closed by aligning the `milestones` client-approval scenario wording with the actual behavior (`in_review → approved → paid` collapsed to a single request; `approved` is asserted only on failure/retry paths) and removing dead code (`UserRepository.updateStripeAccountFlags`). |

### Resolved at the end of the change

- CRITICAL-1 — `connect-onboarding` API unimplemented ✅ (PR #16)
- WARNING-2 — `approved`/`paid` wording in `milestones` spec ✅ (PR #17)
- WARNING-3 — `transfer.*` events not recorded in `stripe_webhook_events` ✅ (PR #16)
- WARNING-4 — disputed-unreachable untested ✅ (PR #16)
- WARNING-5 — real `createExpressAccount` used `delay_days` with manual payouts ✅ (PR #16)
- SUGGESTION-6 — `tasks.md` stale / omitted connect ✅ (PR #16)
- SUGGESTION-7 — `authorization.ts` `assertRole` dead code ✅ (PR #16)

## Notable fixes shipped during the change

1. **Payout RETRY bug (closed in PR #16)** — A failed `Transfer` left the milestone `approved`. The original approval flow modeled the post-failure retry as `in_review → approved` again, which the state machine's compare-and-set guard rejected with 409 forever. The retry path was made `approved → paid` instead, with the Stripe idempotency key (`transfer:${milestoneId}`) preserved so a re-attempted `Transfer` cannot double-pay. Verified by `milestones.approve.routes.test.ts > allows the payout to be RETRIED once the seller connects an account` (first call → 409 + `approved` + 0 ledger; after `setStripeAccountId` the second call → 200 + `paid` + 2 ledger rows).

2. **`createExpressAccount` `delay_days` fix (PR #16)** — The real Stripe adapter was calling `accounts.create({ settings: { payouts: { schedule: { interval: "manual", delay_days: "..." } } } })`. Stripe rejects `delay_days` when `interval: "manual"`. Fixed to send only `{ interval: "manual" }`. `grep -rn delay_days src/` returns no matches; verified by `connect.routes.test.ts > creates a Connect Express account, stores it on the user, and returns a hosted URL` against the real adapter shape.

3. **`transfer.*` webhook dedupe (PR #16)** — `handleTransferEvent` did not insert into `stripe_webhook_events`, so re-delivery of a `transfer.created` or `transfer.failed` event could trigger duplicate side effects. Fixed by adopting the same `tryInsert` + `$transaction` pattern used for the other event types. Verified by `stripe-webhooks.flow.test.ts > records transfer.created in stripe_webhook_events so re-delivery is a no-op` (and the `transfer.failed` variant).

4. **Dead-code cleanup (PR #16, PR #17)** — `assertRole` was declared in `src/lib/authorization.ts` but never imported anywhere (no role check actually used the global `role` enum); removed. `UserRepository.updateStripeAccountFlags` was declared and Prisma-implemented but never called after the webhook handler moved to `tx.user.update`; removed in PR #17.

5. **Disputed-unreachable regression guard (PR #16)** — Three regression tests assert `submit`, `approve`, and `fund` on a `disputed` milestone all return 409 and the status stays `disputed`, locking in the "reserved enum, no reachable transition" guarantee.

## Documented design deviation

**`connect-onboarding` is available to ANY authenticated user, not only `role=seller`.** The design table listed `role=seller` for `POST /connect/onboarding-link` and `GET /connect/status`. In practice, every user registers with `role: "client"` (the registration flow in `user-auth` does not let the caller pick a role); the seller identity is **per-contract**, assigned when the client names the seller by email. The same human is `client` of contracts they created and `seller` of contracts a counterpart named them in. Gating onboarding on a global `role=seller` would have made it impossible to onboard at all. The spec was updated to "any authenticated user" and the implementation matches. The Interfaces table in `design.md` is stale on this row (spec is authoritative).

This deviation was surfaced in the initial verify run (CRITICAL-1) and resolved by PR #16, which also corrected the implementation gating.

## PR / commit trail

| PR | Branch | Scope | Merge commit |
|----|--------|-------|--------------|
| **#12** | `feat/happy-path-foundation` | Phase 1 + Phase 2 — Prisma models/enums, ports, Stripe `fake`, env, raw-body content-type parser | `fd88708` (`18a9420` foundation + Stripe plumbing) |
| **#13** | `feat/happy-path-contracts` | Phases 3 + 4 — `contracts` + `milestones` modules, state machine, status guards, submit/approve routes | `bebcadb` (`fc15053` contracts + milestones) |
| **#14** | `feat/happy-path-funding` | Phase 5 — funding endpoint + Stripe webhooks plugin, `payment_intent.*` and `account.updated` dispatch | `ce2b104` (`d75ab9d` funding + webhooks) |
| **#15** | `feat/happy-path-payout` | Phases 6 + 7 — `splitCommission`, approve → `paid`, contract `completed` on last milestone, hardening | `32ec260` (`4ee8650` payout + commission) |
| **#16** | `feat/happy-path-connect` | Phase 8 — closes CRITICAL-1 + WARNINGs 3–5: `connect` module/routes/tests, `setStripeAccountId` port, real `createExpressAccount` `delay_days` fix, `transfer.*` dedupe, `assertParticipant` adoption, disputed regression guard, regenerated OpenAPI | `a911206` (`a712d1a`) |
| **#17** | `chore/happy-path-reconcile` | Closes WARNING-2 — reconciles `milestones` client-approval scenario wording with the collapsed `in_review → approved → paid` behavior, removes `UserRepository.updateStripeAccountFlags` dead code | `065f418` (`1e89de7`) |

All 6 PRs merged to `main`. Final merge on `main`: `065f418` (PR #17).

### Quality gates at archive

- `pnpm exec tsc --noEmit` ✅ clean
- `pnpm openapi` ✅ byte-identical regen (OpenAPI in sync with implemented routes, including `/connect/*`)
- `pnpm test` ✅ **128/128 green**, 13 test files, ~17.8 s
- 0 CRITICAL, 0 FAILING, 0 UNTESTED, 0 MISSING (40/41 compliant, 1 PARTIAL closed by PR #17)

## SDD cycle complete

The change has been fully planned (proposal/spec/design/tasks), implemented across 6 chained PRs, verified twice (initial FAIL → re-verify PASS WITH WARNINGS), reconciled in a final PR, and archived. The SDD cycle is complete and the next change can start.