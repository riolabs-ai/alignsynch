# AS2 home page — visual QA (card `t_b4c03b9c`, issue #853)

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › AS2 home visual QA · prev [The Sent screen with no invitation row, #976](../976-sent-none/README.md) · next [Brand lockup](../brand-lockup/README.md)

<!-- docs-nav:end -->

The AlignSynch front page at `/` was replaced by the approved AS2 redesign. This folder is the
evidence: five stills of one production build, the numbers behind each shutter, and the geometry
probe for the interaction that is easiest to get wrong.

## How the shots were taken

- `BRAND=alignsynch pnpm build` then `pnpm start --port 3199` — a production build, not `next dev`.
  `/` prerenders (`○ /` in the build output), which is why the stills are of the same HTML CI builds.
- Headless Chrome over the DevTools protocol, no Playwright and no Puppeteer — the same loop every
  other `docs/qa-*` folder used. The driver is committed beside the images:
  `capture.mjs` (stills) and `probe.mjs` (geometry).
- Viewports **1440 · 1024 · 768 · 390 · 360**, `deviceScaleFactor: 1`, mobile emulation below 700.
- The viewport is resized to the measured `document.scrollHeight` before each shutter: a
  `captureScreenshot` clip below the fold returns a blank frame and `captureBeyondViewport` still
  frames only the viewport.
- `prefers-reduced-motion` was not forced; the page's only animation is the anchor scroll, and the
  probe waits for it to settle before reading a rect.

## What was asserted before each shutter

Every one of these ran at **all five widths** and passed; the values are in `capture-report.json`.

| Assert                                                                          | Why it is on the list                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `innerWidth === width`                                                          | the emulation actually applied                                      |
| `scrollWidth === innerWidth`                                                    | no horizontal page overflow — the card names 360 and 390 explicitly |
| `h1` present                                                                    | the page rendered its hero, not a shell                             |
| the menu's `position` is `sticky`, `5` rows                                     | one row that scrolls, never a wrapping block                        |
| each of the 7 anchor ids occurs **exactly once**                                | a duplicate id silently sends a jump to the wrong band              |
| each target's resolved `scroll-margin-top ≥ header height`                      | the offset is derived (140/136), not retyped                        |
| `≥ 7` `[data-home-anchor]` bands                                                | the five menu targets plus the two nested template groups           |
| no `DATABASE_URL` / `postgres://` / `npg_` / `sk_test` / `NEON_` in `innerText` | a still must never carry a local env value                          |
| every `<img>` `complete` with `naturalWidth > 0`                                | a broken photograph is a blank card, not an error                   |

## The stills

Measured off each PNG header, and the ink share over a 240px-wide thumbnail (`pixels.py`, committed
beside them):

| File            | Size      | Document height | Distinct colours | Ink share |
| --------------- | --------- | --------------: | ---------------: | --------: |
| `home-1440.png` | 1440×5661 |        5 661 px |           18 787 |    74.5 % |
| `home-1024.png` | 1024×5624 |        5 624 px |           30 342 |    73.8 % |
| `home-768.png`  | 768×6423  |        6 423 px |           42 863 |    75.3 % |
| `home-390.png`  | 390×10178 |       10 178 px |          151 298 |    75.2 % |
| `home-360.png`  | 360×10367 |       10 367 px |          160 297 |    75.3 % |

Read the ink share with its own caveat: the page's grounds are `paper #f8fafb`, `mist #f5f7f8` and
`sand #eef4f7`, all below the 245 threshold used to call a pixel "white", so a _correctly_ tinted band
counts as ink. The measure's real job is the first column — a placeholder frame is one flat colour,
and these are 18 000–160 000.

## The interaction, measured

`probe.mjs` loads the page, returns to `scrollY 0`, sets `location.hash`, waits for the smooth scroll
to settle, and reads where the target landed (`measurements.json`).

| Width | Header box | Menu row | Container | `#questions` | `#personal-relationships` (nested) | `#how-it-works` |
| ----- | ---------: | -------: | --------: | -----------: | ---------------------------------: | --------------: |
| 1440  |      81 px |    52 px |  1 152 px |        +7 px |                              +7 px |            0 px |
| 390   |      81 px |    48 px |    390 px |        +7 px |                              +7 px |            0 px |
- **Pinned menu top is exactly `80`** at both widths — the value of `--site-header-height`, read from
  the same variable the header's row is declared from. `--home-anchor-offset` resolves to 140 px at
  desktop (80 + 52 + 8) and 136 px on a phone (80 + 48 + 8), so a target clears _both_ bars with
  7 px to spare rather than touching the menu's hairline.
- **The header's box is 81 px, not 80**: its own 1 px bottom border. The menu pins at 80 and therefore
  overlaps that border by one pixel, under the header (`z-10` vs `z-5`), which is why the two bars
  read as one piece of chrome. The variable stays at the row height deliberately — see the comment on
  `.home-anchors` in `app/globals.css`.
- **`#how-it-works` shows 0 px** and that is correct: it is the first band after the hero, so at that
  scroll position the menu has not pinned yet and sits _at_ the section's top rather than over it.
- The hero's two cards are **side by side at 1440** (same `y`) and **stacked at 390**, and the menu row
  at 390 reports `scrollWidth > clientWidth` — it scrolls sideways instead of wrapping, which is the
  behaviour the card asked for.

## Related

- [The AS2 package](../../specs/spec-as2-style-home-redesign/README.md) — the approved page this
  build is compared against.
- [ui-registry.md](../../ui-registry.md) — the surfaces that render the bands.
- Photography credits live at `/terms` (section "Photography credits", `data/pages/legal.ts`) — once,
  not on this page.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › AS2 home visual QA · prev [The Sent screen with no invitation row, #976](../976-sent-none/README.md) · next [Brand lockup](../brand-lockup/README.md)

<!-- docs-nav:end -->
