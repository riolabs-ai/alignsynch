# #979 B — the create flow's dialog behaves like a route

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › The flow's dialog behaves like a route, #979 · prev [The create flow as a dialog over the relationships page, #979](../979-flow-dialog/README.md) · next [AS2 home visual QA](../as2-home/README.md)

<!-- docs-nav:end -->

The card asks for the four things that separate a dialog from _a card that happens to be open_: an
address that survives a refresh, a Back button that walks the wizard instead of leaving the product,
the accessibility behaviours a modal owes a keyboard, and a panel that is the viewport at 390 rather
than a squeezed card with a scroll trap inside it. All four are measured here, by one script, on one
dev server, signed in as a throwaway account.

`report.json` is the measurement; the three stills are the readable half of it. Reproduce with:

```bash
# from the worktree, with the environment of the main checkout (a worktree carries no .env)
~/.hermes/profiles/alignsynch/bin/withenv.sh <main-checkout> \
  bash -c 'cd <worktree> && exec pnpm dev --port 3001 --hostname 127.0.0.1'

node docs/qa/979-flow-parity/capture.mjs --base http://localhost:3001 --out docs/qa/979-flow-parity
pnpm format   # report.json is generated; the gate formats it like every other file
```

## 1. Deep-link parity — a history entry per stage, and a pop to close

**Every stage advance is a history entry (`router.push`); nothing in the flow calls `router.replace`.**
That is what makes Back mean "the stage before" rather than "leave the product", and it is asserted
against the shell's source in `tests/flow-dialog-keyboard.test.tsx` — a `replace` there would collapse
the whole flow into one entry, which is the fake the card names.

The walk, measured with three browser Back presses (`Page.navigateToHistoryEntry`, the same history
navigation the Back button performs):

| #   | Address after the press                                 | Dialog | Stage drawn            |
| --- | ------------------------------------------------------- | ------ | ---------------------- |
| —   | `/templates/relationship/brother-sister/create/aspects` | open   | Stage 3 of 5, Aspects  |
| 1   | `/templates/relationship/brother-sister/create/mode`    | open   | Stage 2 of 5, Settings |
| 2   | `/templates/relationship/brother-sister/create`         | open   | Stage 1 of 5, Details  |
| 3   | `/dashboard/relationships`                              | closed | the page underneath    |

### The refresh proof

`1-stage3-in-dialog-1440.png` is stage 3 inside the dialog, at the address
`/templates/relationship/brother-sister/create/aspects`. Typing that address into the page and
reloading it gives `2-stage3-as-a-page-1440.png`: **the same address, the same stage, rendered as a
page** — `[data-flow-mount="dialog"]` absent, `h1` "Relationship Aspects", rail "Stage 3 of 5",
panel still 880 × 952 at x=280. No stage 1, no blank dialog.

### Closing is a pop, not a push — and that was a real defect

The card's own suspicion ("a `router.replace` that never lets Back work is not parity") was right in
spirit and wrong in direction: the dismissal was a **push**, and a push does nothing here. Measured,
with a temporary probe over the same dialog:

| Dismissal                | Address after Esc                 | Dialog |
| ------------------------ | --------------------------------- | ------ |
| `router.push(origin)`    | `/templates/…/create` (unchanged) | open   |
| `router.replace(origin)` | `/templates/…/create` (unchanged) | open   |
| `router.back()`          | `/dashboard/relationships`        | closed |

Next keeps an intercepted slot's active subpage across a soft navigation, so pushing the page the
dialog stands over is a no-op while the interception is active; **going back is what ends it**. Since
each stage is an entry, the dismissal pops exactly the entries the flow pushed —
`flowEntriesSinceOrigin()`, from the Navigation API's entry index — which lands on the origin page in
one step from stage 3 (`entriesSinceOrigin: 2` in `report.json`) and leaves no trail for Back to walk
back into. Where the browser has no Navigation API the shell falls back to a single `router.back()`.

## 2. The four accessibility behaviours

| Behaviour                     | Measured                                                                                        | Test                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| focus trapped                 | 12 real `Tab` presses, every landing inside the panel; a focus aimed at the page pulled back in | `tests/flow-dialog-keyboard.test.tsx`                |
| `Esc` closes                  | one press from stage 3 → dialog gone, address `/dashboard/relationships`                        | `tests/flow-dialog-escape.test.tsx` + keyboard suite |
| scroll locked behind it       | `getComputedStyle(document.body).overflow` = `hidden`; a `scrollTo` moves the page 0 px         | `tests/flow-dialog-keyboard.test.tsx`                |
| focus returned to the trigger | `document.activeElement` after `Esc` is the control that leads back into the flow               | `tests/flow-dialog-keyboard.test.tsx`                |

`aria-modal="true"` and the stage's own heading as the accessible name were already measured by the
parent card; they are re-checked live in `report.json` (`opened.title` = "Relationship Details",
`stageThree.title` = "Relationship Aspects").

### Focus return has two measured caveats, both handled

1. **It cannot happen while the panel stands.** The modal's trap pulls an outside focus straight back
   in, so a focus given during the dismissal is undone and the following navigation drops focus on
   `<body>` — that was the behaviour before this card (`activeElement: "BODY"`). The shell now gives
   focus in the effect cleanup, when the panel has left the document.
2. **The trigger may not exist any more.** The intercepted render re-renders the page underneath and
   the chooser comes back closed, so the Create control is **not in the document** while the dialog
   stands (`triggerPresent: false` in every open snapshot). The origin therefore carries a fallback
   selector for the always-mounted Start control, and focus goes to the first of the two that is
   still mounted. Measured after `Esc`: `activeText: "Start a relationship"`,
   `activeIsFallback: true`.

## 3. Narrow widths — the same shell, full-bleed

`3-dialog-390-full-bleed.png`, at 390 × 844: the panel is `{ x: 0, y: 0, 390 × 844 }` — exactly the
viewport, `fullBleed: true` — with no element inside it wider than the panel
(`elementsWiderThanPanel: []`) and the page behind scroll-locked. It is the same component at every
width: the only thing that changes is a CSS breakpoint (`inset-0` below `lg`, `inset-6` +
`max-w-[880px]` above it), never a second mobile path.

One honest note: while the dialog is open the _document_ is 564 px wide at a 390 px viewport, because
the app shell keeps its closed mobile drawer laid out at x=390. Nothing in the dialog contributes to
that (`widestInDocument` rows are all `insidePanel: false`), and the page is scroll-locked, so it
cannot be scrolled to.

## 4. A draft survives `Esc`

The draft is the flow's own cookie, written by stage 1 and by the Account stage; a dismissal never
discarded it and this card adds no discard prompt the spec does not draw. Measured: after `Esc` from
stage 3, reopening the flow shows `title: "Avery and Rowan, on trust"` and
`counterpartyFirst: "Rowan"` — what was typed, not an empty form (`draftAfterEscape` in
`report.json`).

## Still not proved here

- **Stage 4 (Account) and stage 5 (Invite)** are not walked: they ask for an account and a plan, and
  a payment surface is not this card. The dismissal's pop is measured from stage 3, which is two
  entries deep; the mechanism counts entries rather than trusting a stage index.
- **A shared link is the same browser.** The refresh proof reloads the address with the draft cookie
  present, which is what a person who refreshes sees. A link opened on another device has no draft, so
  it lands on stage 1 by design (`…/create/aspects` redirects to Who when there is no draft) — that is
  the flow's existing rule, unchanged here.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › The flow's dialog behaves like a route, #979 · prev [The create flow as a dialog over the relationships page, #979](../979-flow-dialog/README.md) · next [AS2 home visual QA](../as2-home/README.md)

<!-- docs-nav:end -->
