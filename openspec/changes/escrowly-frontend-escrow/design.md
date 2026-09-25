# Design: Escrowly Frontend Escrow Flow

## Technical Approach

Frontend-only. Reuse `<AppLayout>` + `AuthGuard`, `api`, `queryClient`, `useAuth`, generated `paths` types, `<Banner>`/`<Toast>`/`<Skeleton>`/`<Badge>`, Tailwind tokens in `styles/index.css`. Ship 4 features (`contracts`, `milestones`, `funding`, `connect`) mirroring `features/profile` (TanStack Query hook + zod/rhf component). Add `/contracts` + `/connect` to Vite proxy (path-passthrough). Re-implement Stitch "Escrowly" screens as React components — never paste Stitch HTML.

## Architecture Decisions

| # | Decision | Options | Choice + rationale |
|---|----------|---------|--------------------|
| 1 | Routes + nav | New layout vs reuse `AppLayout`; NavBar prop vs Link | Reuse `AppLayout` + `AuthGuard`. Add children: `contracts` (index), `contracts/new`, `contracts/:id`, `onboarding`. Extend `NavBar` with `Contracts` link beside `Dashboard`. Single shell. |
| 2 | Feature module shape | One-file-per-feature vs hooks+components split | Mirror `features/profile/`: `useContracts.ts` + `<ContractsList>` + `contracts-schemas.ts`; identical for milestones, funding, connect. Predictable, easy to mock. |
| 3 | Money | float cents/dollars; `Intl.NumberFormat` on floats; string cents | New `src/lib/money.ts`: `dollarsToCents(s)` parses "12.34"→1234 via `Math.round(parseFloat(s)*100)` (only place float meets money); `formatCents(c)` via `Intl.NumberFormat("en-US",{style:"currency",currency:"USD"})`; `sumCents(arr)`. zod `z.number().int().positive()` for cents. Form converts dollars→cents on submit only. |
| 4 | `viewerRole` | `profile.role` (global) vs derived per-contract | Per-contract: `me?.id===contract.client.id?"client":me?.id===contract.seller.id?"seller":"none"`. Matrix: `pending×client→Fund`, `funded×seller→Submit`, `in_review×client→Approve & pay`, `paid→paid badge`, `approved→approved badge`. Wrong role → button hidden. |
| 5 | Server state + webhook latency | Single query vs parallel + polling | `useQuery(["contract",id])`. `hasPending = milestones.some(m=>m.status==="pending")`; `refetchInterval: hasPending?3000:false`. Mutations `onSuccess: invalidateQueries(["contract",id])` stops polling on first `funded`. |
| 6 | Stripe.js | `redirectToCheckout` vs Payment Element | `@stripe/react-stripe-js`. `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)` (test pk). `<Elements stripe={stripePromise} options={{clientSecret}}>` wraps modal only. `confirmPayment({elements,confirmParams:{return_url:location.href}})`. Decline (card_error/validation_error) → in-modal error; no mutation. |
| 7 | Error mapping | Custom parser vs generic toast | Reuse `ApiError`. 404 on `POST /contracts` → `setError("sellerEmail")`. 400 `details` → `Object.entries(err.details).forEach(setError per field)`. 403/409 transitions → `<Toast variant="error">` non-blocking, form unchanged. Network → mutation `isError` retry. |
| 8 | Vite proxy | Add `/contracts`+`/connect` vs full prefix | Path-passthrough (same as `/auth`,`/users`): add `{target:"http://localhost:3000",changeOrigin:true}` for both. Preserves `sameSite:"strict"` refresh cookie. |
| 9 | Testing | MSW + Stripe mock | Extend `handlers.ts` with `/contracts*` + `/connect/*`. Mock `@stripe/react-stripe-js` (`Elements`/`PaymentElement`/`useStripe.confirmPayment`). Parametrized viewerRole matrix test. Polling: MSW pending→funded; assert `refetchInterval` false after second poll. |
| 10 | Types | Hand-write vs regenerate | `pnpm gen:api` only; commit `types.generated.ts`. No client-code changes beyond auto-generated additions. |

## Folder Structure (additions)

```
app-escrowly-frontend/src/
├─ features/{contracts,milestones,funding,connect}/
│   contracts: useContracts.ts useContract.ts ContractsList.tsx
│              ContractCreateForm.tsx contracts-schemas.ts
│   milestones: MilestoneRow.tsx milestone-role.ts (viewerRole + matrix)
│   funding: useFundMilestone.ts FundingModal.tsx StripeProvider.tsx
│   connect: useConnectStatus.ts OnboardingLinkButton.tsx
├─ lib/money.ts
pages/app/ ContractsListPage ContractCreatePage ContractDetailPage OnboardingPage
test/mocks/ extend handlers.ts (+ contracts, connect handlers)
```

## Data Flow

**(a) Create contract**

```
Form (zod, int cents) ─▶ api.post(/contracts) ─200─▶ navigate(/app/contracts/:id)
                                       └─404─▶ setError(sellerEmail)
                                       └─400 details─▶ setError per field
```

**(b) Fund via Payment Element**

```
Client clicks Fund ─▶ api.post(.../fund) ─{clientSecret}─▶
  <Elements> opens modal ─▶ stripe.confirmPayment ─▶
    resolve─▶ modal "funds in transit" (no mutation)
      └─webhook flips pending→funded
        polling (3000ms) sees funded─▶ invalidate stops
    reject card_error─▶ in-modal error; stays pending; retry
```

**(c) Role-aware milestone action**

```
useContract(id)─▶ viewerRole = me.id vs contract.client.id/seller.id
MilestoneRow: status×role─▶ Fund(c,pending)|Submit(s,funded)|Approve(c,in_review)|badge(paid|approved)
onClick─▶ mutation─▶ invalidateQueries(["contract",id])
        └─409/403─▶ non-blocking toast; row unchanged
```

## File Changes

| File | Action |
|------|--------|
| `src/routes/routes.tsx` | Add 4 children under `/app` → `AppLayout` |
| `src/pages/app/AppLayout.tsx` | Pass `onNavigateContracts` |
| `src/components/organisms/NavBar.tsx` | Add `Contracts` link + prop |
| `vite.config.ts` | Proxy `/contracts`, `/connect` |
| `.env.example` | Add `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` |
| `src/lib/money.ts` | Create |
| `src/lib/api/types.generated.ts` | Regenerate (`pnpm gen:api`) |
| `src/features/{contracts,milestones,funding,connect}/*` | Create |
| `src/pages/app/{ContractsList,ContractCreate,ContractDetail,Onboarding}Page.tsx` | Create |
| `src/test/mocks/handlers.ts` | Extend |

## Interfaces

```ts
type Contract = paths["/contracts/{id}"]["get"]["responses"][200]["content"]["application/json"];
type ConnectStatus = paths["/connect/status"]["get"]["responses"][200]["content"]["application/json"];
type ViewerRole = "client"|"seller"|"none";

useContracts()             → { data: Contract[] }
useContract(id)            → { data: Contract; hasPending; refetchInterval }
useFundMilestone(c,m)      → mutation → { clientSecret }
useSubmitMilestone(c,m)    → mutation   useApproveMilestone(c,m) → mutation
useConnectStatus()         → { data: ConnectStatus; refetch }
// lib/money: dollarsToCents(s)→int, formatCents(c)→USD string, sumCents(arr)→int
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `money.ts`, `viewerRole` matrix, zod schemas | Vitest |
| Integration | List/Detail/Create: MSW 404→sellerEmail error, 400 details→fields, 403/409→toast | RTL + MSW |
| Integration | Funding: confirmPayment resolve→"in transit"; card_error→modal error, stays pending | RTL + mock `@stripe/react-stripe-js` |
| Integration | Polling: MSW pending→funded; `refetchInterval` toggles to false | RTL + MSW timers |
| Integration | Connect: onboarding-link click navigates; status refetch rerenders | RTL + MSW |

## Migration / Rollout

No migration. `.env.example` documents `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (test mode only). Rollback = delete 4 `features/` dirs + `lib/money.ts`; revert `routes.tsx`, `NavBar.tsx`, `vite.config.ts`, `.env.example`; rerun `pnpm gen:api`.

## Open Questions

- None blocking; design is self-sufficient against the frozen OpenAPI + existing foundation.