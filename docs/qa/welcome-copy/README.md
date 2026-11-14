# The welcome panel's copy — the owner's tagline and the two noun tiles

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › The welcome panel's copy — the tagline and the Aspects/Opinions tiles · prev [QA atlas — v1.18.0](../../qa-atlas/v1.18.0/index.md)

<!-- docs-nav:end -->

The sign-in panel beside the form carried the two-party premise: the sentence "The same questions
for both of you. Where your answers part is the Gap." and two tiles reading **One set of questions**
over _Two answers_, and **The distance between them** over _The Gap_. The owner replaced all three
(2026-11-13, mock in hand) with a tagline and the product's two nouns:

| where                       | before                                                                    | after                                                                       |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| panel sentence (`subtitle`) | `The same questions for both of you. Where your answers part is the Gap.` | `Knowledge is power and communication is your key to relationship success.` |
| tile `sides`                | `One set of questions` / `Two answers`                                    | `Aspects` / `Define the Destination`                                        |
| tile `gap`                  | `The distance between them` / `The Gap`                                   | `Opinions` / `Your Map to Get There`                                        |

The words are verbatim: the full stop, the commas and the initial capitals are the owner's. Nothing
in the layout moved — the fixture's `hero-alignsynch.body` is the panel's `subtitle` and
`stats-alignsynch` is the band, and both are read by `lib/auth-copy.ts`, so this is a copy swap in
`data/pages/login.ts` and nothing else.

## Where the words land

| surface                                 | sentence                                                                               | tiles                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/login` (alignsynch)                   | **the new tagline** — `loginCopyFor` puts `hero-alignsynch.body` where `subtitle` sits | **Aspects / Opinions** — `stats-alignsynch`                |
| `/register` (alignsynch)                | its own hero, untouched (`data/pages/register.ts`: "Create an account, then invite …") | **Aspects / Opinions** — the same band, via `heroTilesFor` |
| Account stage, in the create-flow modal | **nothing** — `layout="embedded"` hides sign-in's panel and drops sign-up's hero       | **nothing** — the tiles go with the panel                  |

`/register` reads the _tiles_ from `/login`'s fixture and keeps its own sentence, which is what #971
established: a tile is reworded once, a page keeps its own headline. The tagline is `/login`'s
because `/login`'s fixture holds it.

## Measured

`capture.mjs` in this directory — raw CDP over a `BRAND=alignsynch` dev server at
`http://localhost:3438`, `Page.setDeviceMetricsOverride` for the honest 390, DOM probes plus the
still, reported in `welcome-copy-after-report.json`:

| page · width      | heading                                                  | sentence box                            | tiles (216×124 each)                                                                   |
| ----------------- | -------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `/login` @1440    | h2 `Welcome to AlignSynch` at y406                       | 448×65 at 136,462 — the new tagline     | `Aspects / Define the Destination` at y559, `Opinions / Your Map to Get There` at y559 |
| `/login` @390     | h2 in the card                                           | panel `display: none`, box 0×0          | 0×0 — the panel is desktop-only (`hidden lg:flex`)                                     |
| `/register` @1440 | h1 `The same questions, answered by both of you` at y274 | 624×98 at 48,370 — **its own** sentence | the two nouns at y531                                                                  |
| `/register` @390  | h1 in the flow's first step                              | panel `display: none`                   | 0×0                                                                                    |

The 390 stills are kept because they prove the small screen did not regress; they cannot show the
tagline, because that panel has been `hidden lg:flex` on both routes since #824 and this card
changes no geometry.

## Two things the mock draws that the tiles do not

Recorded rather than changed — both are layout, and this card is copy:

- **The scale icon matches.** `auth-hero-tiles.tsx` resolves an id it does not know to
  `NEUTRAL_MARK`, which is `Scale`; `sides` and `gap` are such ids, so both tiles already draw the
  mock's scale. No icon changed.
- **The em dash between the two parts is not in the markup.** A tile renders the bold `value` and
  the small `label` as two stacked lines; the mock writes them as one line joined by an em dash.
  Typing a dash into the fixture would put it inside `value` or `label`, which is not that layout,
  so it was left alone.

## Re-running it

```bash
BRAND=alignsynch pnpm exec next dev --turbo -p 3438     # one dev server, the alignsynch build
node docs/qa-welcome-copy/capture.mjs --base http://localhost:3438 --out docs/qa-welcome-copy
```

Files: `welcome-copy-after-{login,register}-{1440,390}.{png,html}` and
`welcome-copy-after-report.json`. The sibling harness is `docs/qa-971-tiles/capture.mjs`, which this
one is copied from (a `subtitle` probe added, its own prefix and CDP port).

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › The welcome panel's copy — the tagline and the Aspects/Opinions tiles · prev [QA atlas — v1.18.0](../../qa-atlas/v1.18.0/index.md)

<!-- docs-nav:end -->
