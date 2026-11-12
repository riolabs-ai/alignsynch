# Reference UX pattern spec — `spec-ux-repo-patterns/`

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Reference UX patterns · prev [Stage display](ux-stages.md) · next [AS2 home redesign (handoff)](spec-as2-style-home-redesign/README.md)

<!-- docs-nav:end -->

**Method.** `vision_analyze` was unavailable (vision model is text-only). The nine PNGs (1440×900) were read via local OCR
and pixel scans for geometry/colour — numbers are measured, not guessed.

## 0. Tokens

Canvas `#020817`; surface/border `#1e293b` (1px); raised `#101929`; text `#f8fafc`; muted `#94a3b8`–`#bcbcbc`; accent
`#6366f1`; destructive `#7f1d1d`; currency `#eab308`. Radius 6–8px; full only for chips, timer, letter badges. Type:
H1 30/36 (ink 27), lede 16, section 18, card title 16, body 14/20, label 12, eyebrow 11 caps, numeral 24, nav 14.

## 1. Shell (identical in all nine)

- Sidebar `x8–249` (241px, 1px border at x249, 8px inset). Items **233×40, radius 6**, icon 18 + label 14 at x49, muted.
  **Active = solid accent fill, white label** (measured y520–559).
- Top bar: 40px row (y12–51) — logo x15, search `384×40` at x330, currency right, 46px avatar x1365–1411.
- **Content x274→x1400 = 1126px**, left-justified, never centred (24px pad, 40px right gutter).
- **12-col grid, 24px gutter**: 4 cols 359, 8 cols 742 (verified 742+24+359 and its mirror in `assessment-gap-analysis`).

## 2. Dashboard page (`assessment-gap-analysis`, `profile-1440`, `relationship-example-demo`)

Header y95–145: H1 at **x274**, lede 16 muted, right-aligned actions on its baseline.
First card y176, 32px under the lede; 16–24px between cards; sections split by 24px + an 18px heading.

## 3. Card anatomy (all screens)

1px `#1e293b` border, radius 6, transparent or `#101929` fill, **no shadow or gradient**; padding 24. Header: title 16
semibold left, chip/action right. Stat strips: equal columns, numeral 24 + label 12, no dividers. Meters 4–6px, radius
full, `#f8fafc` on `#1e293b`, width = value (`profile` 293/262/123). Leaderboard rows: 40px avatar, name 14, value
right, 52px pitch.

## 4. Step progress — three variants

**(a) Continuous bar** (`buy-template-wizard`, `relationship-assessment-session`): 8px tall, full column width, **no
segment dividers, no pills, no numbered circles**; 20% `#f8fafc` on `#1e293b`; label above-left, `20% Complete` right.

> **WIZARD, verbatim:** 5 steps, drawn as **one continuous horizontal progress bar** — not five pills, not a numbered
> stepper. Width **862px** = full content column (x414→1276), height **8px** (y322–329), square-to-2px-rounded ends.
> Fill `#f8fafc` for the first **171px = 20.0%** (step 1 of 5); the remaining **690px** is `#1e293b` track. Label
> `Question 1 of 5` (14px white) **above** at x414/y286–308; timer chip `19:58` (90×31, radius 10, `#1e293b`) above the
> bar's right end x1187–1277. Sits under title+chips, above the question, inside the page column.

**(b) Cell rail** (`relationship-edit-flow` 3 cells, `relationship-create-onboarding` 2): **39px band across the content
width** (x280–1416 / x391–1286), 1px border, equal cells (378px), no seams. **Current cell = canvas fill + white label;
others = surface fill + muted label**; labels centred 14px.

**(c) Secondary tab rail** (`relationship-template-detail` 6 tabs, `relationship-example-demo` 3): 28px band, 1px top
rule, surface fill, selected = **inverted notch** (canvas fill, white label), 12px padding, left-packed (ignore the empty
track before the first label).

## 5. Task / create form (`relationship-create-onboarding`, `relationship-edit-flow`)

Two-column form grid in one card: label 12 muted **above** the control, 8px gap; inputs 40px, radius 8, 1px border;
**row pitch 88px**, column gap 24. Segmented control 40px, selected segment **solid accent** (203×40). Full-width accent
CTA at the foot (846×48). Edit footer: outline `New Quiz`, `Preview`, destructive `Delete Quiz`
(148), `Save Draft`, accent `Publish Quiz` **148×40** flush right. Fix: both create screens sit in a **centred 896px
column (x391–1286)** with centred H1/lede.

## 6. Session runner (`relationship-assessment-session`, `buy-template-wizard`)

H1 x272 + lede; 4-up stat strip (359px cards). Body = **8-col question card 274–1014 + 24px + 4-col rail 1041–1400**.
Question 18px; options **48px rows, radius 8, 1px border, 52px pitch**, 32×32 letter badge, selected = accent border.
Card footer: outline `Previous` left, accent `Next Question` right. Rail: segmented Today/Week/All Time + ranked rows.

## 7. Detail page (`relationship-template-detail`, `relationship-example-demo`)

Back link 14 top-left, outline actions top-right. Hero 1024×570, chips (Medium / Published / Geography), H1 30, meta 12
with `·`. Tab rail (c), then prose left, aside right: **label/value card, values right-aligned** (Players 1245, Status,
Created, Updated, Time Limit, Questions) + `Quick Actions` card with a full-width accent button. The purple **gradient**
hero CTA is the only gradient in the set — exception, not system.

## 8. Index + empty state (`relationship-user-dash-kb`)

Hero 30 + lede 16, **320px search centred below**, then a 3-col grid of **260px cards, 28px gutter** (title 16, desc
14, `1 articles` meta). Missing media is a flat `#bcbcbc` placeholder, not shimmer. No pagination.

## Rules a new screen must obey

1. H1 and every block start at **x274 / max 1126**, left-justified — a centred header is a bug.
2. 12-col grid, 24px gutter; 4/8 or 8/4, never 50/50.
3. Cards: 1px border, radius 6, padding 24, transparent fill, **no shadow, no rounded-2xl, no centred content**.
4. Every multi-step surface shows progress at the top of its block: bar for uniform quiz items, rail for distinct form
   stages. Never both, never numbered circles.
5. Labels above inputs (12 muted); inputs 40px radius 8; one accent primary action per view, 40–48px tall.
6. Meta 12 muted with `·`; numbers right-align in label/value lists and tables.
7. Empty data gets an explicit bordered or grey-media block plus one action — never blank.
8. Sentence case, no exclamation marks in headings, `$`/`%` inline.

**Mobile: no evidence.** All captures are 1440×900 with no responsive state, so how the rail or sidebar collapses is
unproven. Proposed: off-canvas sidebar, single column, rail full width with `Step 1/3`, option rows 48px.

## Related

- [UI-UX-AUDIT.md](../UI-UX-AUDIT.md) — what the build follows, varies or diverges from, measured against the purchased template.
- [REFERENCE-MOCKUPS.md](../REFERENCE-MOCKUPS.md) — the specification's own mockups, the other reference set this one is measured against.
- [ui-registry.md](../ui-registry.md) — the surfaces these nine screens are, and their status.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Reference UX patterns · prev [Stage display](ux-stages.md) · next [AS2 home redesign (handoff)](spec-as2-style-home-redesign/README.md)

<!-- docs-nav:end -->
