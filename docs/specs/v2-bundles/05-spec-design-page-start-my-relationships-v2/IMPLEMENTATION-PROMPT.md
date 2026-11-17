# AlignSynch Start and My Relationships v2: React / Tailwind CSS v3 implementation brief

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Start and My Relationships v2 — implementation brief · prev [Start and My Relationships v2 (handoff)](README.md) · next [Start and My Relationships v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Start and My Relationships** · prev [04-spec-design-page-align-v2](../04-spec-design-page-align-v2/README.md) · next [06-spec-design-page-templates-v2](../06-spec-design-page-templates-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/05-spec-design-page-start-my-relationships-v2/` · **Issue:** #1129 (+ #1134, #1135)  
**Source:** `v2-prototype` pass 10 plus the 2026-11-16 trial-start decision (DESIGN-NOTES v3.2 §45). QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0.  
**Priority:** P1  
**Issues:** [#1129](https://github.com/riolabs-ai/alignsynch/issues/1129) app shell v2 with Start and My Relationships · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · tokens [#1120](https://github.com/riolabs-ai/alignsynch/issues/1120) · built in pass 10: [#1134](https://github.com/riolabs-ai/alignsynch/issues/1134) card menus, [#1135](https://github.com/riolabs-ai/alignsynch/issues/1135) leave/abandon, [#1136](https://github.com/riolabs-ai/alignsynch/issues/1136) account menu (bundle 11)  
**Target:** the signed-in landing (Start, the dashboard home) and the relationship list (`/dashboard/relationships`), plus the v2 app shell they share.  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Start page and My Relationships list from `05-spec-design-page-start-my-relationships-v2/` in the existing Next.js app, together with the v2 app shell they share. Use `start.html`, `my-relationships.html`, `css/tokens.css`, `js/tw-config.js` and `reference/` as the reference. The rail reads Start · My Relationships · Templates · Chat · Payment (Library and My Templates merged into Templates). Each relationship card shows one status chip, one next line and one action; the vivid mini summary bar appears only when results exist. Start leads with the computed Next Step. Use the existing shell components (`main-layout`, `sidebar`), real relationship records and the copy layer. Check at 390, 1280 and 1920 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| App shell | `components/layout/main-layout.tsx`, `sidebar.tsx`, `data/nav-menu.json` | Rail order Start · My Relationships · Templates · Chat · Payment; full sidebar from `xl`, icon rail `md`–`xl`; 1440 cap. The admin-only Permissions row after Docs is #1126. |
| Relationship list | `components/dashboard/*`, relationship records | Status derived per relationship (Live, Waiting on Invite, Draft, Paused). |
| Next Step | shared `next_step()` | Widest Gap → Wish beats Feel → Aspect order. |

## Page and interaction requirements

### Start

- H1 "Welcome Back, Marcus".
- **Your Next Steps:** first row is the computed Next Step on solid graphite (e.g. "Talk About Parent Decisions"); then up to two small jobs in outline (add a card for the paused relationship (Initiator only), finish the draft).
- Two active relationship cards and four template cards; each section has a View All link (→ My Relationships, → Templates).

### My Relationships

- Cards (Elena, Tomás, Dana, Priya in the fixture): one status chip (Stage 6 Live · Waiting on Invite · Draft · Paused), the vivid mini summary bar only with results (a paused one keeps its bar labelled "Aligned · Read-Only"), otherwise the dashed "Results appear once you both answer."; one next line and one action (Draft and Paused solid, others outline).
- Status filter toggle-group with counts and a search; filter empty state "Nothing Matches" + Show All; no-relationships empty state leads to the Library; `?filter=paused` deep-links a filter (keep in the app).

- **Card kebab by status** (`reference/kebab-relationship-1280.png`): Live → Open, Leave · Invited → Open, Copy Invite Link, Resend Invite, Cancel Invite · Draft → Open, Continue Setup, Abandon Draft · Paused → Open, Add a Card (Initiator), Leave. Destructive items use the shared neutral confirm; results confirm with the toast (`?notice=abandoned` arrival in the prototype).
- The header avatar opens the account menu (bundle 11).

### States and query params

`my-relationships.html?empty=1` (prototype only) · `?filter=live|waiting|draft|paused` (keep).

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/layout/header` | start.html (1), my-relationships.html (1) |
| `components/layout/main-layout` | start.html (1), my-relationships.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | start.html (1), my-relationships.html (1) |
| `components/layout/page-header` | start.html (1), my-relationships.html (1) |
| `components/layout/sidebar` | start.html (1), my-relationships.html (1) |
| `components/ui/avatar` | start.html (2), my-relationships.html (2) |
| `components/ui/badge` | start.html (15), my-relationships.html (4) |
| `components/ui/button` | start.html (8), my-relationships.html (8) |
| `components/ui/card (next steps)` | start.html (1) |
| `components/ui/card (relationship)` | start.html (2), my-relationships.html (4) |
| `components/ui/card (template)` | start.html (4) |
| `components/ui/dropdown-menu` | start.html (2), my-relationships.html (4) |
| `components/ui/dropdown-menu (account)` | start.html (1), my-relationships.html (1) |
| `components/ui/empty-state` | my-relationships.html (1) |
| `components/ui/input` | start.html (1), my-relationships.html (2) |
| `components/ui/sheet` | start.html (1), my-relationships.html (1) |
| `components/ui/toggle-group` | my-relationships.html (1) |
| `NEW: status summary (mini)` | start.html (1), my-relationships.html (2) |

## Copy strings (exact)

"Welcome Back, Marcus" · "Your Next Steps" · "View All" · "My Relationships" · "Stage 6 Live" · "Waiting on Invite" · "Draft" · "Paused" · "Aligned · Read-Only" · "Results appear once you both answer." · "Nothing Matches" · "Show All".

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

`StartPage` → `NextStepsList`, `RelationshipCard` (shared), `TemplateCard` (shared with bundle 06) · `MyRelationshipsPage` → `StatusFilter`, `RelationshipSearch`, `RelationshipCard` (`StatusChip`, `StatusMiniBar`), `EmptyState`.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Compare with `reference/start-*`, `my-relationships*` (390 / 1280). No overflow.
- The paused-card "add a card" job never renders for a Counterparty.

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

- Two statuses or two primary actions per card; red; a delete action on a relationship (archive/leave instead).

## Included from pass 10

Relationship card kebabs, Abandon Draft, Leave and Cancel Invite from the card, and the header account menu (DESIGN-NOTES §36, §42, §43).

## Definition of done

Start and My Relationships match the reference in the v2 shell with real data, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `start.html` · Start · AlignSynch v2.0 prototype

**Headings:** H1 “Welcome Back, Marcus” · H2 “Your Next Steps” · H2 “Active Relationships” · H3 “Staying Close Through Busy Seasons” · H3 “Planning Dad’s 70th” · H2 “Browse Templates” · H3 “Brother–Sister” · H3 “Partners” · H3 “Parent and Adult Child” · H3 “Co-Founders”

**Buttons and actions:** “Add a Card” · “Cancel Invite” · “Continue Setup” · “Copy Invite Link” · “Create Relationship” · “Leave Relationship” · “MR” · “Open” · “Open Align” · “Open Library” · “Resend Invite” · “View All”

### `my-relationships.html` · My Relationships · AlignSynch v2.0 prototype

**Prototype review states:** With Relationships → `my-relationships.html` · Empty State → `?empty=1`

**Headings:** H1 “My Relationships” · H3 “Staying Close Through Busy Seasons” · H3 “Planning Dad’s 70th” · H3 “Sharing the Weekend Load” · H3 “Back on Track as Co-Founders” · H2 “Nothing Matches” · H2 “No Relationships Yet”

**Buttons and actions:** “Abandon Draft” · “Add a Card” · “All 4” · “Browse Templates” · “Cancel Invite” · “Continue Setup” · “Copy Invite Link” · “Create Relationship” · “Drafts 1” · “Leave Relationship” · “Live 1” · “MR” · “Open” · “Paused 1” · “Resend Invite” · “Show All” · “Start From Brother–Sister” · “Waiting 1”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Start and My Relationships** · prev [04-spec-design-page-align-v2](../04-spec-design-page-align-v2/README.md) · next [06-spec-design-page-templates-v2](../06-spec-design-page-templates-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Start and My Relationships v2 — implementation brief · prev [Start and My Relationships v2 (handoff)](README.md) · next [Start and My Relationships v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->
