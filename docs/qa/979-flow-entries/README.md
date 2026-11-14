# The create flow opens **in place** from every in-product door, #979 B

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Every in-product Create door opens the flow in place, #979 · prev [The create flow as a dialog over the relationships page, #979](../979-flow-dialog/README.md) · next [The flow's dialog behaves like a route, #979](../979-flow-parity/README.md)

<!-- docs-nav:end -->

**Measured** on this branch stacked on #1009 (`9bf53c4f`, the dismissal that closes by popping the
entries the flow pushed) over `main` at `da00fe2f`, dev server `http://localhost:3479`, Chrome driven
over raw CDP by [`capture.mjs`](capture.mjs). Two viewports: **1440×1000** (the dialog) and
**390×844** (the sheet). Six sampled entries, each walked to the same four facts; two entries of the
class that must **not** move, captured with the same harness.

Reproduce:

```bash
PORT=3479 withenv.sh <repo> node24.sh pnpm dev      # the DEV branch's DATABASE_URL + auth env
node24.sh node docs/qa/979-flow-entries/capture.mjs --base http://localhost:3479 --out docs/qa/979-flow-entries
```

`cookies.json` is gitignored: the harness signs a throwaway account up from Node (the auth branch
refuses a browser-origin sign-in) and installs the cookies with `Network.setCookies`.

## The six samples

| #   | surface (the door pressed)                                          | viewport    | address after the press                                         | panel                                  | stage 1 → advance                                                 | `Esc` closes →                   | focus after `Esc`                              |
| --- | ------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| 1   | `/dashboard/templates` — catalogue card, `Create Relationship`      | 1440×1000   | `/templates/relationship/brothers/create`                       | **880×952 at x=280**                   | `/create/mode`, dialog still mounted, shelf still in the document | `/dashboard/templates`           | **the door**                                   |
| 2   | `/templates/relationship` — library card, `Create Relationship`     | 1440×1000   | `/templates/relationship/business-partners/create`              | 880×952 at x=280                       | `/create/mode`                                                    | `/templates/relationship`        | **the door**                                   |
| 3   | `/templates/relationship/<slug>` — the detail page's primary action | 1440×1000   | `/templates/relationship/assessment-relationship-basics/create` | 880×952 at x=280                       | `/create/mode`                                                    | `/templates/relationship/<slug>` | **the door**                                   |
| 4   | `/dashboard/relationships` — the chooser's `Start the relationship` | 1440×1000   | `/templates/relationship/brother-sister/create`                 | 880×952 at x=280                       | `/create/mode`                                                    | `/dashboard/relationships`       | the `Start a relationship` control (see below) |
| 5   | `/assessment` — catalogue card, `Create Relationship`               | **390×844** | `/templates/relationship/business-partners/create`              | **390×844 at 0,0** (full-height sheet) | `/create/mode`                                                    | `/assessment`                    | **the door**                                   |
| 6   | `/dashboard/templates` — catalogue card                             | **390×844** | `/templates/relationship/brothers/create`                       | 390×844 at 0,0                         | `/create/mode`                                                    | `/dashboard/templates`           | **the door**                                   |

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

## `Esc` closes — and the door it goes back to is a _new_ element

The first pass of this capture measured the opposite and it was a real defect: `Esc` left the dialog
mounted, the URL unchanged, `history.length` 50 → 50, focus on `<body>` — a `router.push` back to the
page already mounted under an active interception is dropped by Next's router. That measurement went
to `t_c99072cc` (the shell's card) and was repaired on `t_fae57af3` / PR #1009, which closes by
**popping** the entries the flow pushed (`flowEntriesSinceOrigin()`), and this branch is stacked on it.

At this head, with the same harness, all six close:

| measurement                          | value                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `location.pathname` after `Esc`      | the page the door was pressed on, on all six                            |
| `history.length` before → after      | the flow's own entries are gone (one entry per stage advance)           |
| `document.activeElement` after `Esc` | the door itself on samples 1, 2, 3, 5 and 6 — at 0 ms, not a frame late |

Sample 4 lands on the always-mounted **`Start a relationship`** control rather than the door inside
the chooser: the chooser's door lives in a disclosure that the intercepted render comes back with
_closed_, so `relationship-create.tsx` nominates `[data-relationships-start-toggle]` as the fallback
and focus goes to the first of the two controls still in the document. That is the shell's own
documented behaviour (`lib/flow/dialog-origin.ts`), measured here rather than assumed.

**Why focus fell to `<body>` even after the pop.** Measured on this harness, not inferred: the pop
re-renders the page underneath and **React does not keep the anchor** — a JS expando stamped on the
door before the press is on no element in the document afterwards (`markedAnywhere: 0`, 28 doors
present). So the element the shell remembered was detached when it came to hand focus back, and
`resolveFocusTarget` returned `null`. The fix is in this card's own component, not the shell:
[`FlowEntryLink`](../../../components/assessment-flow/flow-entry-link.tsx) renders
`data-flow-entry-id="<href>"` and hands `[data-flow-entry-id="<href>"]` to `rememberFlowOrigin` as the
fallback — a different node, the same control, which is what "focus returns to the trigger" has to
mean once the trigger is replaced.

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
| `capture-report.json`                                                          | every number above, per sample, including the `Esc` focus trace         |
| `*-dialog.png`                                                                 | the dialog open over the page it was pressed on                         |
| `*-stage1-filled.png`                                                          | stage 1 with the typed values, before the advance                       |
| `*-after-esc.png`                                                              | where `Esc` left the screen: the page the door was pressed on           |
| `marketing-relationship-types-1440-page.png`, `assessments-empty-390-page.png` | the class that keeps navigating, as it renders                          |

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Every in-product Create door opens the flow in place, #979 · prev [The create flow as a dialog over the relationships page, #979](../979-flow-dialog/README.md) · next [The flow's dialog behaves like a route, #979](../979-flow-parity/README.md)

<!-- docs-nav:end -->
