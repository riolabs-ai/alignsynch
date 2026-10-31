# Stages — the four relationship stages, and the two ladders behind them

A **Stage** is the glossary's name for "The progress of the Relationship functions". The two
authoritative documents use the same word for **two different ladders**, and telling them apart is
the whole of this note:

- the **relationship ladder** — four stages, numbered **1–4**: Invited → Connected → Sharing →
  Aligned. This is the ladder the build derives;
- the **ladder of the User** — four lettered account states, **A–D**: Play, Registered, Parties
  Locked, Subscribed. That is billing, and it is **out of scope** (`docs/SPEC-DRIFT.md` §4.2, §4.3).
  Nothing here models it.

Only the first is a relationship. Nothing is undefined between the two: an earlier reading of the
glossary alone recorded stages 4–6 as missing from the source, and the website specification shows
that gap was a ladder split, not silence.

## The relationship ladder — four stages, 1–4

| #   | Stage     | Definition (verbatim, glossary)                                                                                          | Derived from                                                         |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Invited   | Initiator has Invited Counterparty, but they have not Registered. Aspects, Values, and Opinions are locked.              | the Counterparty's seat does not exist yet — the invite is unclaimed |
| 2   | Connected | Counterparty Registered, found the Relationship, and is free to Propose Changes to Aspects or Values, and mark Opinions. | both seats exist; the sheet is not complete (blind answering)        |
| 3   | Sharing   | Counterparty Shared Opinions, Relationship and Opinions now fully open to all Users.                                     | complete, and at least one Gap exceeds the instance's Setting        |
| 4   | Aligned   | Parties are Aligned - In Synch – Same Page.                                                                              | complete, and every Gap the instance has meets its Setting           |

The en dash in "Aligned - In Synch – Same Page" is the document's (hyphen, then en dash), quoted as
it prints. The names are the glossary's ("Invited", "Connected", "Sharing", "Aligned") and the
relationship order is the specification's.

## Two ladders, not one

**The glossary** (v2-01-01h) gives Stage a Qty of **6**, points its Example List at **"(1-6)"**, and
then defines four rows: **1** Invited, **2** Connected, **3** Sharing and **7** Aligned. There is no
row numbered 4, 5 or 6 anywhere in the document — checked against a full-text extraction of the PDF,
not a summary of it.

**The website specification** (V2-01-01g) draws the same bar differently — "Now 8 Stages" — and the
mockup on page 57 labels the eight as two ladders:

> A–D are _stage of User_ (Play → Registered → **Parties Locked at Account Bank zero** → Subscribed);
> 1–4 are _stage of Relationship_ (Invited → Connected → Sharing → Aligned).
>
> — `docs/REFERENCE-MOCKUPS.md`, row `08-stage-bar-and-stage-terms.png`, p57

So the glossary's "missing" rows were never relationship stages. They are the account ladder the
specification letters **A–D**:

| Stage | Short name | What it is (glossary / specification)                               | Why it is out of scope                        |
| ----- | ---------- | ------------------------------------------------------------------- | --------------------------------------------- |
| A     | Play       | Initiator plays unregistered, one template at a time, nothing saved | unregistered play with no save is not adopted |
| B     | Registered | Initiator registered, full functions for one free trial week        | the free week is a billing window             |
| C     | Locked     | Initiator's Account Bank is zero — functions locked and watermarked | Account Bank currency does not exist here     |
| D     | Paid       | Initiator subscribed — Account Bank increases                       | subscriptions do not exist here               |

The ruling, quoted from `docs/SPEC-DRIFT.md`:

> **4.2 Accounts from the start.** … the spec's A–D ladder (free week, Account Bank, locked
> watermarks, 30-day expiry) is **out of scope**, and no work should assume it.
>
> **4.3 Relationship stages only.** Four stages: **Invited → Connected → Sharing → Aligned**. The
> A–D states in the spec are _billing_ states, not relationship stages, and are out of scope with
> 4.2.

**Why the numbers are 1–4.** The build numbers the ladder it models. The glossary numbers Aligned
**7** because it counts one six-stage ladder and never defines the rows in between; the
specification numbers the relationship ladder **1–4** and puts the account states on letters where
they belong. So the four stages keep the source's order and the relationship ladder's numbers, and
no fifth relationship stage is invented to hold a slot that belongs to billing.

`STAGE_NUMBERS = { invited: 1, connected: 2, sharing: 3, aligned: 4 }`.

## Nothing is stored

Every stage is derived on read from facts the rows already carry, in `content/stages.ts`
(`stageOf`). There is **no `stage` column**, exactly as there is no `status` column and no `gap`
column: a stored stage would be a second authored copy of a fact the invite row and the opinion rows
already carry, and no constraint in SQL could compare the two. No migration ships with this
derivation, and `db:verify`'s "no column named like a gap" rule is unchanged.

The Setting is read, never assumed: stage 4 is the only branch that looks at it, and it reads it
through the same `instanceAlignment` the report uses. Soft tolerates a Small Gap of 1; Full
tolerates none — so the same five Aspects can be Aligned under one Setting and Sharing under the
other. That is why the Setting is a required member of the derivation's input and has no default
anywhere.

## What a party who has not submitted sees

`invited` or `connected`, and nothing else. Those two are facts about **seats** — whether the other
person has claimed their invitation at all. Neither carries a score, an answered count, a Gap value,
or any hint that the other party is part-way through their sheet.

`sharing` and `aligned` describe a **finished** sheet, and both are reachable only once both parties
have submitted — the same instant the blind rule lifts. The input type (`StageFacts`) makes that
structural rather than a convention: the Setting and the Gaps are not representable on an instance
that is not complete, so there is no argument through which an answer could reach a pre-submit
stage.

## Not built here

- **The Stage Bar visual.** The derivation landed first; the bar is a later card and renders the
  four relationship stages and nothing else.
- **The A–D account ladder and everything billing** — Account Bank, Relationship Week, trial weeks,
  watermarks, subscriptions (§4.2).
- **The Change system** — answers freeze at completion (§4.1), so a propose/approve/change-log flow
  is a design this product has not adopted.

## Where it lives

- `content/stages.ts` — the four names, the numbers, the definitions, and `stageOf`.
- `scripts/__tests__/stages.test.ts` — the four states with real fixture values, the Soft/Full
  difference on one Gap, and the leak bound; runs under `pnpm data:check`.
- `lib/flow/state.ts` — the derived three-value status the stage composes with, and the blind rule
  it must never outrun ([TWO-PARTY-FLOW](TWO-PARTY-FLOW.md)).
- `docs/SPEC-DRIFT.md` — the specification against the build; §4 holds the rulings this note
  applies, and [REFERENCE-MOCKUPS](REFERENCE-MOCKUPS.md) indexes the page renders quoted above.
