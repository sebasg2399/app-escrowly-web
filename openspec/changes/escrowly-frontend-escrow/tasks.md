# Tasks: Escrowly Frontend Escrow Flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,500–1,900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundations → PR 2 contracts → PR 3 milestones → PR 4 funding+connect |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundations: money lib, types, proxy, env, MSW, routes/nav | PR 1 | money.ts + tests included |
| 2 | Contracts: hooks, schemas, list/create/detail pages | PR 2 | depends on PR 1 |
| 3 | Milestones: viewerRole matrix, rows, submit/approve, polling | PR 3 | depends on PR 2 |
| 4 | Funding + Connect + integration tests + cleanup | PR 4 | depends on PR 3; mock Stripe.js |

## Phase 1: Foundations

- [x] 1.1 Create `src/lib/money.ts` (`dollarsToCents`, `formatCents`, `sumCents`) + tests; no floats
- [x] 1.2 Run `pnpm gen:api`; commit regenerated `src/lib/api/types.generated.ts` (contracts + connect paths)
- [x] 1.3 Add `/contracts` + `/connect` path-passthrough proxies in `app-escrowly-frontend/vite.config.ts`
- [x] 1.4 Add `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` to `.env.example`; add `@stripe/stripe-js`, `@stripe/react-stripe-js` (Stripe deps deferred to Phase 4 — `.env.example` documents the key only)
- [x] 1.5 Extend `src/test/mocks/handlers.ts` with `/contracts*`, `/connect/*` handlers (contracts added; connect stubs deferred to Phase 5)
- [x] 1.6 Add `Contracts` link in `NavBar.tsx`; register `/app/contracts*` + `/app/onboarding` in `src/routes/routes.tsx` (AuthGuard, AppLayout)

## Phase 2: Contracts

- [x] 2.1 Create `useContracts.ts`/`useContract.ts` + `contracts-schemas.ts` zod: sellerEmail, ≥1 milestone, cents `int().positive()`
- [x] 2.2 Build `ContractsList.tsx` + page: skeleton, empty CTA, USD total (`sumCents`+`formatCents`), status, progress
- [x] 2.3 Build `ContractCreateForm.tsx` + page: dollars→cents on submit, `POST /contracts`, navigate on 200; 404→sellerEmail error; 400 `details`→field errors; empty list blocked
- [x] 2.4 Build `ContractDetailPage.tsx`: header + milestone list; 403/404→error state with back link, no amounts

## Phase 3: Milestones

- [x] 3.1 Create `milestone-role.ts`: per-contract `viewerRole` (client/seller/none) + action matrix (Fund/Submit/Approve/badges)
- [x] 3.2 Build `MilestoneRow.tsx`: role×status-gated buttons; `paid`/`approved` terminal badges
- [x] 3.3 Add `useSubmitMilestone`/`useApproveMilestone`; invalidate `["contract",id]` on success; 409/403→non-blocking toast
- [x] 3.4 Polling in `useContract`: `refetchInterval: hasPending ? 5000 : false`; stops past `pending`

## Phase 4: Funding

- [x] 4.1 `src/lib/stripe.ts` (lazy `getStripe` singleton) + Stripe.js loaded into `<Elements>` inside `FundingModal.tsx`; key never hardcoded
- [x] 4.2 `useFundMilestone.ts`: `POST .../fund` → `clientSecret`
- [x] 4.3 `FundingModal.tsx`: `<PaymentElement>` + `confirmPayment`; on success close + invalidate contract query (webhook + polling flip status to `funded`); on decline/required-action surface in-modal error and stay open

## Phase 5: Connect Onboarding

- [x] 5.1 `useConnectStatus.ts` (`GET /connect/status` + `POST /connect/onboarding-link` → `window.location.assign(url)`)
- [x] 5.2 `OnboardingPage.tsx`: not-onboarded/onboarded states (`payoutsEnabled`+`detailsSubmitted`); "Refresh status" refetch; "Continue on Stripe" CTA wired to launchOnboarding

## Phase 6: Tests + Cleanup

- [x] 6.1 Integration tests (web-contracts): list rows/empty; create 200→navigate, 404→sellerEmail, 400→fields; detail 403/404→error state
- [x] 6.2 Integration tests (web-milestones): role matrix allowed/disallowed/terminal; submit 200→`in_review`; 409→toast; polling pending→funded→stops
- [x] 6.3 Integration tests (web-funding): mock Stripe; in-transit; decline→modal error, stays `pending`; 50000→$500.00
- [x] 6.4 Integration tests (web-connect): link navigates; status states; refresh refetch; guest→`/login` with redirect-back
- [x] 6.5 Run `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm format:check`; fix failures; README if needed