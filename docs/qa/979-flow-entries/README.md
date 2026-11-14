# The create flow opens **in place** from every in-product door, #979 B

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Every in-product Create door opens the flow in place, #979 · prev [The create flow as a dialog over the relationships page, #979](../979-flow-dialog/README.md) · next [AS2 home visual QA](../as2-home/README.md)

<!-- docs-nav:end -->

**Measured** on `main` + this branch (`526dcb99` + the convergence diff), dev server
`http://localhost:3479`, Chrome driven over raw CDP by [`capture.mjs`](capture.mjs). Two viewports:
**1440×1000** (the dialog) and **390×844** (the sheet). Six sampled entries, each walked to the same
four facts; two entries of the class that must **not** move, captured with the same harness.

Reproduce:

```bash
PORT=3479 withenv.sh <repo> node24.sh pnpm dev      # the DEV branch's DATABASE_URL + auth env
node24.sh node docs/qa/979-flow-entries/capture.mjs --base http://localhost:3479 --out docs/qa/979-flow-entries
```

`cookies.json` is gitignored: the harness signs a throwaway account up from Node (the auth branch
refuses a browser-origin sign-in) and installs the cookies with `Network.setCookies`.

## The six samples

| #   | surface (the door pressed)                                          | viewport    | address after the press                                         | panel                                  | stage 1 → advance                                                 | `Esc`     |
| --- | ------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- | --------- |
| 1   | `/dashboard/templates` — catalogue card, `Create Relationship`      | 1440×1000   | `/templates/relationship/brothers/create`                       | **880×952 at x=280**                   | `/create/mode`, dialog still mounted, shelf still in the document | **no-op** |
| 2   | `/templates/relationship` — library card, `Create Relationship`     | 1440×1000   | `/templates/relationship/business-partners/create`              | 880×952 at x=280                       | `/create/mode`                                                    | **no-op** |
| 3   | `/templates/relationship/<slug>` — the detail page's primary action | 1440×1000   | `/templates/relationship/assessment-relationship-basics/create` | 880×952 at x=280                       | `/create/mode`                                                    | **no-op** |
| 4   | `/dashboard/relationships` — the chooser's `Start the relationship` | 1440×1000   | `/templates/relationship/brother-sister/create`                 | 880×952 at x=280                       | `/create/mode`                                                    | **no-op** |
| 5   | `/assessment` — catalogue card, `Create Relationship`               | **390×844** | `/templates/relationship/business-partners/create`              | **390×844 at 0,0** (full-height sheet) | `/create/mode`                                                    | **no-op** |
| 6   | `/dashboard/templates` — catalogue card                             | **390×844** | `/templates/relationship/brothers/create`                       | 390×844 at 0,0                         | `/create/mode`                                                    | **no-op** |

Every sample carries the same stage: `h1` **Relationship Details**, the rail's cell **Details**, and
the seven fields `templateRecordId, title, initiatorFirst, initiatorLast, counterpartyFirst,
counterpartyLast, email` — the same element tree a deep link renders, because the intercepted route
imports the stage's own page module and changes one prop.

**Stage 1 completes** in every sample: the five required controls and the counterparty address are
typed through the browser's own input events, the advance posts the stage's own form
(`application/x-www-form-urlencoded`), the dialog captures it, follows the answer with `router.push`,
and the address becomes the **stage's own** `/templates/relationship/<slug>/create/mode` — never a
dialog-specific URL. `pageStillMounted: true` on all six: the page the door was pressed on is still
in the document under the panel, which is the whole point of converging the doors.

## The finding: `Esc` does not close the dialog (a defect in #1004's dismissal)

This is measured, not inferred, and it is **not** a harness artefact — three independent facts from
each sample:

| measurement                          | value                                                      | what it rules out                                                                   |
| ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `location.pathname` after `Esc`      | unchanged (the stage's own address)                        | the dismissal ran and left onto the stage deliberately                              |
| `history.length` before → after      | **50 → 50**                                                | the dismissal navigated and something rolled it back                                |
| `document.activeElement` after `Esc` | `body`                                                     | focus returned to the trigger (it did not)                                          |
| `history.back()` afterwards          | **moves the URL** to the previous stage, dialog still open | a dead address; the stage URL is real and the router simply did not act on the push |

**Mechanism.** `FlowDialogMount`'s `dismiss()` calls `closeFlowToOrigin((path) => router.push(path))`
with the page the flow was opened over — and that page is the one already mounted _underneath_ the
slot. When the router is handed the URL of the route it is already rendering (the intercepted page
plus its slot), the navigation is dropped: no URL change, no history entry, no popstate. Pushing a
**different** page does work — measured, with the same harness: a dismissal with no remembered origin
falls back to `/dashboard/relationships`, and from `/dashboard/templates` that push closes the dialog.

So the loss is specific and reproducible: **for an in-product door — which is every door this card
converges — the origin is always the page underneath, and the close is always a no-op.** The same
shape applies to `/dashboard/relationships` (where #1004 mounted the first dialog), which is why this
is reported on `t_c99072cc` rather than patched here: `components/assessment-flow/**` is that card's
shell, and this card's brief forbids modifying it.

Candidate fixes, for whoever owns the shell (all confined to `FlowDialogMount`/`dialog-origin.ts`):

1. **`router.back()` when an origin was remembered**, `push(fallback)` otherwise — an intercepted
   push is exactly one history entry, so `back()` is exact. Needs the advances counted (each stage
   advance is another push) or the advances made `router.replace`, so the whole flow occupies one
   entry.
2. Keep `push` but navigate to the origin **with a cache-busting key** — not recommended: it puts a
   meaningless fact in an address whose job is to name one screen.
3. Dismiss by clearing the slot instead of navigating — not possible with an intercepted route,
   whose existence _is_ the address.

## The class that must not move

| entry                                                                    | door                                             | what the press did                           | dialog          |
| ------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------- | --------------- |
| `/relationship-types` (marketing) — `Create Relationship` on a type card | `⇒ /templates/relationship/staff-manager/create` | **navigated** to the wizard route, as a page | **not mounted** |
| `/assessments` (member, empty state) — `Start a relationship`            | `⇒ /assessment`                                  | **navigated** to the catalogue               | **not mounted** |

Both are stills of the page as it renders (`marketing-relationship-types-1440-page.png`,
`assessments-empty-390-page.png`) plus the address the press produced — the claim "the marketing pages
render unchanged" is a capture, not a sentence.

## Files in this directory

| file                                                                           | what it is                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `capture.mjs`                                                                  | the harness: Node-side sign-in, CDP, six samples, two unchanged entries |
| `capture-report.json`                                                          | every number above, per sample, including the `Esc` trace               |
| `*-dialog.png`                                                                 | the dialog open over the page it was pressed on                         |
| `*-stage1-filled.png`                                                          | stage 1 with the typed values, before the advance                       |
| `*-after-esc.png`                                                              | where `Esc` left the screen (the dialog, unchanged — the finding)       |
| `marketing-relationship-types-1440-page.png`, `assessments-empty-390-page.png` | the class that keeps navigating, as it renders                          |

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Every in-product Create door opens the flow in place, #979 · prev [The create flow as a dialog over the relationships page, #979](../979-flow-dialog/README.md) · next [AS2 home visual QA](../as2-home/README.md)

<!-- docs-nav:end -->
