# The v7 flow conformance, measured

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Flow conformance, v7 · prev [Six flow stages](../qa-flow-stages/README.md) · next [Flow validation, 2026-11-07](../qa-flow-validation/2026-11-07.md)

<!-- docs-nav:end -->

The stills and numbers the v1.11.0 release note argues from (#760). Every figure here was read
out of the running page in the same pass that took the screenshot, not estimated from the source.

## How this was produced

`pnpm dev` on this tree, demo branch, then a headless Chrome driven over CDP:

1. `POST /assessment/new/who` and `POST /assessment/new/mode` with `curl -c` to get the flow's
   draft cookie, so stages 2 and 3 render their own screens instead of `307`-ing back to stage 1.
2. `Emulation.setDeviceMetricsOverride` to 1440×900 and 390×844 — the device override is the only
   honest 390; an OS window on this desktop cannot go below ~658px.
3. `Runtime.evaluate` to read `innerWidth`, `scrollWidth`, the `[data-stage-shell]` panel box, the
   `[data-stage-foot]` row and its two ends, and the `[data-aspect-row]` text.
4. `Page.captureScreenshot` — the picture the measurements were taken beside.

`measurements.json` is that read, verbatim. The stills were retaken after scrolling the stage's
own scroller to its bottom for the two `-foot` files, because on Details at 1440 the foot sits
below the fold and a viewport still would not show the thing the release claims.

## What was measured

| Claim                                                   | 1440                                                                           | 390                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Panel width                                             | 880 (`panelLeft` 280, `panelRight` 280 — centred)                              | 390 (full-height sheet, no inset)                    |
| `scrollWidth == innerWidth`                             | 1440 == 1440                                                                   | 390 == 390                                           |
| The foot is one row                                     | row 780 wide, `Back` left-flush at 330, advance right-flush at 945             | advance 358 full-width at 16, above a 175+8+175 pair |
| The two controls in the foot are 44px tall              | `Back` 44, advance 44                                                          | `Back` 44, advance 44                                |
| Settings draws two peers                                | `Opinions Mode` / `Alignment Setting` legends render                           | same, one column below `sm`                          |
| An Aspect row reads index · handle · name · ends · edit | `01 ⠿ How much time do you spend together in a normal week? Rare ↔ Constant ✎` | same text                                            |

The three aspect rows are the template's own, so the ordinals (`01`, `02`, `03`) are read off the
row index rather than typed into the fixture — which is what makes a drag renumber them.

## Files

| Still                     | What it shows                                                        |
| ------------------------- | -------------------------------------------------------------------- |
| `details-1440-foot.png`   | Details' foot: `[Back][Cancel]` left-flush, advance right-flush      |
| `details-390-foot.png`    | The same foot stacked: advance full-width above the pair             |
| `settings-1440-peers.png` | `Opinions Mode` and `Alignment Setting` as two peers, one radio each |
| `settings-390-peers.png`  | The same two fieldsets as one column                                 |
| `aspects-1440-rows.png`   | `01 · ⠿ · name · opinions · ✎`, three rows                           |

The harness lived under a throwaway `.probe/` directory and was removed before the commit; the
cookie it needs is minted by the two `POST`s above and is never committed.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Flow conformance, v7 · prev [Six flow stages](../qa-flow-stages/README.md) · next [Flow validation, 2026-11-07](../qa-flow-validation/2026-11-07.md)

<!-- docs-nav:end -->
