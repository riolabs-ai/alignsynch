# Billing — the port, the two drivers, the gate and the pricing CTA (#289, cards 1–3)

Billing is an **integration of our own**, not an auth plugin: Neon's managed Better Auth exposes a
fixed plugin subset and hosts no payment provider, so the app owns the tables, the checkout entry
point, the webhook receiver and the entitlement read.

This document describes what #289 shipped — the model, the offline adapter, the hosted test-mode
adapter with its webhook, the gate, and the pricing page's buttons — and what is deliberately absent.

## The shape

```
lib/billing/types.ts            Plan, Subscription, Entitlement, CheckoutRequest (+ wire shapes)
lib/billing/port.ts             the interface — startCheckout, readSubscription, handleWebhook,
                                entitlementFor. No provider import, no database import.
lib/billing/adapters/mock.ts    offline + deterministic: checkout writes a row, webhook applies once
lib/billing/adapters/stripe.ts  hosted, test mode: Checkout Session + signed webhook
lib/billing/entitlements.ts     plan → what the server allows; the refusal sentences
lib/billing/index.ts            the composition root: which adapter answers (BILLING_PROVIDER)
lib/db/billing.ts              the SQL: plans, one live subscription, webhook idempotency, counts
lib/billing/catalogue.ts       the plan grid: billing_plan rows joined to the fixture's words
data/billing-plans.ts           the four tiers — one authored list
db/migrations/0009_billing.sql  billing_plan, billing_subscription, billing_event
app/api/billing/checkout/route.ts POST only: a card's purchase, through the port
app/api/billing/webhook/route.ts  POST only: verify, map, apply once
components/pricing/plan-checkout-button.tsx  the button that follows the route's answer
scripts/billing-smoke.mjs       the live proof, keyless (`pnpm billing:smoke`)
scripts/stripe-smoke.mjs        the live proof, test mode (`pnpm billing:stripe:smoke`)
```

Two rules keep this a port rather than a mock screen:

- **The port names no provider.** `lib/billing/port.ts` and `lib/billing/entitlements.ts` contain no
  provider's name, and `lib/billing/adapters/mock.ts` contains none either —
  `tests/billing-entitlements.test.ts` scans the three files, so a comment cannot claim what a grep
  would disprove.
- **The offline adapter writes the same rows.** `MockBillingAdapter` calls the same
  `applyBillingEventOnce` / `writeSubscription` the hosted adapter will, so a demo checkout leaves a
  real `billing_subscription` row and a real `billing_event` row. There is no mock checkout page.

## The gate — what a plan allows

| plan       | active assessment instances | modes                                     |
| ---------- | --------------------------- | ----------------------------------------- |
| Free       | 1                           | Basic Mode only (Feel and Wish)           |
| Basic      | unlimited                   | Basic and Advanced (adds Think and Guess) |
| Pro        | unlimited                   | Basic and Advanced                        |
| Enterprise | unlimited                   | Basic and Advanced                        |

Both facts are computed, never stored: the count is `activeInstanceCount(userId)` — a party row on
an instance that is not complete yet, the same definition `instanceStatusOf` uses — and the mode is
`assessment_instance.mode`, which the schema already fixes at creation.

**Enforcement is in the store, before the transaction.** `createInstanceFromTemplate`
(`lib/flow/store.ts`) asks `instanceGateRefusal()` and throws a `FlowError` carrying
`instance-limit` or `mode-not-entitled`; the create route already answers `{error, message}` for
every `FlowError`, so a refused create costs nothing — no record, no items, no party row, no
invitation. A signed-out create is not gated: there is no account to hold a plan.

Every refusal names the plan in its sentence, e.g.

> The Free plan includes 1 active assessment. This account already has 1 active assessment. Finish
> or close that one before starting another, or move to a paid plan for unlimited active
> assessments.

## Proving it

```bash
pnpm db:migrate && pnpm db:seed && pnpm db:verify   # V13 compares billing_plan to the fixture
pnpm billing:smoke                                  # the four gate outcomes + a real subscription row
pnpm test                                           # the table, the refusals, the adapter decisions
pnpm billing:stripe:smoke                           # a test-mode checkout, delivered twice (needs keys)
```

`pnpm billing:smoke` creates two throwaway accounts (`billing-smoke-free`, `billing-smoke-paid`),
asserts the four outcomes, prints the subscription row, and deletes every row it created — a smoke
that left instances behind would make the next `pnpm db:seed` fail (the seed refuses assessment
records it does not author).

`pnpm billing:stripe:smoke` is the hosted adapter's acceptance: it proves `livemode: false` from the
API, creates a Checkout Session through the adapter, waits for a test card, then delivers the
provider's own `checkout.session.completed` event to the running app twice plus one forged body, and
prints the `billing_event` count, the subscription row and the entitlement before deleting what it
wrote. Card payments in test mode move no money; the card is `4242 4242 4242 4242`, any future date,
any CVC.

## The pricing page — one list, and a real checkout (card 3)

`/pricing` is request-time (`export const dynamic = "force-dynamic"`), because two of its facts
belong to the request: which rows `billing_plan` holds, and which plan the viewer is entitled to.

- **Rows.** `lib/billing/catalogue.ts::readPricingPlanRows()` reads `billing_plan` through
  `lib/db/billing.ts` when `DATABASE_URL` is set, and answers the authored `billingPlanRows()` when
  it is not (the gate, a build, a laptop with no `neon env pull`) — the same list `db:seed` writes
  and V13 compares back. A read that throws is logged and degrades the same way.
- **Cards.** `pricingPlans()` joins those rows to `data/billing-plans.ts`: the fixture owns the
  words, the row owns the money and whether it is live. `components/pricing/pricing-plans.tsx`
  carries no price, no bullet and no CTA label of its own, and `tests/billing-plans.test.ts` fails
  the build if a price literal reappears under `components/pricing/`.
- **No row, no button.** `active = false` — or no row at all — at an interval means that card
  prints the not-available line instead of a button at that interval, so a retired `basic/year`
  still sells `basic/month`. A `source: "fixture"` render sells nothing at all, because a tree with
  no database cannot write a subscription.
- **A click.** `POST /api/billing/checkout` takes `{ planId, interval }`, resolves the account from
  the session (`currentUserIfConfigured()` — never the body), and calls `startCheckout()` on
  whichever adapter `BILLING_PROVIDER` selects. It answers `{ url, provider, completed }` (200),
  `{ signInUrl }` (401), a `BillingRefusal` sentence (400, or 503 when the adapter has no
  credentials) or `billing-unavailable` (502). The mock completes inline and the browser reloads
  `/pricing`; the hosted adapter sends it to its own page. `tests/pricing-catalogue.test.ts` drives
  the projection and the body parser with no Postgres and no browser.
- **Current plan.** The page reads the entitlement on the server and marks the entitled card; a
  query string decides nothing, so a refresh after a checkout shows the plan that was bought.
- **Test mode is labelled.** `billingTestMode()` is true when the hosted adapter is selected (it
  refuses anything but a test key), and the band prints one line saying no card is charged.

## The hosted adapter — test mode, and only test mode

`lib/billing/adapters/stripe.ts` is selected by `BILLING_PROVIDER=stripe` and constructed lazily, on
the branch that selects it. With the variable unset the module is never resolved, so the demo, the
tests and the gate run keyless.

The credential surface is four variables, and the environment names are the contract:

| variable                      | scope           | secret |
| ----------------------------- | --------------- | ------ |
| `BILLING_PROVIDER`            | `mock`/`stripe` | no     |
| `STRIPE_TEST_SECRET_KEY`      | server          | yes    |
| `STRIPE_TEST_PUBLISHABLE_KEY` | server          | no     |
| `STRIPE_TEST_WEBHOOK_SECRET`  | server          | yes    |

The `_TEST_` segment is deliberate and the adapter enforces it: a secret key whose prefix is not the
test-mode one is refused with `not-configured`, and there is no branch, flag or fallback that reaches
a live account. The publishable key is carried but unread — hosted Checkout does not need it in the
browser, because the server creates the session and the browser is redirected to the provider's own
page. Neither secret may enter `next.config.mjs`'s `env` block: that block is inlined into the client
bundle.

The line item is inline `price_data` built from `data/billing-plans.ts`, not a pre-created Price in
the provider's dashboard: the amount a checkout charges is the fixture's, and a second copy of it is
exactly the drift `billing_plan` exists to prevent. The account, tier and interval ride along in
metadata, on the session and on the subscription it creates — that is what makes every later
subscription event mappable without a customer→account table.

### The webhook

`POST /api/billing/webhook` is the only verb, and the path is fixed: it is what the owner pastes into
the provider's dashboard, so a different path is a silent 404 reported as a failed delivery. The
endpoint must be registered as a **Snapshot** destination (the payload carries the whole object) and
subscribed to three events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Anything else is acknowledged with a 200 and recorded nowhere — a 4xx on an unsubscribed type makes
the provider retry it for days. Status codes: 200 applied/duplicate/ignored, 400 bad signature or
unparseable body, 503 this deployment has no credentials, 502 the provider's API could not be
reached.

The signature is checked before the body is parsed as JSON, with the provider's own algorithm —
HMAC-SHA256 over `${t}.${body}`, any `v1` entry matching, a 300-second tolerance, a constant-time
compare. It is written out in the adapter rather than pulled from an SDK, for the same reason
`lib/objstore.ts` hand-writes a SigV4 client: two REST calls and one HMAC do not justify a package,
and a verifier the gate can mint a signature for offline is a verifier whose failures are testable.

Idempotency is ours, not the provider's: `applyBillingEventOnce()` inserts the `billing_event` row in
the same transaction as the subscription write, unique on `(provider, provider_event_id)`. A replay
therefore applies nothing — the second delivery is reported as `duplicate` and writes no row.

**Snapshot payloads are not re-fetched.** `customer.subscription.*` events map straight out of
`event.data.object`. `checkout.session.completed` is the one exception, and it is documented on
`subscriptionForEvent()`: that event's subject is the _session_, which names the subscription it
created only by id, so the adapter reads that one object — it is not re-reading anything the payload
carried, because the payload carries no subscription. When the session arrives with the subscription
expanded, no call is made.

`readSubscription()` reads **our row**, not the provider's: the webhook is the writer, and a read that
called the API instead would be a second truth the two could disagree about, plus a network round
trip on every page that shows a plan. Both adapters answer that method the same way; they differ only
in who writes the row.

### Test mode in production

The release candidate runs `BILLING_PROVIDER=stripe` on Preview and Production with test keys, so a
completed checkout in production creates a **test-mode** subscription and no money moves. Any surface
that could be read as "you are being billed" needs the smallest honest marker — one line, test mode,
no charge. That surface is `components/pricing/**`: card 3 of #289 has the band print the
`test-mode` line from `data/pages/pricing.ts` whenever `billingTestMode()` is true, and the button
next to it is a real checkout on a test key.

## Deliberately absent

No tax, invoices, dunning, coupons or seats. No coach role — `party.role` is structurally
`initiator|counterparty`, and a coach paying for a seat is an architectural decision (SPEC-DRIFT
§8), not a billing one. No `gap` column anywhere: the Gap stays `gapOf()` over two scores.
