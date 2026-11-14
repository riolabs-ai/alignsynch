# Stripe — the account dossier and the go-live pre-flight

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Stripe go-live · prev [Spec drift](spec-drift.md)

<!-- docs-nav:end -->

**Status:** landed 2026-11-14 — it replaces the account notes that had no home (chat threads and issue
bodies), and it does **not** replace `docs/reference/billing.md`, which keeps the code story. Companion to
[`docs/reference/billing.md`](../reference/billing.md) (which documents the port, the two drivers and the
gate) — this page documents the **account**: what exists in Stripe, where every credential lives, what the
dashboard must be set to, what the app does and does not send, and the ordered checks that must pass before
a real card can be charged.

**Versioning.** The page carries an _applies to_ line (app version + commit) and every row carries a status.
A row is only `SET` when a command in this repo or a dashboard screenshot in `docs/qa/` proves it. This page
is **not** a narrative; it is a checklist someone can execute cold, and a stale row is a defect like a stale
`docs/glossary.md`.

| field      | value                                                                                |
| ---------- | ------------------------------------------------------------------------------------ |
| applies to | app `1.20.0`, `main@497385f5` — 2026-11-14                                           |
| mode       | **test only** (`BILLING_PROVIDER=stripe`, `sk_test_…`, `livemode: false` everywhere) |
| live       | **not enabled.** `#847` (adapter accepts a live key) is open and `blocked`           |

Legend: `SET` proven · `OWED` nobody has done it · `BLOCKED-ON` needs a value or an account we do not have ·
`N/A` deliberately absent, with the reason.

---

## 1. Accounts

| account     | id                      | mode | state                                                                                                                                                      |
| ----------- | ----------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Venture I/O | `acct_19bZw7KKtWHoLhLR` | test | **retiring.** Held the 4 Prices and both endpoints until 2026-11-14. Nothing in the repo reads it now. Its dashboard retains the test-mode history.        |
| AlignSynch  | `acct_1If98uIxC4rz96cc` | test | **the active account** for production, demo and local                                                                                                      |
| AlignSynch  | same id                 | live | **does not exist as a configuration.** A publishable live key is in the vault; the secret key has never existed here, so live-mode inventory is unverified |

`RIO_GITHUB_KEY` and the org-level credentials are not this account's business.

## 2. Credentials — what exists, where, and who reads it

| credential                           | value kind                    | lives in                                                                                          | status                                                                          |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| app secret key (test)                | `sk_test_…`                   | Vercel **Production** + **Preview@demo** (`sensitive`), local `.env` / `.env.local` / `.env.demo` | `SET`                                                                           |
| app publishable key (test)           | `pk_test_…`                   | same six places                                                                                   | `SET`                                                                           |
| prod endpoint signing secret         | `whsec_…` (sha256 `b1de0a74`) | Vercel Production, `.env`, `.env.local`, BWS `ALIGNSYNCH_STRIPE_TEST_WEBHOOK_SECRET`              | `SET`                                                                           |
| demo endpoint signing secret         | `whsec_…` (sha256 `3ac2d2c5`) | Vercel Preview@demo, `.env.demo`, BWS `…_WEBHOOK_SECRET_DEMO`                                     | `SET`                                                                           |
| live secret key                      | `sk_live_…`                   | **nowhere**                                                                                       | `BLOCKED-ON` owner mints it in the dashboard                                    |
| live publishable key                 | `pk_live_…`                   | BWS `ALIGNSYNCH_STRIPE_LIVE_PUBLISHABLE_KEY`                                                      | `SET` (value unverified against an account — a `pk_` cannot read `/v1/account`) |
| live endpoint signing secret         | `whsec_…` live                | nowhere — the endpoint does not exist                                                             | `BLOCKED-ON`                                                                    |
| CLI/agent key (restricted preferred) | `rk_test_…` / `sk_test_…`     | BWS `ALIGNSYNCH_STRIPE_TEST_KEY`, read by `withstripe.sh`                                         | `SET` (full `sk_test_`, not restricted — see §10)                               |
| MCP connector                        | OAuth grant                   | the `stripe` MCP, currently bound to `acct_19bZw7KKtWHoLhLR`                                      | `OWED` re-auth to AlignSynch: `hermes -p alignsynch mcp login stripe`           |
| Stripe CLI                           | keychain/`STRIPE_API_KEY`     | `withstripe.sh stripe …`                                                                          | `SET`                                                                           |

`withstripe.sh` is **operator tooling, not repo code**: it lives at
`~/.hermes/profiles/alignsynch/bin/withstripe.sh` on the operator's machine, pulls a key out of BWS at call
time and never writes it to disk. Every command below names that full path, because `bin/withstripe.sh` does
not exist in the checkout and a pre-flight command that cannot be run is worse than none. A reader without
the wrapper exports `STRIPE_API_KEY` from the same vault entry
(`bws secret get <ALIGNSYNCH_STRIPE_TEST_KEY id> -o json`) and calls `stripe` directly.

**Rules this page states so they stop being folklore**

1. A key is used in exactly one place: the body of the request that needs it. Never in `next.config.mjs`'s
   `env` block (it is inlined into the client bundle), never in a log line, never in a PR body, never in a
   `bws` note (a note prints in every `bws secret list`).
2. **Vault names and app env names are different namespaces.** `ALIGNSYNCH_STRIPE_TEST_KEY` is what the CLI
   reads; `STRIPE_TEST_SECRET_KEY` is what the app reads. Do not "unify" them — the app's name is deployed.
3. Rotation: a leaked **test** key costs a dashboard regeneration and six env writes; a leaked **live** key
   costs a 24 h incident. Test keys rotate on any exposure; live keys rotate only with the runbook in §11.

## 3. Account settings — the dashboard list nobody wrote down

Every row is `OWED` unless noted; none of them is code, and all of them are visible to a customer.

| setting                         | the value it must have                                                             | why it is on this list                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Business profile / legal entity | the entity that invoices the membership, with support email, phone and URL         | appears on receipts and in disputes                                                           |
| **Statement descriptor**        | short, recognisable, matches the brand (`ALIGNSYNCH`)                              | it is the only string a card holder sees on their statement; a wrong one is a chargeback      |
| Branding                        | icon + colour from `data/brand.ts`, not a default                                  | the checkout frame is a customer surface                                                      |
| Payout account + schedule       | the operating account, schedule stated                                             | money that lands nowhere is worse than no sale                                                |
| Tax                             | Stripe Tax on, registrations entered, or an explicit "not registered anywhere yet" | `automatic_tax` is **not** sent by the app (§6)                                               |
| Radar / fraud rules             | default rules reviewed, blocked-country list decided                               | live mode turns on exposure                                                                   |
| Payment methods                 | cards only, deliberately — not "whatever is enabled"                               | the UI promises a card; a wallet that appears unannounced changes the flow                    |
| Email receipts                  | on, from a branded sender                                                          | the app sends its own purchase confirmation; two documents about one charge is worse than one |
| Customer portal                 | configured **only if** `#847`'s successor wires it (§8)                            | an unconfigured portal is a link to a 404                                                     |
| Test clocks                     | none left running                                                                  | a clock in test mode makes every later test lie                                               |

## 4. Plans and Prices

The amount is authored once, in `data/billing-plans.ts`. `data/billing-prices.ts` carries only the provider's
handle. A (tier, interval) with no Price is a **refused checkout**, never an inline amount.

| tier      | interval | amount           | lookup_key                   | test Price                       | live Price   |
| --------- | -------- | ---------------- | ---------------------------- | -------------------------------- | ------------ |
| basic     | month    | $8.95 (895)      | `alignsynch_basic_month`     | `price_1UblGqIxC4rz96ccmAumC406` | `BLOCKED-ON` |
| basic     | year     | $85.92 (8 592)   | `alignsynch_basic_year`      | `price_1UblGqIxC4rz96ccmptGY2EQ` | `BLOCKED-ON` |
| principal | month    | $16.95 (1 695)   | `alignsynch_principal_month` | `price_1UblGrIxC4rz96cc1Zt530Ir` | `BLOCKED-ON` |
| principal | year     | $162.72 (16 272) | `alignsynch_principal_year`  | `price_1UblGsIxC4rz96ccA1IrDjSA` | `BLOCKED-ON` |

Products: `prod_Vd1JwLLr4gRqE9` (AlignSynch Basic), `prod_Vd1JHMddelStiz` (AlignSynch Principal).

**Live mode needs its own four Prices.** Test ids do not resolve in live mode, and this file deliberately has
no live map — creating it is a release decision, not a config change. The `lookup_key` convention exists so a
re-run is recognisable instead of making a fourth copy of the same amount: `alignsynch_<tier>_<interval>`.

Nine legacy WooCommerce products and their Prices sit in the same account, inert, referenced by nothing.
`OWED` archive them so the dashboard does not read like a plan catalogue.

## 5. Webhooks

| host                  | endpoint                                               | events                                                                                         | secret      |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------- |
| `alignsynch.com`      | `we_1UblH7IxC4rz96ccjeMoYQdd` → `/api/billing/webhook` | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` | `b1de0a74…` |
| `demo.alignsynch.com` | `we_1UblH7IxC4rz96ccOGBbqsDW` → `/api/billing/webhook` | same three                                                                                     | `3ac2d2c5…` |
- The receiver verifies the raw body against `Stripe-Signature` (tolerance enforced), records an event row
  keyed by Stripe event id **once**, and applies an event only when `metadata.host` matches its own
  `BILLING_HOST`. A foreign delivery answers `200 {"applied":false,"kind":"foreign"}` — acknowledged, never
  applied, so the sibling host's events are not silently swallowed either.
- An event type outside the three is acknowledged and **logged** (`billing: ignored stripe event …`) rather
  than 200-ing silently.
- Replay: `~/.hermes/profiles/alignsynch/bin/withstripe.sh stripe events resend <evt_id>`; idempotency makes
  a double resend harmless.

**The probe (non-mutating, run against the live host):** sign a `customer.subscription.updated` whose
`metadata.host` names the _other_ host, POST it, and expect `200 foreign`; the same body signed with the
wrong secret must answer `400`. Measured 2026-11-14 against `alignsynch.com`: `200 foreign` / `400` / `400`.

## 6. The session contract — what the app sends, and what it does not

Sent (`lib/billing/adapters/stripe.ts`): `mode=subscription`, `payment_method_collection=always`,
`subscription_data[trial_period_days]=7`,
`subscription_data[trial_settings][end_behavior][missing_payment_method]=cancel`, `metadata.host` on the
session **and** the subscription.

Not sent — each a go-live blocker the moment money is real:

| absent parameter                                                               | status | why it blocks live                                                       |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| `automatic_tax`                                                                | `OWED` | charging tax you do not collect is a liability, not a rounding error     |
| `billing_address_collection`                                                   | `OWED` | tax and fraud both need the address                                      |
| `consent_collection` (terms + recurring disclosure)                            | `OWED` | a recurring charge without a stored consent record is a dispute you lose |
| `statement_descriptor`                                                         | `OWED` | see §3 — it can also be set on the account, and then this row is `N/A`   |
| `payment_method_options[card][setup_credential_usage]`                         | `OWED` | credential-on-file rules; without it, avoidable SCA declines             |
| `payment_method_options[card][stored_credential_usage]` on off-session charges | `OWED` | same                                                                     |

## 7. The event contract vs the product's own surfaces

**Measured gap. The state machine and the email band both assume events nobody subscribes to.**

| the product says                        | where it says it                           | subscribed?                                                                   |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `invoice.paid` moves `expired → active` | `lib/relationship/status.ts:184`           | **no** — logged as `not subscribed` and dropped                               |
| a lapsed membership is announced        | `lib/email/templates/membership-lapsed.ts` | **no event reaches it**                                                       |
| the trial is ending                     | `lib/email/templates/trial-ending.ts`      | **no** — `customer.subscription.trial_will_end` is not handled                |
| a renewal failed                        | nothing                                    | **no** — `invoice.payment_failed` is not handled, so there is no dunning path |

Consequence, stated plainly: a relationship that lapsed and is then recovered by a **renewal** charge has no
path back to `active`; a trial that ends charges a card with no warning to the member; a failed renewal is a
silent lapse. Test mode hides all three, because nothing in test mode has to renew.

`BLOCKED-ON` a decision, not a value: either subscribe `invoice.paid` + `invoice.payment_failed` +
`customer.subscription.trial_will_end` and wire the two existing templates, or prove that every lapse ends in
`customer.subscription.deleted` (so a renewal can never be the recovery path) and delete the two templates.

## 8. User surface

| surface                    | what a customer sees                                                                                                                                 | status                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/pricing`                 | the four tiers, month/year switch, and "Test mode: the card checkout runs on test keys, so no card is charged."                                      | `SET` — the line is conditional on the deployment, not hardcoded             |
| Stage 5 — plan             | the plan chosen in the previous stage is carried, the real Prices are behind it                                                                      | `SET` for the plan grid; the _carry_ is `#1043`, `OWED`                      |
| Stage 5 — card             | embedded Checkout in the dialog, trial stated                                                                                                        | `SET`                                                                        |
| decline                    | the provider's refusal surfaced on the dialog, not a silent failure                                                                                  | `OWED` — no test-mode decline has been recorded since the account move       |
| receipt                    | Stripe's own receipt email                                                                                                                           | `OWED` — §3                                                                  |
| `/settings` → subscription | "View your past invoices and payment history" + a **View All Invoices** button with no handler (`components/settings/subscription-settings.tsx:301`) | `OWED` — a dead control on a paying member's screen                          |
| customer portal            | absent. Changing a card, cancelling, or switching Basic → Principal has no compliant surface                                                         | `OWED` — this is the known upgrade-path gap                                  |
| cancellation / lapse       | a lapsed relationship goes read-only both sides (`lib/relationship/membership.ts`)                                                                   | `SET` in code, `OWED` end to end — nothing proves it against a live delivery |

## 9. Admin service

`/admin/billing` (`app/(mainlayout)/admin/billing`, `lib/admin/billing-control.ts`) shows plan counts, one row
per relationship with its period and provider state, a live/test badge, and a single audited grant band
(`compPlan`, kinds `comp` and `extend`). Every grant writes an `admin_action` row.

| capability                                                      | status                                         |
| --------------------------------------------------------------- | ---------------------------------------------- |
| comp / extend a plan, audited                                   | `SET`                                          |
| see each member's provider state and whether it is live or test | `SET`                                          |
| refund a charge                                                 | `OWED` — no surface, no code path              |
| cancel a subscription on a member's behalf                      | `OWED`                                         |
| change a plan (Basic → Principal) from the console              | `OWED`                                         |
| look up an invoice or a payment intent                          | `OWED`                                         |
| see a webhook delivery that failed                              | `OWED` — the ignore log line is the only trace |

## 10. Security posture

- **Test mode is structural, not a setting.** `stripeCredentialsFromEnv()` accepts `sk_test_` and nothing
  else; there is no flag, branch or fallback that could reach a live account. A live key deployed today
  refuses at the credential read (`#847`).
- **A restricted key (`rk_*`) is the right credential for the CLI** and is refused by the app on purpose.
  Today BWS holds a full `sk_test_` under `ALIGNSYNCH_STRIPE_TEST_KEY` because that is what existed; minting a
  restricted key is `OWED` and needs the dashboard.
- **The webhook is the only unauthenticated ingress.** It verifies the signature over the raw body, enforces
  a timestamp tolerance, keys events by provider id, and applies only its own host's deliveries.
- **Live mode has no rehearsal path yet.** `withstripe.sh --mode live` resolves nothing (no live key), and
  test clocks are the only way to rehearse a renewal — which is exactly what §7 says nobody has done.

## 11. Pre-flight — the checks, in order

### A. Before live keys are requested

| #   | check                                                     | command / where                                                 | pass                                              |
| --- | --------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| A1  | app is on the right account                               | `~/.hermes/profiles/alignsynch/bin/withstripe.sh --which`       | TEST present, LIVE missing                        |
| A2  | the four test Prices resolve and are the ones in the tree | the loop below, compared to `data/billing-prices.ts`            | 4 × 200, amounts 895/8592/1695/16272              |
| A3  | prod and demo endpoints verify their own secrets          | the §5 probe against both hosts                                 | `200 foreign` each, `400` for the other's secret  |
| A4  | the priced walk works end to end                          | `pnpm billing:stripe:smoke`                                     | `livemode=false`, exactly one `billing_event` row |
| A5  | §3 settings are set                                       | dashboard, screenshot into [`docs/qa/payment/`](../qa/payment/) | statement descriptor + tax + payout + receipts    |
| A6  | §6 parameters are sent                                    | `git grep automatic_tax` in `lib/billing`                       | non-empty, or the row is `N/A` with a reason      |
| A7  | §7 event decision is recorded                             | the issue that closes it                                        | a sentence naming the choice                      |

A1 and A2 are two commands, both read-only:

```bash
W=~/.hermes/profiles/alignsynch/bin/withstripe.sh

# A1 — which vault names resolve. Values are never printed.
"$W" --which
#   ALIGNSYNCH_STRIPE_TEST_KEY present (sk_test…)
#   ALIGNSYNCH_STRIPE_LIVE_KEY MISSING

# A2 — the four test Prices, against the four ids in §4.
for p in price_1UblGqIxC4rz96ccmAumC406 price_1UblGqIxC4rz96ccmptGY2EQ \
         price_1UblGrIxC4rz96cc1Zt530Ir price_1UblGsIxC4rz96ccA1IrDjSA; do
  "$W" stripe get "/v1/prices/$p" \
    | grep -E '"(id|unit_amount|currency|livemode|lookup_key)"'
done
#   four blocks, one per id: "livemode": false, unit_amount 895 / 8592 / 1695 / 16272,
#   lookup_key alignsynch_<tier>_<interval> — which is what data/billing-prices.ts carries.
```

### B. The live cut (its own chat; `#847` ships first)

| #   | check                                                                                  | pass                                                |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| B1  | live Prices exist for all four pairs, with the same lookup keys                        | 4 × live ids in `data/billing-prices.ts`'s live map |
| B2  | the live endpoint exists and is enabled on `alignsynch.com`                            | `we_…`, 3 events, `livemode: true`                  |
| B3  | the live secret, endpoint secret and publishable key are in Vercel **Production only** | Preview keeps test keys, or refuses to boot         |
| B4  | live mode on a preview deployment refuses, by name                                     | the `#847` guard message                            |
| B5  | `STRIPE_MODE` is explicit in every scope                                               | grep the env, not the code                          |

### C. After the cut

| #   | check                                                                   | pass                                                        |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| C1  | one real membership, one real card, one receipt                         | `billing_subscription` + `billing_event` + Stripe's receipt |
| C2  | a cancellation reaches `customer.subscription.deleted` and applies once | event row, one transition                                   |
| C3  | a renewal charge does not depend on a checkout                          | the §7 decision, proven by a test clock                     |
| C4  | refunds are possible                                                    | the §9 surface exists, or the manual runbook is written     |
| C5  | `/admin/billing` shows `live` on that row                               | badge, screenshot                                           |

### D. Rollback

Disable the live endpoint, set `BILLING_PROVIDER=mock` in Production, redeploy. Members keep their rows; the
pricing page stops claiming a checkout. Say in the release note that live charging is off and why.

---

## Revision log

| date       | applies to          | change                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | 1.20.0 / `497385f5` | first draft. Test-mode move to `acct_1If98uIxC4rz96cc` executed; §7's event gap and §8's dead invoices button measured, not assumed                                                                                                                                                                             |
| 2026-11-14 | 1.20.0 / `497385f5` | landed from `#1054` as this page. §11 A1 and A2 re-run on the landing tree: `--which` prints TEST present / LIVE missing, and the four test Prices answer `livemode: false` at 895 / 8592 / 1695 / 16272 with the §4 lookup keys. `withstripe.sh` named by its operator path, because it is not in the checkout |

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Stripe go-live · prev [Spec drift](spec-drift.md)

<!-- docs-nav:end -->
