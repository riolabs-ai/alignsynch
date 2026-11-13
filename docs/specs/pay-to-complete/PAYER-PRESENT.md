# The payer-present state — what the spec says, and what is still unwritten

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › Payer-present state · prev [Payer copy inventory](COPY-INVENTORY.md) · next [PRD](PRD.md)

<!-- docs-nav:end -->

The card that asked for this file said "include SPEC §9 copy for a charge that requires the payer
to be present after an off-session decline on a card requiring 3DS". **There is no such copy, and
SPEC §9 is not where it would live.** This document records that finding, maps the trigger
conditions the spec _does_ define onto the states a mockup must draw, says per state which strings
are already authoritative and which are unwritten, and ends with the blind-rule checklist a
counterparty screen is held to.

Read [COPY-INVENTORY.md](COPY-INVENTORY.md) for the shipped payer strings; this file is the
complement — the states, not the labels.

## 1. The finding

`docs/specs/pay-to-complete/SPEC.md` §9 is titled, verbatim:

> ## 9. What remains in PR #634

Its body is the code review list for that PR (branch `card/pay-to-complete`) — five open items about
the `charge` job, `openPaymentObligations()`, a `Date.toString()` comparison at
`tests/payment-jobs-live.test.ts:172`, the live suite, and the copy change. It contains **no screen,
no state, no sentence and no button.** §9 is a to-do list about mechanics; it is the one section of
the spec with no product surface in it at all.

Three measurements, so this is not an opinion:

| search                                              | result                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `grep -rIl "3DS\|3-D Secure" .` (whole checkout)    | **zero files**                                                      |
| `grep -rn "Approve payment"`                        | zero                                                                |
| `grep -rn "Your bank needs you"`                    | zero                                                                |
| `grep -rn "needs-action" ` — code                   | zero; prose only (`ADR.md:67`, `RESEARCH.md:97`, `PRD.md:201`)      |
| `PAYMENT_JOB_KINDS` (`lib/flow/payment-jobs.ts:41`) | `charge`, `remind`, `retry-charge`, `expire` — no payer-present job |
| `PAYMENT_REFUSALS` (`lib/flow/payment.ts:345`)      | six codes, none for "the payer must confirm"                        |
| `ChargeOutcome` (`lib/billing/types.ts`)            | `{ok:true,…}` or `declined \| no-method \| not-configured`          |

The belief that §9 holds the payer-present copy comes from two sentences that mean something
narrower than they read:

- `docs/specs/pay-to-complete/README.md:40` — "remaining work is [SPEC §9](SPEC.md#9-what-remains-in-pr-634):
  the payer's UI." True as a pointer to the work, false as a pointer to copy.
- `docs/specs/pay-to-complete/COPY-INVENTORY.md:225` — "The §9 payer-present state (`Approve payment`, the
  band's sentence) has no shipped copy at all". That is the correct reading, and it is why the
  mockup's band is marked _proposed_ in the mockup's own ledger
  (`mockup-pay-to-complete-v2-final.html:568` — "SPEC §9 copy — this is the ask").

**A charge requiring 3DS is never named anywhere in this repository.** The spec's word for the
condition is not "3DS" but **a payer-approved action / an SCA-style challenge**; downstream the
outcome is called **`needs-action`**. Any screen that says "3DS", or names a bank, a challenge or a
verification step, is writing copy the product has not written.

## 2. What the spec does say about the trigger

| source                   | verbatim                                                                                                                                                                                                     | what it settles                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `RESEARCH.md:92` (§3)    | "may require a **payer-approved action** (an SCA-style challenge) that an unattended job cannot satisfy. The job must therefore have a _terminal_ path for \"needs the payer\", not only retry-then-expire." | the trigger, and that retrying is wrong |
| `ADR.md:67` (ADR-3)      | "a `needs-action` outcome for a charge that cannot be completed without the payer (RESEARCH §3)."                                                                                                            | the outcome's name                      |
| `README.md:42`           | "needs the payer present"                                                                                                                                                                                    | the state's name in prose               |
| `PRD.md:201` (§9, q3)    | "**Needs-action charges** — if an unattended charge needs the payer present, email a link or expire?"                                                                                                        | **undecided**: link vs expire           |
| `RESEARCH.md:145` (§6.3) | "does the product email a link that opens a payment page, or expire? The spec proposes the link; the product has not agreed it."                                                                             | the same question, still open           |
| `PRD.md:203`             | "None of the three blocks the build; each blocks the **release**."                                                                                                                                           | it may be built before it is decided    |

So: **the condition is specified, the outcome has a name, and the UI does not exist in any decided
form.** A mockup can draw the state; it cannot quote it.

## 3. Trigger → state → copy

Two tables. The first is what a payer surface can say _today_, sourced. The second is the one state
that has no copy at all.

### 3.1 States with authoritative wording

Every row's copy is the spec's own sentence (`what the screen says` in SPEC §4, or the PRD §4 state
table). None of these is a fixture label yet — [COPY-INVENTORY §8](COPY-INVENTORY.md) proves each one
has no rendered string — so they are adopted **verbatim**, never reworded, and the fixture that
carries one follows the E23 rule (one label, one home, `data/pages/<surface>.ts`).

| trigger (spec)                                          | state                     | the wording that exists                                                                                                                                  | source                                           |
| ------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| no method on file, anyone but the payer acts            | refusal                   | "only the initiator can complete this"                                                                                                                   | SPEC §4                                          |
| both sheets not answered and accepted                   | refusal                   | "the sheets are not finished"                                                                                                                            | SPEC §4                                          |
| sealed, no method                                       | refusal / pay prompt      | "add a payment method to open the Gap"                                                                                                                   | SPEC §4                                          |
| `charged_at` set                                        | refusal                   | "already paid — the report is open"                                                                                                                      | SPEC §4                                          |
| `expired_at` set                                        | refusal                   | "this relationship expired; a new round is a new relationship"                                                                                           | SPEC §4                                          |
| the provider refused the card (a retry can fix it)      | `charge-declined`         | "the card was declined; we retry on <date>"                                                                                                              | SPEC §4                                          |
| method captured, 7-day trial running                    | `charge-due`              | "opens on <date>"; "the trial is stated, not hidden"                                                                                                     | PRD §4                                           |
| an attempt was declined, ladder running                 | `charge-failed`           | "we'll try again on <date>"                                                                                                                              | PRD §4                                           |
| sealed, no method, seen by the **counterparty**         | `awaiting-payer`          | **"waiting for <name> to publish"** — no amount, no date, no method, no decline                                                                          | ADR-8, PRD §4, R6                                |
| 14 days after sealed, never charged                     | `expired (unpaid)`        | "both told it expired; the report does not open"                                                                                                         | PRD §4                                           |
| ladder spent or the week ran out                        | `expired (charge-failed)` | "both told it expired; the card says why"                                                                                                                | PRD §4                                           |
| the fee landed                                          | `charged`                 | "the Gap report"                                                                                                                                         | PRD §4                                           |
| **spec source of pay-later, the only shipped sentence** | create, no payment step   | `Creating a relationship is free. Your plan decides how many you may hold at once, and it is chosen when a relationship is ready to complete, not here.` | `data/pages/assessment-template-detail.ts:82-84` |

The counterparty's shipped-card sentence is a **state** sentence, not a publish sentence:
`Waiting for {name} to answer.` (`data/pages/assessment-instances.ts:155`). ADR-8's
"waiting for \<name\> to publish" is spec wording, not yet a fixture label.

### 3.2 The §9 row — payer present after an off-session decline

| what the mockup must show                | value                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **trigger**                              | an unattended charge returns the provider's "the payer must approve this" answer — not a decline a retry can fix         |
| **the state's name**                     | `needs-action` (ADR-3)                                                                                                   |
| **payer's screen**                       | a band on the relationship / completion surface, naming no bank and no technical step                                    |
| **the action**                           | one primary control that takes the payer to the provider to approve; the charge is attempted again afterwards            |
| **the window**                           | undecided — the retry week (`CHARGE_RETRY_WINDOW_DAYS = 7`, SPEC §2) is the proposal; nothing has agreed it              |
| **counterparty's screen**                | **unchanged, byte for byte** — the `awaiting-payer` sentence only (ADR-8)                                                |
| **copy**                                 | **none.** No band heading, no body, no button label, no "7 days" line exists anywhere                                    |
| **what must be added in code, not copy** | a `ChargeOutcome` member, a `PAYMENT_REFUSALS` code, a row in PRD §4's state table, and the job that returns the outcome |

The four code gaps in that last row are the builder's whole scope, and none of them is a string:

1. `lib/billing/types.ts` — `ChargeOutcome` has no member for "the payer must approve".
2. `lib/flow/payment.ts:345` — `PAYMENT_REFUSALS` has no code, so the screen has nothing to map
   (ADR-10: "a new refusal requires adding to the list first").
3. `PRD.md` §4 — the derived-state table has no `needs-action` row, so no surface can be described
   as being in it.
4. `lib/flow/payment-jobs.ts` — no job returns it; the ladder today is retry-then-expire, which is
   the path `CHANGELOG.md` lists as a Known limit ("A charge that needs the payer present has no
   path").

### 3.3 Placeholders — the only parameterised slots the spec uses

A placeholder is not copy to fill in freely; it is a slot whose value comes from a row.

| placeholder         | means                                        | where it is already used              |
| ------------------- | -------------------------------------------- | ------------------------------------- |
| `<name>` / `{name}` | the other seat's name, from the party row    | ADR-8, `assessment-instances.ts:155`  |
| `<date>` / `{date}` | a stored instant, printed as a calendar date | SPEC §4, `assessment-instance.ts:274` |
| `{plan}`            | the tier's display name                      | `assessment-instances.ts:132`         |
| `{price}`           | a formatted amount                           | `data/pages/templates.ts:57`          |
| `{endedAt}`         | a stored instant                             | `assessment-instance.ts:255`          |

**Never invent a placeholder.** There is no `{bank}`, `{challenge}`, `{attempt}` or `{fee}` slot
anywhere, and a sentence that needs one is a new sentence.

## 4. What must not be invented

Each row is a string the current mockups draw, why it cannot ship as-is, and the check that proves
it is not in the tree.

| string in the mockup                                     | status                                                                                      | the check                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `Your bank needs you before this payment can go through` | **proposed** — names the payer's bank, which the product never learns                       | `grep -rn "Your bank needs you"` → 0                  |
| `Approve payment`                                        | **proposed** — the spec names no control                                                    | `grep -rn "Approve payment"` → 0                      |
| the band's 7-day line                                    | **proposed** — the window is undecided (PRD q3, RESEARCH §6.3)                              | `grep -rn "stays open"` → 0                           |
| `Waiting for Daniel to publish`                          | **proposed** — no source; the shipped shape is `Waiting for {name} to answer.`              | `grep -rn "to publish"` on `data/pages/` → 0          |
| `Card number` / `Expiry` / `CVC`                         | **proposed** — no capture surface exists, so no labels do                                   | `grep -rni "card number\|\bCVC\b"` → legal prose only |
| `pay now` / `pay later`                                  | **near-verbatim** — the phrase is in code comments and `PRD.md:91`, never a rendered string | `grep -rni "pay now\|pay later"` → no `label:`        |

The rule for the builder, in one line: **a mockup may show one of these only with the `p` marker and
a lane saying who must approve it — never with a "verbatim" mark, and never promoted into
`data/pages/**` before the owner approves the string.**

## 5. Blind-rule checklist for mockup QA

The rule is ADR-8, verbatim:

> The counterparty sees **"waiting for &lt;name&gt; to publish"**. No amount, no date, no method, no
> decline.

PRD R6 says the same as a requirement: "The counterparty is never told the initiator's billing
details." Each check below is pass/fail on the rendered counterparty screen, and each names the
mechanism that makes it true today.

| #   | check                                                                                                        | why it is credible                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | the counterparty's card carries **only** the waiting sentence — no plan, price, method, decline or countdown | ADR-8; PRD §4 `awaiting-payer` row                                                    |
| 2   | no string on that screen matches `\$`, `paid`, `payment`, `card`, `declined`, `retry`, `needs-action`        | this is the vocabulary scan the v5 mockup ran (15 terms)                              |
| 3   | two allowed false positives are excluded from the scan, not "fixed" in copy                                  | `Money` is an Aspect name and `We plan together` is an opinion label                  |
| 4   | the billing component is **not rendered**, not hidden — no `hidden`, no `aria-hidden`, no CSS-only removal   | `instance.paid === null` returns `null` before the block (`my-instances.tsx:455-479`) |
| 5   | raising the `needs-action` state leaves the counterparty's markup **byte-identical**                         | the only honest proof that one seat's state does not leak into the other's screen     |
| 6   | no date of any kind appears, including "opens on" and "we'll try again on"                                   | ADR-8 bans a date, not only a figure                                                  |
| 7   | the payer's reminder goes to the payer alone; a "your partner has not paid" note does not exist              | `lib/member/payment-notice.ts:21-26`, `lib/email/templates/payment-reminder.ts`       |
| 8   | the counterparty's expiry notice carries no figure                                                           | `lib/email/templates/relationship-expired.ts:9-18`                                    |
| 9   | no render-path clock feeds a countdown; every date is a stored instant printed once                          | ADR-6, and the hydration rule                                                         |
| 10  | the seat is decided server-side (`initiator` vs not), never by a client prop the page can be tricked into    | `lib/db/assessments.ts:898,953` — the read hands a non-initiator `paid: null`         |

Checks 4, 7 and 8 are already true in code, so a mockup that violates them is drawing a rule the
product does not have. Checks 1, 5, 6 and 9 are properties of the mockup itself.

## 6. What the builder can implement without new copy

In order, and stopping where copy would be required:

1. **Do now:** add the outcome to `ChargeOutcome`, the refusal to `PAYMENT_REFUSALS` (ADR-10's
   order), the row to PRD §4, and the terminal branch to `paymentJobsOf()` — the payer-present
   condition returns the outcome and **does not** enter the retry ladder, because a retry cannot
   satisfy it. Nothing renders yet.
2. **Do now:** the counterparty's screen stays exactly as it is. That is not a placeholder — ADR-8
   already decides it, and check 5 above is how it is proven.
3. **Do now:** the payer's _existing_ surfaces keep the spec's own sentences (§3.1) — `charge-declined`
   covers every decline a retry can fix, so no new string is needed for the common failure.
4. **Stop:** the band. Its heading, body, button and window are owner copy plus an open product
   decision (link vs expire). A `needs-action` screen built before that answer is a screen with
   invented text, which is exactly what the parent card forbids.

**The one question the band waits on**, stated so it can be answered in a word: _when an off-session
charge needs the payer, does the product email a link that opens the approval and retry, or expire
the relationship with `charge-failed`?_ The spec proposes the link (RESEARCH §6.3) and the product
has not agreed it (PRD §9 q3). Either answer is buildable; only the first needs a band and therefore
new copy.

## How to re-check this document

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
sed -n '164,176p' docs/specs/pay-to-complete/SPEC.md        # §1 — §9 is a PR checklist
grep -rIl "3DS\|3-D Secure" . | grep -v node_modules  # §1 — zero files
grep -n "PAYMENT_REFUSALS" -A8 lib/flow/payment.ts     # §1 — six codes
grep -n "ChargeOutcome" -A8 lib/billing/types.ts       # §1 — three codes
grep -n "PAYMENT_JOB_KINDS" lib/flow/payment-jobs.ts   # §1 — four jobs
sed -n '135,147p' docs/specs/pay-to-complete/ADR.md          # §5 — ADR-8 verbatim
```

A row in §4 stays true only while its grep returns nothing: if a string appears in the tree, move it
into §3.1 with its `file:line` rather than editing the absence claim.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › Payer-present state · prev [Payer copy inventory](COPY-INVENTORY.md) · next [PRD](PRD.md)

<!-- docs-nav:end -->
