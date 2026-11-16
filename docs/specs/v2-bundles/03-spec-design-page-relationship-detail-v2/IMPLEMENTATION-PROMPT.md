# AlignSynch Relationship Detail v2: React / Tailwind CSS v3 implementation brief

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Relationship Detail (every state, both roles)** · prev [02-spec-design-page-onboarding-v2](../02-spec-design-page-onboarding-v2/README.md) · next [04-spec-design-page-align-v2](../04-spec-design-page-align-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/` · **Issue:** #1124 (+ #1121, #1133, #1135)  
**Source:** `v2-prototype` pass 10 (final, QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0).  
**Priority:** P1 (where completion lands and where both people live after acceptance)  
**Issues:** [#1124](https://github.com/riolabs-ai/alignsynch/issues/1124) Relationship Detail v2 · [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121) trial-ended states · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · tokens [#1120](https://github.com/riolabs-ai/alignsynch/issues/1120) · trial data [#1115](https://github.com/riolabs-ai/alignsynch/issues/1115) · CRUD (built in pass 10): [#1133](https://github.com/riolabs-ai/alignsynch/issues/1133) proposed changes, [#1134](https://github.com/riolabs-ai/alignsynch/issues/1134) Counterparty fork, [#1135](https://github.com/riolabs-ai/alignsynch/issues/1135) invitation hygiene and leave  
**Target:** `/dashboard/relationships/[id]`, every state for both roles.  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Relationship Detail from `03-spec-design-page-relationship-detail-v2/` in the existing Next.js app. Use `relationship-detail.html` with its state and role links, `css/tokens.css`, `js/tw-config.js` and the 42 renders in `reference/` as the visual and interaction reference.
>
> The port is "add a tab layer": keep `RecordDetailShell` and its region order (back, band, aside, children) unchanged and wrap the existing detail sections in `components/ui/tabs` (Discussion · Aspects · Members · Details · Settings · Payment, hash-addressable). Each state shows exactly one status line and one Next Step action; banners only confirm what just happened. Derive the state from the relationship, member and subscription rows (`trial_ends_at`, `trial_extended_at`, `card_on_file`), never from a query string. The Counterparty never sees a price, the word trial, a card ask or an extension. Destructive actions are neutral outline buttons with an ×. Check every state for both roles at 390, 1280 and 1920 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Shell | `components/assessment-flow/record-detail-shell.tsx` | Unchanged; the tabs go inside its children. Light band variant is open (see Decisions). |
| Detail sections | `components/dashboard/relationship-detail.tsx` (`DetailSection`, `DetailFacts`) | Wrap sections in `Tabs`; At a Glance = `DetailFacts`. |
| Trial state | `lib/billing/trial.ts` `trialStateOf()` (PR #1116), #1115 | `none | active | ending | lapsed`; paused = lapsed with no card. Extension availability = `trial_extended_at` is null. |
| Next Step | `src/domain.py next_step()` in the prototype | Widest Gap first; tie → Wish beats Feel → template Aspect order. Port as a pure function with a unit test. |
| Layout | `components/layout/main-layout.tsx`, `sidebar.tsx` | 1440 cap; full sidebar from `xl`, icon rail `md`–`xl`. |
| Comments | #921 | The Discussion model is out of scope; draw it with the existing data. |

## Page and interaction requirements

### Structure

- **Hero (light band):** 4 px graphite→deep→cyan identity rule, eyebrow with icon, H1 (relationship title), one-line purpose, **The Two of You** party cards (`NEW: party-card`, "(You)" marks the viewer), **Your Shared Goal**.
- **Aside, "Where You Are":** stage gauge (`NEW: stage-gauge`, live variant), badge (icon + word), one status line, the graphite Next Step block with one action. Initiator-only trial pill under the status line ("Trial · 3 Days Left" / "Extra Week · 7 Days Left", links to `#payment`). Then **At a Glance** (`DetailFacts`) with the vivid mini status bar and legend "● 1 In Synch · ● 2 Small Gap · ● 2 Gap".
- **Tabs:** Discussion (thread, Aspect-linked comments, composer) · Aspects (answer rows with `NEW: paired-answer-bars` and vivid outlines) · Members (party rows, role actions, Invitation History scroll region with `tabindex=0 role=region`) · Details (facts and Timeline) · Settings (Mode, Alignment Tolerance; "Changes apply from the next round.") · Payment (`NEW: payment-panel`).

### States (one status, one action)

| State | Initiator Next Step | Counterparty Next Step |
| --- | --- | --- |
| Draft | Finish and send the invite | n/a |
| Invite Sent | "Waiting on Elena to Join" · Copy Invite Link | n/a |
| Both Joined (Live) | Start Assessment | Start Your First Assessment |
| Waiting (one answered) | role-specific waiting copy | role-specific waiting copy |
| Live with results | computed, e.g. "Talk About Parent Decisions" | same computation |
| Paused · trial ended | **Your Trial Ended** · "Add a card or get 7 more days free. Either one resumes Stage 6 right away." · **Add a Card** + **Get 7 More Days Free** | **Waiting on Marcus** · "Nothing to do. You can still read your results." · **See Your Results** |
| Paused · extra week ended | **Your Extra Week Ended** · **Add a Card** only | same as above |

Paused badge: Initiator "Paused"; Counterparty "Paused · Waiting on Marcus" (grey `line`/`muted-foreground`, pause icon). Status lines: "Stage 6 is paused. Your results and Discussion are saved and read-only." / "Stage 6 is paused until Marcus resumes it. Everything is saved." While paused: composer replaced by "Read-only while Stage 6 is paused."; Like, Reply, Settings inputs and Save Settings disabled; Members actions stay.

Payment tab: Initiator sees Status, Trial Ends / Extra Week, "1 Free Week Available" or "Used Nov 19–26", "After You Resume $9.99 / month", Card, Billing Owner and the actions. Counterparty sees only "Marcus covers this relationship. You’re never charged." Timeline for the Counterparty shows "Stage 6 Paused" only.

### Arrival banners (one line, dismissible)

- `?from=wizard` "Relationship Created" (+ trial end date) · `?from=wizard&draft=1` "Saved as Draft" · `?from=join` "You’ve Joined. Marcus has been told you’re in." (+ "Your suggestion was sent to him.") · `?from=extend` "7 More Days Added · Stage 6 is running again. Your extra week ends Nov 26." Dismissing removes `from` and keeps the state.

### Pass 10 actions (CRUD)

- **Still Editable (draft and invited, Initiator):** panel with Edit Details, Edit Settings, Edit Aspects → wizard edit mode (`?stage=1|2|3&edit=draft|invited`), back with a saved toast (`reference/rd-invited-details-*`).
- **Live Aspects are locked:** "Aspects are locked while Stage 6 is live. Any change needs you both to agree." **Propose a Change** opens the neutral modal (Reword · Turn Off · Add, Aspect, new wording). Proposer sees "Waiting on <Other>" with **Withdraw**; the other party sees "<Name> Proposes a Change" with **Decline** / **Accept** (Turn Off carries a warning). Accepted: "Change Agreed · applies from Round 2" (Round 1 answers are never rewritten). Declined: "Nothing changed". Disabled while paused. (`reference/modal-propose-1280.png`, `proposal-incoming-1280.png`, `rd-live-aspects*`.)
- **Counterparty fork:** on the live Aspects tab the Counterparty gets "Save These Aspects as a My Template" (saved to their own account).
- **Invitation hygiene (Members, invited):** Copy Invite Link (clipboard + toast), Resend Invite (adds an "Invite Resent" history row), **Cancel Invite** (graphite × confirm: "The link stops working… Your draft stays and you can invite again.") → back to **Draft** (`reference/modal-cancel-invite-*`, `rd-draft-members-*`).
- **Leave or close, never delete:** no "Delete Relationship" anywhere. **Abandon Draft** only for drafts (nobody invited). **Leave Relationship** for both roles: Stage 6 closes for both, answers and Discussion stay readable, "Relationship Closed" banner, controls disabled; replaces "Remove Counterparty". **Request My Removal** (Counterparty, ghost): name and answers removed within 30 days, then the relationship closes; optional reason Marcus never sees (`reference/rd-live-members-counterparty-*`).
- Every Start Assessment button opens the assessment (bundle 10).

### Role rules

- Counterparty: Request My Removal, Suggest a Change / Propose a Change, Save These Aspects as a My Template, payment note only.
- Destructive (Cancel Invite, Abandon Draft, Leave Relationship, Request My Removal): neutral outline + ×, the shared neutral confirm, never red.

### States and query params (prototype)

`?state=draft|invited|joined|waiting|live|trial-ended|trial-ended-extended`, `&role=initiator|counterparty`, `&ext=1`, `&from=wizard|join|extend`, `&draft=1`, `&suggested=1`, hashes `#discussion #aspects #members #details #settings #payment`. In the app only the `from` arrivals and the tab hashes remain; everything else is derived.

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `DetailFacts (facts slot)` | relationship-detail.html (1) |
| `RecordDetailShell aside (facts + actions)` | relationship-detail.html (1) |
| `RecordDetailShell back` | relationship-detail.html (1) |
| `RecordDetailShell children` | relationship-detail.html (1) |
| `RecordDetailShell grid: lg:grid-cols-[320px_minmax(0,1fr)]` | relationship-detail.html (1) |
| `components/assessment-flow/aspect-list (adapted)` | relationship-detail.html (1) |
| `components/assessment-flow/record-detail-shell DetailBand (tone: identity)` | relationship-detail.html (1) |
| `components/layout/header` | relationship-detail.html (1) |
| `components/layout/main-layout` | relationship-detail.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | relationship-detail.html (1) |
| `components/layout/sidebar` | relationship-detail.html (1) |
| `components/quiz/comment` | relationship-detail.html (3) |
| `components/ui/alert (tone: success)` | relationship-detail.html (1) |
| `components/ui/avatar` | relationship-detail.html (8) |
| `components/ui/badge` | relationship-detail.html (42) |
| `components/ui/badge (tone: billing, link)` | relationship-detail.html (2) |
| `components/ui/button` | relationship-detail.html (38) |
| `components/ui/button (variant: ghost on action)` | relationship-detail.html (1) |
| `components/ui/button (variant: outline on action)` | relationship-detail.html (14) |
| `components/ui/card` | relationship-detail.html (8) |
| `components/ui/card (tone: action) · Next Step` | relationship-detail.html (14) |
| `components/ui/dropdown-menu (account)` | relationship-detail.html (1) |
| `components/ui/input` | relationship-detail.html (1) |
| `components/ui/radio-group (card)` | relationship-detail.html (4) |
| `components/ui/select` | relationship-detail.html (2) |
| `components/ui/sheet` | relationship-detail.html (1) |
| `components/ui/table` | relationship-detail.html (3) |
| `components/ui/tabs TabsContent` | relationship-detail.html (6) |
| `components/ui/tabs TabsList` | relationship-detail.html (1) |
| `components/ui/textarea` | relationship-detail.html (1) |
| `components/ui/toggle-group` | relationship-detail.html (1) |
| `NEW: Aspect lock + Propose a Change` | relationship-detail.html (1) |
| `NEW: edit setup (draft / invited)` | relationship-detail.html (2) |
| `NEW: paired-answer-bars` | relationship-detail.html (10) |
| `NEW: party-card` | relationship-detail.html (2) |
| `NEW: party-card (compact)` | relationship-detail.html (2) |
| `NEW: payment-panel` | relationship-detail.html (1) |
| `NEW: stage-gauge (composes components/ui/circular-progress)` | relationship-detail.html (5) |
| `NEW: stage-gauge + components/ui/card (status → action)` | relationship-detail.html (1) |
| `NEW: tab layer inside children` | relationship-detail.html (1) |

## Copy strings (exact)

Use the strings in the state table above, plus: tab labels "Discussion" "Aspects" "Members" "Details" "Settings" "Payment" · "Where You Are" · "At a Glance" · "The Two of You" · "Your Shared Goal" · "Read-only while Stage 6 is paused." · "Changes apply from the next round." · badge "Live" (never "Ongoing").

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


## Decisions

- **Open (DESIGN-NOTES §12 Q1):** light `DetailBand` variant (prototype) vs keep the dark band and move party cards into the children.
- **Decided (epic D-D):** no shadow on `Card` (AGENTS.md C1); the prototype's `shadow-sm` is not ported.
- **Decided:** Align is Stage 6 and goes live when the Counterparty accepts.

## Suggested React component boundaries

`RelationshipDetail` (existing) → `RelationshipHero` (`PartyCard` ×2, `SharedGoal`) · `WhereYouAre` (`StageGauge`, `StatusLine`, `NextStepCard`, `TrialPill`) · `AtAGlance` (`StatusMiniBar`) · `RelationshipTabs` → `DiscussionTab`, `AspectsTab` (`PairedAnswerBars`), `MembersTab`, `DetailsTab` (`Timeline`), `SettingsTab`, `PaymentTab` (`PaymentPanel`) · `ArrivalBanner`.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

### Visual and responsive

- Compare each state and role with `reference/rd-*` (390 / 1280; 1920 for `rd-live` and `rd-trial-ended-initiator`). No overflow at 360–1920.

### Accessibility and behaviour

- Keyboard traversal and visible focus on every control; skip link to `#main`; one `h1` per page and an ordered heading outline.
- Tabs use `role=tablist/tab/tabpanel` with arrow-key movement; switches and toggle groups expose `aria-checked`/`aria-pressed`; the current stage/step carries `aria-current="step"`.
- Status is never colour-only: icon + word on every chip, bar and legend.
- Contrast: inks ≥ 4.5:1 on their tints, UI marks ≥ 3:1 (values in `css/tokens.css` were checked; re-check with the app's real variables).
- Touch targets ≥ 44 px on mobile; reduced-motion disables smooth scroll and transitions.
- axe-core (wcag2a + wcag2aa): 0 violations on every state (the prototype passes at 390 and 1280).


### Flow

- Each of the five states plus paused renders exactly one status line and one Next Step action for both roles (port of `src/qa/check4.js`).
- Get 7 More Days Free resumes Stage 6 and is never offered again; Add a Card resumes Stage 6 in both views (port of `src/qa/flow5.js`).
- Counterparty no-leak test: no `$`, "trial", "card", "extension", "price" on any Counterparty render.

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

- Must not change `record-detail-shell.tsx`'s region order, show two statuses or two primary actions in one state, or read state from a query string.
- Must not delete or close a relationship or its answers when a trial lapses; must not allow a second extension.
- Must not silently edit a live Aspect (proposed change only, #1133), rewrite Round 1 answers when a change is agreed, or offer Delete Relationship.
- Must not port the repo's silent Aspect-edit function (named in #1133) to live relationships.
- No "Ongoing", no red, no pulse.

## Included from pass 10

DESIGN-NOTES §37–42: Still Editable, propose/accept on locked Aspects, the Counterparty fork, invitation hygiene and leave/close. The shared modal and toast are specified in bundle 09 (`patterns.html`).

## Definition of done

Every state and role matches the reference, the tab layer sits inside the unchanged shell, trial/pause behaviour follows #1121, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `relationship-detail.html` · Relationship Detail · AlignSynch v2.0 prototype

**Prototype review states:** Draft → `?state=draft` · Invite Sent → `?state=invited` · Both Joined → `?state=joined` · Waiting for Elena → `?state=waiting` · Results In → `?state=live` · Trial Ended → `?state=trial-ended` · Extra Week Ended → `?state=trial-ended-extended`

**Headings:** H1 “Staying Close Through Busy Seasons” · H2 “Where You Are” · H2 “Send the Invitation” · H2 “Send the Invitation” · H2 “Share the Invite Link” · H2 “Share the Invite Link” · H2 “Start Your First Assessment” · H2 “Start Your First Assessment” · H2 “Waiting for Elena” · H2 “Start Your First Assessment” · H2 “Talk About Parent Decisions” · H2 “Talk About Parent Decisions” · H2 “Your Trial Ended” · H2 “Waiting on Marcus” · H2 “Your Extra Week Ended” · H2 “Waiting on Marcus” · H2 “At a Glance” · H2 “Relationship Discussion” · H2 “Aspects · Round 1” · H3 “Contact Frequency” · H3 “Old Roles” · H3 “Showing Up” · H3 “Parent Decisions” · H3 “Feeling Respected” · H3 “Contact Frequency” · H3 “Old Roles” · H3 “Showing Up” · H3 “Parent Decisions” · H3 “Feeling Respected” · H2 “Member Actions” · H2 “Invitation History” · H2 “Still Editable” · H2 “Still Editable” · H2 “Relationship Information” · H2 “Timeline” · H2 “Assessment Settings” · H2 “Relationship Membership”

**Buttons and actions:** “1” · “2” · “Abandon Draft” · “Add a Card” · “Aspects 5” · “Cancel Invite” · “Cancel Trial” · “Copy Invite Link” · “Details” · “Discussion 3” · “Edit Aspects” · “Edit Details” · “Edit Settings” · “Elena” · “Get 7 More Days Free” · “Leave Relationship” · “MR” · “Marcus” · “Members 2 1” · “Message Elena” · “Message Marcus” · “Open Align” · “Payment” · “Post Comment” · “Propose a Change” · “Reply” · “Request My Removal” · “Resend Invite” · “Save Settings” · “Save These Aspects as a My Template” · “See Your Results” · “See the Gap” · “Send Invitation” · “Send a Reminder” · “Settings” · “Start Assessment” · “Suggest a Change”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Relationship Detail (every state, both roles)** · prev [02-spec-design-page-onboarding-v2](../02-spec-design-page-onboarding-v2/README.md) · next [04-spec-design-page-align-v2](../04-spec-design-page-align-v2/README.md)

<!-- bundle-nav:end -->
