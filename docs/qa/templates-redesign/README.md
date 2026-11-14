# QA — the Templates catalogue rebuild (#889)

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › AS2 templates catalogue visual QA · prev [Template catalogue](../template-catalogue/README.md) · next [v1.x UI cohort](../v1x-ui-cohort/README.md)

<!-- docs-nav:end -->

The screenshots and measurements behind
[`docs/specs/spec-as2-style-templates-redesign/`](../../specs/spec-as2-style-templates-redesign/README.md),
the approved design package `/relationship-types` was rebuilt from. Same shape as
[`../qa-as2-home/`](../as2-home/README.md), which is the record for the home page's equivalent
rebuild.

## What is here

| File                          | What it is                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `relationship-types-1440.png` | the whole page at 1440px, as the browser paints it                                                                                                                                                                              |
| `relationship-types-1024.png` | 1024px                                                                                                                                                                                                                          |
| `relationship-types-768.png`  | 768px — the width the hero's split has to survive                                                                                                                                                                               |
| `relationship-types-390.png`  | 390px — the common phone                                                                                                                                                                                                        |
| `relationship-types-360.png`  | 360px — the narrowest width the acceptance names                                                                                                                                                                                |
| `measurements.json`           | what each of those renders measured: page width vs viewport width, card and realm counts, whether the realm menu scrolls inside itself, and the four interaction checks                                                         |
| `capture.mjs`                 | the harness that produced the images — raw Chrome DevTools Protocol over a `WebSocket`, no dependency, one PNG per viewport                                                                                                     |
| `interact.mjs`                | the harness for the interaction checks: search, the empty state, the clear control, and where a realm anchor lands                                                                                                              |
| `count-probe.mjs`             | the counts, read from `data/relationship-types.ts` through the repo's own `@/` resolve hook — 27 purchasable of 30 records, 7 realms, and the per-realm split, so the page's numbers have a source that is not the spec's prose |

## How to reproduce

```bash
PORT=3011 pnpm dev                       # the gate owns 3000; any free port does
node docs/qa/templates-redesign/capture.mjs \
  http://localhost:3011/relationship-types \
  docs/qa-templates-redesign 1440x900 1024x800 768x900 390x844 360x780
node docs/qa/templates-redesign/interact.mjs http://localhost:3011/relationship-types
```

Both scripts shell out to `google-chrome --headless=new` and talk to it over `--remote-debugging-port`,
so they need a Chrome binary at `/usr/bin/google-chrome` and nothing else. `capture.mjs` writes a
full-page PNG per viewport and prints the measurements it took; `interact.mjs` prints JSON and writes
nothing.

## What the numbers say, in one line each

- **The catalogue is complete without JavaScript.** 27 cards and 7 realm groups in the initial HTML at
  every width, because the search filters rendered cards instead of gating them.
- **Nothing overflows horizontally at 360px.** `scrollWidth == clientWidth` at all five widths.
- **The realm menu is the only thing that scrolls sideways.** 608px of links in a 312px row at 360px,
  which is the point — a wrapped menu would push the first realm heading down the page.
- **A realm anchor lands under both sticky bars.** `#realm-social`'s heading sits at y=136 below a
  header that ends at 81 and a realm menu that ends at 129.
- **The search is honest about what it found.** `handover` → `1 of 27 templates`, one card, one realm;
  a query that matches nothing → `0 of 27`, an empty state and no realm headings; the clear control
  restores all 27.

## What these screenshots are not

A dev-server render, not a production build, and a **QuizHub** render — the brand tokens come from
`data/brand.ts`, so the AlignSynch build paints the same layout in its own palette. The colours in
these images are therefore not the colours the AlignSynch deployment shows; the geometry is.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › AS2 templates catalogue visual QA · prev [Template catalogue](../template-catalogue/README.md) · next [v1.x UI cohort](../v1x-ui-cohort/README.md)

<!-- docs-nav:end -->
