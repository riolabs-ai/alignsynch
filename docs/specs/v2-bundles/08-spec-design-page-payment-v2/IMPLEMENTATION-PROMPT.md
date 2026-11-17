# AlignSynch Payment v2: React / Tailwind CSS v3 implementation brief

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Payment v2 — implementation brief · prev [Payment v2 (handoff)](README.md) · next [Payment v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Payment (standalone billing)** · prev [07-spec-design-page-chat-v2](../07-spec-design-page-chat-v2/README.md) · next [09-spec-design-system-tokens-v2](../09-spec-design-system-tokens-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/08-spec-design-page-payment-v2/` · **Issue:** #1132 (+ #1121)  
**Source:** `v2-prototype` pass 10 plus the 2026-11-16 trial-start decision (DESIGN-NOTES v3.2 §45). QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0.  
**Priority:** P1  
**Issues:** [#1132](https://github.com/riolabs-ai/alignsynch/issues/1132) Payment v2 · [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121) trial-ended states · [#1115](https://github.com/riolabs-ai/alignsynch/issues/1115) / PR [#1116](https://github.com/riolabs-ai/alignsynch/pull/1116) card-free trial · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)  
**Target:** `/dashboard/payment` (standalone billing).  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Payment page from `08-spec-design-page-payment-v2/`: one billing-surface panel per relationship (Status, Ends, After, Card) with one note and its actions, a Payment Method card, Billing History and How Trials Work. Use `payment.html` (`?role=counterparty`, `?rel=cofound#bill-cofound`), `css/tokens.css`, `js/tw-config.js` and `reference/` as the reference. Read trial state through `trialStateOf()` (PR #1116); Add a Card goes to the existing checkout, the only card-capture surface. The Counterparty view shows only "Marcus covers this relationship. You're never charged." Check at 390 and 1280 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Trial state | `lib/billing/trial.ts` `trialStateOf()`, `lib/db/billing.ts` `grantCreationTrial()` | `none` until the Counterparty accepts; `active` from acceptance; then `ending (≤ 2 days) | lapsed`. Extension = `trial_extended_at` null. **Move `grantCreationTrial()` to acceptance** (PR #1116 currently grants at creation). |
| Checkout | `lib/billing/adapters/stripe.ts` (`payment_method_collection: "always"`), `startMembershipAction` / `confirmMembershipAction` | Add a Card is the explicit upgrade action (#1115 task 9). `tests/one-payment-surface.test.ts` must still see one card-capture component. |
| Panel | `NEW: payment-panel` | Shared with the Relationship Detail Payment tab. |

## Page and interaction requirements

- **Per-relationship panels** (billing surface `#f2f7f4`, line `#c8dccf`, ink `#2d6549`):
  - Live trial: Status "Free Trial · 3 Days Left", Ends, After "$9.99 / month", Card "None"; action **Add a Card**.
  - Invite sent: Status **"Trial Starts When Tomás Accepts"** (use the other person's first name), no Ends date, no countdown. Note: "Your 7-day free trial starts when Tomás accepts. No card needed."
  - Draft: Status "Not Started", Trial **"Starts When Dana Accepts"**. Note: "Send the invite. Your 7-day free trial starts when Dana accepts." Action **Continue Setup**.
  - **Resolved (2026-11-16):** the clock starts when the Counterparty accepts, not at creation and not when you send. PR #1116 must move its grant to acceptance (see bundle 01).
  - Paused: **Add a Card** + **Get 7 More Days Free**; after use the extension hides and the panel notes "one time only".
- **Aside:** Payment Method (no-card state, Add a Card → existing checkout; the HTML's inline add-card form is a mock, "Prototype only. Nothing is charged."), Billing History ("No charges yet."), How Trials Work.
- **Counterparty view:** only "Marcus covers this relationship. You’re never charged." No `$`, trial, card or extension text.

### States and query params

`?role=counterparty` (prototype only; derive the role) · `?rel=<id>#bill-<id>` (keep as an anchor to a panel).

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/auth (FormSurface: no shadow)` | payment.html (1) |
| `components/layout/header` | payment.html (1) |
| `components/layout/main-layout` | payment.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | payment.html (1) |
| `components/layout/page-header` | payment.html (2) |
| `components/layout/sidebar` | payment.html (1) |
| `components/ui/avatar` | payment.html (2) |
| `components/ui/badge` | payment.html (4) |
| `components/ui/button` | payment.html (7) |
| `components/ui/card (payment method)` | payment.html (1) |
| `components/ui/dropdown-menu (account)` | payment.html (1) |
| `components/ui/input` | payment.html (1) |
| `components/ui/input + label` | payment.html (4) |
| `components/ui/sheet` | payment.html (1) |
| `NEW: payment-panel (per relationship)` | payment.html (4) |

## Copy strings (exact)

"Payment" · "Free Trial · N Days Left" · "Trial Starts When {Name} Accepts" · "Starts When {Name} Accepts" · "Starts when the other person accepts" · "Add a Card" · "Get 7 More Days Free" · "Paused" · "Payment Method" · "Billing History" · "No charges yet." · "How Trials Work" · "Marcus covers this relationship. You’re never charged."

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

`PaymentPage` → `RelationshipBillingPanel` (`PaymentPanel`), `PaymentMethodCard`, `BillingHistory`, `HowTrialsWork`, `CounterpartyCoverageNote`.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

- Compare with `reference/payment*`. No overflow at 390/1280.
- One extension per relationship, enforced server-side; Add a Card resumes a paused relationship immediately.
- Counterparty no-leak test passes on this page.

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

- Create a Stripe subscription before the user adds a card; offer a second extension; render any payment wording for the Counterparty; ship the inline card-form mock.

## Definition of done

Payment matches the reference with real trial data, drafts and pending invites show no countdown, the checkout stays the single card surface, tokens only, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `payment.html` · Payment · AlignSynch v2.0 prototype

**Prototype review states:** Marcus → `payment.html` · Elena → `payment.html?role=counterparty` · From a Paused Relationship → `payment.html?rel=cofound#bill-cofound`

**Headings:** H1 “Payment” · H2 “Memberships” · H3 “Staying Close Through Busy Seasons” · H3 “Planning Dad’s 70th” · H3 “Sharing the Weekend Load” · H3 “Back on Track as Co-Founders” · H2 “Payment Method” · H2 “Billing History” · H2 “How Trials Work” · H1 “Payment”

**Buttons and actions:** “Add a Card” · “Cancel” · “Continue Setup” · “Get 7 More Days Free” · “MR” · “Save Card”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Payment (standalone billing)** · prev [07-spec-design-page-chat-v2](../07-spec-design-page-chat-v2/README.md) · next [09-spec-design-system-tokens-v2](../09-spec-design-system-tokens-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Payment v2 — implementation brief · prev [Payment v2 (handoff)](README.md) · next [Payment v2 — asset sources](ASSET-SOURCES.md)

<!-- docs-nav:end -->
