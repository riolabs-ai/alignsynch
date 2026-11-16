# AlignSynch onboarding basics v2: React / Tailwind CSS v3 implementation brief

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Onboarding basics: public Templates catalog, public template page, Pricing → template pick, Counterparty join** · prev [01-spec-design-page-wizard-v2](../01-spec-design-page-wizard-v2/README.md) · next [03-spec-design-page-relationship-detail-v2](../03-spec-design-page-relationship-detail-v2/README.md)

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/` · **Issue:** #1127, #1125  
**Source:** `v2-prototype` pass 10 plus the 2026-11-16 trial-start decision (DESIGN-NOTES v3.2 §45). QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0.  
**Priority:** **P0** (visitor conversion and the invitee's first minutes)  
**Issues:** epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119) · Counterparty join [#1125](https://github.com/riolabs-ai/alignsynch/issues/1125) · wizard handoff [#1123](https://github.com/riolabs-ai/alignsynch/issues/1123) · trial data [#1115](https://github.com/riolabs-ai/alignsynch/issues/1115) / PR [#1116](https://github.com/riolabs-ai/alignsynch/pull/1116) · public visual rollout [#854](https://github.com/riolabs-ai/alignsynch/issues/854) · visitor conversion [#1127](https://github.com/riolabs-ai/alignsynch/issues/1127)  
**Target:** Four surfaces that take a visitor or an invitee to their first relationship:

| Page | Prototype file | App route |
| --- | --- | --- |
| Public Templates catalog | `relationship-templates.html` | **`/relationship-templates`** (new; `/relationship-types` 308-redirects here) |
| Public template page | `relationship-template-public.html` | **`/relationship-templates/[slug]`** (`/relationship-types/[slug]` redirects) |
| Pricing | `pricing.html` | `/pricing` (existing) |
| Counterparty join | `counterparty-join.html?step=1|2|3` | the existing invite-link route (`claimInvite()` in `lib/flow/store.ts`) |

**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

> **Owner decision (2026-11-16), drawn in the pass 10 HTML.** The plan chosen on Pricing is carried through the catalog and template page into the wizard and shows at **Stage 5** (the invite stage), in the billing note beside the **Continue with 7 Days Free** button (PR #1116). Stage 4 is account only. The template page note "You create your account at Stage 4. No card needed." stays true. **Resolved (2026-11-16):** the 7-day free trial starts when the other person accepts, not at creation and not when you send. PR #1116 must move its grant to acceptance. See bundle 01.

## Copy-ready team prompt

> Implement the approved v2 onboarding surfaces from `02-spec-design-page-onboarding-v2/` in the existing Next.js app: the public Relationship Templates catalog at `/relationship-templates`, the public template page at `/relationship-templates/[slug]`, the Pricing page, and the three-step Counterparty join. Use the HTML files, `css/tokens.css`, `js/tw-config.js` and `reference/` as the visual and interaction reference.
>
> Move the public catalog from `/relationship-types` to `/relationship-templates`, add permanent redirects for the old routes (list and detail), and update the shared route constant so no link points at the old path. Keep the pages inside the shared marketing layout: use the existing marketing header, public navigation (Templates in the main menu, then How It Works and Pricing) and footer; do not duplicate them. Template lists and details come from the real relationship-type records; plans and prices come from the billing configuration, never hard-coded copy.
>
> Close the Pricing orphan: no plan button goes to payment. Every "Start With <Plan>" opens the catalog as "Step 1 of 2 · Pick a Template" with the plan saved; the plan is carried to the template page and through the wizard, where it shows at Stage 5 beside Continue with 7 Days Free. The invitee's join flow is its own role surface with one primary action per step and never shows a price, a trial, a card or an extension. Check every page at 360–1920 px, run the repository checks, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.


## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Public route shell | `app/(marketing)/layout.tsx` | Keep all three public pages inside it. |
| Public header and nav | `components/marketing/marketing-header.tsx`, `components/layout/nav-menus.tsx`, `data/pages/shell.ts` | Reuse `PublicNav`. The prototype header (`components/layout/public-header`) shows the target order: Templates, How It Works, Pricing · Sign In (ghost, hidden below `sm`) · **Start Free** (the single primary, → catalog). Active item: graphite with a thin cyan underline (the only cyan). Below `md` a menu button opens a stacked nav with 44 px rows. |
| Footer | `components/layout/footer.tsx` | Shared footer only; the prototype footer columns are a visual reference. |
| Catalog route and constant | `data/relationship-types.ts`, `data/assessments.ts`, `lib/flow/paths.ts` (`RELATIONSHIP_TYPES_PATH`) | Rename the public path to `/relationship-templates`; 308 redirects in `next.config` (or middleware) for `/relationship-types` and `/relationship-types/:slug`; update the constant and every link; keep the data module name if renaming is noisy. |
| Plans and prices | billing configuration (`lib/billing/*`), #1115 | Single `$9.99 / month` is from the spec. **Family `$19.99 / month` and Single Annual `$99 / year` are placeholders** until the owner sets the tiers. |
| Invite claim | `lib/flow/store.ts::claimInvite()`, #1115 PR 2 (two-field Counterparty entry, derived `connected`) | The join flow is the visual layer on top of the claim; it lands on `/dashboard/relationships/[id]?from=join`. |
| Tokens | #1120 | Semantic classes only. |

## Page and interaction requirements

### Public Templates catalog (`/relationship-templates`)

1. **Plan banner (conditional)** when arriving from Pricing (`?from=pricing&plan=<id>`): slim billing-surface bar "Step 1 of 2 · Pick a Template · Your <Plan> plan is saved for later. Nothing to pay today." with a **Change Plan** link to `/pricing`.
2. **Hero:** eyebrow "Relationship Templates", H1 "See Where You Agree. Talk About the Rest.", one-line value prop, three billing-ink ticks (7-day free trial · No card needed · The person you invite never pays), primary **Browse Templates** (→ `#catalog`), outline **Start With the Most Popular** (→ the most popular template page). Beside it, a live example card using the locked 1–5 scale with party dots and a vivid Gap chip ("Marcus wishes 5 · Elena wishes 3 · Gap · Next Step: talk about this one first.").
3. **Catalog (`#catalog`):** H2 "Choose a Template", search, category toggle-group with counts (All, Family, Couples, Friends, Work, Home), cards (category chip, Aspect count, minutes; "Popular" badge) that link on their full surface to the template page. Empty filter state "Nothing Matches · Try another filter or search." with **Show All**. Same data and filter behaviour as the in-app Library (bundle 06).
4. **How It Works (`#how`, status surface):** four steps (Pick a Template · Invite One Person · Answer Privately · See Where You Agree), then three testimonials. **The testimonials are placeholder copy** (`data-qh="placeholder testimonials"`): do not ship them; replace with real, consented quotes or remove the row.
5. **FAQ:** five native accordions (`components/ui/accordion`): free to start, does the invitee pay, what happens when the trial ends, who sees answers, can I change a template.
6. **Final CTA band:** solid graphite, "Start Your First Relationship · 7 days free. No card. Your invitee never pays." with Browse Templates and See Pricing.

`#how` is linked from the header ("How It Works"); keep the anchor stable and give every anchor target a `scroll-margin-top` derived from the sticky header height.

### Public template page (`/relationship-templates/[slug]`)

- Same body as the in-app template page (bundle 06) rendered in the marketing shell, with a Templates › <Name> breadcrumb and the plan banner when a plan is chosen.
- Hero: eyebrow "Relationship Template", H1, one-line purpose, fact chips (category, n Aspects, about N minutes, 2 People); primary **Create Relationship** → wizard Stage 1 with `from=public` (plus `plan`); secondary **All Templates**.
- Main: What It Covers (3 theme tiles) · The n Aspects, each with the locked scale preview and end labels, plus the Feel/Wish strip ("Advanced Mode adds Think and Guess.") · Who It's For, ending with "Not for crisis support. If someone is unsafe, reach out to local help first."
- Sticky aside: Create Relationship card with the note "You create your account at Stage 4. No card needed."; billing-surface trial summary (7-Day Free Trial · No card needed to start · price after, only with a card · The person you invite is never charged); status-surface How It Works (Stage 1–5 Set Up · Stage 6 Align dashed · Talk).
- Closing band repeats the one primary action.
- Only Brother–Sister has a detail page in the prototype; every catalog card opens it. In the app every template has its own page from its record.

### Pricing (`/pricing`)

- H1 "Simple Pricing. Start Free." and "Every plan starts with a 7-day free trial and no card. The trial begins when the other person accepts. The person you invite never pays."
- Three plan cards (Single highlighted "Most Popular"); each shows price, "After a 7-day free trial · No card to start", four ticks and **Start With <Plan>**.
- **Orphan fix:** every Start With <Plan> → `/relationship-templates?from=pricing&plan=<id>#catalog`. No pricing CTA links to Payment or a checkout.
- "Not sure? Start with the most popular" → the most popular template page on Single.
- How Billing Works (billing surface): 1 Pick a Template ("Your plan is saved while you choose.") · 2 Set Up and Invite ("Your trial starts when they accept. No card.") · 3 Add a Card When Ready ("Only after the trial, if you want to keep going.").
- FAQ (three items) and the final CTA band.

### Plan carry (`plan` param)

- `plan` and `from=pricing` are appended to every template-page and wizard link while a plan is chosen, so the plan survives each hop.
- In the wizard the plan shows only at **Stage 5**, in the billing note: "<Plan> Plan · $x / month after the trial, once you add a card · Change"; the rail summary reads "Free Trial · Starts When Elena Accepts · then <Plan>". The default is still the card-free trial; the clock starts when they accept, and nothing is charged before then.
- The Counterparty never sees a plan or price (`flow9` check).

### Counterparty join (invite link)

- **Decline (pass 10):** one click on Step 1's "Decline the invitation" shows "Invitation Declined" with an optional reason and **Send Note** or **Done**; Marcus is not shown the reason unless it is sent (`reference/join-declined-*`).
- Signed-out flow header, 1440 cap, three-dot stepper "Step n of 3" (Invite · Join · Accept). Its own role surface; never the Initiator wizard rail.
- **Step 1 Invitation:** "Marcus invited you to align on <Title>", one-line how it works, the Shared Goal quote, both party cards (`NEW: party-card`), the n Aspects preview, How It Works (Mode, Alignment Tolerance in plain words), the coverage note "You're never charged. Marcus covers this relationship.", the privacy line "Your answers stay private until you both share." Primary **Join Marcus**; quiet link "Not for you? Decline the invitation".
- **Step 2 Create Your Account:** "Use the email Marcus invited, so he knows it's you."; tabs New to AlignSynch / I Have an Account; email prefilled with "From Marcus's invite."; FormSurface, no shadow; primary **Create Account** / **Sign In**; Back.
- **Step 3 Accept the Invitation:** both party cards; "You join <Title> as the Counterparty. When you accept, Stage 6 goes live for both of you and your first Assessment opens."; primary **Accept Invitation**; optional collapsible "Suggest a Change to the Aspects (optional)" (Aspect select + text, "Sent to Marcus with your acceptance. The Aspects stay as they are unless he changes them."); Back.
- Accept → `/dashboard/relationships/[id]?from=join` (Counterparty) with "You've Joined. Marcus has been told you're in." (+ "Your suggestion was sent to him." when sent), Live badge, Next Step "Start Your First Assessment".

### States and query params

| Param | Page | In the app | Meaning |
| --- | --- | --- | --- |
| `from=pricing&plan=<id>` | catalog, template page, wizard | yes | plan banner and plan carry |
| `#catalog`, `#how` | catalog | yes | anchors (header links) |
| `relationship-template.html?public=1` | prototype only | no | redirect stub to the public page |
| `step=1|2|3` | join | prototype only | derive from auth and claim state |
| `suggested=1` | detail arrival | prototype only | whether a suggestion was sent |

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count) |
| --- | --- |
| `components/assessment-flow/aspect-list (read-only)` | counterparty-join.html (1) |
| `components/assessment-flow/record-detail-shell DetailBand (invite)` | counterparty-join.html (1) |
| `components/assessment-flow/stage-rail (adapted: 3 join steps)` | counterparty-join.html (1) |
| `components/auth/auth-card (FormSurface: no shadow)` | counterparty-join.html (1) |
| `components/auth/sign-in-form (visual mock)` | counterparty-join.html (1) |
| `components/auth/sign-up-form (visual mock)` | counterparty-join.html (1) |
| `components/layout/header (signed out)` | counterparty-join.html (1) |
| `components/layout/page-header` | relationship-template-public.html (1) |
| `components/layout/public-footer` | relationship-templates.html (1), relationship-template-public.html (1), pricing.html (1) |
| `components/layout/public-header` | relationship-templates.html (1), relationship-template-public.html (1), pricing.html (1) |
| `components/layout/public-layout (content cap: max-w-content)` | relationship-templates.html (1), relationship-template-public.html (1), pricing.html (1), counterparty-join.html (1) |
| `components/ui/accordion` | relationship-templates.html (5), pricing.html (3) |
| `components/ui/avatar` | counterparty-join.html (4) |
| `components/ui/badge` | relationship-templates.html (26), relationship-template-public.html (6), pricing.html (1), counterparty-join.html (1) |
| `components/ui/button` | relationship-templates.html (6), relationship-template-public.html (6), pricing.html (7), counterparty-join.html (8) |
| `components/ui/card` | relationship-template-public.html (2), counterparty-join.html (1) |
| `components/ui/card (Aspects preview)` | relationship-template-public.html (1) |
| `components/ui/card (accept)` | counterparty-join.html (1) |
| `components/ui/card (plan)` | pricing.html (3) |
| `components/ui/card (template)` | relationship-templates.html (8) |
| `components/ui/collapsible` | counterparty-join.html (1) |
| `components/ui/input` | relationship-templates.html (1) |
| `components/ui/tabs` | counterparty-join.html (1) |
| `components/ui/textarea + label` | counterparty-join.html (1) |
| `components/ui/toggle-group` | relationship-templates.html (1) |
| `placeholder testimonials (replace with real quotes before launch)` | relationship-templates.html (1) |
| `NEW: invite declined (one click)` | counterparty-join.html (1) |
| `NEW: paired-answer-bars (marketing sample)` | relationship-templates.html (1) |
| `NEW: paired-answer-bars (scale only)` | relationship-templates.html (1), relationship-template-public.html (5) |
| `NEW: party-card (compact)` | counterparty-join.html (4) |
| `NEW: payment-panel (summary)` | relationship-template-public.html (1) |
| `NEW: step banner (pricing → template)` | relationship-templates.html (1), relationship-template-public.html (1) |

## Copy strings (exact)

- Header: "Templates" · "How It Works" · "Pricing" · "Sign In" · "Start Free"
- Catalog: "See Where You Agree. Talk About the Rest." · "Browse Templates" · "Start With the Most Popular" · "Choose a Template" · "Nothing Matches" · "Show All" · "Start Your First Relationship" · "See Pricing"
- Plan banner: "Step 1 of 2 · Pick a Template" · "Your {Plan} plan is saved for later. Nothing to pay today." · "Change Plan"
- Template page: "Create Relationship" · "All Templates" · "What It Covers" · "The 5 Aspects" · "Who It’s For" · "Start With Your Sibling" · "You create your account at Stage 4. No card needed."
- Pricing: "Simple Pricing. Start Free." · "Most Popular" · "Start With {Plan}" · "How Billing Works" · "Add a Card When Ready"
- Join: "Step n of 3" · "Join Marcus" · "Decline the invitation" · "Create Your Account" · "From Marcus’s invite." · "Accept the Invitation" · "Accept Invitation" · "Suggest a Change to the Aspects (optional)" · "You’re never charged. Marcus covers this relationship."

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


## Audience and positioning

See `AUDIENCE-AND-POSITIONING.md` in this folder. It carries the canonical 12 November audience note and flags one open conflict: the v2 catalog leads with family templates (Brother–Sister as Most Popular), while the home direction leads with business and corporate relationships.

## Suggested React component boundaries

- Catalog: `TemplatesHero`, `ExampleAlignCard` (reuses `PairedAnswerBars`), `TemplateCatalog` (`CategoryFilter`, `TemplateSearch`, `TemplateCard`, shared with the in-app Library), `HowItWorksSteps`, `Testimonials` (off until real quotes), `PublicFaq`, `FinalCta`, `PlanBanner`
- Template page: shared `TemplateBody` (bundle 06) + `PublicTemplateAside`
- Pricing: `PlanCard`, `HowBillingWorks`, `PricingFaq`
- Join: `JoinStepper`, `InviteStep`, `JoinAccountStep` (existing auth), `AcceptStep` (`SuggestChange`)

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar (state and role links) is a review tool. Drop it.
- Every `?state=`, `?role=`, `?stage=`, `?step=`, `?empty=`, `?filter=` switch in the prototype is a review shortcut. In the app, derive state from the relationship, member, subscription and template rows; never from a query string (deep-link params that exist in the app, such as `?tab=` and `?plan=`, are listed per page).
- Names (Marcus, Elena), dates (Nov 16–26), counts and prices in the HTML are fixture data. Bind to real records and the validated copy layer.
- `js/proto.js` is behaviour for the static preview only (tabs, role preview, re-scoring, filters, mock submits). Rebuild behaviour in React; do not ship the file.


## Validation checklist

### Visual and responsive

- Compare against `reference/relationship-templates*`, `relationship-template-public*`, `pricing*`, `join-step1..3*` at 390 / 1280 (1920 for catalog and pricing).
- Header, nav and footer appear exactly once; the mobile menu works with 44 px rows; no page-level overflow at 360/390.
- Every anchor (`#catalog`, `#how`) lands with the heading visible under the sticky header.

### Accessibility and behaviour

- Keyboard traversal and visible focus on every control; skip link to `#main`; one `h1` per page and an ordered heading outline.
- Tabs use `role=tablist/tab/tabpanel` with arrow-key movement; switches and toggle groups expose `aria-checked`/`aria-pressed`; the current stage/step carries `aria-current="step"`.
- Status is never colour-only: icon + word on every chip, bar and legend.
- Contrast: inks ≥ 4.5:1 on their tints, UI marks ≥ 3:1 (values in `css/tokens.css` were checked; re-check with the app's real variables).
- Touch targets ≥ 44 px on mobile; reduced-motion disables smooth scroll and transitions.
- axe-core (wcag2a + wcag2aa): 0 violations on every state (the prototype passes at 390 and 1280).


### Flow and routing

- `/relationship-types` and `/relationship-types/<slug>` return 308 to the `/relationship-templates` equivalents; no internal link uses the old path (`rg -n "relationship-types" app components data lib` only matches the redirect and data module).
- Pricing → Start With Family → catalog banner → template → Create Relationship → wizard Stage 5 shows "Family Plan" (port of `src/qa/flow9.js`).
- No pricing CTA reaches Payment or a checkout.
- Join: Invite → Join → Accept (with suggestion) lands as Counterparty with the joined banner and suggestion line (port of `src/qa/flow4.js`); each step has exactly one primary button.
- Counterparty no-leak: no `$`, "trial", "card", "price", "extension" or plan name on any join step.

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

- Must not ship the placeholder testimonials or the placeholder Family/Annual prices.
- Must not link any pricing CTA to payment, or ask for a card before a relationship exists.
- Must not duplicate the marketing header/footer, or hard-code template lists, counts or routes.
- Must not reuse the Initiator wizard rail for the join flow, or let a suggestion edit Aspects.
- Must not leave `/relationship-types` links behind or break its inbound URLs.

## Pending and open

- Invite controls (Copy Invite Link, Resend, Cancel Invite) live on Relationship Detail (bundle 03).
- Decided in pass 10: Decline is one click with an optional reason. Still open (DESIGN-NOTES §12 Q4): where a suggestion lands (Discussion post vs notification).
- Real testimonials; final plan tiers and prices; whether the catalog leads with business templates (audience note).

## Definition of done

- `/relationship-templates` and `/relationship-templates/[slug]` render the approved v2 design inside the shared marketing layout, with redirects from the old routes.
- Pricing never orphans: plan → template → wizard Stage 5, card-free.
- The join flow is three steps, one primary each, no price or trial wording, landing on Relationship Detail as Counterparty.
- Tokens only, no red, axe 0, repository checks pass, owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `relationship-templates.html` · Relationship Templates · AlignSynch

**Headings:** H1 “See Where You Agree. Talk About the Rest.” · H2 “Choose a Template” · H3 “Brother–Sister” · H3 “Partners” · H3 “Parent and Adult Child” · H3 “Co-Founders” · H3 “Manager and Report” · H3 “Best Friends” · H3 “Roommates” · H3 “Siblings · Event” · H2 “Nothing Matches” · H2 “How It Works” · H3 “Pick a Template” · H3 “Invite One Person” · H3 “Answer Privately” · H3 “See Where You Agree” · H2 “Questions” · H2 “Start Your First Relationship” · H2 “Product” · H2 “Account” · H2 “Company”

**Buttons and actions:** “All 8” · “Browse Templates” · “Couples 1” · “Family 3” · “Friends 1” · “Home 2” · “Show All” · “Sign In” · “Start Free” · “Start With the Most Popular” · “Work 2”

### `relationship-template-public.html` · Brother–Sister Template · AlignSynch

**Headings:** H1 “Brother–Sister” · H2 “What It Covers” · H3 “How You Stay in Touch” · H3 “Old Roles” · H3 “Family Decisions” · H2 “The 5 Aspects” · H3 “Contact Frequency” · H3 “Old Roles” · H3 “Showing Up” · H3 “Parent Decisions” · H3 “Feeling Respected” · H2 “Who It’s For” · H2 “Start With Your Sibling” · H2 “7-Day Free Trial” · H2 “How It Works” · H2 “Product” · H2 “Account” · H2 “Company”

**Buttons and actions:** “All Templates” · “Create Relationship” · “Sign In” · “Start Free”

### `pricing.html` · Pricing · AlignSynch

**Headings:** H1 “Simple Pricing. Start Free.” · H3 “Single” · H3 “Family” · H3 “Single Annual” · H2 “How Billing Works” · H2 “Questions” · H2 “Start Your First Relationship” · H2 “Product” · H2 “Account” · H2 “Company”

**Buttons and actions:** “Browse Templates” · “Sign In” · “Start Free” · “Start With Family” · “Start With Single” · “Start With Single Annual” · “Start With the Most Popular”

### `counterparty-join.html` · Join Marcus · AlignSynch v2.0 prototype

**Prototype review states:** Step 1 → `?step=1` · Step 2 → `?step=2` · Step 3 → `?step=3`

**Headings:** H1 “Marcus invited you to align on Staying Close Through Busy Seasons” · H2 “The 5 Aspects” · H2 “How It Works” · H2 “Invitation Declined” · H1 “Create Your Account” · H1 “Accept the Invitation”

**Buttons and actions:** “Accept Invitation” · “Back” · “Create Account” · “Done” · “I Have an Account” · “Join Marcus” · “New to AlignSynch” · “Not for you? Decline the invitation” · “Send Note” · “Sign In”


<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Onboarding basics: public Templates catalog, public template page, Pricing → template pick, Counterparty join** · prev [01-spec-design-page-wizard-v2](../01-spec-design-page-wizard-v2/README.md) · next [03-spec-design-page-relationship-detail-v2](../03-spec-design-page-relationship-detail-v2/README.md)

<!-- bundle-nav:end -->
