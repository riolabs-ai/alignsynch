# QA — the lockup back in the chrome, and the auth mark at a seal's size

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Brand lockup · prev [Rail collapse handle](../qa-rail-handle/README.md) · next [Comments mockup, both placements](../qa-comments-mockup/README.md)

<!-- docs-nav:end -->

Evidence for the correction to #539 item 1: the header and footer draw the **full lockup**
(`public/brand/as2-logo_v2_cl.png`, 818×127), and the square mark stays where an icon belongs.
Two visual jobs, one table:

| surface                  | renders                                      | rule                                                                |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------- |
| marketing header, footer | the lockup, whole                            | scaled by height, 818:127 follows; the row it sits in does not grow |
| the five auth screens    | the brand's **icon** (`alignsynch-icon.svg`) | one size for the family: 40 px in a 64 px tile                      |
| `not-found`              | its own _fact_ glyph (`compass`, lucide)     | no brand mark on that page — nothing to size, left untouched        |
| tab, PWA, home-screen    | `alignsynch-icon*.png`, `favicon.ico`        | unchanged bytes (see `tests/brand-immutable.test.ts`)               |

Screenshots are `1440` and `390`, captured with Chrome headless over CDP at
`deviceScaleFactor: 1` against `BRAND=alignsynch pnpm dev`. `*-before.png` was taken from `main`
(`f3b4a917`) with the work stashed; `*-after.png` from this branch.

## Measured — every number is `getBoundingClientRect()`, not an estimate

### Header

|                                     | before (`main`)                  | after                                                          |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| image                               | `alignsynch-mark-1024.png` 96×96 | `as2-logo_v2_cl.png` **360.7×56** at 1440, **154.6×24** at 390 |
| declared intrinsic size             | 1024×1024                        | 818×127 (the export's own)                                     |
| header row (`header > div`, `h-20`) | **80 px**                        | **80 px**                                                      |
| nav baseline count                  | 1 line                           | 1 line                                                         |
| page `scrollWidth` / `innerWidth`   | equal                            | equal                                                          |

The 96 px box overflowed the 80 px bar by 8 px above and below (`y = -8`, bottom 88). The lockup is
56 px tall in that row at 1440 — 12 px clear top and bottom — and 24 px at 390, where the brand slot
has 171.7 px before the account pair.

### Footer

|                                                    | before       | after                       |
| -------------------------------------------------- | ------------ | --------------------------- |
| image                                              | 96×96 icon   | **309.2×48** (1440 and 390) |
| brand row (`flex`, first child of the 4-col block) | **96 px**    | **96 px**                   |
| brand block                                        | **183.4 px** | **183.4 px**                |
| blurb top                                          | y 4526       | y 4526                      |

The row keeps `h-24` so the block's rhythm is byte-for-byte the same height; only what is inside it
changed. 48 px is the ceiling the 336 px column allows (336 × 127/818 = 52.2 px).

### Auth family — one size, 40 px in a 64 px tile

| route                             | before                                                                    | after                             |
| --------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| `/register` (1440, left panel)    | 48×48 in a 96×96 tile                                                     | **40×40 in a 64×64 tile**         |
| `/register` (390, above the form) | 32×32 in a 64×64 tile                                                     | **40×40 in a 64×64 tile**         |
| `/login` (1440, left panel)       | 40×40 in an 80×80 tile                                                    | **40×40 in a 64×64 tile**         |
| `/login` (390, above the form)    | 48×48 in a 48×48 tile                                                     | **40×40 in a 64×64 tile**         |
| `/forgot-password`                | 48×48 in a 48×48 tile                                                     | **40×40 in a 64×64 tile**         |
| `/reset/<token>`                  | 48×48 in a 48×48 tile (same markup as `/forgot-password`, measured there) | **40×40 in a 64×64 tile**         |
| `/reset/complete`                 | 48×48 in a 48×48 tile                                                     | **40×40 in a 64×64 tile**         |
| `/not-found`                      | no brand mark; `compass` glyph 20×20                                      | unchanged — `compass` glyph 20×20 |

All five auth screens draw the **same file**: `/brand/alignsynch-icon.svg`. No asset was swapped, and
`sha256sum` on the mark is identical before and after.

### On the owner's 162×148 measurement

There is no 162×148 element on `/register` at either width: the biggest brand element was the
**96×96** tile (with the 48×48 image inside it), measured in the DOM on `main` and in production at
`alignsynch.com/register`. The reduction is therefore applied to the pair that measurement is
looking at — tile 96 → 64, mark 48 → 40 — and the same numbers are applied to the whole family so
the five screens stay siblings.

## What the guard now asserts

`tests/brand-immutable.test.ts` pins **lockup-first chrome**: the header's one image is the lockup and
the footer's is `brandMark(brand.logo)`, the `<img>` carries the 818×127 intrinsic size and a
height-driven `w-auto` class, neither file may name `alignsynch-icon` or `brand.mark`, and the tab /
PWA bytes are in the same SHA-256 table. Pointing the header back at the mark fails the first
assertion — the run is in the PR.

## Related

- [BRAND-RELEASE.md](../BRAND-RELEASE.md) — tokens + name + mark — the three things a brand ships.
- [ui-registry.md](../ui-registry.md) — the surfaces whose chrome carries the lockup.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Brand lockup · prev [Rail collapse handle](../qa-rail-handle/README.md) · next [Comments mockup, both placements](../qa-comments-mockup/README.md)

<!-- docs-nav:end -->
