# `/help` two-column layout — QA evidence

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Help two-column · prev [Contact landing](../qa-contact-land/README.md) · next [Home hero polish](../qa-home-polish/README.md)

<!-- docs-nav:end -->

Card: kanban `t_bdb02052`. Two owner comments on `/help`, one defect: the two-column intent
collapsed, so a category click changed an answer far below the click, and the "need a person" band
stacked under the form instead of sitting beside it.

Captured from a production build (`BRAND=alignsynch pnpm build`, `PORT=3199 pnpm start`) with a
headless Chrome driven over the DevTools protocol: `Emulation.setDeviceMetricsOverride` per width,
`Page.captureScreenshot` with a clip and `captureBeyondViewport` for the full-page shots, and
`Runtime.evaluate` for every number below. The harness's own screenshot path was not used — its
`Page.captureScreenshot` times out on this page.

## The page, measured at four widths

`scrollWidth === clientWidth` at every width: no horizontal scrollbar.

| Width | `scrollWidth` / `clientWidth` | Answers grid | Rail                    | Answer panel     |
| ----- | ----------------------------- | ------------ | ----------------------- | ---------------- |
| 1440  | 1440 / 1440                   | 220px + 1fr  | 220×330 at x168         | 852 wide at x420 |
| 1024  | 1024 / 1024                   | 220px + 1fr  | 220×298 at x24          | 724 wide at x276 |
| 768   | 768 / 768                     | 200px + 1fr  | 200×342 at x24          | 488 wide at x256 |
| 390   | 390 / 390                     | one column   | chip row 390×53 at y276 | 342 wide at y345 |

Before the fix, at 1440 the same page measured a two-track grid of `220px 820px 0px` with the
rail at y265 and the answer panel at **y627** — a second row under a full-height list of
categories. The mechanism was `md:col-span-3` inside a grid that declares two tracks; a span wider
than the track count creates implicit columns.

## The contact row

At `md` and up the form is the first column and "Need a person?" is the second.

| Width | Contact grid  | Form box             | "Need a person?" box | Right of the form  |
| ----- | ------------- | -------------------- | -------------------- | ------------------ |
| 1440  | 752px + 320px | x201 y1032 w686 h413 | x952 y867 w320 h242  | yes                |
| 1024  | 624px + 320px | x57 y1032 w558 h413  | x680 y867 w320 h242  | yes                |
| 768   | 368px + 320px | x57 y1106 w302 h433  | x424 y915 w320 h242  | yes                |
| 390   | one column    | x49 y1222 w292 h465  | x24 y1744 w342 h242  | stacked, by design |

## The interaction

`tap-390.png` and `tap-1440.png` are the viewport after a category was tapped, with no scrolling
by hand.

| Case                        | Result                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 390, tap from the top       | `Privacy FAQs`, first row at y482 of an 844px viewport — visible                                                                                           |
| 390, tap while scrolled 520 | panel moved to y144 under the pinned chip row (bottom 133), heading y169, first row y281–386 — visible; before the tap that row was at y-38, above the bar |
| 1440, tap in the rail       | `Privacy FAQs`, first row at y354 — visible, page never scrolled                                                                                           |

`tap-390-scrolled-before.png` is the same scroll position before the tap: the answer being replaced
is above the pinned filter row, which is the reported "click then scroll" experience.

## The sticky rail

`sticky-1440.png`: 1440×700 viewport (shorter than the FAQ list), scrolled to y400. The answer
panel's top is at -135 while the rail is pinned at y96–426 — still in view, with the last FAQ row
at y353. The rail's cell is stretched by the grid's default `stretch`, which is what gives the
sticky card room to travel; the narrow chip row is sticky against the section instead, under the
80px marketing header.

## Files

- `help-1440.png`, `help-1024.png`, `help-768.png`, `help-390.png` — the whole page
- `contact-1440.png`, `contact-1024.png`, `contact-768.png`, `contact-390.png` — the contact row
- `tap-1440.png`, `tap-1024.png`, `tap-768.png`, `tap-390.png` — after a category tap
- `tap-390-scrolled-before.png`, `tap-390-scrolled.png` — the deep-scroll tap
- `sticky-1440.png` — the rail still in view at the bottom of the list
- `quizhub-390.png` — the other brand at 390, with its own six filters (Quiz Creation included)
- `measurements.json` — every rectangle above, as measured

## Related

- [UI-MAPPING.md](../UI-MAPPING.md) — the surface map `/help` is a variation of.
- [ui-registry.md](../ui-registry.md) — the `/help` surface and its status.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Help two-column · prev [Contact landing](../qa-contact-land/README.md) · next [Home hero polish](../qa-home-polish/README.md)

<!-- docs-nav:end -->
