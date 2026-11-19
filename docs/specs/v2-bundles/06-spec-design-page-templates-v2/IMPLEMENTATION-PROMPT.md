# AlignSynch Templates in-app v2: React / Tailwind CSS v3 implementation brief

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Templates in-app v2 — implementation brief · prev [Templates in-app v2 (handoff)](README.md) · next [Templates in-app v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Templates in-app (Library | My Templates tabs, template page, My Template detail, proposal)** · prev [05-spec-design-page-start-my-relationships-v2](../05-spec-design-page-start-my-relationships-v2/README.md) · next [07-spec-design-page-chat-v2](../07-spec-design-page-chat-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/06-spec-design-page-templates-v2/` · **Issue:** #1130 (+ #1133, #1134)  
**Source:** `v2-prototype` pass 10 plus the 2026-11-16 trial-start decision (DESIGN-NOTES v3.2 §45). QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0.  
**Priority:** P1  
**Issues:** [#1130](https://github.com/riolabs-ai/alignsynch/issues/1130) Templates v2 · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · public side [#1127](https://github.com/riolabs-ai/alignsynch/issues/1127) · built in pass 10: [#1133](https://github.com/riolabs-ai/alignsynch/issues/1133) Aspect drawer, [#1134](https://github.com/riolabs-ai/alignsynch/issues/1134) card menus and Save a Copy  
**Target:** one in-app Templates surface tabbed **Library | My Templates** (`/dashboard/templates?tab=library|mine`, proposed), the in-app template page, My Template detail and the Propose to Library form.

| Page | Prototype file |
| --- | --- |
| Templates tabs | `templates.html?tab=library|mine` |
| Template page (in-app) | `relationship-template.html` |
| My Template detail | `my-template-detail.html` |
| Propose to Library | `template-proposal.html` |
| Old routes (redirect stubs) | `library.html`, `my-templates.html` → the matching tab, keeping the query |

**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Templates surface from `06-spec-design-page-templates-v2/`: one dashboard page with Library and My Templates tabs (count pills, `?tab=` deep link), the in-app template page, the My Template detail page and the Propose to Library form. Use the HTML, `css/tokens.css`, `js/tw-config.js` and `reference/` as the reference. Old Library and My Templates routes redirect into the matching tab. Template data comes from the real records; the catalog card, filter and search components are shared with the public catalog (bundle 02). Destructive actions are neutral with an ×, and archive is the default over delete. Check at 390 and 1280 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Template records | `data/relationship-types.ts`, `data/assessments.ts`, template versions (`lib/db/template-versions.ts`) | Library = published templates; My Templates = the user's copies. |
| Nav | `data/nav-menu.json` | One "Templates" item replaces Library and My Templates. |
| Tabs | `components/ui/tabs` | Clicking a tab rewrites `?tab=` (not a hash). |
| Clone | `clonePublic` (#1134) | Save to My Templates / Save a Copy uses it (pending). |

## Page and interaction requirements

- **Library tab:** featured template on the status surface (View Template outline, Create Relationship primary); category filter with counts (All, Family, Couples, Friends, Work, Home); search; cards linking on their full surface with category, Aspect count and minutes chips; "Propose a Template".
- **My Templates tab:** saved copies with a "My Copy" chip, "Based on <template>", edited-count and used-in chips; actions Open and Create Relationship (→ wizard `from=my-template`); empty state (`&empty=1` in the prototype) with "Browse the Library", which switches tabs in place.
- **Template page (in-app):** eyebrow "Library Template", H1, purpose, fact chips; primary **Create Relationship** (→ wizard Stage 1 `from=template`), secondary Save to My Templates; What It Covers (3 tiles); The n Aspects with the locked scale preview and the Feel/Wish strip; Who It's For with "Not for crisis support…"; sticky aside: Create Relationship card, billing-surface trial summary (invitee never charged), status-surface How It Works; closing band. `?public=1` redirects to the public page (bundle 02).
- **My Template detail:** Create Relationship primary, Edit secondary; Aspects with scale preview and "Edited" chips, each pencil opening the shared Aspect drawer (Title, Prompt, 1 Means, 5 Means; scale locked) and Add an Aspect; aside About, Used In, "Share It With Others" (Propose to Library). **Retire band:** Archive is the default; **Delete Permanently** is enabled only for an unused copy (`?id=ev`, `reference/my-template-detail-unused-*`) behind the neutral confirm (`modal-delete-template-1280.png`); a used copy says "Used in 1 relationship, so it can only be archived."
- **Kebabs (pass 10):** My Templates cards → Edit, Duplicate, Archive. Archive has no confirm (reversible): an Undo toast, and the card moves to a collapsed "Archived" section with Restore. Library cards → Create Relationship, Save a Copy (`reference/kebab-library-1280.png`, `kebab-my-templates-1280.png`).
- **Save a Copy really copies:** the Library kebab and the template page hero write "<Name> · My Copy" to My Templates, toast with View, and the new card is highlighted in the My Templates tab with "Not Used Yet"; the tab count updates.
- **Propose to Library:** name, category, who it's for, optional note for reviewers, required consent ("Nothing personal…"); Submit for Review → "Sent for Review" status; aside lists exactly what is shared and never shared.

### States and query params

`?tab=library|mine` (keep) · `&filter=<category>` (keep) · `&empty=1` (prototype only) · `my-template-detail.html?id=<id>&edit=1` (Edit mode) · `from=my-template` into the wizard.

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/layout/header` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/layout/main-layout` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/layout/page-header` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/layout/sidebar` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/ui/avatar` | templates.html (1), relationship-template.html (1), my-template-detail.html (2), template-proposal.html (1) |
| `components/ui/badge` | templates.html (36), relationship-template.html (6), my-template-detail.html (4), template-proposal.html (2) |
| `components/ui/button` | templates.html (12), relationship-template.html (4), my-template-detail.html (11), template-proposal.html (3) |
| `components/ui/card` | relationship-template.html (2), my-template-detail.html (1) |
| `components/ui/card (Aspects preview)` | relationship-template.html (1) |
| `components/ui/card (my template)` | templates.html (3) |
| `components/ui/card (template)` | templates.html (8) |
| `components/ui/collapsible` | templates.html (1) |
| `components/ui/dropdown-menu` | templates.html (11) |
| `components/ui/dropdown-menu (account)` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/ui/empty-state` | templates.html (1) |
| `components/ui/form` | template-proposal.html (1) |
| `components/ui/input` | templates.html (2), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/ui/input + label` | template-proposal.html (1) |
| `components/ui/sheet` | templates.html (1), relationship-template.html (1), my-template-detail.html (1), template-proposal.html (1) |
| `components/ui/tabs TabsContent` | templates.html (2) |
| `components/ui/tabs TabsList` | templates.html (1) |
| `components/ui/textarea + label` | template-proposal.html (2) |
| `components/ui/toggle-group` | templates.html (1) |
| `NEW: Aspect drawer (My Template)` | my-template-detail.html (1) |
| `NEW: paired-answer-bars (scale only)` | relationship-template.html (5), my-template-detail.html (5) |
| `NEW: payment-panel (summary)` | relationship-template.html (1) |
| `NEW: retire band` | my-template-detail.html (1) |

## Copy strings (exact)

"Templates" · "Library" · "My Templates" · "Propose a Template" · "View Template" · "Create Relationship" · "Save to My Templates" · "My Copy" · "Browse the Library" · "Library Template" · "What It Covers" · "Who It’s For" · "Share It With Others" · "Submit for Review" · "Sent for Review" · "Archive Template".

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

`TemplatesPage` (`Tabs`) → `LibraryTab` (`FeaturedTemplate`, `CategoryFilter`, `TemplateSearch`, `TemplateCard`), `MyTemplatesTab` (`MyTemplateCard`, `EmptyState`) · `TemplateBody` (shared with the public page) · `MyTemplateDetail` · `TemplateProposalForm`.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Compare with `reference/templates*`, `relationship-template-*`, `my-template-detail*`, `template-proposal*`. No overflow at 390/1280.
- Old Library and My Templates URLs land on the matching tab with the query kept.

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

- Separate Library and My Templates nav items; red delete buttons; hard delete of a template used in a relationship; silent edits to a template already used by a live relationship.

## Included from pass 10

Aspect drawer and Edit mode (`?edit=1` focuses the first pencil), kebabs, Duplicate, Archive with Undo and Restore, Delete Permanently for unused copies only, and Save a Copy (DESIGN-NOTES §35–37). Prototype mock state lives in localStorage (`as-mt`); the port saves to the user's account.

## Definition of done

One tabbed Templates surface with real data and redirects from the old routes, template page and My Template detail and proposal match the reference, archive over delete, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `templates.html` · Templates · AlignSynch v2.0 prototype

**Prototype review states:** ?tab=library → `templates.html?tab=library` · ?tab=mine → `templates.html?tab=mine` · My Templates Empty → `templates.html?tab=mine&empty=1`

**Headings:** H1 “Templates” · H2 “Brother–Sister” · H3 “Brother–Sister” · H3 “Partners” · H3 “Parent and Adult Child” · H3 “Co-Founders” · H3 “Manager and Report” · H3 “Best Friends” · H3 “Roommates” · H3 “Siblings · Event” · H2 “Nothing Matches” · H3 “Brother–Sister · Our Version” · H3 “Weekend Load” · H3 “Family Event Planning” · H2 “No Templates Yet”

**Buttons and actions:** “All 8” · “Archive” · “Browse the Library” · “Couples 1” · “Create Relationship” · “Duplicate” · “Family 3” · “Friends 1” · “Home 2” · “Library 8” · “MR” · “My Templates 3” · “Propose a Template” · “Restore” · “Save a Copy” · “Show All” · “View Template” · “Work 2”

### `relationship-template.html` · Brother–Sister Template · AlignSynch v2.0 prototype

**Headings:** H1 “Brother–Sister” · H2 “What It Covers” · H3 “How You Stay in Touch” · H3 “Old Roles” · H3 “Family Decisions” · H2 “The 5 Aspects” · H3 “Contact Frequency” · H3 “Old Roles” · H3 “Showing Up” · H3 “Parent Decisions” · H3 “Feeling Respected” · H2 “Who It’s For” · H2 “Start With Your Sibling” · H2 “7-Day Free Trial” · H2 “How It Works”

**Buttons and actions:** “Create Relationship” · “MR” · “Save to My Templates”

### `my-template-detail.html` · Brother–Sister · Our Version · AlignSynch v2.0 prototype

**Prototype review states:** In Use (Archive Only) → `my-template-detail.html?id=bs` · Unused (Can Delete) → `my-template-detail.html?id=ev`

**Headings:** H1 “Brother–Sister · Our Version” · H2 “Aspects” · H3 “Contact Frequency” · H3 “Old Roles Edited” · H3 “Showing Up” · H3 “Parent Decisions Edited” · H3 “Feeling Respected” · H2 “About” · H2 “Used In” · H2 “Share It With Others” · H2 “Retire This Template”

**Buttons and actions:** “Add an Aspect” · “Archive” · “Create Relationship” · “Delete Permanently” · “Edit” · “Edit Aspects” · “MR” · “Propose to Library”

### `template-proposal.html` · Propose a Template · AlignSynch v2.0 prototype

**Headings:** H1 “Propose a Template” · H2 “What Gets Shared”

**Buttons and actions:** “Back to My Template” · “Cancel” · “MR” · “Submit for Review”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Templates in-app (Library | My Templates tabs, template page, My Template detail, proposal)** · prev [05-spec-design-page-start-my-relationships-v2](../05-spec-design-page-start-my-relationships-v2/README.md) · next [07-spec-design-page-chat-v2](../07-spec-design-page-chat-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Templates in-app v2 — implementation brief · prev [Templates in-app v2 (handoff)](README.md) · next [Templates in-app v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->
