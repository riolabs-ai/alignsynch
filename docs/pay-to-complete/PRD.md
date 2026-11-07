# PRD — a relationship is paid for once, at completion

**Release:** `v1.6.0` · **Issues:** #619 (payment), #623 (CRUD) · **Status:** decided, build in flight
**Owner decisions:** 2026-11-07, recorded on #619 · **Research:** [RESEARCH.md](RESEARCH.md) ·
**Technical spec:** [SPEC.md](SPEC.md) · **Decisions:** [ADR.md](ADR.md)

---

## 1. Problem

The product's output is a Gap report — the thing a person actually wants. Today **it is free**: two
acceptances complete a session and open the report, and the only thing that ever charges is _publishing at
creation_, which happens before the other party has done anything (`lib/member/publish-basis.ts`).

That produces three failures at once:

1. **The fee is taken at the moment of least value.** The initiator pays for a relationship nobody has joined.
2. **The free path and the paid path produce the same result**, so paying is irrational: a member who never
   publishes a plan still gets the report.
3. **Nothing can be recovered.** There is no stored fact saying whether a relationship was paid for, so no
   screen, job, or operator can answer "did this person pay?" — measured on production: 6 active relationships,
   all `plan = NULL`.

A relationship also cannot be corrected after creation: there is **no edit surface**, and five `relationship`
columns (`template_version_id`, `completed_at`, `void_reason`, `expired_at`, `lapse_reason`) have **no writer at
all**. A mistyped Aspect is permanent, and the states those columns describe (completed, voided, expired, lapsed)
cannot be entered by any code path.

## 2. Goal

**Money and value land at the same moment.** A relationship is free to create and free to answer; the fee is
owed when the second sheet is sealed and the Gap is what it buys. One fee per relationship covers every round.

Success is not "a checkout renders". It is: **a person can create a relationship, both parties can finish their
sheets, the initiator can pay once, and the report opens — with the failure paths (no method, declined card,
nobody pays) all ending in a stated state rather than a silent half-finished one.**

### Non-goals

- Subscriptions, seats, proration, coupons, tax, and invoicing.
- Charging the counterparty. There is one payer (see ADR-2).
- Refunds and disputes. A charge that lands is final for this release; the refund path is an operator action and
  is not modelled.
- Payment for anything other than a relationship's completion.
- Redesigning the template editor or the console editor look. #623 is a **functional** gap.

## 3. Who this is for

| actor                | what they need                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **Initiator** (pays) | to start free, invite without friction, and be asked for money once — at the point the report is real |
| **Counterparty**     | to finish their sheet without ever seeing billing, and to not be told someone else's money situation  |
| **Free member**      | a relationship that can actually reach a report, or an honest statement that it cannot                |
| **Operator**         | to see whether a relationship is paid, expired or stuck, and to end one with a recorded reason        |

## 4. The state machine this release creates

Derived, never a status column — the same discipline the Gap follows.

| state                       | entered when                              | the person sees                                                                                                          |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `created`                   | relationship exists, nothing captured     | the relationship, "invite sent", free                                                                                    |
| `invited`                   | invitation live                           | free; payment is offered as a checkbox, not a gate                                                                       |
| `answering`                 | either party is answering                 | free; both sides nagged to publish                                                                                       |
| `sealed`                    | **both** sheets answered **and** accepted | the report is real; the initiator is asked to pay                                                                        |
| `awaiting-payer`            | sealed, no method on file                 | initiator: "add a payment method to open the Gap". counterparty: **"waiting for <name> to publish"** — no billing detail |
| `charge-due`                | method captured, 7-day trial running      | initiator: "opens on <date>"; the trial is stated, not hidden                                                            |
| `charged`                   | the fee landed                            | the Gap report                                                                                                           |
| `charge-failed`             | an attempt was declined, ladder running   | initiator: "we'll try again on <date>"; both see the relationship is not finished                                        |
| `expired` (`unpaid`)        | 14 days after sealed, never charged       | both told it expired; the report does not open                                                                           |
| `expired` (`charge-failed`) | ladder spent or the week ran out          | both told it expired; the card says why                                                                                  |
| `voided`                    | an operator ended it                      | terminal, reason recorded (#503 outranks everything)                                                                     |

Two rules the table encodes and every screen must respect:

- **`expired` and `voided` are terminal.** A new round on the same relationship is not offered; a new attempt is
  a new relationship.
- **`charged` is write-once.** A second round does not charge again (ADR-2).

## 5. Requirements

### R1 — Creating is free and the invite is never blocked

The initiator may create and invite with no payment method. At the end of the create stages an **optional**
"pay now / later" control appears. Choosing "later" leaves the relationship fully functional.

_Acceptance:_ a relationship created with no method sends its invitation, both parties answer, and no screen
refuses an action for want of money before the seal.

### R2 — A method on file is required to publish a sheet

Publishing is the act that seals a party's sheet. It is refused without a captured method, **server-side on the
action** — not by disabling a button.

_Acceptance:_ a POST to the publish action with no method on file returns the `method-required` refusal and
writes nothing; the UI's disabled control is a courtesy, and a test asserts the server refuses independently.

### R3 — The trial delays the charge, not the obligation

A captured method starts a **7-day** trial. The charge lands 7 days later. The method is required up front.

_Acceptance:_ capturing a method sets `method_captured_at` and `charge_due_at = +7d`; the charge happens on or
after that instant, driven by the scheduled job, with no render-path clock involved.

### R4 — Completion takes the charge exactly once

When both sheets are sealed and a method exists, the fee is charged once per relationship. A second round never
charges again.

_Acceptance:_ two runs of the job at the same instant produce one charge (idempotent by `relationship_id` +
attempt); a relationship already `charged` is never in the open-obligation scan.

### R5 — A failed charge retries, then expires

A declined charge retries **three times across a week**, then the obligation expires with notice to both.

_Acceptance:_ the ladder is computed from `first_failed_at`, not from the job's uptime; a job that was down for
a week finds every rung due and runs them now; after the last rung the state is `expired (charge-failed)`.

### R6 — Nobody pays: remind at day 3 and 10, expire at 14

From the sealed instant. The counterparty is never told the initiator's billing details.

_Acceptance:_ reminders stamp `reminder_day3_at` / `reminder_day10_at` so a hourly-or-daily job sends each once;
at sealed + 14 days the obligation expires with reason `unpaid`; the counterparty's card reads only
"waiting for <name> to publish".

### R7 — Price is per relationship, and the copy says so

One fee, every round. **"$19 per completed assessment" is wrong copy** and must change in the same release:
`data/billing-plans.ts`, the pricing page and the template cards.

_Acceptance:_ no reader-visible string says "per completed assessment"; `tests/billing-plans.test.ts` still pins
the number to one file.

### R8 — Every payment action is audited

A refund, a manual charge, an expiry waiver is an `act()` action: a reason ≥ 8 characters, a row in
`admin_action`, refused before the mutation.

_Acceptance:_ no payment path writes without an audit row; the console lists the reason.

### R9 — A relationship is editable, and the cost of a change is stated (#623)

The initiator (and staff) may edit every field the schema carries — meta, counterparty, Aspects, schedule, and
the template version pin. Where a change would discard answers, the UI states it before saving
("turning off Aspect 3 discards 2 answers from <name>").

_Acceptance:_ each of the five orphan columns has a writer or a stated reason it stays unwritten; `completed_at`
and `expired_at` are never hand-set; a round-trip test edits a field and re-reads the row through
`lib/db/rows.ts`.

### R10 — The disabled controls become live

`Activate Relationship` and `Gap Analysis` shipped **disabled** in #620 as a temporary expression. The change
that makes them possible wires them.

_Acceptance:_ after this release neither control is `disabled`, and their hrefs are in `content/routes.ts`.

## 6. Copy that must change

| where                                 | today                                | must say                                             |
| ------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `data/billing-plans.ts`, pricing page | "$19 per completed assessment"       | **per relationship** — one fee, every round          |
| relationship card                     | "Activate Relationship" (disabled)   | the payment action, named for what it does           |
| template editor                       | nothing about cost                   | that creating is free and completion is what is paid |
| product lander CTA                    | "Create Relationship" (shipped #618) | unchanged, plus "free to start"                      |

## 7. Metrics (what would tell us this worked)

- **Completion rate**: relationships that reach `sealed` ÷ created. Today the ceiling is set by `answering`.
- **Payment conversion**: `charged` ÷ `sealed`. This is the number the whole release exists to move.
- **Expiry rate** and its split: `unpaid` vs `charge-failed`. A high `charge-failed` is a provider/card problem,
  not a pricing one.
- **Time from sealed to charged**: should sit at ~7 days while the trial is the default; longer means the nags
  are not working.
- **Support mail naming the Gap as "missing"**: should go to zero — every unfinished relationship now says why.

## 8. Risks

| risk                                                                          | mitigation                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The report is taken away from people who had it free.**                     | The release ships with the trial as the default path; a Free member reaches one completion before any charge. **This is the unconfirmed Free-plan question (RESEARCH §6.1)** — it must be answered before release, not after. |
| Charges happen unattended and can fail for reasons the payer cannot see.      | `charge-failed` is a visible, stated state with a date; the job is idempotent; expiry is terminal and communicated.                                                                                                           |
| A migration reaching production while the code is red.                        | Migration ships with the code, applied after a snapshot, verified by `db:verify`; approved by the owner 2026-11-07.                                                                                                           |
| Two billing triggers alive at once (creation and completion) double-charging. | `publish-basis.ts`'s creation-time trigger is **removed in the same change** that adds the completion charge; a test asserts only one path charges.                                                                           |
| A UI-only gate.                                                               | Every requirement above is enforced on the server action; the disabled control is explicitly temporary.                                                                                                                       |
| The live suite is skipped and proves nothing.                                 | #634's own review found exactly this. The release requires the live suite green **with** `DATABASE_URL` set, and the PR states the run.                                                                                       |

## 9. Open questions before release

1. **Free plan** — does Free keep one trial-based completion, or become a preview? (RESEARCH §6.1; asked, not
   answered.)
2. **Provider** — mock adapter behind a flag, or Stripe test mode live? (#634 ships both.)
3. **Needs-action charges** — if an unattended charge needs the payer present, email a link or expire?

None of the three blocks the build; each blocks the **release**.
