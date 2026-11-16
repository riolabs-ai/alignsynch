# AlignSynch Chat v2: React / Tailwind CSS v3 implementation brief

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Chat** · prev [06-spec-design-page-templates-v2](../06-spec-design-page-templates-v2/README.md) · next [08-spec-design-page-payment-v2](../08-spec-design-page-payment-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/07-spec-design-page-chat-v2/` · **Issue:** #1131  
**Source:** `v2-prototype` pass 10 (final, QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0).  
**Priority:** P2  
**Issues:** [#1131](https://github.com/riolabs-ai/alignsynch/issues/1131) Chat v2 · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · trial pause [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121)  
**Target:** `/dashboard/chat` and `/dashboard/chat?relationship=<id>` (proposed; confirm in `lib/flow/paths.ts`).  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Chat from `07-spec-design-page-chat-v2/`: a conversation list and one thread per relationship, with party-tinted bubbles and Aspect-tagged messages that carry their Align status chip. Use `chat.html` (and `?relationship=busy|dad70|cofound`), `css/tokens.css`, `js/tw-config.js` and `reference/` as the reference. Waiting-to-join threads say when chat opens; paused threads are read-only. Check at 390 and 1280 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Messages | Discussion/comments model (#921) | Chat and the Relationship Detail Discussion tab read the same thread. |
| Status chips | shared `StatusChip` | A tagged message shows the Aspect chip plus its current status (Soft/Full aware). |

## Page and interaction requirements

- **General view:** conversation list (unread counts, a Paused chip) plus "Pick a Conversation".
- **Thread:** below `lg` the list hides and a Back chevron returns to it. Bubbles: clay tint for You, slate-teal tint for the other person. A message can carry an Aspect chip plus its status chip.
- **Composer:** "Tag:" Aspect chips (toggle, `aria-pressed`), textarea, send icon button (with an accessible name).
- **Waiting thread:** "Chat Opens When Tomás Joins".
- **Paused thread:** read-only. Initiator: one action, **Add a Card**. Counterparty: no payment wording ("Paused · Waiting on Marcus").

### States and query params

`?relationship=<id>` (keep).

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/chat/composer` | chat.html (1) |
| `components/chat/conversation-list` | chat.html (1) |
| `components/chat/thread` | chat.html (3) |
| `components/layout/header` | chat.html (1) |
| `components/layout/main-layout` | chat.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | chat.html (1) |
| `components/layout/sidebar` | chat.html (1) |
| `components/ui/avatar` | chat.html (7) |
| `components/ui/badge` | chat.html (8) |
| `components/ui/button` | chat.html (5) |
| `components/ui/dropdown-menu (account)` | chat.html (1) |
| `components/ui/input` | chat.html (1) |
| `components/ui/sheet` | chat.html (1) |

## Copy strings (exact)

"Chat" · "Pick a Conversation" · "Tag:" · "Chat Opens When Tomás Joins" · "Read-only while Stage 6 is paused." · "Add a Card" (Initiator only).

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


## Suggested React component boundaries

`ChatPage` → `ConversationList`, `ChatThread` (`MessageBubble`, `AspectTag`), `ChatComposer` (`AspectTagToggle`).

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Compare with `reference/chat*`. No overflow at 390/1280; the list/thread swap works below `lg`.
- Counterparty no-leak on the paused thread.

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

- Show payment wording to the Counterparty; allow sending while paused; colour-only Aspect status.

## Definition of done

Chat matches the reference with real threads, paused and waiting states behave as above, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `chat.html` · Chat · AlignSynch v2.0 prototype

**Prototype review states:** All Conversations → `chat.html` · ?relationship=busy → `chat.html?relationship=busy` · ?relationship=dad70 → `chat.html?relationship=dad70` · ?relationship=cofound → `chat.html?relationship=cofound`

**Headings:** H1 “Chat” · H2 “Conversations” · H2 “Pick a Conversation” · H2 “Staying Close Through Busy Seasons” · H2 “Planning Dad’s 70th” · H3 “Chat Opens When Tomás Joins” · H2 “Back on Track as Co-Founders”

**Buttons and actions:** “Add a Card” · “Contact Frequency” · “Feeling Respected” · “MR” · “Old Roles” · “Open” · “Parent Decisions” · “Showing Up”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Chat** · prev [06-spec-design-page-templates-v2](../06-spec-design-page-templates-v2/README.md) · next [08-spec-design-page-payment-v2](../08-spec-design-page-payment-v2/README.md)

<!-- bundle-nav:end -->
