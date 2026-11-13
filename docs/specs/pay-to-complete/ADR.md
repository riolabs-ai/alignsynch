# Architecture decision record — pay to complete

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › ADR · prev [Technical spec](SPEC.md) · next [Research](RESEARCH.md)

<!-- docs-nav:end -->

**Release:** `v1.6.0` · **Status:** accepted 2026-11-07 · **Supersedes:** the creation-time charge (#533)

An ADR per decision, each with the alternative it beat and what it costs us. If you disagree with something in
the spec, this is the file to argue with — the spec is downstream of it.

**Reversibility**: 🟢 cheap to undo · 🟡 needs a migration/data change · 🔴 changes what the product promises

---

## ADR-1 — Charge at completion, not at creation 🟡

**Context.** `lib/member/publish-basis.ts` starts a trial or opens a checkout at _publish_, and publish is what
creation does. The fee is therefore taken before the counterparty has done anything, and the report — the thing
being bought — is free a few days later.

**Decision.** Creation is free. The fee is owed when both sheets are sealed; the Gap opens on payment.
The creation-time trigger is **removed in the same change**, never left beside the new one.

**Alternatives.** (a) Keep creation-time billing and gate nothing — that is today, and it is why 6 active
production relationships carry `plan = NULL`. (b) Charge at creation _and_ at completion — two triggers, one
double-charge bug waiting. (c) Charge per answer — punishes the counterparty for a slow reply.

**Consequences.** A relationship can now legitimately sit finished-but-unpaid, so this release must add the
reminders, the expiry, and a stated screen for each. It also means the product can no longer claim a completed
relationship without money: the Gap has a price, and the PRD's metrics are about conversion, not usage.

---

## ADR-2 — One payer per relationship, fixed at creation 🔴

**Context.** A relationship can run several rounds. Whoever pays could be fixed to the relationship or to the
round.

**Decision.** The **original initiator always pays**. `relationship_payment.relationship_id` is the primary key,
so a second round cannot open a second obligation.

**Alternatives.** "Whoever starts the round pays" is fairer across repeated use but changes the deal mid-flight:
the counterparty can open round 2 and hand the initiator a bill. Splitting needs two payment flows and a refund
story for a party who never pays.

**Consequences.** One fee, unlimited rounds — a per-relationship licence rather than a per-use fee. The
counterparty is never billed, so the counterparty must also never _see_ billing state (ADR-8).

---

## ADR-3 — The trial delays the charge, not the obligation 🟢

**Context.** "Free for 7 days" can mean two different things: no method captured until day 7, or a method captured
now and charged later.

**Decision.** **The method is required up front**; the charge lands 7 days after capture
(`METHOD_TRIAL_DAYS`). The delay is on the money, not on the commitment.

**Alternatives.** Ask for the method at day 7: a person is then asked for a card at the exact moment the report
appears, which reads as a bait-and-switch and converts worse. Never charge during a trial: the obligation ages
and expires without anyone ever being charged (this is the hole PR #634 shipped).

**Consequences.** A captured method must be charged unattended, so the release needs idempotency, a decline path,
and a `needs-action` outcome for a charge that cannot be completed without the payer (RESEARCH §3).

---

## ADR-4 — Acceptance and payment are separate acts 🟢

**Context.** Completion needs both `accepted_at` (#R2). Payment could replace the initiator's acceptance, or be a
third gate.

**Decision.** **Both parties accept, then the initiator pays.** `instanceStatusOf()` keeps its shape; payment is a
third fact read beside it, not an input that makes the function impure.

**Alternatives.** "Paying is accepting" is one screen fewer and records money as consent — the one thing the
accept page exists to record. "Only the counterparty accepts" removes the initiator's consent entirely.

**Consequences.** One extra step before checkout. In exchange, the audit trail can distinguish "agreed" from
"paid", which is what a dispute would turn on.

---

## ADR-5 — The obligation is a table, not columns on `relationship` 🟡

**Context.** `relationship` already carries five columns with no writer (`template_version_id`, `completed_at`,
`void_reason`, `expired_at`, `lapse_reason`). Payment could join them.

**Decision.** A separate `relationship_payment` table, keyed by `relationship_id`.

**Alternatives.** `relationship.paid_at` is a second authored copy of a fact the provider reports, and nothing in
SQL could compare the two. Columns on the lifecycle row also mix two vocabularies: "status" is a word a person
moves through, "captured/charged/attempts" is money.

**Consequences.** One join on every read that needs both. In exchange the provider's facts have one home, and the
relationship's lifecycle stays a lifecycle.

---

## ADR-6 — Every deadline is derived from a stored instant 🟢

**Context.** The 14-day window, the two nags and the retry ladder are all "N days after something". That something
could be stored or recomputed.

**Decision.** Store the **origins** (`method_captured_at`, `first_failed_at`, `accepted_at`) and derive every
deadline. Never store the deadline itself, except `charge_due_at`, which is a convenience copy of
`method_captured_at + 7` written once at capture.

**Alternatives.** A `payment_deadline` column would have to be backfilled for every existing session — inventing
a deadline nobody had — and would drift the moment a seat is re-accepted. Computing from `now()` in a render is
the #418 hydration bug.

**Consequences.** A job that was down for a week catches up instead of skipping: every rung and nag is already
due, and it runs them now. It also means no screen may read a clock — `now` is always handed down.

---

## ADR-7 — The timers are driven by a cron 🟢

**Context.** Reminders and expiry could fire on traffic (whenever someone loads a page) or on a schedule.

**Decision.** A daily cron at 09:00 hits `/api/billing/payment-jobs` (`vercel.json`), approved by the owner.

**Alternatives.** Fire-on-traffic is the fault #599 just fixed for the platform health record: a fact that should
be true by time becomes true only by luck. Firing on every request is the same thing with more load.

**Consequences.** A production job that can charge a card. It must be idempotent, cheap when idle, and safe to
re-run — the platform can retry a cron.

---

## ADR-8 — The counterparty never sees billing state 🔴

**Context.** Someone waiting on a payer can be told "waiting for payment" or something narrower.

**Decision.** The counterparty sees **"waiting for &lt;name&gt; to publish"**. No amount, no date, no method, no
decline.

**Alternatives.** Showing the full state puts social pressure on the payer and discloses someone else's money
situation to a third party. Showing nothing leaves a card that looks stuck.

**Consequences.** The wait is explained without disclosure. The initiator, by contrast, sees everything about
their own obligation, including the trial date and a decline.

---

## ADR-9 — Pre-existing relationships are "not measured", not backfilled 🟡

**Context.** Six active production relationships predate this model. They were charged at creation (or not at
all), under a rule being retired.

**Decision.** **No backfill.** Absence of a row reads as `undefined` — not measured — and does **not** gate
completion. Every relationship created from now on writes its row at creation, so `false` is real there.

**Alternatives.** Backfilling a captured method for old rows claims a charge that never happened, which is the
same class of error as backfilling `accepted_at` to make a dashboard look right — substituting an operator's
record for a person's act. Backfilling `expired_at` would retroactively close relationships people still use.

**Consequences.** Two meanings to "no row" for the lifetime of the data, so every reader must treat absence as
unknown rather than as unpaid.

---

## ADR-10 — Refusals are a vocabulary, not per-screen prose 🟢

**Context.** Six ways to be refused (`not-the-payer`, `not-ready`, `method-required`, `already-charged`,
`expired`, `charge-declined`) reach several screens.

**Decision.** One exported list, each code mapped to a sentence per surface — the discipline E23 already applies to
content. The server answers a code; the screen owns the words.

**Alternatives.** Prose from the action couples the copy to the transaction and cannot be reviewed in a fixture;
per-screen ad-hoc strings drift.

**Consequences.** Copy is editable in one place and testable. A new refusal requires adding to the list first.

---

## ADR-11 — The live suite is release evidence 🟢

**Context.** `tests/payment-jobs-live.test.ts` skips without `DATABASE_URL`, so a green gate says nothing about the
SQL. It had never run when PR #634 opened.

**Decision.** The gate stays database-free; the **live suite is quoted in the PR** as the evidence that the SQL
works, run with `withenv.sh . bash -c 'npx vitest run tests/payment-jobs-live.test.ts'`.

**Alternatives.** Make it a gate step — that contradicts the repo's database-free gate and would fail CI, which
has no connection string. Drop it as unmaintainable — that is how a fake surface ends up certifying an
implementation Postgres refuses.

**Consequences.** Evidence depends on someone running a command, so the PR must show it. It already earned its
keep: it found three fixture defects and the missing charge branch.

## Related

- [SPEC.md](SPEC.md) — the implementation contract these decisions produced.
- [PRD.md](PRD.md) — the product case each decision is answerable to.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › ADR · prev [Technical spec](SPEC.md) · next [Research](RESEARCH.md)

<!-- docs-nav:end -->
