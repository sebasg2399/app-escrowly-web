# Escrowly — Architecture & Flow Diagrams

Interactive HTML diagrams for the Escrowly monorepo, generated with [archify](https://opencode.ai/docs/archify) and validated against the source code.

All diagrams open in a standalone viewer (theme switching, pan/zoom, search, focus, presentation, export). Open the `.html` file directly in a browser, or browse them at the GitHub Pages landing page:

**https://sebasg2399.github.io/app-escrowly-web/**

## Diagrams

| # | Diagram | Type | Source truth |
|---|---------|------|--------------|
| 1 | [Architecture overview](diagrams/architecture.html) ([live](https://sebasg2399.github.io/app-escrowly-web/flows/diagrams/architecture.html)) | `architecture` | `app-escrowly-backend/src/app.ts`, `app-escrowly-frontend/src/main.tsx` |
| 2 | [Milestone lifecycle](diagrams/milestone-lifecycle.html) ([live](https://sebasg2399.github.io/app-escrowly-web/flows/diagrams/milestone-lifecycle.html)) | `lifecycle` | `app-escrowly-backend/prisma/schema.prisma` (`MilestoneStatus`), `modules/milestones/milestones.service.ts`, `plugins/stripe-webhooks.ts` |
| 3 | [Happy path money flow](diagrams/happy-path-money-flow.html) ([live](https://sebasg2399.github.io/app-escrowly-web/flows/diagrams/happy-path-money-flow.html)) | `sequence` | `modules/milestones/milestones.routes.ts` + `milestones.service.ts` + `plugins/stripe-webhooks.ts` |
| 4 | [Stripe Connect onboarding](diagrams/connect-onboarding.html) ([live](https://sebasg2399.github.io/app-escrowly-web/flows/diagrams/connect-onboarding.html)) | `sequence` | `modules/connect/connect.service.ts` + `modules/connect/connect.routes.ts` |
| 5 | [Auth flow](diagrams/auth-flow.html) ([live](https://sebasg2399.github.io/app-escrowly-web/flows/diagrams/auth-flow.html)) | `sequence` | `modules/auth/auth.service.ts` + `auth.routes.ts` + `auth.tokens.ts` |

## How to regenerate

```bash
node ~/.agents/skills/archify/bin/archify.mjs deliver <type> diagrams/<name>.json diagrams/<name>.html --quality showcase
```

Each `.json` is the authored spec. The `.html` is the deterministic, frozen snapshot produced by `deliver` and is what you open in the browser.

## Authoring conventions

- Quality profile is always `showcase` (9/9 artifact checks, 0 composition errors).
- Cards on the right summarize the key invariants in 3 bullets each.
- Money flow uses Stripe Connect Express: PaymentIntents in (escrow), Transfers out (90/10 split).
- Webhooks (`payment_intent.*`, `transfer.*`) are deduplicated by `stripe_webhook_events` and are the ONLY writers of `pending → funded`.
