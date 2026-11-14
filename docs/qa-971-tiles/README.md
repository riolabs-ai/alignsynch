# #971 — the two welcome tiles on `/register`, and `/login` unchanged

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The welcome tiles on /register too, #971 · prev [The create flow as a dialog over the relationships page, #979](../qa-979-flow-dialog/README.md) · next [The welcome panel's copy — the tagline and the Aspects/Opinions tiles](../qa-welcome-copy/README.md)

<!-- docs-nav:end -->

`/login` drew the welcome panel beside its form — the mark, a headline, a sentence and **two
tiles** — and `/register` drew a panel of its own with a headline, a sentence and no tiles. The
issue's title says `/register` had no hero at all; the measurement below says otherwise (it had the
split panel and its own `h1`), so the work is the narrow one the owner chose: **the pair appears on
both pages, each page keeps its own headline, and the create flow's Account stage stays compact.**

The pair is now one component, `components/auth/auth-hero-tiles.tsx`, mounted by both views. The
panels around it stay separate on purpose: `/register`'s `h1`, mark and step rail are sign-up's
expression of the same surface, and reusing sign-in's panel would have swapped that `h1` for an `h2`
and restyled a panel the card said not to touch.

## Before → after, measured

Every number here is from the run in this directory (`capture.mjs` over raw CDP, 1440 and 390, one
dev server per tree — `origin/main` at `4796bac2` for **before**, this branch for **after**).

| page · width      | before                                     | after                             | pixels changed                                              |
| ----------------- | ------------------------------------------ | --------------------------------- | ----------------------------------------------------------- |
| `/login` @1440    | h2 `Welcome to QuizHub`, 2 tiles at y 567  | identical                         | **0 of 1,440,000** — the PNG is byte-identical              |
| `/login` @390     | panel hidden, 2 tiles at 0×0               | identical                         | **0 of 390,000** — byte-identical                           |
| `/register` @1440 | h1 `Join the Quiz Revolution`, **0 tiles** | h1 at y 326, **2 tiles** at y 511 | 168,682 of 1,440,000 (11.7 %), bbox `68,68 → 653,1000`      |
| `/register` @390  | panel hidden                               | panel hidden                      | **0 of 390,000** — the panel is desktop-only on both routes |

Body markup, scripts stripped:

- `/login` @1440 and @390 — **byte-identical**, 9,279 characters both sides. The extraction moved
  the tile grid into a component and changed nothing it renders.
- `/register` — 30 tag-level lines **added**, **0 removed**. The added block is the tile grid and
  nothing else; no existing element was restyled, reordered or dropped.

The register panel's column, measured at 1440 (`layout.mjs`):

| row                                           | y   | bottom |
| --------------------------------------------- | --- | ------ |
| mark + `h1` + sentence                        | 206 | 479    |
| **the two tiles** (216 × 124 each, x 136–584) | 511 | 635    |
| two-step rail                                 | 667 | 707    |
| current-step label                            | 739 | 794    |

No content row overlaps another, nothing leaves the 1,000 px panel, and the tiles sit **beneath**
the page's own headline — which is what "keeps its `h1`, gains the icons" means.

## What is not in a still, and why

The in-modal Account stage (`/templates/relationship/<slug>/create/commit`) needs a session **and**
a stage draft cookie to render, so a signed-out capture shows the redirect to `/login` and proves
nothing about the panel. That mount is pinned by test instead:

- `tests/auth-hero.test.tsx` — `RegisterView layout="embedded"` renders no panel, no tiles, no
  headline and no backdrop, on both brands; `account-panel.tsx` opens on sign-up, so that is the
  mount the decision is about.
- `tests/account-panel.test.tsx` — the stage itself still renders its form, with the band passed and
  unused.

`/login`'s embedded mount keeps the shape #824 gave it: the panel is still in the tree carrying
`hidden`, so it is out of the layout rather than a second hero. The same test pins that, so a later
extraction cannot quietly make it visible.

## Re-running this

```bash
# after: this tree, before: a worktree at origin/main; one dev server each
pnpm exec next dev --port 3438   # this branch
pnpm exec next dev --port 3439   # origin/main

node docs/qa-971-tiles/capture.mjs --base http://localhost:3438 --out . --phase after  --port 9352
node docs/qa-971-tiles/capture.mjs --base http://localhost:3439 --out . --phase before --port 9353
node docs/qa-971-tiles/layout.mjs  http://localhost:3438    # the register panel's rhythm
python3 docs/qa-971-tiles/diff.py                          # pixels + body markup, per route/width
```

`capture.mjs` also writes the stripped body markup (`971-<phase>-<route>-<width>.html`) that
`diff.py` reads, so the DOM comparison is reproducible rather than quoted.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The welcome tiles on /register too, #971 · prev [The create flow as a dialog over the relationships page, #979](../qa-979-flow-dialog/README.md) · next [The welcome panel's copy — the tagline and the Aspects/Opinions tiles](../qa-welcome-copy/README.md)

<!-- docs-nav:end -->
