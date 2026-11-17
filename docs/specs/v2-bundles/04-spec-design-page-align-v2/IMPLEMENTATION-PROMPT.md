# AlignSynch Align v2 (Stage 6): React / Tailwind CSS v3 implementation brief

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Align (Stage 6) v2 — implementation brief · prev [Align (Stage 6) v2 (handoff)](README.md) · next [Align (Stage 6) v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Align (Stage 6)** · prev [03-spec-design-page-relationship-detail-v2](../03-spec-design-page-relationship-detail-v2/README.md) · next [05-spec-design-page-start-my-relationships-v2](../05-spec-design-page-start-my-relationships-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/04-spec-design-page-align-v2/` · **Issue:** #1122  
**Source:** `v2-prototype` pass 10 plus the 2026-11-16 trial-start decision (DESIGN-NOTES v3.2 §45). QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0.  
**Priority:** P1  
**Issues:** [#1122](https://github.com/riolabs-ai/alignsynch/issues/1122) Align v2 · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · tokens [#1120](https://github.com/riolabs-ai/alignsynch/issues/1120) · answer screen (pending) [#1128](https://github.com/riolabs-ai/alignsynch/issues/1128)  
**Target:** the existing Align route under the relationship on the dashboard (confirm in `lib/flow/paths.ts`); Align lives on the dashboard, never in the wizard.  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Align page from `04-spec-design-page-align-v2/` in the existing Next.js app. Use `align.html`, `css/tokens.css`, `js/tw-config.js` and `reference/align-*` as the visual and interaction reference. Title it "Where You Agree, and Where You Differ" with the "Stage 6 · Align" eyebrow. Add the Soft/Full Alignment Tolerance toggle that re-scores in place, the vivid summary bar (one segment per Aspect in template order, icon + Aspect title + status word, stacking as a list below `md`), the legend, and per-Aspect answer rows on the locked, numbered 1–5 scale with party markers and vivid Gap outlines. Compute gaps at render (`|a − b|`), never store them. One Next Step action: Start the Conversation. Check at 390, 1280 and 1920 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Gap model | `content/gaps.ts`, `gapOf` | Gap = `|a − b|` at render. Verdict table: 0 → In Synch; 1 → Small Gap (OK under Soft, Not OK under Full); ≥ 2 → Gap. |
| Tolerance field | relationship settings | Rename "Alignment Setting" to **Alignment Tolerance**, field `alignmentTolerance: "soft" | "full"`. |
| Answer bars | `NEW: paired-answer-bars` | Shared with Relationship Detail Aspects tab, wizard Stage 3 (scale-only) and the catalog example card. |
| Next Step | prototype `next_step()` | Widest Gap, Wish beats Feel, then Aspect order; shared with Relationship Detail. |

## Page and interaction requirements

- **Header:** breadcrumb My Relationships › <Title> › Align; eyebrow "Stage 6 · Align"; H1 "Where You Agree, and Where You Differ"; purpose line.
- **Alignment Tolerance toggle:** Soft ("Answers one step apart still count as aligned.") / Full ("Only identical answers count as aligned."). Switching re-scores the summary, chips, rings, legend and captions in place. With the demo sheet, Full shows "1 of 5 aligned".
- **Summary:** solid segment per Aspect (template order) with status icon (✓ / ≈ / flag), bold Aspect title linking to its card, and the word ("In Synch", "Small Gap · OK", "Small Gap · Not OK", "Gap"). Gold segments carry the 1 px `#665624` edge. Below `md`, a stacked list (bar, title, word); no truncation.
- **Legend:** vivid filled circles with icons and counts.
- **Filters:** All / In Synch / Small Gap / Gap (toggle-group with counts).
- **Aspect rows:** five equal numbered cells `bg-scale-1…5`; Feel and Wish lines; M (Marcus, clay `-solid`) and E (Elena, slate-teal `-solid`) markers with a 2 px white ring, Marcus above, Elena below; chosen numbers bold with a 2 px dark-teal underline; the Gap outline spans the cells between the answers: In Synch 2 px `#1f9d55` ring on a 1 px white offset; Small Gap 2 px `#f2b705` ring plus 1 px `#665624` outline; Gap 2 px `#d96a00` ring; under Full a Small Gap takes the Gap ring.
- **Next Step:** one action, **Start the Conversation** (→ Discussion with the Aspect tagged).
- Paused relationships: Align stays readable (a Paused banner on Align is an open follow-up, §15).

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/layout/header` | align.html (1) |
| `components/layout/main-layout` | align.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | align.html (1) |
| `components/layout/sidebar` | align.html (1) |
| `components/ui/avatar` | align.html (1) |
| `components/ui/badge` | align.html (16) |
| `components/ui/button` | align.html (5) |
| `components/ui/button (outline on action)` | align.html (1) |
| `components/ui/card (tone: action)` | align.html (1) |
| `components/ui/card + NEW: paired-answer-bars` | align.html (5) |
| `components/ui/card + page header` | align.html (1) |
| `components/ui/collapsible` | align.html (1) |
| `components/ui/dropdown-menu (account)` | align.html (1) |
| `components/ui/input` | align.html (1) |
| `components/ui/sheet` | align.html (1) |
| `components/ui/toggle-group` | align.html (3) |
| `NEW: paired-answer-bars` | align.html (10) |

## Copy strings (exact)

"Stage 6 · Align" · "Where You Agree, and Where You Differ" · "Alignment Tolerance" · "Soft" · "Full" · "In Synch" · "Small Gap · OK" · "Small Gap · Not OK under Full" · "Gap" · "Start the Conversation" · "Feel" · "Wish". Banned: "Alignment Setting", "Update My Opinions".

## Locked rules (apply to every v2 surface)

These were decided by the owner on 2026-11-16 and are not open for reinterpretation during the port.

1. **Calm palette.** Initiator clay: mark `#c8735a`, ink `#9a4b33`, solid/avatar `#a4573e`, tint `#fbf1ec`, line `#ecc6b6`. Counterparty slate-teal: mark `#4e8794`, ink `#33636e`, solid/avatar `#3f7480`, tint `#edf5f6`, line `#b9d5da`. Graphite `#37474f` is every action (hover `#2a373e`); cyan `#08add5` is a thin surface accent only, never text; calm deep `#276a80` (the prototype's `--deep`, ported as `deep-calm`; the brand record's `deep` `#156898` stays). No pulse animations.
2. **Vivid status = icon + word, always.** In Synch `#1f9d55` with ✓; Small Gap gold `#f2b705` with ≈ and a 1 px `#665624` edge; Gap orange `#d96a00` with a flag. Chip grounds `#e8f6ec` / `#fdf5d6` / `#fdeddc`, inks `#2f6a4b` / `#665624` / `#7f5219`. Under Full tolerance, a 1-step Small Gap keeps its word and ≈ but takes the Gap colour ("Small Gap · Not OK under Full"). Colour is never the only cue.
3. **Locked 1–5 answer scale.** `#f2bc9f` `#f1cc95` `#e9daa2` `#cbd9a6` `#acd0b4` (`bg-scale-1…5`), every cell numbered; M/E party markers with a 2 px white ring; chosen values bold with a dark-teal underline. Do not change these values.
4. **No red anywhere** except scale step 1. Destructive actions are neutral graphite outline buttons with an × icon. No `red-*`/`rose-*` classes; `--destructive` is graphite.
5. **The Counterparty never sees a price, the word "trial", a card ask or an extension.** Paused reads "Paused · Waiting on Marcus" for them.
6. **Live Aspect changes are proposed, not silent.** Once Stage 6 is live, editing an Aspect creates a proposed change both people Accept or Decline. Do not port the repo's silent Aspect-edit function to live relationships.
7. **Archive over delete.** Default to Archive (reversible) for templates and relationships; hard delete only where there is no shared data and it is confirmed.
8. **Title Case for labels, buttons, tabs and headings, with no ending period**; sentence case for sentences. Product terms are capitalized: Aspect, Feel, Wish, Think, Guess, Stage, Align, In Synch, Small Gap, Gap, Alignment Tolerance.
9. **Route conflict.** The repo's public catalog is `/relationship-types`; the v2 route is **`/relationship-templates`**. Ship `/relationship-templates` and `/relationship-templates/[slug]`, permanently redirect (308) `/relationship-types` and `/relationship-types/[slug]` to them, and update `RELATIONSHIP_TYPES_PATH` (`lib/flow/paths.ts`) so no link points at the old route.
10. **Card-free trial, decided placement and start.** Stage 4 is the account only. The Stage 5 primary button is **Continue with 7 Days Free** and only sends the invite. **The 7-day free trial starts when the Counterparty accepts** (both parties in). Drafts and sent-but-pending invites use no trial days. This replaces PR #1116's start at relationship creation and the earlier prototype start-at-send copy; PR #1116 must move its grant to acceptance. When the 7 days end without a card, Stage 6 pauses read-only (nothing lost) and the Initiator gets one free 7-day extension, once.
11. **One status and one next action per state.** Banners confirm what just happened and never repeat the status.
12. **Layout.** QuizHub breakpoints, content capped at 1440 px (`max-w-content`), `data-qh` on prototype elements names the QuizHub source to reuse.


## Suggested React component boundaries

`AlignPage` → `AlignHeader` · `ToleranceToggle` · `AlignSummaryBar` (`SummarySegment`) · `StatusLegend` · `AlignFilters` · `AspectAlignCard` (`PairedAnswerBars` ×2 lines, `StatusChip`) · `NextStepCard`. Scoring lives in one pure `verdict(gap, tolerance)` with a unit test.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Compare with `reference/align-390.png`, `align-1280.png`, `align-1920.png`.
- Toggling Full repaints a 1-step Small Gap's ring, chip, segment and caption to Gap colour while keeping "Small Gap" and ≈.
- Summary stacks readably at 390; no truncated labels; no overflow.
- Vitest for the verdict table (gap 0 / 1 / ≥ 2 × Soft / Full).

### Accessibility and behaviour

- Keyboard traversal and visible focus on every control; skip link to `#main`; one `h1` per page and an ordered heading outline.
- Tabs use `role=tablist/tab/tabpanel` with arrow-key movement; switches and toggle groups expose `aria-checked`/`aria-pressed`; the current stage/step carries `aria-current="step"`.
- Status is never colour-only: icon + word on every chip, bar and legend.
- Contrast: inks ≥ 4.5:1 on their tints, UI marks ≥ 3:1 (values in `css/tokens.css` were checked; re-check with the app's real variables).
- Touch targets ≥ 44 px on mobile; reduced-motion disables smooth scroll and transitions.
- axe-core (wcag2a + wcag2aa): 0 violations on every state (the prototype passes at 390 and 1280).


### Repository checks

Run from the app repository after implementation:

```bash
pnpm typecheck
pnpm lint            # includes scripts/lint-brand-classes.mjs, both brand lanes
pnpm test
pnpm build
bash scripts/verify.sh
rg -n "bg-(red|rose)-|text-(red|rose)-|border-(red|rose)-" components app   # 0 hits in the AlignSynch lane
```

Do not weaken existing route, data, brand or copy-ownership checks to make the page pass.


## Must not

- Must not change the locked scale cell colours, store gap values, use colour as the only cue, or reuse the removed calm `-fill` tokens.
- Must not add Advanced Mode rows (Think/Guess, prediction Gap types) in 1.22 (§11).

## Pending

- The answer screen (Assessment) is its own bundle, `10-spec-design-page-assessment-v2` ([#1128](https://github.com/riolabs-ai/alignsynch/issues/1128)).
- Paused banner on Align (open).

## Definition of done

Align renders the approved v2 design, Soft/Full re-scores correctly, gaps are computed at render, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `align.html` · Align · AlignSynch v2.0 prototype

**Headings:** H1 “Where You Agree, and Where You Differ” · H2 “Talk About Parent Decisions” · H2 “Aspect by Aspect” · H2 “Contact Frequency” · H2 “Old Roles” · H2 “Showing Up” · H2 “Parent Decisions” · H2 “Feeling Respected”

**Buttons and actions:** “Aligned 3” · “All 5” · “Discuss” · “Elena” · “Full” · “MR” · “Marcus” · “Soft” · “Start the Conversation” · “To Talk About 2”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Align (Stage 6)** · prev [03-spec-design-page-relationship-detail-v2](../03-spec-design-page-relationship-detail-v2/README.md) · next [05-spec-design-page-start-my-relationships-v2](../05-spec-design-page-start-my-relationships-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Align (Stage 6) v2 — implementation brief · prev [Align (Stage 6) v2 (handoff)](README.md) · next [Align (Stage 6) v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->
