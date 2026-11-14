# #979 B — the create flow as a dialog over `/dashboard/relationships`

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The create flow as a dialog over the relationships page, #979 · prev [The Sent screen with no invitation row, #976](../qa-976-sent-none/README.md) · next [The welcome tiles on /register too, #971](../qa-971-tiles/README.md)

<!-- docs-nav:end -->

The card asks for one thing this repository cannot prove from a unit test: that pressing **Create
relationship** on the member's Relationships page draws the flow **over the page it was pressed on**,
with a real stage inside it — not a second flow, not a blank panel, not a navigation that leaves the
page behind.

`flow-dialog-relationships-1440.png` is that still: 1440×1000, one dev server on this branch
(`6d676087`), signed in as a throwaway account, the chooser opened, a template chosen, the Create
control pressed. `capture-report.json` is the measurement taken immediately before the shutter, so
the claim is readable as numbers rather than as a picture of a panel.

| Measured                   | Value                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| address after the click    | `/templates/relationship/brother-sister/create` — the stage's own                                                |
| the page it was pressed on | `/dashboard/relationships`, still mounted under the panel (`h1` `My Relationships` is in the same document)      |
| the mount marker           | `[data-flow-mount="dialog"]` present                                                                             |
| the dialog at 1440         | 878 × 986 at `x=281`                                                                                             |
| the stage panel            | 880 × 952 at `x=280` — the 880 px cap, centred                                                                   |
| the stage inside it        | `h1` `Relationship Details` (stage 1 of 5)                                                                       |
| its real fields            | title, initiator first/last name, counterparty first/last name, counterparty email, the relationship description |

The address staying the stage's own is the mounting's whole design, not a side effect: the dialog is
an **intercepted route** (`app/(mainlayout)/dashboard/relationships/@flow/**`), so a soft navigation
into a stage keeps its URL, a refresh of that URL renders the same stage as a page, and the five
wizard routes are untouched for deep links and invitations.

## What this still does **not** prove

- **Focus trap, `Esc`, scroll lock, focus return and narrow-width full-bleed** are the child card's
  work; the frame's dismissal path exists, but this capture does not exercise the keyboard.
- **Advancing a stage inside the dialog** (the `fetch` submit that keeps the document alive) is
  covered by `tests/flow-dialog-shell.test.tsx`, not by this still — a still cannot press twice.
- **The other entry points** into the flow are a third card; this capture is the dashboard's one
  control, which is all this card wires.

## Reproducing it

```bash
# from the worktree, with the environment of the main checkout (a worktree carries no .env)
~/.hermes/profiles/alignsynch/bin/withenv.sh <main-checkout> \
  bash -c 'cd <worktree> && exec pnpm dev --port 3001 --hostname 127.0.0.1'

node docs/qa-979-flow-dialog/capture.mjs --base http://localhost:3001 --out docs/qa-979-flow-dialog
```

`capture.mjs` signs the throwaway account in **from Node** (the auth branch answers
`403 INVALID_ORIGIN` to a browser-origin sign-in) and installs its two `__Secure-` cookies over CDP
before the first navigation; `cookies.json` is the session it writes between runs and is gitignored.
It also refuses to guess: every step is a named `waitFor` on the DOM it expects, so a missing
control fails as `never became true: <what>` rather than as a photograph of the wrong screen.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The create flow as a dialog over the relationships page, #979 · prev [The Sent screen with no invitation row, #976](../qa-976-sent-none/README.md) · next [The welcome tiles on /register too, #971](../qa-971-tiles/README.md)

<!-- docs-nav:end -->
