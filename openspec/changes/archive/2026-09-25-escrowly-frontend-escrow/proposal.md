# Proposal: Escrowly Frontend Escrow Flow

## Intent

Backend (contracts, milestones, Stripe, Connect, payout) and the frontend foundation (shell, auth, profile, typed client) are archived. This change ships the **escrow happy-path UI** on top: create contract, fund via Stripe, submit, get paid — against the frozen OpenAPI contract. Frontend-only; backend, OpenAPI shape, and the Vite proxy pattern are unchanged.

## Scope

### In Scope
- **Contracts**: list/create/detail. Create = seller email + N milestones (title + integer-cents amount).
- **Milestones**: seller `submit` on `funded`; client `approve` on `in_review`. Buttons gated by `viewerRole` × `milestone.status`; show `paid` (or `approved` on transfer failure).
- **Funding**: client `POST .../fund` on `pending` → Stripe `<PaymentElement>` with `clientSecret`; reflect `funded` after webhook.
- **Connect onboarding**: `/app/onboarding` — `POST /connect/onboarding-link` + `GET /connect/status` (`payouts_enabled`).
- **Money**: `formatCents()` via `Intl.NumberFormat`. Integer cents only; zod `int().positive()`. No float math.
- **Vite proxy**: add `/contracts`, `/connect` (path-passthrough).

### Out of Scope
Disputes/refunds/chargebacks; Premium; deliverable storage; admin/moderation; mobile; production cross-origin CORS.

## Capabilities

### New Capabilities
- `web-contracts`: list/create/detail; participant-scoped reads; zod create form.
- `web-milestones`: role-aware list + submit/approve; state-machine gating.
- `web-funding`: Stripe Payment Element + clientSecret flow.
- `web-connect-onboarding`: onboarding-link launch + status display.

### Modified Capabilities
- `web-app-shell`: add `Contracts` nav + `/app/contracts/*`, `/app/onboarding` under `AuthGuard`.
- `web-api-client`: regenerate `types.generated.ts` via `pnpm gen:api`; no client-code changes.

## Approach
`features/<x>/` exports `useX` (TanStack Query) + `<XForm>`/`<XCard>` (rhf + zod). Reuse `api`, `queryClient`, `<AppLayout>`, `NavBar`. Stripe in `<Elements stripe={loadStripe(VITE_STRIPE_PUBLISHABLE_KEY)}>`. Vitest + RTL + MSW continue.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/features/{contracts,milestones,funding,connect}/` | New |
| `src/lib/money.ts`, `src/lib/api/types.generated.ts` | New / Regenerated |
| `routes.tsx`, `NavBar.tsx`, `vite.config.ts`, `.env.example` | Modified |
| backend | None |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Real Stripe test-mode key for end-to-end funding | Med | `.env.example` documents it; tests mock Stripe.js |
| User is client in one contract, seller in another | Med | Derive `viewerRole` per-contract from `client.id`/`seller.id` vs `profile.id`; never global `profile.role` |
| Float math on money | High | zod `int().positive()`; `formatCents` only; no `parseFloat`/`toFixed` |
| Webhook latency → stale UI | Med | `refetchInterval` while any milestone is `pending`; stop on first `funded` |

## Rollback Plan
Delete the 4 `features/` dirs + `lib/money.ts`; revert `routes.tsx`, `NavBar.tsx`, `vite.config.ts`, `.env.example`; re-run `pnpm gen:api`. No backend/schema change → clean revert.

## Dependencies
Backend `:3000`; Vite proxy covers `/contracts`, `/connect`. `@stripe/react-stripe-js`, `@stripe/stripe-js`; `VITE_STRIPE_PUBLISHABLE_KEY` (test).

## Success Criteria
- [ ] Create contract with N integer-cents milestones; visible in list.
- [ ] Fund `pending` via Payment Element; UI shows `funded` post-webhook.
- [ ] Seller submits `funded`; client approves `in_review`; UI shows `paid`.
- [ ] Non-participants can't read contracts (403/404); wrong-role buttons disabled.
- [ ] `/app/onboarding` opens Stripe-hosted link + reports `payouts_enabled`.
- [ ] `pnpm build` + `pnpm test` green; no float math.