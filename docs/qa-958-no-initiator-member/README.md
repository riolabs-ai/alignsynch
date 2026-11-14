# #958 — a relationship with no initiator member reaches the pay modal

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › A relationship with no initiator member, #958 · prev [One-click create on /assessment, #957](../qa-957-assessment-one-click/README.md) · next [The relationship detail's identity, #975](../qa-975-detail-identity/README.md)

<!-- docs-nav:end -->

The owner's rule in three parts ends _no Initiator member → resolved through the modal_. It was the
one part with no working path, and #913's sweep measured the two rows where it failed: a
**list-created draft** and a **demo/seed draft**. `#912`'s handoff named the cause as _"needs a
relationship-keyed pay route"_, and it was half right — the address was never the problem.

## What is actually wrong

The demo branch ships **four relationships, all four with `relationship.initiator_user_id` NULL**,
and the two that matter here have their `party` seats bound:

| relationship                                   | status  | `initiator_user_id` | session                           | Initiator seat    |
| ---------------------------------------------- | ------- | ------------------- | --------------------------------- | ----------------- |
| `relationship-assessment-instance-avery-rowan` | `draft` | `NULL`              | `assessment-instance-avery-rowan` | `initiator@demo…` |
| the other three                                | `draft` | `NULL`              | present                           | unbound (nobody)  |

So Avery holds the **Initiator seat** and `initiator_user_id` names nobody. The read decided the
write permission from the column alone:

```ts
const isInitiator = row.initiator_user_id !== null && row.initiator_user_id === viewerUserId;
```

which made Avery a Counterparty on their own relationship. Every downstream flag is
`isInitiator && …`, so on the list the two draft CTAs were absent and the primary read **Open
Relationship**, and on the detail screen the read-only band said _"You are the Counterparty on this
relationship"_ — no publish band, no Invite Members, no Aspects editor.

**The modal was always reachable.** Stage 5 resolves the viewer from the party seat
(`relationshipRoleOf`), and its Send (`sendDraftInvitation`) does the same, so the address
`/templates/relationship/<slug>/create/invite?instance=<session>` opens for Avery and its walk takes
the card. The defect was the permission bit in front of the door, not the door.

## The rule, and why it is safe

`lib/relationship/initiator.ts` — one pure function, and the order is the protection:

- the **column** answers first and always wins when it names somebody. A hand-edited `party` row
  cannot outvote it, so #706's guarantee is untouched: a Counterparty is listed and read-only.
- `NULL` — and a blank string, which a hand repair can write — is the absence the fallback is for,
  and then the viewer's **own Initiator seat** answers.
- the fallback cannot widen into a session-keyed read: it asks which seat the viewer holds on _this
  relationship_, and a bound seat hangs off a `session` row, so `isInitiator` implies "there is a
  session" — which is why the modal's address always resolves for a row this rule opens.

The screen and the transaction call the same function: `readMyRelationship` for the flags, and
`saveAspects` / `publishRelationship` / `republishRelationship` inside their own `act()`
transactions, where the seat is read only when the column named nobody.

## Before, beside after

Both captured with `capture.mjs` in this directory, headless Chrome over CDP at 1440×1200 on
`BRAND=alignsynch`, signed in as `initiator@demo.alignsynch.test`; `before` on
`origin/main 1322666`, `after` on this branch. The full census is
[`before-report.json`](before-report.json) and [`after-report.json`](after-report.json).

| what                               | before                                     | after                                                        |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| card chip                          | `Initiator` (from the seat)                | `Initiator`                                                  |
| card **Invite Members**            | absent                                     | `…/create/invite?instance=assessment-instance-avery-rowan`   |
| card **Publish to Counterparty**   | absent (primary was **Open Relationship**) | same address — the modal's own Send                          |
| card disabled/inert controls       | none                                       | none                                                         |
| detail **read-only band**          | _"You are the Counterparty on this…"_      | absent                                                       |
| detail publish band                | absent                                     | `data-publish-gate="method-required"` + the pair below       |
| detail **Invite Members**          | absent                                     | the modal                                                    |
| detail **Publish to Counterparty** | absent                                     | the modal                                                    |
| detail **Aspects editor**          | absent (frozen list only)                  | present (Add an Aspect, Save the draft, Save and mark ready) |
| detail fork-template panel         | present                                    | absent — the initiator owns the words (#785)                 |

The band's two doors are one address because the modal is one screen: its walk takes the card and
its Send is what publishes and invites. The card has drawn that pair to that address since #913.

## The stills

| still                                            | what it shows                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [`958-before-list.png`](958-before-list.png)     | the card as `main` drew it: role chip **Initiator**, primary **Open Relationship**, no draft CTAs                    |
| [`958-before-detail.png`](958-before-detail.png) | the detail's only band: _"You are the Counterparty on this relationship"_                                            |
| [`958-after-list.png`](958-after-list.png)       | **Invite Members** and **Publish to Counterparty**, both to the modal, nothing disabled                              |
| [`958-after-detail.png`](958-after-detail.png)   | the payment band with the same pair, and the Aspects editor above it                                                 |
| [`958-after-modal.png`](958-after-modal.png)     | where both land: stage 5, _"Send the invitation"_, plan choices and the card walk, Send gated until the walk is done |

## The test that keeps it

`tests/relationship-initiator-seat.test.ts` — ten cases across four seams: the rule (column first,
seat second, blank column reads as nobody), the read (`isInitiator`, `aspectsEditable`,
`publishable`, `canForkTemplate` for both seats on the same `NULL` row), the write (`saveAspects`
accepts the seat-holder, refuses the Counterparty and refuses an account with no seat), and one
mechanical sweep: `lib/member/relationships.ts` carries no `initiator_user_id !==` comparison
outside the resolver.

**Proven to bite**, both ways, on this branch:

```bash
# 1. the rule — put main's comparison back in `relationshipOf`
npx vitest run tests/relationship-initiator-seat.test.ts
#   × gives the account in the Initiator seat every write flag
#     AssertionError: expected false to be true
#   × carries no direct initiator_user_id comparison outside the resolver
#   Tests  2 failed | 8 passed (10)

# …restore, and it is green again
npx vitest run tests/relationship-initiator-seat.test.ts
#   Tests  10 passed (10)

# 2. the card — put the inert `Invite Members` back in relationship-cards.tsx
npx vitest run tests/member-relationship-cards.test.ts
#   × says why the modal cannot open, and offers a door, when the draft has no session (#958)
#     AssertionError: expected '…' not to contain 'aria-disabled'
#   Tests  1 failed | 15 passed (16)
```

## What a draft with no session says instead

A relationship with no session cannot open the modal at all — stage 5 is keyed by the session — and
#958's answer is **not** a greyed-out `Invite Members` with its reason in a `title`. The card prints
the reason in words and offers the door that fixes it (the template's own create flow, the only
writer of a session). No such row can be created since #913 deleted the list's create band; the
branch exists for a tree that still holds one.

## How it was measured

```bash
# renders + census, from this directory; the server must be BRAND=alignsynch on :3411
# (`localhost`, not `127.0.0.1` — Neon Auth answers INVALID_ORIGIN otherwise)
node docs/qa-958-no-initiator-member/capture.mjs --base http://localhost:3411 --phase after \
  --out docs/qa-958-no-initiator-member

# the card's own suite, and the round trip through the modal
pnpm test
pnpm flow:e2e
bash scripts/verify.sh
```

The database reads behind the table at the top (`initiator_user_id`, seats, `relationship_payment`,
`session_invite`) came from `pg` against `DATABASE_URL` with `NEON_BRANCH=demo`.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › A relationship with no initiator member, #958 · prev [One-click create on /assessment, #957](../qa-957-assessment-one-click/README.md) · next [The relationship detail's identity, #975](../qa-975-detail-identity/README.md)

<!-- docs-nav:end -->
