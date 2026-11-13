# The flow is six stages — Details, Settings, Aspects, Invite, Connect, Align (#735)

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Six flow stages · prev [Contact landing](../contact-land/README.md) · next [Flow validation, 2026-11-07](../flow-validation/2026-11-07.md)

<!-- docs-nav:end -->

Evidence for the card. The requirement is `docs/specs/flow-stages.md` (binding); this page is
what the build does when asked for it. Captured against the **demo branch**
(`ep-crimson-truth-b4ppwxrp`), `next start` on `:3111`, node 24, from the gated tree — the same
tree `bash scripts/verify.sh` passed on (`lane=code`, 16/16 steps green, 296.7 s on a loaded box).

## The six words, and the line above them

`data/pages/lifecycle.ts` holds them once; every stage fixture references that section, and the
rail renders it:

```text
1 Details · 2 Settings · 3 Aspects · 4 Invite · 5 Connect · 6 Align
Stage {n} of 6
```

`stage-1-details-1440.png` and `stage-1-details-390.png` — stage 1 of the create flow, read back
from the DOM at each width: `nav[aria-label="Relationship lifecycle"]` with **6** cells
(`data-step-cell`, the measured cell rail #716 draws), the `Stage 1 of 6` line, the sixth cell
`data-step-state="unavailable"`, and the stage column (`max-w-[1126px]`) inside the viewport
(375×… at 390, no horizontal overflow).

## Align is conditional

The sixth cell is live only once an assessment is shared on the relationship — `answering`,
`awaiting_payment` or `complete` (`alignAvailableOf()` in `lib/flow/stage.ts`). It is never a
step the wizard advances into: no stage posts to it, and the create flow's four stages plus
Connect are the only `current` values the rail is mounted with — the answer sheet mounts it at
`Align`, which is the stage that screen is in, and `current` is live by definition.

| Still                            | Relationship state                                         | Sixth cell                                                                      |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `align-unavailable-1440.png`     | invitation unclaimed — one seat, nothing is shared         | `data-step-state="unavailable"`, no `<a>`, visually-hidden `Not available yet`  |
| `align-unavailable-390.png`      | the same, at 390                                           | the same                                                                        |
| `align-available-1440.png`       | both seats claimed and both accepted (a shared assessment) | a link to `/assessment/instances/<id>`, `data-step-state="upcoming"` at stage 5 |
| `align-available-390.png`        | the same, at 390                                           | the same                                                                        |
| `align-opens-alignment-1440.png` | what the live cell opens: the instance screen              | the Alignment, Aspect by Aspect (`Both sheets are sealed…`)                     |
| `align-opens-alignment-390.png`  | the same, at 390                                           | the same                                                                        |

Both relationships were created through the shipped flow (stage 1 → Settings → commit), the
counterparty seat claimed through the real invitation link (`POST /invite/<token>/claim`), and the
answers posted to the real endpoints (`…/answers`) — no fixture was written into the database by
hand, and both instances are demo-branch rows. Each still is captured with DOM-fact assertions
attached (`cdp-capture-flow.py`): the viewport width, the cell count, the sixth cell's state and
href, and the `Stage n of 6` line are read back out of the rendered page and the capture fails
when any of them is not the claim above.

## Stage 1 — the inventory, and the grid

`tests/create-fields.test.ts` pins the section's ids and labels in order and renders the form to
check the order and the spans: `initiator` · `counterparty` on row 1 (6/6), `email` · `title` on
row 2 (6/6), `description` across row 3 (12). Two lines the artifact does not draw were deleted
(`email-help`, `submit-note`), `title-help` is the artifact's one clause
(`The card title both of you see.`), and `Back` is the secondary action beside
`Continue to mode and setting` — the artifact's stage foot (`s4.back` beside `s4.next`).

## The tests bite, measured

| Change made locally                              | Result                                                      |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `Settings` → `Mode` in `data/pages/lifecycle.ts` | 2 red: the six words in order, the six names the rail draws |
| an extra `who` item added to the fixture         | 1 red: the inventory is 15 items, not 16                    |

Both were reverted before the gate run.

## One thing this card did not cause

At 390 the **document** scrolls 466px wide on every stage screen, because the app's header sits
behind the modal. Measured identically on stage 2 (`…/create/mode`), whose markup this card does
not touch, and the stage column itself fits — so it is recorded here rather than fixed here.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Six flow stages · prev [Contact landing](../contact-land/README.md) · next [Flow validation, 2026-11-07](../flow-validation/2026-11-07.md)

<!-- docs-nav:end -->
