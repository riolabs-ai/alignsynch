# #539 — v1.x UI polish cohort, evidence

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › v1.x UI cohort · prev [AS2 templates catalogue visual QA](../templates-redesign/README.md)

<!-- docs-nav:end -->

Ten owner items, one cohort. Every number below is measured in a real browser against the built
app: **before** = `origin/main` at `6b8ea138` (its own production build, `BRAND=alignsynch`),
**after** = this branch's build, same brand, same viewport, same session.

Reproduce: `BRAND=alignsynch pnpm build && pnpm start`, then measure with
`getBoundingClientRect()` / `scrollWidth` at the widths named here.

## Measured old → new

| Item | What                                     | Before                                                | After                                                                                          |
| ---- | ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | Header/footer mark box                   | lockup `206×32` at 1440 (monogram ≈`43×32` inside it) | square mark `96×96` box, ink `96×62` — **2.2× width / 1.94× height**                           |
| 1    | Mark at 390                              | `181×28` (flex-squeezed)                              | `96×96`, no squeeze                                                                            |
| 4    | Body font-size                           | `14px`                                                | `13px` (`0.8125rem`); root stays `16px` so `text-*` callers are unaffected                     |
| 4    | `--radius`                               | `0.375rem` (6px)                                      | `0.3125rem` (5px)                                                                              |
| 5    | Header height                            | `65px`                                                | `81px` (`h-20` + border)                                                                       |
| 5    | Sign In → Sign Up gap                    | `8px`                                                 | `16px`                                                                                         |
| 8    | `/pricing` content measure at 1920       | `1800px`, x=`53`                                      | `1152px`, x=`377`                                                                              |
| 8    | `/pricing` content measure at 1440       | `1400px`, x=`13`                                      | `1152px`, x=`137`                                                                              |
| 8    | `/` content measure at 1920              | `1152px`, x=`377`                                     | `1152px`, x=`377` — now the same measure as `/pricing`                                         |
| 9    | Help rail row, "Technical Issues" at 768 | row `130px`, `scrollWidth` `159` → **29px overrun**   | row `166px`, `scrollWidth === clientWidth`, row wraps to `55px` tall                           |
| 9    | Help rail, "All Categories" at 768       | 12px overrun                                          | 0 overrun                                                                                      |
| 6    | Footer link grid at 768                  | 3 columns × `85.5px` (one empty)                      | 2 columns × `148.25px`                                                                         |
| 7    | News band position                       | inside `<footer>`, between links and legal row        | own `<section data-footer-news>` above the footer (`band.bottom ≤ footer.top` at 390/768/1440) |

No horizontal overflow at any width on either brand: `scrollWidth − innerWidth = −15` at 1440,
1920 and 390 (the scrollbar), i.e. never positive.

## Item 2 — the Gap scale

`--gap-0..4` in `app/globals.css`, read back from the live page:

| Step | Token                    | Hex                | Contrast on white |
| ---- | ------------------------ | ------------------ | ----------------- |
| 0    | `hsl(200 17.9% 26.3%)`   | `#37474F` graphite | **9.65:1**        |
| 1    | `hsl(169.4 21.5% 31%)`   | `#3E605A`          | 6.94:1            |
| 2    | `hsl(138.8 25.2% 35.8%)` | `#447253`          | 5.56:1            |
| 3    | `hsl(108.2 28.8% 40.5%)` | `#55854A`          | 4.34:1            |
| 4    | `hsl(77.6 32.5% 45.3%)`  | `#83994E` green    | 3.17:1            |

Every step clears the 3:1 non-text floor (WCAG 1.4.11). Adjacent steps sit at 1.25–1.39:1 on
purpose — the scale is ordinal and the histogram prints its five counts in the table beside it,
so nothing depends on telling two neighbours apart. The right end is `#93A85B` one step darker
than the owner's swatch: that swatch is 2.63:1 on white, which would have made "aligned" the
faintest thing in the chart.

## Files

| Item | Files                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1, 5 | `item01-05-header-1440-{before,after}.png`, `item01-05-header-390-{before,after}.png`, `item01-05-home-390-{before,after}.png` |
| 2, 4 | `item02-gap-scale-after.png`, `item02-04-home-1440-{before,after}.png`                                                         |
| 3    | `item03-help-1440-{before,after}.png` (selected row: solid `bg-action` → `bg-action/10` + inset ring)                          |
| 4    | `item04-quizhub-home-{1440,390}-after.png` (template brand, same tokens)                                                       |
| 6, 7 | `item06-07-footer-{1440,768,390}-{before,after}.png`                                                                           |
| 8    | `item08-home-1920-{before,after}.png`, `item08-pricing-1920-{before,after}.png`, `item08-quizhub-home-1920-after.png`          |
| 9    | `item09-help-rail-768-{before,after}.png`                                                                                      |
| 10   | `item10-admin-rail-{before,after}.png`                                                                                         |

## Two honest notes

- **Item 10** is auth-gated (`/admin/*` answers 404 to a member and 500 without auth env), so the
  rail is rendered from the real `AppNav` component with `navViewer("admin")` — the same viewer
  the shell passes — rather than captured from the route. The row order, the group labels and
  their `data-nav-group` values come from that render.
- **Item 2's histogram** lives on `/admin/gaps`, which is behind the same gate. The scale is
  therefore shown as a swatch built from the live tokens plus the contrast read; the hero ground
  that consumes the same two stops is visible in the home screenshots.

## Related

- [UI-MAPPING.md](../../specs/ui-mapping.md) — the surface map every item in this cohort moved.
- [ui-registry.md](../../ui-registry.md) — the surfaces these frames capture.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › v1.x UI cohort · prev [AS2 templates catalogue visual QA](../templates-redesign/README.md)

<!-- docs-nav:end -->
