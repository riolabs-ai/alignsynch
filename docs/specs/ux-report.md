# UX Spec — The Gap Report (eight kinds per Aspect)

**Recommendation:** Keep the per-Aspect card as the row unit, but restructure each card into
**three named groups using the spec's own headings** ("Feelings and Wishes Differ",
"Desires To Change", "Prediction Gaps & Analysis"), render each group as a semantic
**table** (gap name as row header, the two compared Opinions, a 0–4 bar, and the numeric Gap),
and put a **verdict summary first** above the cards: "Aligned under {Soft/Full}" or
"{N} Gaps exceed your {Soft/Full} Setting, the widest is {k} on {Aspect}". Every Gap keeps its
number beside any flag colour (never colour-only), and a bar's only mark beyond the value is a
tick at the Setting's tolerance (1 for Soft, 0 for Full). **What we do NOT show:** any total,
average or composite "alignment score", Doubt gaps, empty prediction rows on Basic instances,
the other party's mid-completion counts anywhere, and bare flag colours.

## The obvious approach — and why it loses

- **Obvious A: the current flat 8-line list per Aspect (what the build has).** Honest and
  already tested (`data-<kind>-gap` attributes), but flat: four prediction rows sit visually
  level with four Basic rows, so a reader cannot tell "we disagree about facts" from "you
  misread each other" without re-deriving each pair. The spec's own document groups the eight
  under three headings (p. 65: "Feelings and Wishes Differ (Basic)", "Desires To Change
  (Basic)", "Prediction Gaps & Analysis"), and SPEC-DRIFT §6 already names "name the gap
  groups" a quick win. Flat lists also force the eye to re-read each pair's labels; grouping
  lets the heading carry the meaning once.
- **Obvious B: the spec's bulleted lists with flag colours (mockup 09).** Bullets are for prose
  relationships, not for comparing 8 numbers × 5 Aspects; the flag colours (yellow/orange/
  pink/red) are the spec's whole visual channel, which fails WCAG 1.4.1 the moment colour is
  the only channel — and it is, in the mockup.
- **Obvious C: a bullet graph per Gap.** Few's bullet graph is the right _shape_ (compact bar +
  target tick + qualitative ranges, "designed for rapid monitoring when screen space and time
  are limited"), but the full five-component spec (label, scale, measure, comparative measure,
  2–5 qualitative ranges) is overbuilt here: our ranges _are_ the 0–4 integers and our only
  comparative measure is the Setting tolerance. We take the shape, not the ranges.

## The layout, concretely

1. **Verdict summary (new, one band above the cards).** Answer the user's first question first:
   are we aligned? `instanceAlignment` already computes this — `{aligned, unmet}` from
   `content/gaps.ts` — but no screen renders it today. Show: the Setting and its definition
   (`SETTING_DEFINITIONS`), "Aligned" when `unmet` is empty, otherwise the count of unmet Gaps
   and the widest one, e.g. "3 Gaps exceed Soft — the widest is a Gap of 3 on {prompt}."
2. **Per-Aspect card (kept).** `h2` prompt + pole line (already good screen-reader navigation).
   Then three group headings, each with the glossary's own words. Rows stay in `GAP_KINDS`
   glossary order _within_ their group — stable positions across visits beat dynamic sorting
   for re-reading; the summary already surfaces the worst.
3. **A row.** Semantic table or definition-list row: `th`/term = Gap kind name (`GAP_KIND_LABELS`);
   middle = the two named sides exactly as today ("Noor Think" notches + number, "vs", "Iris
   Feel" notches + number — the existing `SideScore` is right and must stay, it is what makes a
   prediction row legible); right = the Gap as a number ("In synch" for 0, per SPEC-DRIFT quick
   win #4 this should be capitalised as the spec treats it: "In Synch") plus a 0–4 bar with the
   setting tick. The bar is `role="img"` with `aria-label` "{kind}: Gap of {n} out of 4" or
   `aria-hidden` with the number as the text alternative, and the number itself always in
   text — never colour-only.
4. **Flag colour stays, subordinate.** Yellow/Orange/Pink/Red for gaps 1/2/3/4 as a secondary
   channel only; the number, the words "Small Gap"/"Big Gap", and the bar length carry the fact.
5. **Basic vs Advanced.** Basic renders the two Basic groups only (4 rows) — the schema already
   makes prediction rows absent (`gapKindsOf` skips undefined pairs), and the component must
   keep drawing only present kinds, never empty "Prediction" shells.

## Cognitive-load reasoning (which numbers first)

A couple opens this report together. The emotional first question is the verdict — are we on the
same page — not "what is the Initiator Guess Gap on housework". So: verdict → biggest unmet
gaps → full detail. Within the detail, the grouped headings cut 8 names down to 3 meanings the
spec already established, and the bar column turns 8 numbers per card into a scanable profile
(one glance: all bars near the left = good). The numbers the user does NOT need first — and
therefore never shown — are composites: the glossary defines no total, and a made-up average of
eight incomparable differences (disagreement vs prediction error) is fake precision that invites
"our score is 71" readings the model cannot support.

## Why NOT the alternatives, named

- **One giant comparison table (Aspects × Gaps).** 5 Aspects × 8 kinds = 40 rows with 2 notch
  bands each; wide tables collapse on mobile (NN/g: tables force horizontal scrolling or
  information loss on small screens). Per-Aspect cards already handle mobile for free.
- **Sparkline/radar chart per Aspect.** Pretty, useless: a radar implies a common scale and
  ordering the 8 kinds do not have (a Think Gap is not "more" than a Feel Gap), and it is
  unreadable to screen readers without a table-equivalent behind it.
- **Bullet list per the spec mockup.** No alignment, no scan path, colour-dependent.
- **Sorting rows by gap size.** Tempting, rejected: positions would move between visits and
  between parties' reads of the same frozen data, hurting joint discussion ("the third row" is
  a thing couples say). Stable order + the summary band gets the benefit without the churn.

## Accessibility consequence and failure modes

Semantic tables with `scope="row"` give screen-reader users the pair structure ("Feel Gap — Noor
Feel 3 vs Iris Feel 5 — Gap 2"); heading-grouped cards give heading navigation; bars with text
alternatives keep WCAG 1.4.1 (never colour-only) and 1.3.1. **Failure modes:** (a) a bar without
an adjacent number is the spec mockup's bug again — colourblind users cannot distinguish yellow
from orange from pink; (b) a "total" that someone adds later will drift from the model the moment
the eight kinds change — no schema can catch an invented aggregate (same reason the Gap is a
function, never a column); (c) showing prediction rows on Basic instances as "—" or 0 would print
In Synch about questions nobody asked — the component must keep the `gap === undefined` guard
that already exists; (d) an "Aligned" verdict rendered without naming the Setting is ambiguous,
since Soft/Full change the verdict on the same numbers.

## Sources

- **Stephen Few, "Bullet Graph Design Specification" (Perceptual Edge)** —
  https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf
  Single measure + comparative measure tick + ≤5 (ideally 3) qualitative ranges; "rich display
  of data in a small space"; comparative measure as a perpendicular short line.
- **Stephen Few, "Why Most Dashboards Fail"** — https://www.perceptualedge.com/articles/misc/WhyMostDashboardsFail.pdf
  Condense; include only what is needed; one accent colour so attention lands on what is urgent.
- **NN/g, "Comparison Tables for Products, Services, and Features"** —
  https://www.nngroup.com/articles/comparison-tables/ — tables are for comparing across
  attributes; keep the compared items stable and columns consistent (supports the stable-row-order
  decision and the row-table choice).
- **GOV.UK Design System, Tables** — https://design-system.service.gov.uk/components/table/
  "Use the table component to make information easier to compare and scan" for numerical data;
  numeric data right-aligned, tabular numbers.
- **WCAG 2.2, SC 1.4.1 Use of Color** — https://www.w3.org/TR/WCAG22/#use-of-color
  "Color is not used as the only visual means of conveying information" — the spec's four flag
  colours are the only channel in the mockup.
- **Spec p. 65 (mockup 09-gap-analysis-terms.png)** — gap severity → flag colour mapping, the
  three group headings ("Feelings and Wishes Differ", "Desires To Change", "Prediction Gaps &
  Analysis") — the headings are the spec's own words; the build adopts them instead of inventing
  "Basic / Prediction".
- **docs/SPEC-DRIFT.md §1, §6** — Doubt gaps are not computable (frozen opinions, no history);
  quick win #4 "In synch" capitalisation; quick win #5 "name the gap groups".

## Implementation sketch (real files)

1. **`content/gaps.ts`** — add a `GAP_GROUPS` table: three named groups with `kinds` (the spec's
   three headings; "Prediction Gaps & Analysis" holds the four Advanced kinds), preserving the
   existing `GAP_KINDS` order. Pure data, so `pnpm data:check` compiles it untouched.
2. **`lib/assessment-report.ts`** — extend `AssessmentReport` with `setting: AlignmentSetting`
   and `verdict: AlignmentVerdict` computed via `instanceAlignment(rows.map(r => ({itemId:
   r.itemId, gaps: r.gaps})), instance.setting)`; expose `settingLimit` so the view can draw the
   tick without importing the threshold table a second time (the same single-reader rule the
   comment in `gapMeetsSetting` already states).
3. **`components/assessment/assessment-report.tsx`** — keep `AspectRow`, `SideScore`, `Notches`;
   replace the flat `GAP_KIND_SOURCES.map` with a loop over the three groups rendering a heading
   (`h3`) + table per group; convert the `grid` rows into a real `<table>` with `th scope="row"`
   gap names; add the verdict band above the cards; add the 0–4 bar (a `div` with a
   `style={{width}}` or Tailwind `w-*` classes, tick at the setting limit); render "In Synch"
   capitalised; keep every `data-<kind>-gap` attribute so `tests/assessment-report.test.ts` keeps
   passing (add group heading assertions).
4. **`data/pages/assessment-instance.ts` + a new `data/pages/assessment-report.ts`** — copy ids
   for the verdict band ("Aligned under Soft — Small Gap (1) OK", "{n} Gaps exceed…", the three
   group headings live in `content/gaps.ts` as data, their _rendering_ needs no copy file; the
   verdict sentences do) — E23: components hold no literals.
5. **`app/(mainlayout)/assessment/[slug]/page.tsx`** — unchanged call shape; the projection now
   carries the verdict so the page stays a pure read.

## Acceptance criteria

1. `tests/assessment-report.test.ts` (existing) still passes unmodified for the `data-<kind>-gap`
   attributes, and a new assertion verifies exactly three group headings per Advanced card and
   two per Basic card, with the exact heading strings from `GAP_GROUPS`.
2. Rendered Basic report contains no Think/Guess row or "Prediction" heading: assert the
   rendered text of a Basic fixture (`assessment-instance-avery-rowan`) lacks
   "Think" / "Guess" / "Prediction".
3. Verdict band: rendered text of `assessment-instance-ruth-sam` (all gaps 0) contains
   "Aligned"; `assessment-instance-marco-priya` (gaps 1–4) contains a count and the widest gap,
   e.g. "Gap of 4" — asserted in the render test; and `instanceAlignment` results are unit-tested
   in `tests/` for both Settings.
4. Colour-blind safety: every row's rendered text contains either "In Synch" or a bare integer
   gap (regex on the rendered markup per row), and the bar element is `role="img"` with an
   `aria-label` containing the numeric gap — verify with the render test, not by eye.
5. `grep -riE "total gap|average gap|overall score|compatibility" app/ components/ lib/ content/
   data/` returns nothing — no composite metric exists anywhere in the tree.
6. Semantics: `renderToStaticMarkup` of an Aspect card contains `<table>` and at least one
   `<th scope="row">` per group; axe-core scan of the report route reports no violations.
7. Setting tick: the rendered bar markup for a row with gap 1 under Soft differs from the same
   row under Full only by the tick position/verdict text — assert via the projection fixture
   switch in the render test.
8. `bash scripts/verify.sh` exits 0 (content + components lanes both run; `data:check` validates
   the new `GAP_GROUPS` table against `GAP_KINDS` if a z-schema is added).
