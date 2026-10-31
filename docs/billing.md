# Billing — the port, the mock driver, and the gate (#289, card 1 of 3)

Billing is an **integration of our own**, not an auth plugin: Neon's managed Better Auth exposes a
fixed plugin subset and hosts no payment provider, so the app owns the tables, the checkout entry
point, the webhook receiver and the entitlement read.

This document describes what card 1 shipped — the model, the offline adapter and the gate — and
where cards 2 and 3 attach. It describes no provider's product beyond the adapter name the
vocabulary already carries.

## The shape

```
lib/billing/types.ts            Plan, Subscription, Entitlement, CheckoutRequest (+ wire shapes)
lib/billing/port.ts             the interface — startCheckout, readSubscription, handleWebhook,
                                entitlementFor. No provider import, no database import.
lib/billing/adapters/mock.ts    offline + deterministic: checkout writes a row, webhook applies once
lib/billing/entitlements.ts     plan → what the server allows; the refusal sentences
lib/billing/index.ts            the composition root: which adapter answers (mock today)
lib/db/billing.ts              the SQL: plans, one live subscription, webhook idempotency, counts
data/billing-plans.ts           the four tiers — one authored list
db/migrations/0009_billing.sql  billing_plan, billing_subscription, billing_event
scripts/billing-smoke.mjs       the live proof (`pnpm billing:smoke`)
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
```

`pnpm billing:smoke` creates two throwaway accounts (`billing-smoke-free`, `billing-smoke-paid`),
asserts the four outcomes, prints the subscription row, and deletes every row it created — a smoke
that left instances behind would make the next `pnpm db:seed` fail (the seed refuses assessment
records it does not author).

## Where the next two cards attach

- **Card 2 (hosted adapter).** Add `lib/billing/adapters/<provider>.ts`, implement `BillingPort`,
  and add it to the switch in `lib/billing/index.ts` plus `CARRIED_BILLING_PROVIDERS`. Nothing else
  changes: `types.ts`, `port.ts`, `entitlements.ts` and the migration already carry the provider
  name, `billing_event` is already the idempotency key, and the demo keeps running on `mock` until
  keys exist (an unset `BILLING_PROVIDER` is `mock`; a name this build does not carry is refused
  with a sentence naming the missing adapter, never silently served by the mock).
- **Card 3 (the pricing CTA).** `lib/db/billing.ts::readBillingPlans()` returns the rows; a server
  component passes them down as props (`import type` across the client boundary — a client module
  that value-imports `lib/db/**` fails `data:check` E34 and 500s at request time). The page's
  `PLANS_DATA` then goes away, and `tests/billing-plans.test.ts` switches from reconciling the two
  lists to asserting no price literal remains in `components/pricing/**`.

## Deliberately absent

No tax, invoices, dunning, coupons or seats. No coach role — `party.role` is structurally
`initiator|counterparty`, and a coach paying for a seat is an architectural decision (SPEC-DRIFT
§8), not a billing one. No `gap` column anywhere: the Gap stays `gapOf()` over two scores.
