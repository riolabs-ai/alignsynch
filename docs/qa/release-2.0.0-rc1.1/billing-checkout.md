# A test-mode checkout on production — `#1053`, rc1.1

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › A test-mode checkout on production, #1053 · prev [Rail collapse handle](../rail-handle/README.md) · next [Relationship detail — the edit form is asked for](../rel-detail-edit/README.md)

<!-- docs-nav:end -->

**Run at** 2026-11-18T00:49Z (local 2026-11-17 18:49 CST) · **host** `https://alignsynch.com` ·
**deployment** `/api/version` → `{"version":"2.0.0-rc1","commit":"c81f013cb9266523ab9123e34d5ec64bd9cf2497"}`

The four lines this card asks for:

1. **Happy path** — a test-mode Checkout Session created on production was **paid** with Stripe's
   all-4s Visa test card; the provider reported `status=complete`, `payment_status=paid`, and the
   app's webhook wrote one subscription row and one event row. **Passed, for the checkout hop.**
2. **Decline** — the generic-decline test card `4000 0000 0000 0002` printed _"Your card was
   declined. Try another card."_ in the provider's own frame; the session stayed `open`/`unpaid`
   and **no row was written**. **Passed.** (One clause of it was already true by accident: the app
   also wrote nothing for the _successful_ relationship attempt below, because that attempt failed
   before the write.)
3. **Row state written** — `billing_subscription 300fe73e-d173-46ce-8506-00dd633431e4`:
   `provider=stripe`, `plan_id=basic`, `interval=month`, `status=trialing`, `livemode=false`,
   `current_period_end=2026-11-25T00:49:14Z` — the 7-day membership trial. **A relationship
   `draft → active` transition was NOT produced**: the create flow answered `500` at stage 4, so
   stage 5 was never reached (see _The failing hop_ below).
4. **Mode the session reports** — **test**. The key that resolved the session is the deployment's
   test key (`STRIPE_VENTURE_TEST_SECRET_KEY`, test prefix, value never printed), the session id is
   `cs_test_…`, and both the session object and the written row carry `livemode=false`.

Everything below is the evidence, in the order the card asks for it.

## 1 · The request that starts the checkout

```text
POST https://alignsynch.com/api/billing/checkout
  cookie: <the QA account's session>
  {"planId":"basic","interval":"month"}
→ 200 {"provider":"stripe","completed":false,"url":"https://checkout.stripe.com/g/pay/cs_test_…"}
```

The route's own contract (`.worktrees/…/app/api/billing/checkout/route.ts`): the account is the
session's, the price is the fixture's, and the answer is where the browser goes. The account used
was created through the app's own sign-up proxy (`POST /api/auth/sign-up/email`, `200`, user id
`c233d868-2862-431e-8de5-b38ce993d13d`, address `qa-billing-rc11-1794962110@alignsynch.com`) — a
real signed-in account, because production carries no demo door (`/demo` → `404`).

## 2 · The Stripe test session it created

Read back from the provider's API with the deployment's test key:

| fact                 | value                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| session id           | `cs_test_a0HjflJa9w58H882phWZYTmP37JmhrFsDvxbplicPJHyQUu2ZxtmILdn6C`        |
| key that resolved it | `STRIPE_VENTURE_TEST_SECRET_KEY` (test prefix — the value is never printed) |
| `livemode`           | `false`                                                                     |
| `mode` / `ui_mode`   | `subscription` / `hosted_page`                                              |
| `amount_total`       | `0 usd` (the 7-day trial; the recurring amount starts after it)             |
| `metadata`           | `{user_id: c233d868-…, plan_id: basic, interval: month, host: alignsynch}`  |
| `success_url`        | `https://alignsynch.com/pricing`                                            |

After the card was typed and the form submitted:

| fact             | graded                         |
| ---------------- | ------------------------------ |
| `status`         | `complete`                     |
| `payment_status` | `paid`                         |
| `subscription`   | `sub_1Ucx3nKKtWHoLhLRP6sfxBh9` |

No product and no price was created or mutated: the session's line item resolved an existing lookup
key from `data/billing-prices.ts`, which is the catalogue the card's MUST NOT protects.

## 3 · The return URL the app lands on

The session's `success_url` is `https://alignsynch.com/pricing`, minted from the request's own
origin by the route. The surface itself, opened as the account that paid
(`pricing-after-checkout.png`, 1440×3146):

> Test mode: the card checkout runs on test keys, so no card is charged. … **Most Popular Single 1
> relationship $9.99 / month … Your current plan**

The page reads the entitlement on the server and marks the bought tier — the band's test-mode line
and the "Your current plan" state are both the app's, not this document's, words.

**One honest gap in this hop:** the headless browser's synthetic submit completed the session on the
provider's side, but the provider's page did not navigate afterwards, so the redirect itself was not
observed. The return URL above is the session's own `success_url` (a hard fact from the API) and the
landing surface was captured by opening it as that account. The hop "the provider redirects to the
app's return URL" is therefore evidenced by the session object plus the app's own page, not by
watching one navigation.

## 4 · The row state the app wrote

One delivery, one write, in one transaction:

| table                  | row                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `billing_event`        | `evt_1Ucx3pKKtWHoLhLRcjiiFvly` · `checkout.session.completed` · received `2026-11-18T00:49:20.268Z`                                                                                                                                              |
| `billing_subscription` | `300fe73e-d173-46ce-8506-00dd633431e4` · `basic` / `month` · `stripe` · `trialing` · `livemode=false` · `provider_subscription_id=sub_1Ucx3nKKtWHoLhLRP6sfxBh9` · `current_period_end=2026-11-25T00:49:14Z` · created `2026-11-18T00:49:20.268Z` |

Counts, before → after this run: `billing_subscription` 8 → 9, `billing_event` 9 → 10. This is the
hop `#846` could not prove from outside: the webhook delivered to production's endpoint was
**applied**, and the row it wrote names the provider's subscription id.

## 5 · The decline path

A second session, same account, same tier:

| fact                              | value                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| session id                        | `cs_test_a0Det0818HtjBXigLSsLgw9nsEDLdFes9wX4zhLtUX4zj1UXrusxcVC3ds`                              |
| card                              | `4000 0000 0000 0002` (Stripe's generic-decline test card)                                        |
| what the provider drew            | `role="alert"`: _"Your card was declined. Try another card."_ (three times, once per field group) |
| `status` / `payment_status` after | `open` / `unpaid`                                                                                 |
| `subscription` after              | `None`                                                                                            |
| rows written                      | none — `billing_event` stayed 10, `billing_subscription` stayed 9                                 |

The refusal is the provider's, drawn in the provider's frame; the app writes only on a completed
event, so a declined card reaches neither the mapping nor `billing_event`.

## The failing hop — stage 4 of the create flow, `500`

The card's step 1 asks for a relationship, then the payment stage. The relationship half **did not
run**, and this is the finding:

| hop                | request                                                                      | answer                                                     |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1 · Who            | `POST /assessment/new/who` (signed in, template `assessment-brother-sister`) | `303 → /dashboard/templates/brother-sister/create/mode`    |
| 2 · Mode           | `POST /assessment/new/mode`                                                  | `303 → …/create/aspects`                                   |
| 3 · Aspects        | `GET …/create/aspects`, `POST /assessment/new/aspects`                       | `200`, `{"ok":true}`                                       |
| 4 · Commit (draft) | `POST /assessment/new` `{templateRecordId, draft:"1"}`                       | **`500`, empty body — twice, from a fresh walk each time** |
| 5 · Invite         | not reached                                                                  | —                                                          |
| send               | not reached                                                                  | —                                                          |

Nothing was written by the failed commit, which the database confirms: `relationship` stayed at 26
rows, **0** owned by the QA account, and `plan_grant` stayed at **0**. So the trial this run granted
is the **membership's** (`billing_subscription.status = trialing`), not the publish trial a
published relationship would grant.

Two deviations follow, both stated rather than papered over:

- the checkout was started through `POST /api/billing/checkout` — the hosted presentation of the
  same adapter, the route the live harnesses use — not stage 5's embedded frame, because stage 4
  never handed the browser a stage 5;
- no `draft → active` (or `published`) transition was observed, so the row state in line 3 is the
  membership's trial only.

`500` with an empty body on `POST /assessment/new` for a signed-in creator whose draft is complete is
worth its own card: it is the one hop between "a person wants a relationship" and "a person can
pay for one", and it is green in `pnpm flow:e2e` locally, which is exactly the class of failure this
verification exists to surface.

## Discipline

- **No live key.** The key that resolved the session is the deployment's test key; the session id
  and the written row both carry `livemode=false`; no live product, price, customer or card was
  touched.
- **No key material printed**, and no full session object pasted — only the fields the card asks
  for. No card number beyond the two Stripe test identities above, and the all-4s one is described,
  not written.
- **No product or price created or mutated.** The four catalogue lookup keys stay as approved.
- **Nothing merged, tagged or released** by this run.
- **Left behind on production** (all test-mode, none charged): one QA account, one `trialing`
  subscription row, one `billing_event` row, one `open`/`unpaid` session. Removing them is the
  owner's call; the previous eight subscription rows on production are the same shape.

## How it was run

Four Node scripts live beside this file, none of which decides anything:

| script                    | what it does                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pay-hosted-checkout.mjs` | opens a session URL in headless Chrome, finds the provider's card frame, types the card, presses the provider's own submit, and records what happened |
| `follow-return.mjs`       | opens a session URL and records where the browser lands (used to test the redirect; it did not navigate)                                              |
| `capture-pricing.mjs`     | adopts the signed-in session's cookies and captures `/pricing`, asserting its own words first                                                         |
| `create-relationship.mjs` | walks stages 1–4 and sends the invitation, over the app's own endpoints — the walk that stopped at the `500`                                          |

They read secrets only through `~/.hermes/profiles/alignsynch/bin/withenv.sh` (repo `.env`) and the
BWS-backed `withstripe` wrapper, and they print no key, cookie or session object.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › A test-mode checkout on production, #1053 · prev [Rail collapse handle](../rail-handle/README.md) · next [Relationship detail — the edit form is asked for](../rel-detail-edit/README.md)

<!-- docs-nav:end -->
