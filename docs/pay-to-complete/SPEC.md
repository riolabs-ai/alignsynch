# Technical spec — the payment obligation

**Release:** `v1.6.0` · **Issue:** #619 · **Branch under review:** `card/pay-to-complete` (PR #634)
**Product requirements:** [PRD.md](PRD.md) · **Decisions:** [ADR.md](ADR.md) · **Evidence:** [RESEARCH.md](RESEARCH.md)

Read [ADR.md](ADR.md) first if you are reviewing a _choice_; this file is the implementation contract.

---

## 1. Data model

One table, `db/migrations/0036_relationship_payment.sql`. It is a **billing** fact, not a `relationship`
column, for the reason the schema already gives elsewhere: `relationship.status` is a lifecycle word a person
moves through, while what was captured and charged is money, and money lives in billing.

| column                                                | type                                            | meaning                                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `relationship_id`                                     | `TEXT PRIMARY KEY REFERENCES relationship (id)` | **one row per relationship** — the primary key is what makes "one fee, every round" structural                                                               |
| `payer_user_id`                                       | `TEXT NOT NULL`                                 | the initiator at creation. Stored, not derived, because `relationship.initiator_user_id` is nullable for pre-#340 rows and an obligation may not name nobody |
| `provider`                                            | `TEXT NOT NULL`                                 | which adapter captured the method (`mock`, `stripe`)                                                                                                         |
| `provider_customer_id` / `provider_payment_method_id` | `TEXT NULL`                                     | **ids only.** No PAN, no brand, no expiry — a card number in a client database is a liability nobody asked for                                               |
| `method_captured_at`                                  | `TIMESTAMPTZ NULL`                              | `NULL` is a real state: "pay later"                                                                                                                          |
| `charge_due_at`                                       | `TIMESTAMPTZ NULL`                              | `method_captured_at + 7 days` (`METHOD_TRIAL_DAYS`)                                                                                                          |
| `charged_at`                                          | `TIMESTAMPTZ NULL`                              | **write-once** (`WHERE charged_at IS NULL`), which is what makes one fee cover every round                                                                   |
| `charge_amount_cents`                                 | `INTEGER NULL`                                  | integer cents, the house convention                                                                                                                          |
| `charge_attempts`                                     | `INTEGER NOT NULL DEFAULT 0`                    | initial attempt included                                                                                                                                     |
| `last_attempt_at`                                     | `TIMESTAMPTZ NULL`                              | for the retry ladder and for answering "when did we last try"                                                                                                |
| `first_failed_at`                                     | `TIMESTAMPTZ NULL`                              | **the ladder and the one-week window are computed from this stored instant**, never from a clock                                                             |
| `expired_at` / `expire_reason`                        | `TIMESTAMPTZ NULL` / `TEXT NULL`                | terminal; two reasons (`unpaid`, `charge-failed`); a CHECK refuses a row carrying both `charged_at` and `expired_at`                                         |
| `reminder_day3_at` / `reminder_day10_at`              | `TIMESTAMPTZ NULL`                              | when each nag was sent, so a job that runs often sends one, not twenty-four                                                                                  |
| `created_at` / `updated_at`                           | `TIMESTAMPTZ NOT NULL DEFAULT now()`            | —                                                                                                                                                            |

**The 14-day window is deliberately not a column.** It is `max(party.accepted_at) + 14 days`, derived by
`paymentDeadlineOf()`. A stored copy would have to be backfilled for every existing session — inventing a
deadline nobody had — and would drift the moment a seat is re-accepted.

**No backfill.** A relationship created before 0036 was charged at creation, under the model this release
retires. Inventing a captured method for those rows would claim a charge that never happened. Absence reads as
**not measured** (`paymentArmedOf()` → `undefined`), which does not gate completion; every relationship created
from now on writes its row at creation, so `false` is real there.

## 2. Modules

| module                                                            | responsibility                                                                                                                                                                  | pure?                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `lib/flow/payment.ts`                                             | the constants and every deadline: `chargeDueAtOf`, `paymentDeadlineOf`, `reminderAtOf`, `reminderDueOf`, `chargeRetryAt`, `chargeExhaustedOf`, `expiryDueOf`, the refusal codes | **yes** — no `pg`, no clock |
| `lib/flow/payment-jobs.ts`                                        | `paymentJobsOf(facts, now)` → the ordered jobs, and `paymentJobKey` for logs/idempotency                                                                                        | **yes**                     |
| `lib/billing/{port,types,index}.ts` + `adapters/{mock,stripe}.ts` | capture a method, charge one amount, and report `{ ok, chargeId }` or a decline. The **only** place a provider is named                                                         | no                          |
| `lib/db/relationship-payment.ts`                                  | `openPaymentObligations()`, `readRelationshipPayment()`, the write-once writers                                                                                                 | no                          |
| `lib/member/payment-job-run.ts`                                   | execute the jobs, with the charge injected as a seam                                                                                                                            | no                          |
| `app/api/billing/payment-jobs/route.ts`                           | the cron entry point; lists, runs, reports                                                                                                                                      | no                          |
| `app/api/billing/payment/route.ts`, `…/return/route.ts`           | capture the method; return from the provider                                                                                                                                    | no                          |
| `lib/member/publish-basis.ts`                                     | **loses** its creation-time charge trigger (ADR-1)                                                                                                                              | yes                         |

Constants (`lib/flow/payment.ts`):

```
METHOD_TRIAL_DAYS        = 7
PAYMENT_WINDOW_DAYS      = 14
PAYMENT_REMINDER_DAYS    = [3, 10]
CHARGE_RETRY_OFFSET_DAYS = [1, 3, 5]
CHARGE_ATTEMPT_LIMIT     = 1 + 3 = 4
CHARGE_RETRY_WINDOW_DAYS = 7
PAYMENT_EXPIRY_REASONS   = ['unpaid', 'charge-failed']
```

## 3. The job ladder — **including the branch that is missing today**

At instant `now`, for one obligation, in this order:

| #     | job            | condition                                                                                                                                                                                   | effect                                                                                                                                                                    |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | **`charge`**   | `charged_at IS NULL` **and** `expired_at IS NULL` **and** `method_captured_at IS NOT NULL` **and** `sealed_at IS NOT NULL` **and** `first_failed_at IS NULL` **and** `now >= charge_due_at` | attempt the fee **for the first time**; on success stamp `charged_at`, complete the relationship, open the Gap; on decline stamp `first_failed_at`, `charge_attempts = 1` |
| 1     | `expire`       | `chargeExhaustedOf(facts, now)` → `charge-failed`; else `now >= sealed + 14d` → `unpaid`                                                                                                    | stamp `expired_at`/`expire_reason`, set the relationship terminal, notify **both**                                                                                        |
| 2     | `remind`       | the earlier unsent of day 3 / day 10, from the sealed instant                                                                                                                               | notify both, stamp that day                                                                                                                                               |
| 3     | `retry-charge` | `first_failed_at` set, ladder not spent, next rung arrived (`+1`, `+3`, `+5` days)                                                                                                          | attempt again; on success stamp `charged_at`                                                                                                                              |

**Row 0 requires the seal, and that clause is the easiest one to lose.** The fee buys a completed
assessment (PRD R4), so an obligation nobody sealed owes nothing however long the method sits — the
fourteen-day window, which _is_ measured from the seal, ends it instead. Dropping the clause would charge a payer
for a Gap that does not exist.

**Row 0 is the fix.** `lib/flow/payment-jobs.ts` emitted only rows 1–3 before it, and `retryDue()` requires
`first_failed_at` — so the 7-day trial charge was never taken and `charge_due_at` was written and read by nothing.
A customer who captured a method and never returned was never charged; their obligation simply aged to day 14 and
expired. That was the trial being decorative, and it was a specification hole rather than a coding mistake.

`expire` outranks the rest because nothing else is owed on an ended obligation: a nag after expiry tells people
to pay for something that just closed. In code it is therefore **tested first and returned alone**, so the
numbering above is the order the remaining jobs run in — not a promise that an expired obligation is still
charged. `charge` returns alone for the same class of reason: a taken fee must not be followed by a nag computed
against "still unpaid".

**Every window is arithmetic over stored instants.** A job that was down for a week finds every rung and every
nag already due and runs them now, instead of skipping a period. Nothing in `lib/flow/**` reads a clock: `now` is
the caller's, so a test pins the exact instant and a run cannot straddle two.

## 4. Refusals

One vocabulary, mapped to a sentence per screen (the E23 discipline). `PAYMENT_REFUSALS`:

| code              | when                                              | what the screen says                                         |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `not-the-payer`   | anyone but the relationship's payer tries to pay  | only the initiator can complete this                         |
| `not-ready`       | both sheets are not yet answered **and** accepted | the sheets are not finished                                  |
| `method-required` | no method on file                                 | add a payment method to open the Gap                         |
| `already-charged` | `charged_at` set                                  | already paid — the report is open                            |
| `expired`         | `expired_at` set                                  | this relationship expired; a new round is a new relationship |
| `charge-declined` | the provider refused the card                     | the card was declined; we retry on <date>                    |

## 5. Enforcement points (server, not UI)

1. **Publish** — `app/(mainlayout)/dashboard/relationships/actions.ts` refuses with `method-required` before any
   write. A disabled control in the UI is a courtesy; a test asserts the server refuses on its own.
2. **Completion** — the charge is only taken by `runPaymentJobs()`; there is no user-facing "charge me" endpoint.
3. **Payer identity** — the payer is read from the row (`payer_user_id`), never from the request body.
4. **Idempotency** — every attempt carries `relationship_id` + attempt number; a re-run of the cron cannot
   double-charge, and a charged row is not in `openPaymentObligations()`.
5. **Audit** — an operator action on a payment (waive, refund, force-expire) goes through `act()`: reason ≥ 8
   characters, `admin_action` row, refused before the mutation.

## 6. Scheduling

`vercel.json` gains one cron — `{ "path": "/api/billing/payment-jobs", "schedule": "0 9 * * *" }` — approved by
the owner 2026-11-07. Without it the timers fire only on traffic, which is the fault #599 just fixed for the
platform health record.

The route must be **idempotent and cheap when there is nothing to do**: it lists open obligations (a sealed,
unpaid, unexpired set), runs each one's jobs, and returns a count. An empty run is the common case.

## 7. Rollout

1. Migration `0036` merges with the code (additive, idempotent, no backfill).
2. Apply to **demo** first — done (`pnpm db:migrate`: 1 applied, 38 skipped; `gap columns: 0`).
3. On the release's green tag: snapshot production (`mcp__neon__create_snapshot`), apply, then
   `pnpm db:verify` green. **Owner-approved 2026-11-07**, never silent.
4. Cron lands with the code; the first run on an empty table is a no-op.

## 8. Test plan

| suite                             | proves                                                            | runs in the gate?                                |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| `tests/payment.test.ts`           | every deadline, ladder rung and refusal over literals             | yes (pure)                                       |
| `tests/payment-jobs.test.ts`      | `paymentJobsOf` order and the new **row 0** `charge` branch       | yes (pure)                                       |
| `tests/payment-job-run.test.ts`   | execution with the charge injected (fake SQL surface)             | yes                                              |
| `tests/member-publish.test.ts`    | publish refuses without a method; **only one charge path exists** | yes                                              |
| `tests/billing-plans.test.ts`     | the price has one home and the copy says per relationship         | yes                                              |
| `tests/payment-jobs-live.test.ts` | **the SQL itself** against real Postgres                          | **no** — skips without `DATABASE_URL`, by design |

**The live suite is mandatory evidence for this release, not optional.** It had never run when PR #634 opened;
on its first real run it failed on three structural fixture defects and then on the missing row-0 branch. The
PR must state the command and the result:

```
withenv.sh . bash -c 'npx vitest run tests/payment-jobs-live.test.ts'   # must be 5/5
```

## 9. What remains in PR #634

Branch `card/pay-to-complete`, remote `7383cc73`, local `b071a458` in `.worktrees/t_d58fcd7f`.

- [x] merge `main` (`d704aaa6`) — `docs/ui-registry.md` conflict resolved by regeneration
- [x] fixture: doubled `TAG` prefix; missing `record` row for `session.record_id`; cleanup column renamed in 0013
- [ ] **add the `charge` job (row 0)** and its order in `paymentJobsOf()`
- [ ] find why `openPaymentObligations()` drops the expire fixture (the first test and the expiry test both fail)
- [ ] `tests/payment-jobs-live.test.ts:172` — compares `Date.toString()` with an ISO string; use `.toISOString()`
- [ ] live suite **5/5** with `DATABASE_URL`, quoted in the PR
- [ ] state the copy change (`per relationship`) as part of the same release
- [ ] wire the two controls #620 shipped disabled

## 10. Constraints a reviewer should check

- no `new Date()` in `lib/flow/**` or in any render path;
- `"use client"` modules do not value-import `lib/db/**` or `pg` (E34 walks the graph);
- money is integer cents;
- parity: if a rendered public route changes, `pnpm parity:update --reason "…"` and the PR names the routes;
- the gate passes with `DATABASE_URL` unset;
- the migration is additive, idempotent, and adds no `gap` name.
