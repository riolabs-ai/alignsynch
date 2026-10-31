# UX Spec — The Answer Input (1–5 Opinion scale)

**Recommendation:** Replace the per-opinion native `<select>` with a **radio group styled as a
five-segment control** (segmented-control look, radio semantics) — five discrete, labeled,
mutually exclusive options per opinion kind (Feel / Wish / Think / Guess), each at least 44×44 CSS px,
inside a `<fieldset>`/`<legend>` per opinion kind, working with zero JavaScript. **Reject the spec's
Left/Mid/Right slider.** The scale is ordinal, the stored value is a committed integer that drives
gap arithmetic, and the form is a no-JS progressive-enhancement POST — three reasons that each
individually rule out a slider, and together rule out anything fancier than a radio group.

## The obvious approach — the spec's slider — and why it loses

The mockups (04-relationship-level-basic.png, 05-relationship-level-advanced.png) show a
continuous slider per opinion with notches marked only at 1/3/5 and Left/Mid/Right labels.
It looks modern and matches the PDF. It is the wrong control here:

1. **The value IS the data.** In AlignSynch a score is not a vibe: `gapOf(left, right)` subtracts
   two stored integers, and a one-notch slip flips the verdict (`gapMeetsSetting`: Soft tolerates
   exactly 1, Full exactly 0). NN/g: "Selecting a precise value using a slider is a difficult task
   requiring good motor skills… If picking an exact value is important to the goal of the
   interface, choose an alternate UI element." Touch users routinely land on 2 when they meant 3.
2. **The mockup's own notch design hides two legal values.** Marking only 1/3/5 visually teaches
   "this is a 3-point scale"; 2 and 4 become invisible targets a slider cannot label. The model
   (`zScore`) requires integers 1–5, so 2 and 4 must remain first-class, labeled options.
3. **Sliders are worse on mobile, where this app is answered.** A horizontal drag on a touch
   screen conflicts with vertical page scroll (the thumb swallows the swipe), and the APG slider
   pattern carries an explicit warning that touch-based assistive technologies often cannot
   operate sliders because their AT gestures don't synthesize the key events sliders need.
4. **Missing-data research is against sliders.** Couper et al. (2006): slider missing-data rates
   roughly 2× radio buttons; Cook et al. (2001): sliders +71 s slower than radio scales; Funke et
   al. (2011) and GESIS guidelines: higher break-off, worst for lower-education and mobile
   respondents. The one head-to-head (Roster et al. 2015, five-point slider vs five-point radios)
   found _no measurement advantage_ for the slider — it loses the tie-break on cost and
   accessibility.
5. **It misrepresents the data type.** A slider implies a continuous range (3.5 is representable
   in the widget, rejected by the schema). A Likert band is ordinal categories; the WAI-ARIA APG
   itself says a radio group is the right pattern for discrete choices (its Rating Radio Group
   example is literally a five-star scale), and the APG's own slider-rating example recommends the
   radio group "for inputs with seven or fewer choices".
6. **The no-JS contract.** `AnswerForm` is a plain `<form method="post">` with no `"use client"`
   and no script; the current submit path works with JavaScript disabled. A styled slider needs JS
   for thumb rendering, value feedback and `aria-valuetext` sync. A radio group needs none.

## Alternatives rejected

- **Keep the native `<select>` (the zero-cost option).** Accessible, keyboard-fine, no-JS. Rejected
  because it hides the scale's spatial meaning: on mobile it opens a native picker overlay where
  the user picks a bare number with the Left/Right Values out of view — the one thing the file
  header says the screen must never show is "a number with no meaning" — and in Advanced Mode
  (4 opinions × 5+ Aspects = 20+ selects) it costs 2 taps per opinion, every time. It is also
  why the mockup's Left/Mid/Right language can never be rendered. The select is the fallback if
  the radio group is ever descoped, not the target.
- **Segmented control as `<button>`s (`aria-pressed` / roving tabindex).** Better look, but wrong
  semantics: "toggle button, pressed" does not tell a screen reader "3 of 5, selected" the way
  "radio 3 of 5" does; a pressed-button group cannot be un-selected-consistent without
  hand-rolled code; buttons submit nothing without hidden inputs + JS, breaking the no-JS POST;
  and 5 tab stops per opinion (60 stops in Advanced) unless a roving tabindex is hand-maintained.
  Rejected wholesale.
- **Five plain radio buttons (unstyled, GOV.UK-style list).** Semantically right, visually sparse;
  the horizontal band is the whole metaphor (Left Value … Right Value), and a segmented visual
  communicates "positions on a line" that five scattered circles do not. The recommendation is
  the plain radio group _with_ the segmented skin — same DOM, different CSS.

## Accessibility consequence of the recommendation

A native radio group announces natively as a group ("Feel, radio group, 3 of 5, selected — {label}"),
is one Tab stop per opinion (arrow keys move within the group), supports Space selection, and
satisfies WCAG 2.2 SC 1.3.1 (structure), 3.3.2 (labels — the fieldset legend), 4.1.2 (name/role/value
for free) and 2.1.1 (keyboard) with no ARIA beyond the labels. Per-option accessible names must
include the pole meaning ("1 — Rare", "5 — Constant", "3 — Middle"), and each segment must be
≥ 24×24 px (SC 2.5.8 AA) — we spec 44×44 to also meet Apple HIG and comfortable touch. Contrast
for segment borders and the checked state must meet 1.4.11 (3:1).

**Failure mode if a slider were shipped instead:** silent one-notch errors change a couple's Gap
from In Synch to a flagged Gap (or vice versa) — the exact wrong answer in a product whose whole
output is `|a − b|`; plus drag-vs-scroll fights on mobile, keyboard users stuck at whole-notch
steps that don't match any visual mark, and screen-reader users told "slider, 2" with no pole
meaning. Failure mode of the recommendation: a fixed-width 5-segment row is ~200 px wide minimum,
so on very narrow screens the segments must shrink or the numbers must stay while labels move
below; guard with a min-width and test at 320 px.

## Sources

- **WAI-ARIA APG, Rating Radio Group example** — https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/
  The five-star rating example is a radio group; recommended pattern for ≤ 7 discrete choices.
- **WAI-ARIA APG, Slider pattern (and its Rating Slider example)** — https://www.w3.org/WAI/ARIA/apg/patterns/slider/ and
  https://www.w3.org/WAI/ARIA/apg/patterns/slider/examples/slider-rating/
  States: "For inputs with seven or fewer choices, another pattern that could be used is radio
  group"; and warns touch-based AT often cannot operate sliders (gestures must synthesize key events).
- **NN/g, "Slider Design: Rules of Thumb"** — https://www.nngroup.com/articles/gui-slider-controls/
  "Selecting a precise value using a slider is a difficult task requiring good motor skills… If
  picking an exact value is important… choose an alternate UI element."
- **GOV.UK Design System, Radios** — https://design-system.service.gov.uk/components/radios/
  One option from a list → radios; group in `<fieldset>` with `<legend>`; do not pre-select (users
  then miss unanswered questions / submit wrong answers).
- **WCAG 2.2** — https://www.w3.org/TR/WCAG22/ SC 2.5.8 Target Size (Minimum, 24×24), 2.1.1
  Keyboard, 2.5.1 Pointer Gestures (path-based gestures need single-pointer alternative), 1.3.1
  Info and Relationships, 1.4.11 Non-text Contrast, 4.1.2 Name Role Value.
- **Roster, Lucianetti & Albaum (2015), "Exploring slider vs. categorical response formats in
  web-based surveys", Journal of Research Practice 11(1)** — https://jrp.icaap.org/index.php/jrp/article/view/509.html
  Five-point slider vs five-point radios: no significant difference in means/completion — i.e. the
  slider buys nothing and costs accessibility.
- **Boise State evidence review, "Evidence-Based Survey Design: The Use of Continuous Rating
  Scales in Surveys"** — https://scholarworks.boisestate.edu/cgi/viewcontent.cgi?article=1097&context=ipt_facpubs
  Summarizes Couper et al. 2006 (2× missing data on sliders), Cook et al. 2001 (+71 s), Funke
  et al. 2011 (break-off, mobile); "Many studies recommended against using sliders."
- **GESIS guideline (Niessen 2023), questionnaire mode transition** —
  https://www.gesis.org/fileadmin/admin/Dateikatalog/pdf/guidelines/questionnaire_design_mode_transition_niessen_2023.pdf
  "the use of slider scales is not advisable because they lead to higher item non-response and
  break-off rates, especially in lower-educated participants and among mobile device users."

## Implementation sketch (real files)

1. **`components/assessment-flow/answer-form.tsx`** — replace the `<select>` block inside the
   per-`kind` `<label>` with a per-kind `<fieldset>` + `<legend>` ("Feel" / "Wish" / "Think" /
   "Guess" from `itemLabel(section, kind)` as today) containing 5 `<input type="radio">` each
   wrapped in a `<label>`. `name` stays `${kind}:${itemId}` (the `parseSubmission` contract in
   `lib/flow/state.ts` is unchanged — values are still `"1"`..`"5"` strings). Each radio's
   accessible name: `aria-label` templated with the Aspect's pole words, e.g.
   `"${leftValue} — 1"`, `"Middle — 3"`, `"${rightValue} — 5"`; plain `"2"` / `"4"`. Visual: a
   Tailwind segmented band (connected rounded segments, checked segment filled via `peer-checked:`
   classes — pure CSS, still no JS). `required` on the first radio of each group only.
   `defaultValue`→`defaultChecked={aspect.own?.[kind] === notch}`.
2. **Keep the outer `<fieldset>`/`<legend>` per Aspect** (nested fieldsets are valid HTML and
   announced as two group levels: Aspect, then opinion kind). Keep the `leftValue — rightValue`
   line above the band; add a one-line group description (aria-describedby) reading "1 is {left},
   5 is {right}, 3 is the middle" so the numbers never stand bare.
3. **`data/pages/assessment-instance.ts`** (E23 — components hold no literals): add copy ids
   `scale-help` (the group-description sentence) and keep `feel`/`wish`/`think`/`guess` labels as
   they are.
4. **`lib/flow/state.ts::parseSubmission`** — unchanged; it already refuses missing/out-of-range
   values per kind, which is the error-recovery path (server refusal → `?problem=incomplete`
   rendered with `role="alert"` in `instance-view.tsx`).
5. **`tests/flow-state.test.ts` + a new render test** — extend to assert the form markup
   (see acceptance criteria); the existing `tests/assessment-report.test.ts` keeps passing since
   the report is untouched.

## Acceptance criteria

1. `grep -c 'type="radio"' components/assessment-flow/answer-form.tsx` equals
   `5 × (number of opinion kinds for the mode) × (Aspects)` on any rendered sheet — for the
   Relationship Basics Basic instance: 50 (5 Aspects × 2 kinds × 5).
2. `grep -riE 'type="range"|role="slider"|aria-pressed' components/assessment-flow/` returns
   nothing — no slider or button-segment implementation anywhere in the flow.
3. Render `AnswerForm` with `renderToStaticMarkup` and assert: every opinion kind is a
   `<fieldset>` with a `<legend>`; every group contains exactly 5 radios named
   `${kind}:${itemId}`; radio 1's accessible name contains the Aspect's `leftValue`, radio 5's
   contains `rightValue` (string check on `aria-label`).
4. No-JS POST still works: `pnpm build` stays green (the form remains a server component with no
   `"use client"`), and the existing submit-flow tests in `tests/flow-state.test.ts` pass
   unmodified — the wire format did not change.
5. Error recovery: posting a sheet missing one opinion still redirects with `?problem=incomplete`
   and renders the `role="alert"` copy (existing behavior asserted in the flow tests); with JS
   on, the browser blocks submit on the first invalid required group and focus lands there.
6. Each segment's computed min-height/min-width is ≥ 44 CSS px at a 320 px viewport
   (check via a rendered class assertion, e.g. every segment carries the size utility class).
7. Keyboard audit (manual or axe): Tab stops on the sheet = 1 per opinion group (+ submit); arrow
   keys move selection within a group and announce "radio, N of 5"; no axe violations on the
   sheet for any radiogroup rule.
8. `pnpm lint` / `pnpm format:check` / `bash scripts/verify.sh` exit 0 — the change is pure
   markup+CSS+copy, no new dependencies, no client JS bundle added.
