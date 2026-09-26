# Delta for web-funding

> Delta for the new `web-funding` UI capability. The funding spec at `openspec/specs/milestone-funding/spec.md` is the source of truth for the money side; this delta defines how the **UI** drives Stripe.

## ADDED Requirements

### Requirement: Fund action obtains a client secret

When the viewer (contract client) opens the funding flow for a `pending` milestone, the page MUST call `POST /contracts/:id/milestones/:mid/fund` and MUST pass the returned `clientSecret` to the Stripe.js Payment Element. The Stripe.js client MUST be initialized from the `VITE_STRIPE_PUBLISHABLE_KEY` environment variable; the publishable key SHALL NEVER be hardcoded in source.

#### Scenario: Fund opens modal with Payment Element

- GIVEN the contract client opens the funding flow for a `pending` milestone
- WHEN `POST .../fund` returns 200 with a `clientSecret`
- THEN the page MUST mount a Stripe.js `<PaymentElement>` initialized with that `clientSecret` inside a modal

#### Scenario: Publishable key from env

- GIVEN the app boots
- WHEN Stripe.js is initialized
- THEN the key MUST come from `VITE_STRIPE_PUBLISHABLE_KEY`
- AND the key MUST NOT appear in source files outside env loading

### Requirement: Confirm payment and reflect in-transit state

The modal MUST confirm the payment through Stripe.js on the client. While the confirmation is in flight the modal MUST show a pending/funds-in-transit state. The milestone MUST remain visually `pending` until the detail page's polling sees the webhook flip it to `funded`.

#### Scenario: Successful confirmation shows in-transit

- GIVEN the modal is open and Stripe.js confirms the payment
- WHEN confirmation resolves successfully
- THEN the modal MUST show a "funds in transit" state
- AND the milestone row MUST continue to render as `pending` until the polling refetch observes `funded`

### Requirement: Card decline leaves milestone pending

If Stripe.js reports a card decline or payment failure, the modal MUST show an error state and MUST allow the viewer to retry. The milestone MUST stay `pending`; no transition MUST be requested.

#### Scenario: Decline shows error in modal

- GIVEN Stripe.js reports a card decline during confirmation
- WHEN the error surfaces
- THEN the modal MUST display an error message
- AND MUST NOT mark the milestone as funded
- AND MUST allow retry without leaving the modal

#### Scenario: Decline does not mutate milestone

- GIVEN a decline occurred
- WHEN the viewer dismisses or retries the modal
- THEN the milestone MUST remain `pending` in the contract list

### Requirement: Money is displayed from integer cents

The amount passed to Stripe.js and displayed in the funding UI MUST be derived from the milestone's integer-cents `amount`. The UI SHALL NEVER compute money with floats; no `parseFloat`, no `toFixed`, no `.toFixed(2)` on dollar strings, no arithmetic on dollar representations.

#### Scenario: Amount matches milestone cents

- GIVEN a milestone with `amount = 12500` cents
- WHEN the modal opens
- THEN the Payment Element MUST be charged $125.00
- AND the displayed amount MUST be exactly the cents value formatted as USD