# #975 D2 / D9 — whose relationship is this, and which one

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The relationship detail's identity, #975 · prev [A relationship with no initiator member, #958](../qa-958-no-initiator-member/README.md) · next [Payment capture & completion](../qa-payment/README.md)

<!-- docs-nav:end -->

Two rows of the #975 UX inventory (`t_df8c157e`), one failure in two clothes: the relationship detail
page never said **whose** relationship it was, and one screen named the same person's seat twice in
two different ways. Measured on `origin/main` (`ada118bc`, 1.17.1) and on the branch that fixes both,
against the demo branch (`ep-crimson-truth`), brand `alignsynch`, dev server on port **3419**.

Nothing in the repository was written by the walk; the two `create-draft` runs go through the
product's own create modal and clean up after themselves (`0 of the 1 record(s) and 1 relationship(s)
this run created still exist`).

## The two rows

| #   | what a person could not tell                                                                           | class       |
| --- | ------------------------------------------------------------------------------------------------------ | ----------- |
| D9  | which relationship this page is: five rows share one `<h1>`, and neither party is named                | read defect |
| D2  | which side of the pair they are on: `Initiator` in the chip, _"You are the Counterparty"_ 300 px below | read defect |

## D9 — the heading read the template, not the relationship

`readMyRelationship()` has returned two titles since #841: `title` (the record the relationship was
configured from — **the template's name**) and `relationshipTitle` (the title the creator's stage 1
wrote; the flow derives `Avery B – Rowan` from the two seats, `lib/flow/names.ts`). The list and the
card print `row.relationshipTitle ?? row.title`; the detail page printed `relationship.title` alone,
so it was the one surface a creator's own title never reached. The same defect `demo-flow` had been
recording since #841:

```
before  ✘ 14 create-draft — the relationship detail heads the draft with the title the creator gave it
          FINDING: create-draft: the relationship detail is headed by the template's name, not the draft's own title
after   ✔ 14 create-draft — the relationship detail heads the draft with the title the creator gave it
```

And the second half of the row — "neither party is named" — is the band's roles line, which was
`undefined` for every relationship whose slug names no catalogue type (`relationship-basics`, which
is all four demo rows). It now names the seats, in the shape the approved artifact's own seat labels
use (`§11` of `prototype-relationship-lifecycle-v9`: `Daniel — payer`, `Rowan — counterparty`), with
the catalogue type's nouns where the slug has them and the product's two words otherwise:

```
before  Relationship Basics                ← heading, then nothing
after   Relationship Basics
        Avery — Initiator / Rowan — Counterparty
```

The Counterparty's name comes from the **seat** (`party.role = 'counterparty'`), not from
`session_invite.counterparty_name`: the demo branch's four relationships have their seats bound and
`session_invite` empty, so the invitation's name does not exist while the person does. That is a new
column (`counterparty_seat_name`) beside the one the initiator has had since #706.

## D2 — two reads of the same relationship, and a sentence that claimed a role

The seat chip prints `viewerRole` — the viewer's own `party` row. The read-only band was gated on
`isInitiator` — the **permission** — and its one sentence opened with a **role** claim. Where the two
values disagree (`relationship.initiator_user_id` names another account, or `NULL` before #958, while
the viewer holds the Initiator seat) the screen said both:

```
#975 measured   [Initiator]  chip
                You are the Counterparty on this relationship.  ← the same viewer, 300 px lower
```

The sentence is now chosen by the seat the chip prints — the Counterparty's own words when the seat
is the Counterparty's, and a sentence that names no role when the controls are simply somebody else's
(`controls-belong-to-starter`). A screen cannot call one person both, because there is one value.

**On `ada118bc` the seeded repro no longer reproduces**, and that is #958's doing, not this card's:
`isInitiator` falls back to the viewer's Initiator seat when the account column is `NULL`, which is
every demo row, so the band no longer draws for Avery at all. The residual defect is the two-source
copy, which is what a divergent row still produced — pinned by
`tests/relationship-detail-identity.test.tsx` (3 D2 cases, 6 of 9 that fail on the parent commit).

## What the screens say now

Both roles, both widths, the same seeded relationship
(`relationship-assessment-instance-avery-rowan`), from `before/` and `after/log-identity.json`:

| screen                  | seat chip      | band sentence                       | heading + seats                                                    | overflowX |
| ----------------------- | -------------- | ----------------------------------- | ------------------------------------------------------------------ | --------- |
| initiator 1440 / 390    | `initiator`    | none (they hold the controls)       | `Relationship Basics` · `Avery — Initiator / Rowan — Counterparty` | 0         |
| counterparty 1440 / 390 | `counterparty` | "You are the Counterparty …" **×1** | same band                                                          | 0         |

`before/` is the same four screens with `git stash` of the branch's source: the band reads
`Relationship Basics` and nothing else, and neither party is named anywhere on the page.

## Reproduce

```bash
# the source both captures were taken from
git switch --detach origin/main            # before
git switch <the PR's branch>               # after

BRAND=alignsynch pnpm dev --port 3419      # .env.local carries the demo branch + DEMO_AUTH/DEMO_PIN

# both roles, 1440 and 390, probes + PNGs (DEMO_PIN comes from .env.local)
BASE_URL=http://localhost:3419 SHOTS=$PWD/docs/qa-975-detail-identity/after \
  node docs/qa-975-detail-identity/capture.mjs --phase=identity

# the draft's own title, through the create modal (creates and cleans up one draft)
BASE_URL=http://localhost:3419 DEMO_FLOW_SKIP_SEED=1 DEMO_FLOW_ONLY=create-draft \
  DEMO_FLOW_OUT=/tmp/demo-flow-975 pnpm demo:flow
```

`capture.mjs` is read-only: it signs in through `/demo`, opens four screens and writes the PNGs and
the probe log. Nothing is created, and no relationship or account is written.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The relationship detail's identity, #975 · prev [A relationship with no initiator member, #958](../qa-958-no-initiator-member/README.md) · next [Payment capture & completion](../qa-payment/README.md)

<!-- docs-nav:end -->
