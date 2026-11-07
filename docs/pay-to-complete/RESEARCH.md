# Research — paying for a completed assessment

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Research · prev [ADR](ADR.md) · next [Billing](../billing.md)

<!-- docs-nav:end -->

**Scope:** milestone `v1.6.0 — pay to complete` (#619, #623). This file is the evidence the other three
documents argue from. It records what the tree does today, what the industry does, and which constraints
of this repo decide the design before any preference does.

Every claim below is either a `path:line` in this repo or a named external behaviour. Where something is
unmeasured it says so.

---

## 1. What ships today (measured)

### The flow completes without money

`lib/flow/state.ts::instanceStatusOf()` decides a session's status from counts alone:

```
voided            outranks everything (#503)
awaiting_counterparty
answering         everyoneAnswered && everyoneAccepted ? "complete" : "answering"
```

`complete` requires both parties to have answered every Aspect **and** both to have accepted. There is no
payment term. Two acceptances therefore open the Gap report, which is the product's whole output — measured
on demo in the 2026-11-07 flow validation (`#622`, `docs/qa-flow-validation/2026-11-07.md`): both seats read
`data-feel-gap="3"` with no charge anywhere in the path.

### The charge happens at creation, which is the inverse of the intended model

`lib/member/publish-basis.ts` runs **trial-or-checkout-or-neither** at _publish_, and publish is what creation
does: `draft`/`pending` → `published`, session opened, invitation minted. So the fee is collected before the
other party has done anything.

A trial is not a column: it _is_ `billing_subscription.status = 'trialing'` (`lib/relationship/trial.ts`).
The trial today is **14 days from publish**.

Production, measured 2026-11-07: 6 active relationships, 4 published, 1 draft, and **all 6 carry `plan = NULL`**
— the price is printed and never charged.

### The copy states a price the model cannot honour

`data/billing-plans.ts` and the template cards print **"$19 per completed assessment"**. Per _assessment_ is the
wrong noun under a per-relationship fee, and the sentence was written when nothing charged, so it has never been
tested against a checkout. `tests/billing-plans.test.ts` reads the component source and fails on a price typed
outside this file, so the number has one home — the noun does not have one yet.

### The console already has the operator verbs, and the Gap is already a function

`admin_action` records every privileged write with a reason (`lib/admin/act.ts`, floor of 8 characters, refusal
before the mutation, plus a DB CHECK). That is the audit trail a payment action must reuse rather than invent.

The Gap is deliberately **not** a column anywhere: `db:migrate` and `db:verify` both fail on the name. Anything
payment-shaped must respect the same discipline — a derived fact is computed, not stored.

---

## 2. What the in-flight branch proves, and what it exposed

PR #634 (branch `card/pay-to-complete`) carries a billing port (`lib/billing/adapters/{mock,stripe}.ts`), the
obligation table `db/migrations/0036_relationship_payment.sql`, a job runner, and three payment routes.
Two findings from reviewing it against real Postgres matter more than the code:

**A fake SQL surface agreed with an implementation that Postgres refuses.** `tests/payment-job-run.test.ts` drives
the decisions over a fake; `tests/payment-jobs-live.test.ts` was written to prove the SQL — and **had never run**,
because it skips without `DATABASE_URL`. On its first real run it failed on a doubled fixture id, a missing
`record` row that `session.record_id` requires by FK, and a cleanup deleting a column 0013 renamed.
_Research conclusion: no payment decision may be considered settled until a live suite runs it._

**The job has no branch that takes the charge when it first comes due.** `lib/flow/payment-jobs.ts` emits exactly
`remind`, `retry-charge` and `expire`, and `retryDue()` requires `firstFailedAt` to be set. `charge_due_at`
(`method_captured_at + 7 days`) is written by the migration and read by nothing. So a customer who captures a
method and never returns is never charged, and the obligation ages until day 14 and expires — the trial is
decorative. This is a **specification hole**, not a bug in a worker's code: nothing in #619 said who takes the
delayed charge.

---

## 3. External practice: delayed charges and off-session payments

The relevant industry behaviour, stated generically so it does not turn into provider documentation:

| practice                                  | what it means here                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trial with a method captured up front** | The standard shape for "no charge for N days, but a live obligation". Requires the method before the trial starts, which is #619's "delay the charge, not the obligation".                                                                                                                                                                                     |
| **Off-session charge**                    | A later charge reuses a stored method without the payer present. It can be **declined** (expired card, no funds) and, depending on region/regulation, may require a **payer-approved action** (an SCA-style challenge) that an unattended job cannot satisfy. The job must therefore have a _terminal_ path for "needs the payer", not only retry-then-expire. |
| **Retry ladders**                         | Providers recommend a small number of retries spread over days, not hourly. Three retries across a week is in the normal band; a fourth blind retry is the anti-pattern.                                                                                                                                                                                       |
| **Idempotency keys**                      | A charge attempted by a job must carry a stable key or a re-run double-charges. A cron that can be retried by the platform makes this mandatory, not optional.                                                                                                                                                                                                 |
| **Status as the provider's, not ours**    | What was captured/charged is a provider fact. A second authored copy in our schema drifts the moment a webhook says otherwise.                                                                                                                                                                                                                                 |

Two consequences the spec takes from this: a **`needs-action` outcome** beside `charged`/`declined`, and an
**idempotency key of `relationship_id` + attempt** on every attempt.

---

## 4. Constraints this repo imposes before any product preference

These are not negotiable and each one has a file that enforces it:

1. **No clock in a render.** `new Date()` in a render path logs a hydration mismatch (#418). Every deadline —
   7-day charge, day-3/day-10 reminder, day-14 expiry — is computed from a **stored instant** and driven by a job.
2. **The gate is database-free.** `bash scripts/verify.sh` must pass with `DATABASE_URL` unset, so a test that
   needs rows must skip without it. The live suite is additive evidence, never a gate step.
3. **A client component may not value-import server code.** `data:check` E34 walks the `"use client"` graph and
   fails a value import that reaches `lib/db/**` or `pg`. Payment reads must resolve on the server and be passed
   down as props (`import type` is erased and legal).
4. **Money is integer cents**, the convention `data/metrics.ts` and `QuizStats.rewardCents` already follow.
5. **Brand colour is a token.** `scripts/lint-brand-classes.mjs` fails a palette step or a gradient in a
   component; the palette has one home (`data/brand.ts` → `app/globals.css`).
6. **Parity is a harness, not a habit.** Seven routes × two brands are hashed; a changed render is rewritten with
   `pnpm parity:update --reason "…"` and the PR names which routes moved and why.
7. **`local-only` means land nothing.** A card does not merge its own work; the gate decides, and a migration
   reaches production only on the owner's word, after a snapshot.

---

## 5. Prior decisions this release inherits (owner, 2026-11-07)

Not re-litigated here; they are inputs to the PRD:

- creation is free; an optional payment method is offered at the end of the create stages and **never blocks the
  invite**;
- the trial is kept and is **7 days**, starting from whichever point the method was captured;
- a method on file is **required to publish a sheet**, and completion is what takes the charge;
- price is **per relationship**, unlimited rounds for one fee, and the **original initiator always pays**;
- a failed charge **retries three times across a week**, then expires with notice to both;
- an unpaid seal allows **14 days**, with reminders at **day 3 and day 10**;
- the counterparty sees **"waiting for <name> to publish"** and no billing detail;
- acceptance and payment stay separate: **both accept, then the initiator pays**;
- the daily cron at 09:00 is approved, and `0036` may reach production after a snapshot.

## 6. Open research questions (unmeasured, carried into the PRD)

1. **Free plan.** Under "payment required to complete", a Free user cannot produce a Gap. Whether Free keeps one
   trial-based completion or becomes a preview has been asked and answered only as "unchanged" — the consequence
   is stated in #619 and is still **unconfirmed**.
2. **Provider.** Stripe test keys exist in the environment; the adapter in #634 has a working mock. Whether the
   release ships mock-only behind a flag, or live test-mode Stripe, is a release question nobody has answered.
3. **SCA-style challenge.** If an off-session charge needs the payer present, does the product email a link that
   opens a payment page, or expire? The spec proposes the link; the product has not agreed it.

## Related

- [PRD.md](PRD.md) — the product case this research argues for.
- [ADR.md](ADR.md) — the decisions it settled.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Research · prev [ADR](ADR.md) · next [Billing](../billing.md)

<!-- docs-nav:end -->
