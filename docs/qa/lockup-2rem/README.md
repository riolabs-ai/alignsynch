# The chrome lockup is 2rem in every expanded-header viewport (t_f4e69dba)

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Lockup 2rem · prev [Home hero polish](../home-polish/README.md) · next [Templates and relationships after creation](../noun-crud/README.md)

<!-- docs-nav:end -->

The header and the footer draw the same 818×127 export and each carried its own height utility,
so one page showed the signature at 56px (header, `lg`), 28px (header, `sm`) and 48px (footer).
Both `<img>`s now carry `data-brand-lockup` and the expanded height is written once, in
`app/globals.css`:

```css
@media (min-width: 992px) {
  img[data-brand-lockup] {
    height: 2rem;
    width: auto;
  }
}
```

`img[data-brand-lockup]` and not a bare `[data-brand-lockup]`: an attribute selector ties with a
`.h-*` utility on specificity, and the emitted bundle puts Tailwind's responsive variants
(`sm:h-7`) **after** this file's own rules. Measured with the bare selector the footer read 32px
(`h-12` is a base utility, emitted earlier) while the header stayed at 28px. The element in the
selector removes the dependence on bundle order.

## Measured, from the alignsynch production build (`next start`, port 3199)

`getComputedStyle(...).height` on `header [data-brand-lockup]` and `footer [data-brand-lockup]`,
`documentElement` font size 16px, so `2rem` is `32px`. `ruleFired` is
`matchMedia("(min-width: 992px)").matches`.

| viewport | header | footer | ruleFired | nav  |
| -------- | ------ | ------ | --------- | ---- |
| 768      | 28px   | 48px   | false     | flex |
| 992      | 32px   | 32px   | true      | flex |
| 1024     | 32px   | 32px   | true      | flex |
| 1280     | 32px   | 32px   | true      | flex |
| 1440     | 32px   | 32px   | true      | flex |
| 1920     | 32px   | 32px   | true      | flex |

At 32px the width follows the asset's own ratio: 206.109px (818:127). No viewport reports
`scrollWidth > innerWidth`.

**The before-state, from the same build.** Deleting the one media rule through CSSOM at 1440 and
re-reading gives header **28px** / footer **48px** — exactly what `origin/main` renders there, so
the rule is the only thing that moved the number. At 768 the rule does not match at all
(`ruleFired: false`), so 28px / 48px is the pre-card size, unchanged.

**Flagged, not fixed.** The card's criterion is "wherever the nav is expanded", which it places at
992. This repo's public nav is `md:flex` — it is already expanded at 768, measured
`display: flex` above. So between 768 and 991 the lockup is 28px while the header is expanded. The
card's number (992) and its acceptance line (768 stays as it was) were followed; moving the
breakpoint to 768 is a one-line change in the same rule if the owner wants that band at 2rem too.

## The asset

```text
sha256sum public/brand/as2-logo_v2_cl.png
6ddd15a2031cab928cd7a87c6316aee81fe93e6a4f57ac55b9b0be01b3d3e4af
git show origin/main:public/brand/as2-logo_v2_cl.png | sha256sum
6ddd15a2031cab928cd7a87c6316aee81fe93e6a4f57ac55b9b0be01b3d3e4af
```

Identical, and `git status public/brand` is empty.

## Shots

- `lockup-1440.png` — `/pricing` at 1440, scrolled to the footer: the sticky header lockup and the
  footer lockup in one frame, both 32px.
- `lockup-768.png` — the same page at 768, where the rule does not fire (28px / 48px).
- `measurements.json` — the six rows above, machine-written by the CDP rig.

## Related

- [BRAND-RELEASE.md](../../operations/brand-release.md) — the lockup as one of a brand's three artefacts.
- [ui-registry.md](../../ui-registry.md) — the header and footer surfaces measured here.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Lockup 2rem · prev [Home hero polish](../home-polish/README.md) · next [Templates and relationships after creation](../noun-crud/README.md)

<!-- docs-nav:end -->
