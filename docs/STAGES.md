# Stages — the four the glossary defines, and the three it does not

A **Stage** is the glossary's name for "The progress of the Relationship functions". The
authoritative source (`AlignSynch.com - Glossary v2-01-01h 2023.docx.pdf`, Jan 2024) gives the
concept a Qty of **6** and points its Example List at **"(1-6)"**. It then defines **four**
stages, numbered **1, 2, 3 and 7**.

This note records what the source actually says, what the build derives from it, and — the part
that needs saying out loud — that **stages 4, 5 and 6 are undefined in the authoritative
source**, so nothing is built for them.

## The four, in the document's own words

| #   | Stage     | Definition (verbatim)                                                                                                    | Derived from                                                         |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Invited   | Initiator has Invited Counterparty, but they have not Registered. Aspects, Values, and Opinions are locked.              | the Counterparty's seat does not exist yet — the invite is unclaimed |
| 2   | Connected | Counterparty Registered, found the Relationship, and is free to Propose Changes to Aspects or Values, and mark Opinions. | both seats exist; the sheet is not complete (blind answering)        |
| 3   | Sharing   | Counterparty Shared Opinions, Relationship and Opinions now fully open to all Users.                                     | complete, and at least one Gap exceeds the instance's Setting        |
| 7   | Aligned   | Parties are Aligned - In Synch – Same Page.                                                                              | complete, and every Gap the instance has meets its Setting           |

The en dash in "Aligned - In Synch – Same Page" is the document's (hyphen, then en dash). The
lettered rows in the same table — A Play, B Registered, C Locked, D Paid — are _Initiator and
account_ states (billing), not relationship stages, and are not modelled here.

## Why there is no stage 4, 5 or 6

The document claims six stages and a "(1-6)" range, and then defines only 1, 2, 3 and 7: there is
no row numbered 4, 5 or 6 anywhere in it. That was checked against a full-text extraction of the
whole PDF, not against a summary of it — the stage table jumps straight from **3 Sharing** to **7
Aligned**.

**The decision (2026-10-31) is to build the four that exist and document the three that do not.**
Nothing is invented, and nothing is renumbered: Aligned is stage **7** because the document says
7, and there is no stage 4 in the vocabulary to hold fourth place. Inventing names would author
vocabulary the authoritative source does not have, and the obvious content for 4–6 — the Change
machinery (propose / approve / log / shading) — contradicts the freeze rule the flow already
ships: answers stop being editable at the instant both parties have submitted. Re-opening answers
is its own decision and its own issue; it is not smuggled in through a stage bar.

The numbering gap is therefore visible in the code on purpose:
`STAGE_NUMBERS = { invited: 1, connected: 2, sharing: 3, aligned: 7 }`.

## Nothing is stored

Every stage is derived on read from facts the rows already carry, in `content/stages.ts`
(`stageOf`). There is **no `stage` column**, exactly as there is no `status` column and no `gap`
column: a stored stage would be a second authored copy of a fact the invite row and the opinion
rows already carry, and no constraint in SQL could compare the two. No migration ships with this
derivation, and `db:verify`'s "no column named like a gap" rule is unchanged.

The Setting is read, never assumed: stage 7 is the only branch that looks at it, and it reads it
through the same `instanceAlignment` the report uses. Soft tolerates a Small Gap of 1; Full
tolerates none — so the same five Aspects can be stage 7 under one Setting and stage 3 under the
other. That is why the Setting is a required member of the derivation's input and has no default
anywhere.

## What a party who has not submitted sees

`invited` or `connected`, and nothing else. Those two are facts about **seats** — whether the
other person has claimed their invitation at all. Neither carries a score, an answered count, a
Gap value, or any hint that the other party is part-way through their sheet.

`sharing` and `aligned` describe a **finished** sheet, and both are reachable only once both
parties have submitted — the same instant the blind rule lifts. The input type
(`StageFacts`) makes that structural rather than a convention: the Setting and the Gaps are not
representable on an instance that is not complete, so there is no argument through which an
answer could reach a pre-submit stage.

## Not built here

- **The Stage Bar visual.** The derivation landed first; the bar is a later card and renders the
  four defined stages and nothing else.
- **Stages 4–6**, and the Change system they would need.
- **Stages A–D / billing** (Account Bank, Relationship Week, trial weeks, watermarks).

## Where it lives

- `content/stages.ts` — the four names, the numbers, the definitions, and `stageOf`.
- `scripts/__tests__/stages.test.ts` — the four states with real fixture values, the Soft/Full
  difference on one Gap, and the leak bound; runs under `pnpm data:check`.
- `lib/flow/state.ts` — the derived three-value status the stage composes with, and the blind
  rule it must never outrun ([TWO-PARTY-FLOW](TWO-PARTY-FLOW.md)).
- `docs/SPEC-DRIFT.md` — the wider specification-vs-build accounting, including the stage
  conflict between the glossary and the website specification.
