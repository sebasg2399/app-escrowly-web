# Archive Report: escrowly-frontend-escrow

## Synced Specs (6 new capabilities → source-of-truth)

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| `web-app-shell` | Created (delta) | 3 added | 5 |
| `web-api-client` | Created (delta) | 1 added | 2 |
| `web-contracts` | Created (new) | 3 added | 9 |
| `web-milestones` | Created (new) | 4 added | 8 |
| `web-funding` | Created (new) | 4 added | 6 |
| `web-connect-onboarding` | Created (new) | 3 added | 4 |

No modified capabilities.

## Archive Contents

- `proposal.md` ✅
- `design.md` ✅
- `specs/` ✅ (all six)
- `tasks.md` ✅ (39 / 39 `[x]`)
- `verify-report.md` ✅ (PASS, 35/35 scenarios compliant)

## Verify Verdict

**PASS** — 35/35 scenarios compliant, 0 PARTIAL, 0 UNTESTED, 0 FAILING, no CRITICAL. `pnpm typecheck` + `pnpm test` (120 passed) + `pnpm lint` + `pnpm format:check` + `pnpm build` all green.

## PR / Commit Trail (stacked-to-main, 4 slices)

| PR | Slice | Notes |
|----|-------|-------|
| #18 | Foundations + contracts | Scaffolded the React app, money helpers, Vite proxy, contracts list/create/detail |
| #19 | Milestones actions + polling | `viewerRole` derivation, action matrix, submit/approve, 5s pending polling |
| #20 | Funding + Connect onboarding + cleanup | Stripe.js `PaymentElement` modal, `connect` onboarding page, README + tasks finalized |
| — | Response schemas follow-up (also on #18) | Backend declared real `schema.response` so `pnpm gen:api` produces the contract types — the frontend no longer hand-writes the contract response shape |

## Notes

- All change deliverables ship without `dispute` / `Premium 2%` / deliverable file storage / admin UI — those remain separate changes for later.
- The `disputed` milestone status is reserved (enum exists) but unreachable in this slice; the action matrix correctly returns `none` for disputed.
- Suggestions (bundle size, optimistic updates, coverage tooling) carried forward; none blocks archive.
