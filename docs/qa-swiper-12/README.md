# swiper 11.2.7 → 12.2.0 — visual QA (card t_f18a9115)

Two critical advisories (`>= 6.5.1, < 12.1.2`) are fixed by 12.1.2, so the five homepage carousels
were migrated to 12.2.0. This folder is the visual evidence: the same carousels, rendered by the
same page, built once from `swiper@11.2.7` and once from `swiper@12.2.0`.

## How the shots were taken

- `next build` + `next start` per brand (`BRAND=quizhub`, `BRAND=alignsynch`), production, port 3199.
- Headless Chrome over CDP (`Page.captureScreenshot`), viewports **1440×900** and **390×844**;
  `innerWidth === target` asserted after `Emulation.setDeviceMetricsOverride` before every shot.
- Every slider is **frozen before the shutter**: `autoplay.stop()` then `slideTo(0, 0)`, twice, after
  all images report `complete`. Without that the four autoplay/loop carousels capture at a random
  offset and a before/after diff measures motion instead of rendering.
- Each carousel is scrolled to centre so its arrows sit in frame.

## Result

| pair                  | desktop                  | mobile                   |
| --------------------- | ------------------------ | ------------------------ |
| categories            | byte-identical           | byte-identical           |
| top players           | byte-identical           | byte-identical           |
| by difficulty         | 1 838 px differ (0.14 %) | 349 px differ (0.11 %)   |
| live winners          | 5 588 px differ (0.43 %) | 22 539 px differ (6.8 %) |
| creator tips          | byte-identical           | byte-identical           |
| AlignSynch front page | byte-identical           | byte-identical           |

**Control:** capturing the _same_ v11 build twice reproduces exactly those four differing pairs
(1 779 / 12 671 / 333 / 1 261 px), so the residual difference is capture timing on the two
autoplay + `loop` carousels, not a rendering change.

**Geometry probe (no pixels):** every slide's `getBoundingClientRect`, its
`transform-style`/`backface-visibility`, the wrapper transform and transition duration, the slide
count, `slidesPerView`, the nav-element binding and the document height are **byte-identical JSON**
across the two versions at both widths.

## Product facts this measurement pinned (pre-existing, unchanged by the bump)

- AlignSynch's front page mounts **no carousel at all** (`0` swipers, `0` Embla regions) — the five
  components are rendered by `QuizHubHome` only, so the AlignSynch shots show the front page it does
  have.
- Autoplay runs on three of five sliders (`categories`, `live-winners`, `creator-tips`). `top-players`
  registers the Autoplay module but passes no `autoplay` prop, and `by-difficulty` sets `autoplay`
  but registers only `Navigation` — both are inert in 11.2.7 and 12.2.0 alike.
- No slider configures Pagination, so no dots exist to compare; the arrows are the custom buttons,
  and `live-winners` points `navigation.nextEl/prevEl` at `.next-winner`/`.prev-winner`, which no
  element carries.
- `quizzes-by-difficulty`'s medium and hard tabs use `components/ui/carousel.tsx`, which is
  **embla-carousel-react**, not swiper; only the easy tab is a swiper.
