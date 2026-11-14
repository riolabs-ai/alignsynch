# Relationship detail — the edit form is asked for (#923)

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Relationship detail — the edit form is asked for · prev [Rail collapse handle](../rail-handle/README.md) · next [Stage 5, both states](../stage5/README.md)

<!-- docs-nav:end -->

Before this change the detail screen mounted `RelationshipEditPanel` as a permanent card in the
320 px actions rail, so the same relationship was drawn twice at once: read-only in the detail,
editable beside it. The owner's words: _"somehow it has form and crud ui down the left column, and
duplicate features"_. Now the rail carries one **Edit** control and the existing panel is mounted
only while that control's modal is open — a dialog at ≥1024, a sheet at 390.

| still                             | what it shows                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `rel-detail-edit-closed-1440.png` | the draft, closed: the door in the rail, **no form on the page**                |
| `rel-detail-edit-dialog-1440.png` | the same page, the panel open in a 672 px dialog named "Edit this relationship" |
| `rel-detail-edit-closed-390.png`  | the closed state at the sheet width                                             |
| `rel-detail-edit-sheet-390.png`   | the panel open as a full-width sheet at 390                                     |
| `rel-detail-edit-live-1440.png`   | a relationship **past invite** (published), Edit control present                |

`capture-report.json` is the numbers each frame was judged on before the shutter. The ones that
matter:

- **closed, both widths** — `formOnPage: false`, `formInRail: false`, `dialog: null`, and the edit
  door is inside `<aside>` (`triggerInRail: true`): 320 × 36 at 1440, 334 × 36 at 390.
- **dialog, 1440** — `kind: "dialog"`, 672 × 765 (85 vh) centred at x = 384, `scrollHeight` 2324
  over a 765 px client, `focusInside: true`, `aria-labelledby` → "Edit this relationship",
  `aria-expanded: "true"` on the door.
- **Escape** — the dialog and the form leave the DOM and focus is back on the door
  (`escape: { dialog: false, form: false, focusOnTrigger: true }`).
- **sheet, 390** — `kind: "sheet"`, 390 × 844 (the full width), `scrollHeight` 2404 over 844, focus
  inside.
- **past invite** — `state: "published"`, the door is present, no form on the page, and the draft
  Aspect editor is correctly absent.

## How these were taken

No Playwright, no Puppeteer: headless Chrome over CDP, from this branch's worktree, against a dev
server on **:4317** (never 3000 — a concurrent gate reaps whatever holds it).

```bash
# 1. the server, with the demo env sourced from the main checkout (.env.local wins → demo branch)
withenv.sh <main-checkout> bash -c 'cd <worktree> && exec node24.sh pnpm dev --port 4317'

# 2. the rows, then the stills
withenv.sh <main-checkout> bash -c 'cd <worktree> && node24.sh node docs/qa/rel-detail-edit/rig.mjs'
node24.sh node docs/qa/rel-detail-edit/stills.mjs

# 3. put the shared demo branch back
withenv.sh <main-checkout> bash -c 'cd <worktree> && node24.sh node docs/qa/rel-detail-edit/cleanup.mjs'
```

`rig.mjs` signs in two throwaway accounts through the app's own sign-up proxy (a page-origin
sign-in answers `403 INVALID_ORIGIN` on this branch) and writes the rows the flows would have
written, prefixed `qarel-edit-`: a `draft` and a `published` relationship with a session, a claimed
invitation and two party seats. That is the harness's stand-in for the card entry and the claimed
invitation — the rows, not a new code path. `cleanup.mjs` removes every one of them and prints the
counts.

One trap worth recording: the full-page shots leave the CDP emulation at the _document's_ height,
so the next measurement resolves `85vh` against 1130 instead of 900 and reports a dialog taller
than the viewport it is in. `stills.mjs` resets the metrics before each interaction; the tell was
`clientHeight: 961` on a 900 px viewport.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Relationship detail — the edit form is asked for · prev [Rail collapse handle](../rail-handle/README.md) · next [Stage 5, both states](../stage5/README.md)

<!-- docs-nav:end -->
