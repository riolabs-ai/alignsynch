# AlignSynch v2 design system: tokens, component sheet and flow map

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › v2 design system — implementation brief · prev [v2 design system (handoff)](README.md) · next [v2 design system — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Design system: tokens, component sheet, shared modal/toast/kebab, flow map** · prev [08-spec-design-page-payment-v2](../08-spec-design-page-payment-v2/README.md) · next [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/09-spec-design-system-tokens-v2/` · **Issue:** #1120  
**Source:** `v2-prototype` pass 10 (final, QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0).  
**Priority:** P0 dependency (every other bundle consumes these tokens)  
**Issues:** [#1120](https://github.com/riolabs-ai/alignsynch/issues/1120) v2 design tokens · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · AS2 public rollout [#854](https://github.com/riolabs-ai/alignsynch/issues/854) · admin matrix [#1126](https://github.com/riolabs-ai/alignsynch/issues/1126)  
**Target:** `app/globals.css` (`:root`, `BRAND=alignsynch`), `tailwind.config.ts` `theme.extend`, `scripts/lint-brand-classes.mjs`, and the four new shared components.  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Land the v2 tokens from `09-spec-design-system-tokens-v2/` before any surface card. Port `css/tokens.css` into `app/globals.css` for the AlignSynch brand lane and `js/tw-config.js` 1:1 into `tailwind.config.ts` `theme.extend`. Use `baseline.html` (the token and component sheet), `patterns.html` (the shared modal, toast and kebab) and `index.html` (the clickable flow map linking every bundle) as the reference. Add the four shared components (`stage-gauge`, `paired-answer-bars`, `payment-panel`, `party-card`) and the three shared interaction patterns (one neutral modal, one toast, one kebab). Make the brand lint fail `red-*` and `rose-*` in the AlignSynch lane, remove pulse animations from status surfaces, and leave the QuizHub lane untouched. Tokens only; no surface changes in this card.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Brand record | `data/brands/alignsynch.ts`, `lib/brand-theme.ts` | Keep `deep` `#156898` in the brand record (epic D-F); add `deep-calm` `#276a80` as a separate token. The prototype overrides `--deep` itself to `#276a80`, so map every prototype `deep` class (`text-deep`, `bg-deep`, the current gauge segment, the chosen-value underline) to `deep-calm` in the port. |
| Tokens | `app/globals.css` | Add party, scale, status, surface tokens; `--destructive` → graphite; `muted-foreground #4f5d6b`; `border #c5d0d5`. |
| Tailwind | `tailwind.config.ts` | Expose every class `tw-config.js` defines (`bg-scale-1…5`, `initiator-*`, `counterparty-*`, `synch|small-gap|gap-*`, `status-*`, `billing-*`, `max-w-content`, `grid-cols-shell`). |
| Lint | `scripts/lint-brand-classes.mjs`, `brand-classes.mjs` | Fail `red-*`/`rose-*` under `components/` and `app/` for AlignSynch. |

## Token reference

| Group | Tokens |
| --- | --- |
| Initiator (clay) | mark `#c8735a` · ink `#9a4b33` · solid `#a4573e` · tint `#fbf1ec` · line `#ecc6b6` |
| Counterparty (slate-teal) | mark `#4e8794` · ink `#33636e` · solid `#3f7480` · tint `#edf5f6` · line `#b9d5da` |
| Answer scale (locked) | `#f2bc9f` · `#f1cc95` · `#e9daa2` · `#cbd9a6` · `#acd0b4` |
| Status marks | synch `#1f9d55` (✓) · small-gap `#f2b705` + edge `#665624` (≈) · gap `#d96a00` (flag) |
| Status tints / inks | `#e8f6ec`/`#2f6a4b` · `#fdf5d6`/`#665624` · `#fdeddc`/`#7f5219` |
| Brand | graphite `#37474f` (hover `#2a373e`) · text `#363d49` · cyan `#08add5` (surface only, press `#0693b8`) · brand-record deep `#156898` · calm deep `#276a80` (named `--deep` in the prototype's `tokens.css`; port it as `deep-calm` per epic D-F and keep the brand record's `deep`) |
| Surfaces | status `#f2f8f9` / line `#c9e2e7` / chip `#deeef1` · billing `#f2f7f4` / line `#c8dccf` / chip `#e2eee6` / ink `#2d6549` · paper, mist, sand, line, pale, mark from `data/brands/alignsynch.ts` |
| Shape and type | `--radius 0.5rem`, 14 px body (both change QuizHub too: separate card after owner ruling) |

`css/tokens.css` is the exact source; where this table and the file differ, the file wins.

## New shared components

| Component | Used in | Notes |
| --- | --- | --- |
| `stage-gauge` | wizard rail (setup variant), Relationship Detail aside (live variant) | 5 segments + dashed outer Stage 6 arc; done graphite, current `deep`, later `line`. |
| `paired-answer-bars` | Align, Relationship Detail Aspects, wizard Stage 3 (scale only), catalog example | Five numbered cells, M/E markers with white ring, vivid Gap outlines. |
| `payment-panel` | Relationship Detail Payment tab, Payment page | Billing-surface `dl`: Status, Ends, After, Card; Counterparty variant is the coverage note only. |
| `party-card` | Relationship Detail hero, join flow | Party tint, line, solid avatar, "(You)" marker. |

## Shared interaction patterns (pass 10)

Every pass 10 interaction uses exactly one of each. Open `patterns.html` to try them; `reference/modal-*`, `kebab-*`, `drawer-edit-*` and `account-menu-1280.png` show them in context.

| Pattern | QuizHub source | Rules |
| --- | --- | --- |
| **One neutral modal** | `components/ui/alert-dialog` (native `<dialog>` in the prototype, `AS.modal()`) | Used for every destructive confirm and every small form (Cancel Invite, Abandon Draft, Leave, Request My Removal, Delete Permanently, Delete Account, Propose a Change, Decline reason). Confirm is graphite `bg-action` with an × icon (or ✓ for a non-destructive submit); Cancel is ghost. Title Case title, one sentence body. Focus goes to the first field or the confirm button and returns to the trigger on close. Never red. |
| **One toast** | `components/ui/toast` (`AS.toast()`) | A single `role=status`, `aria-live=polite` region, bottom centre on mobile and bottom right on desktop; graphite ground; one sentence; optional link (View, Undo); auto-dismiss about 5 s. Undo is how reversible actions (Archive) confirm, instead of a modal. |
| **One kebab** | `components/ui/dropdown-menu` (`kebab()` in `src/kit.py`) | Ghost icon trigger with an accessible label ("Template actions"), `aria-haspopup=menu`, `aria-expanded`; `role=menu` and `menuitem`s; Enter/click opens and focuses the first item, arrows move, Escape and outside click close and return focus. Items are Title Case; destructive items carry an × and open the neutral modal. |
| **Sheet (Aspect drawer)** | `components/ui/sheet` | Right-side sheet for the Aspect editor (bundles 01, 06). The 1–5 scale is never a field. |
| **Account menu** | `components/ui/dropdown-menu` on the avatar | Specified in bundle 11. |

The prototype keeps mock state in localStorage (`as-mt`, `as-prop`, `as-assess-<role>`); the port persists to the account.

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/layout/header` | baseline.html (1), index.html (1) |
| `components/layout/main-layout` | baseline.html (1), index.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | baseline.html (1), index.html (1) |
| `components/layout/sidebar` | baseline.html (1), index.html (1) |
| `components/ui/avatar` | baseline.html (5), index.html (1) |
| `components/ui/badge` | baseline.html (20), index.html (54) |
| `components/ui/button` | baseline.html (13) |
| `components/ui/card` | baseline.html (4) |
| `components/ui/card (link)` | index.html (54) |
| `components/ui/dropdown-menu (account)` | baseline.html (1), index.html (1) |
| `components/ui/input` | baseline.html (1), index.html (1) |
| `components/ui/sheet` | baseline.html (1), index.html (1) |
| `NEW: paired-answer-bars` | baseline.html (2) |
| `NEW: party-card` | baseline.html (2) |
| `NEW: party-card (compact)` | baseline.html (2) |
| `NEW: stage-gauge (composes components/ui/circular-progress)` | baseline.html (3) |

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
10. **Card-free trial, decided placement.** Stage 4 is the account only. The trial choice sits on the Stage 5 send button, **Continue with 7 Days Free** (as in PR #1116); payment happens only after the relationship exists. (Open: PR #1116 anchors the trial at creation; the pass 10 copy says it starts when you send. See bundle 01.) When the 7 days end without a card, Stage 6 pauses read-only (nothing lost) and the Initiator gets one free 7-day extension, once.
11. **One status and one next action per state.** Banners confirm what just happened and never repeat the status.
12. **Layout.** QuizHub breakpoints, content capped at 1440 px (`max-w-content`), `data-qh` on prototype elements names the QuizHub source to reuse.


## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Every token in `css/tokens.css` exists in `app/globals.css` with the same value; `tailwind.config.ts` exposes every class `tw-config.js` defines.
- No hue in 340–10° above 25 % saturation in AlignSynch tokens except `scale-1`.
- Contrast: inks ≥ 4.5:1 on tints, marks ≥ 3:1.
- `patterns.html`: modal focus is trapped and returned; the toast is announced once; the kebab passes keyboard checks; axe 0 with each pattern open.
- Side-by-side screenshot of `baseline.html` against the same sheet rendered from the app (`reference/baseline-*`).
- `rg -n "animate-pulse" components/dashboard components/assessment-flow` → 0.

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

- Hex literals in components; reintroducing the removed calm `-fill` tokens; touching the QuizHub lane's values; changing `deep` in the brand record.

## Definition of done

Tokens and Tailwind classes land in one PR, the brand lint enforces no red, both brand lanes pass CI, and `baseline.html` reproduces from the app.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `baseline.html` · Baseline · AlignSynch v2.0 prototype

**Headings:** H1 “Tokens and Components” · H2 “Brand” · H2 “Party Tokens” · H2 “Gap Status” · H2 “Purpose Surfaces” · H2 “Status and Progress” · H2 “People” · H2 “Content” · H2 “Payment and Billing” · H2 “Type” · H2 “Buttons” · H2 “Badges and Chips” · H2 “Answer Scale” · H2 “Paired Answer Bars” · H2 “Stage Gauge” · H2 “Radius and Breakpoints” · H2 “Party Card”

**Buttons and actions:** “Continue as Draft” · “Default” · “Disabled” · “Extra Small” · “Ghost” · “Large” · “MR” · “Open Assessment” · “Remove Counterparty” · “Secondary” · “Small” · “View Align”

### `index.html` · Flow Map · AlignSynch v2.0 prototype

**Headings:** H1 “Flow Map” · H2 “0 · Visitor Conversion · Visitor, not signed in” · H2 “1 · Create and Invite · Marcus, Initiator” · H2 “1b · After Stage 5 · Marcus, Initiator” · H2 “1c · Still Editable · Marcus, Initiator” · H2 “2 · Join · Elena, Counterparty” · H2 “3 · Stage 6 Align · Both” · H2 “3b · Changing Locked Aspects · Both agree, no silent edits” · H2 “4 · Trial and Membership · Marcus pays, Elena never does” · H2 “App Surfaces · Pass 8–10” · H2 “Reference”

**Buttons and actions:** “MR”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Design system: tokens, component sheet, shared modal/toast/kebab, flow map** · prev [08-spec-design-page-payment-v2](../08-spec-design-page-payment-v2/README.md) · next [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › v2 design system — implementation brief · prev [v2 design system (handoff)](README.md) · next [v2 design system — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->
