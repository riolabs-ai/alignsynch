# #957 — `/assessment` published a relationship in one click

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › One-click create on /assessment, #957 · prev [#542 phase 2](../542-phase2/README.md) · next [A relationship with no initiator member, #958](../958-no-initiator-member/README.md)

<!-- docs-nav:end -->

The public catalogue shipped a six-field form on **every** card that posted `POST /assessment/new`
with no `draft` flag. The endpoint's non-draft path is the whole Invite stage: it writes the
`relationship` row at `published`, sets `published_at`, opens the payment obligation, mints the
invitation and **mails it**. So one press on a marketing surface created a live relationship with no
plan, no card and no stage 2–5 — a second create path beside the flow's five stages, in the class
`tests/one-create-path.test.ts` was written for (#913), which had only looked at the list route.

**Decision (step 2 of the card): the form is deleted.** The door was already there, on the same
card, and it is the _shared_ one: `TemplateCard` (`components/assessment-flow/template-card.tsx`)
renders `Create Relationship` as an anchor to
`createRelationshipPath(template.slug)` — stage 1 of the one flow — for `/assessment` **and**
`/templates/relationship` alike. So deleting the form did not invent a new surface; it removed the
second path and left the one both catalogues already used. That is the card's "doomed if" closed by
construction: the two surfaces cannot differ without editing the shared card.

## What was measured, and how

One headless Chrome over raw CDP (Node 24 has a global `WebSocket`), signed in as the demo initiator
**from Node** — the auth branch answers a browser `Origin` with `403` and a server-side POST with
`200` (`alignsynch-webapp` → `references/qa-stills.md`). Dev server on `:4319`, `127.0.0.1`-bound,
started from this worktree with the main checkout's env (`withenv.sh <main checkout> bash -c 'cd
<worktree> && …'`).

```bash
withenv.sh <main checkout> bash -c 'cd <worktree> && node24.sh node \
  docs/qa-957-assessment-one-click/capture.mjs --base http://localhost:4319 --phase before'
# … the fix …
withenv.sh <main checkout> bash -c 'cd <worktree> && node24.sh node \
  docs/qa-957-assessment-one-click/capture.mjs --base http://localhost:4319 --phase after'
```

`probe.mjs` is the read-only branch census the card's step 4 asks for. `capture.mjs` asserts every
claim **before** each shutter and writes `before-report.json` / `after-report.json`.

## Before — one submit, and what it wrote

| Measured                               | Value                                          |
| -------------------------------------- | ---------------------------------------------- |
| cards / create forms on `/assessment`  | 28 / **28**                                    |
| cards already carrying the flow's door | 28                                             |
| landing after one submit               | `/assessment/instances/04aaeb44-…?invite=sent` |
| `relationship.status`                  | **`published`**                                |
| `published_at`                         | set (`2026-11-13T16:44:09Z`)                   |
| `relationship.plan`                    | **`NULL`**                                     |
| initiator `party` rows                 | 1 (bound to the signed-in account)             |
| `relationship_payment` rows / captured | 1 / **0**                                      |
| `session_invite` rows                  | 1                                              |
| stages 1–5 that ran                    | **none**                                       |

`957-01-catalogue-one-click-form.png` — the catalogue as shipped: 28 cards, each with the
**Create and invite** form under its **Create Relationship** link, on a public page.
`957-02-published-one-click.png` — the relationship screen that same single submit landed on, with
`?invite=sent`: the invitation had already gone out.

The row is this run's own, and the script deletes it in a `finally` (children → `record` → the
relationship, `flow-e2e.mjs`'s order, #865). It printed
`removed this run's own relationship 60d0b960-…`; the branch is back at 4 drafts / 0 published.

**Step 4's answer: no published-without-payment row existed on the demo branch before this card.**
`probe.mjs` read `published relationships with plan NULL: 0` and `relationship statuses: draft 4` —
so nothing was silently deleted, and there was nothing to repair.

## After — the page renders no way to create, only the door

| Measured                               | Value                                                |
| -------------------------------------- | ---------------------------------------------------- |
| `<form>` inside a card / on the page   | **0 / 0**                                            |
| controls posting `/assessment/new`     | **0**                                                |
| mode radios, name inputs, email inputs | 0 / 0 / 0                                            |
| cards with the flow's door             | 28 of 28, label `Create Relationship`                |
| door destination                       | `/templates/relationship/relationship-basics/create` |
| stage 1's rail                         | `Stage 1 of 5`, current cell `Details`               |
| stage 1's cells                        | `Details · Settings · Aspects · Account · Invite`    |
| stage 1's own fields drawn             | yes (its email field is present)                     |

`957-03-catalogue-door-only.png` — the same catalogue after the fix: one `Create Relationship` per
card, no form anywhere, no horizontal overflow at 1440.
`957-04-door-lands-on-stage-1.png` — the door's landing: stage 1, **Details**, `Stage 1 of 5`.

## Stills

| File                                  | Dimensions   | What it shows                                                  |
| ------------------------------------- | ------------ | -------------------------------------------------------------- |
| `957-01-catalogue-one-click-form.png` | 1440 × 10686 | before — 28 cards, each with the create form                   |
| `957-02-published-one-click.png`      | 1440 × 2749  | the published relationship one submit produced, `?invite=sent` |
| `957-03-catalogue-door-only.png`      | 1440 × 4798  | after — the door only (the page is half as tall)               |
| `957-04-door-lands-on-stage-1.png`    | 1440 × 940   | after — the door landing on stage 1's Details screen           |

Every still asserts `document.body.innerText` carries no `DATABASE_URL`, `postgres://`, `npg_` or
`sk_test` before its shutter; every report records the check list it passed.

## A second defect this capture ran into — not fixed here

The catalogue lists **29** published templates but only **three** carry a `template_version`
(`relationship-basics`, `parent-child`, `staff-manager`), so a card for any of the other 26 lands on
stage 1 and is refused there with `?problem=template-not-published` ("has no published version —
publish it before a relationship can copy it"). The list's predicate (`status = 'published' AND
EXISTS item`) is not the create's predicate (a published **version**), so `/assessment` offers doors
that cannot open. That is a listing-versus-writer mismatch with its own fix (the read, or the seed
that should write a version), and it is reported on the PR rather than folded into this card: it is
not a create path, and repairing it changes what the catalogue lists on both brands.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › One-click create on /assessment, #957 · prev [#542 phase 2](../542-phase2/README.md) · next [A relationship with no initiator member, #958](../958-no-initiator-member/README.md)

<!-- docs-nav:end -->
