# Design: Escrowly Happy Path

## Technical Approach

Extend the modular monolith with escrow + Stripe money flow. New Prisma models (`Contract`, `Milestone`, `LedgerEntry`, `StripeWebhookEvent`, User addons) back integer-cents, idempotent financial transitions. `StripeClient` port hides the SDK (real + Vitest fake). Money writes run inside `prisma.$transaction` pairing state change + ledger row. State machine: `pending → funded → in_review → disputed(reserved) → approved → paid`. Backend-only.

## Architecture Decisions

| # | Choice |
|---|--------|
| 1 | **Prisma = normalized+enums**. `ContractStatus`(`draft\|active\|completed`, `cancelled` reserved), `MilestoneStatus`(`pending\|funded\|in_review\|disputed\|approved\|paid`), `LedgerEntryKind`(`platform_receipt\|commission_credit\|transfer_credit`), `LedgerEntrySide`(`credit\|debit`). Unique: `Milestone.stripePaymentIntentId`, `Milestone.stripeTransferId`, `LedgerEntry.idempotencyKey`, `StripeWebhookEvent.eventId`. FK idx: `Contract[clientId,sellerId]`, `Milestone[contractId]`. `User` adds `stripeAccountPayoutsEnabled`, `stripeAccountDetailsSubmitted`. |
| 2 | **`StripeClient` port = method-per-use-case**: `createPaymentIntent({amount,currency,idempotencyKey,metadata:{milestoneId}})`, `createExpressAccount({email,country})`, `createAccountLink({accountId,refreshUrl,returnUrl})`, `retrieveAccount(id)`, `createTransfer({amount,currency,destination,idempotencyKey,metadata:{milestoneId}})`, `constructWebhookEvent({rawBody,signature,secret})`. Real `adapters/stripe/stripe-client.ts`; fake `adapters/stripe/stripe-client.fake.ts` with `fake.webhook.emit(event)`. |
| 3 | **Raw body = `@fastify/raw-body`** for `application/json` → `request.rawBody` buffer. Sig failure → `AppError{code:"VALIDATION_ERROR",statusCode:400}` (NOT 500). |
| 4 | **Idempotency = DB uniques**. Funding `idempotencyKey="fund:${mid}"` + `stripePaymentIntentId @unique`; payout `idempotencyKey="transfer:${mid}"` + `stripeTransferId @unique`; webhook `StripeWebhookEvent.eventId @unique` INSERTed in same `$transaction` — dup → `200 {processed:false}`.
| 5 | **Transactions = `$transaction` per op**. Atomic: funding writes PI id; `payment_intent.succeeded` inserts webhook event + `pending→funded` + `LedgerEntry{platform_receipt}` + contract `draft→active` if first; approval calls `createTransfer` outside tx, then `approved→paid` + commission + transfer ledger + contract `completed` if last. |
| 6 | **Commission = typed module** `src/modules/payments/commission.ts`: `splitCommission(amountCents):{commission,transfer}` where `commission=Math.floor(amountCents*0.10)`, `transfer=amountCents-commission` (transfer absorbs odd cents; sum exact). |
| 7 | **Authorization = shared helper**. Reuse `authenticate`. `assertParticipant(tx,contractId,userId)` + `assertRole(user,"seller"\|"client")`. List scoped `where:{OR:[{clientId:uid},{sellerId:uid}]}`. Mismatch → `403`. |
| 8 | **Endpoints** = see Interfaces. |
| 9 | **Env = Zod**. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION` (`2024-06-20`), `STRIPE_CONNECT_REFRESH_URL`, `STRIPE_CONNECT_RETURN_URL`. Optional when `NODE_ENV=test`. |
| 10 | **Testing = mocked port + escrowly_test DB**. Vitest; `StripeClient` wired to fake; `truncateTables()` extended. |

## State Machine (per `rules.design`)

```
pending ─(client fund + PI succeeded webhook)─▶ funded
funded   ─(seller submit)─────────────────────▶ in_review
in_review ─(client approve + transfer ok)────▶ paid   (90% transfer, 10% commission)
disputed ← reserved; enum exists, unreachable
```

## Data Flow

### (a) Fund a milestone

```
Client ─POST .../fund─▶ ContractsRoute (auth, assert client)
  StripeClient.createPaymentIntent("fund:${mid}") + tx UPDATE Milestone SET stripePaymentIntentId
  ◀─ {id:"pi_…", client_secret:"…"}   status stays pending

Stripe ─POST /webhooks/stripe─▶ StripeWebhooksPlugin (rawBody + sig)
  prisma.$transaction:
    INSERT StripeWebhookEvent(eventId)              ← unique; dup = 200 no-op
    UPDATE Milestone status="funded" WHERE status="pending"
    INSERT LedgerEntry{platform_receipt, idempotencyKey:"pi:${eventId}"}
    if first funded → Contract status="active"
```

### (b) Approve + payout

```
Client ─POST .../approve─▶ MilestonesRoute (auth, client, status=in_review)
  splitCommission(amount) → {commission, transfer}
  StripeClient.createTransfer(seller.stripeAccountId, "transfer:${mid}")
  on success → prisma.$transaction:
    UPDATE Milestone status="approved"→"paid", stripeTransferId, paidAt
    INSERT LedgerEntry{commission_credit, commission, "transfer:${mid}:comm"}
    INSERT LedgerEntry{transfer_credit,   transfer,   "transfer:${mid}:xf"}
    if last milestone → Contract status="completed"
  on failure → status "approved", 502, no seller ledger
```

## File Changes

| Path | Action |
|------|--------|
| `prisma/schema.prisma` | Modify (+models, enums, User fields) |
| `prisma/migrations/<ts>_escrowly_happy_path/migration.sql` | Create (`prisma migrate dev`) |
| `src/ports/{contract,milestone,ledger,webhook-event}-repository.ts` + `stripe-client.ts` | Create |
| `src/adapters/prisma/{contract,milestone,ledger,webhook-event}-repository.ts` | Create |
| `src/adapters/stripe/stripe-client.ts` + `stripe-client.fake.ts` | Create |
| `src/modules/{contracts,milestones,connect}/{routes,service,schemas}.ts` + `payments/commission.ts` | Create |
| `src/plugins/stripe-webhooks.ts` + `src/lib/authorization.ts` | Create |
| `src/app.ts`, `src/config/env.ts`, `.env.example`, `src/test/helpers.ts` | Modify |
| `openapi.yaml` | Regen (`pnpm openapi`) |

## Interfaces / Contracts

| Method | Path | Auth | Rule |
|--------|------|------|------|
| `POST` | `/contracts` | bearer | any authenticated → becomes `client` |
| `GET` | `/contracts` | bearer | caller ∈ {client, seller} of returned |
| `GET` | `/contracts/:id` | bearer | caller = `clientId` or `sellerId` |
| `POST` | `/contracts/:id/milestones/:mid/fund` | bearer | caller = `clientId`; status=`pending` |
| `POST` | `/contracts/:id/milestones/:mid/submit` | bearer | caller = `sellerId`; `funded→in_review` |
| `POST` | `/contracts/:id/milestones/:mid/approve` | bearer | caller = `clientId`; `in_review→paid` |
| `POST` | `/connect/onboarding-link` | bearer | role=`seller` |
| `GET` | `/connect/status` | bearer | role=`seller`, own account |
| `POST` | `/webhooks/stripe` | signature | none |

Errors follow api-foundations. Money = integer cents.

### `LedgerEntry`

```ts
{
  id, milestoneId, contractId,
  kind: "platform_receipt"|"commission_credit"|"transfer_credit",
  side: "credit"|"debit",
  amount: number,           // integer cents, signed by `side`
  currency: "usd",
  reference: string|null,   // Stripe id
  idempotencyKey: string,   // @unique
  createdAt
}
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `splitCommission` odd cents / zero | pure fn |
| Unit | Invalid transitions rejected | stub repos |
| Integration | Funding happy path | escrowly_test + fake; `fake.webhook.emit('payment_intent.succeeded')` → funded + ledger |
| Integration | Webhook idempotency | same eventId twice → 1 ledger, 1 webhook row, stable status |
| Integration | Payout happy path | approve → fake `createTransfer("transfer:${mid}")`; ledger sum = amount |
| Integration | Transfer failure graceful | fake throws → `approved`, 502, no seller ledger |
| Integration | Connect + authz matrix | seller-only onboarding; non-participant GET → 403; non-client fund → 403 |
| OpenAPI | Contract sync | `pnpm openapi` + diff |

## Migration / Rollout

1. `pnpm prisma migrate dev --name escrowly_happy_path` → migration SQL.
2. `pnpm prisma migrate deploy` in envs.
3. `stripe listen --forward-to localhost:3000/webhooks/stripe`; copy `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
4. Rollback = reverse migration + delete new modules. Test mode.

## Open Questions

- [x] **Onboarding refresh URL**: resolved — the backend re-calls `POST /connect/onboarding-link` (no frontend `/connect` yet).
- [x] **Currency scope**: resolved — **USD only**.
- [x] **Express account country**: resolved — always `"US"`.
- [x] **`client_secret` exposure**: resolved — **returned to the client** (the embedded Stripe.js Payment Element needs it to confirm the payment).
- Raw-body handling: verify a raw-body plugin exists before adding it; otherwise use a custom `app.addContentTypeParser("application/json", { parseAs: "buffer" }, …)` that stores `request.rawBody` and then `JSON.parse`s it. Stripe signature verification requires the raw body.