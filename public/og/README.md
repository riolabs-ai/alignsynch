# `public/og/` — the three release-comms rasters

Every file here is **generated** by one script, from the brand record and a screenshot the repo
already commits. Nothing here is hand-exported: the palette is `data/brand.ts` →
`data/brands/alignsynch.ts`, so a brand change re-draws these with no asset to re-cut, and the
commit only ever holds the output.

```bash
pnpm og:banners                       # BRAND=alignsynch (the release-comms brand)
pnpm og:banners --brand=quizhub       # the same three surfaces for the other brand
node scripts/gen-media.mjs            # after any re-run: the registry is a bijection with public/
```

`pnpm og:banners` is
`node --import ./scripts/ts-modules.mjs scripts/og-banners.ts`, and that script's docstring is the
record of _why_ each surface is composed the way it is. Re-run it whenever `data/brands/*.ts`
changes; `pnpm data:check` will not, because a raster's bytes are not a fixture.

## The three files

| file                  | size     | used by                                          | source                                                                                                                                                                                    |
| --------------------- | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readme-banner.png`   | 1280×400 | the header at the top of `README.md`             | composed from the brand tokens; the screen is a 1:1 crop of `docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/reference/rd-extended-live-1280.png` at (300, 520), 400×400 |
| `email-banner.png`    | 1120×280 | the release-note email hero (consumed in lane B) | composed from the brand tokens — type and the drawn Gap, no screenshot, because a 280 px hero is read at about 560 px in a mail client                                                    |
| `release-default.png` | 1200×630 | a release's fallback social card                 | composed from the brand tokens; the screen is a 1:1 crop of the same spec image at (300, 700), 400×160                                                                                    |

The crop is not a file: the composition places the spec PNG at 1:1 inside a fixed-size window and
clips it (`overflow: hidden`), so the screen in the raster is those source pixels, never a scaled
or blurred copy. `docs/` is not served — the bytes are inlined into the PNG at render time, which
is why no runtime file references a `docs/` path.

## What is not here

- **No stock imagery and no remote URL.** The only picture in any of the three is a screen this
  repository commits.
- **No second palette.** Every colour is a field of the `Brand` record; the accent is a _surface_
  on this brand (a bar, a pill, a border) and never a text colour, which is the same rule
  `scripts/lint-brand-classes.mjs` enforces in `components/` and `app/`.
- **No claim the tree cannot back.** The release card says what the changelog actually is:
  entries generated from the commits that shipped them.

## The mark

`brand.logo` (`/brand/as2-logo_v2_cl.png`, 818×127) is drawn unmodified at its own aspect ratio on
a white panel, never recoloured: it is black ink drawn for a light ground. This is the same rule
`lib/brand-og.tsx` documents for the 1200×630 share card — that module owns the share card, this
directory owns the release-comms banners, and they share the palette rather than a component.
