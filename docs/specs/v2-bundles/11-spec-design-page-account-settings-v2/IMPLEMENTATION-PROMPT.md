# AlignSynch Account menu and Account Settings v2: React / Tailwind CSS v3 implementation brief

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Account menu and Settings v2 — implementation brief · prev [Account menu and Settings v2 (handoff)](README.md) · next [Account menu and Settings v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Account menu and Account Settings** · prev [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md) · next none

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/11-spec-design-page-account-settings-v2/` · **Issue:** #1136  
**Source:** `v2-prototype` pass 10 (final, QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0).  
**Priority:** P1  
**Issues:** [#1136](https://github.com/riolabs-ai/alignsynch/issues/1136) account menu and `/settings` · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · shell [#1129](https://github.com/riolabs-ai/alignsynch/issues/1129)  
**Target:** the header avatar menu on every signed-in page, and `/settings` (existing route, v2 visuals).  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 account menu and Account Settings page from `11-spec-design-page-account-settings-v2/`. Use `settings.html`, `css/tokens.css`, `js/tw-config.js`, `reference/settings-*` and `reference/account-menu-1280.png` as the reference. The header avatar becomes a button that opens a menu with the name and email, Account Settings and Sign Out. Settings has Profile, Password, Notifications, Session and Delete Account sections; Delete Account uses the shared neutral confirm. Reuse the existing auth and profile actions. Check at 390 and 1280 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Header and avatar | `components/layout/header`, `components/ui/avatar`, `components/ui/dropdown-menu` | Avatar → button (aria-label "Account menu"); menu per the bundle 09 kebab rules. |
| Settings route | existing `/settings` | Keep the route; restyle in the v2 shell. |
| Auth | existing auth actions | Sign Out → public catalog `/relationship-templates` with the toast "You’re signed out." |
| Account deletion | account/relationship records | Closes every relationship the user is in and removes the account within 30 days; answers stay readable to the other person (same rule as Leave). |

## Page and interaction requirements

- **Account menu:** name and email header, **Account Settings**, **Sign Out**; keyboard and focus as the shared kebab.
- **Settings (H1 "Account Settings", purpose "Your name, email, password and notifications."):**
  - **Profile** ("How you appear to the people you align with."): First Name, Last Name, Email ("We send invites and results here."), **Save Profile**.
  - **Password** ("Use at least 8 characters."): Current Password, New Password, **Update Password**.
  - **Notifications** ("Email only. No marketing."): switches When the Other Person Finishes ("So you know results are ready."), New Chat Messages ("A daily summary, never one email per message."), Billing Reminders ("Before a trial ends or a card is charged."); **Save Notifications**.
  - **Session:** "Signed in as Marcus Reyes on this device." **Sign Out**.
  - **Delete Account:** "Closes every relationship you’re in and removes your account within 30 days. Relationship answers stay readable to the other person." **Delete Account** (neutral outline + ×, neutral confirm).
- Save buttons confirm with the shared toast.
- **Counterparty-only accounts:** hide the Billing Reminders switch (or reword it without "trial"/"card"), so the no-price rule holds for people who only ever joined.

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/layout/header` | settings.html (1) |
| `components/layout/main-layout` | settings.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | settings.html (1) |
| `components/layout/page-header` | settings.html (1) |
| `components/layout/sidebar` | settings.html (1) |
| `components/ui/avatar` | settings.html (1) |
| `components/ui/button` | settings.html (5) |
| `components/ui/card (settings section)` | settings.html (5) |
| `components/ui/dropdown-menu (account)` | settings.html (1) |
| `components/ui/input` | settings.html (1) |
| `components/ui/input + label` | settings.html (5) |
| `components/ui/sheet` | settings.html (1) |
| `components/ui/switch` | settings.html (3) |

## Copy strings (exact)

"Account menu" (label) · "Account Settings" · "Sign Out" · "You’re signed out." · "Profile" · "Save Profile" · "Password" · "Update Password" · "Notifications" · "Save Notifications" · "Session" · "Delete Account".

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

`AccountMenu` (in the shared header) · `SettingsPage` → `ProfileSection`, `PasswordSection`, `NotificationsSection`, `SessionSection`, `DeleteAccountSection`.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Compare with `reference/settings-*` and `account-menu-1280.png`. No overflow at 390/1280.
- The account menu opens from every signed-in page; Sign Out lands on the public catalog with the toast; Delete Account requires the confirm.

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

- A red Delete Account; deleting the other person's answers; showing trial or card wording to a Counterparty-only account; a second header.

## Definition of done

Account menu on every signed-in page, Settings sections work with the existing actions, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `settings.html` · Account Settings · AlignSynch v2.0 prototype

**Headings:** H1 “Account Settings” · H2 “Profile” · H2 “Password” · H2 “Notifications” · H2 “Session” · H2 “Delete Account”

**Buttons and actions:** “Delete Account” · “MR” · “Save Notifications” · “Save Profile” · “Sign Out” · “Update Password”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Account menu and Account Settings** · prev [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md) · next none

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Account menu and Settings v2 — implementation brief · prev [Account menu and Settings v2 (handoff)](README.md) · next [Account menu and Settings v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->
