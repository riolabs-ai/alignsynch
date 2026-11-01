# UI registry

Every surface this tree can render, as a resource a template can pick from rather than a set of screens somebody has to remember. This page is generated: do not edit it.

It has two halves, and each one is owned by a different place:

- **structural** — every component domain with its file count and files, and which routes import it. Derived from `components/` and `app/` by `scripts/gen-ui-registry.mjs` on every run; never typed.
- **judgement** — `status`, `templates`, `capability` and an optional `notes` per surface, in `data/ui-registry.ts`, zod-validated. One entry per surface, and a surface is a route or a component domain, never a file.

`bash scripts/verify.sh` regenerates the page and compares it byte for byte, then checks the two halves against each other: a surface in the tree with no entry fails, an entry for a surface that is gone fails, and a `status` the surface's own imports contradict fails. `pnpm ui:registry` is how you fix any of them.

**`templates` is a scope decision, not a render fact.** Both brands render this one route table — `data/brand.ts` swaps a record, not a page — so a surface is listed here under a template when that template's product story needs it: a quiz-specific implementation is QuizHub's, the alignment product's is AlignSynch's, and a surface both need unchanged is under both. A surface no template claims yet has an empty list and sits in _No template yet_, which is where a candidate for the next vertical starts its life.

How a template picks from this page — the order a new surface is decided in — is [`TEMPLATE-DOCTRINE.md`](TEMPLATE-DOCTRINE.md): one core, many expressions.

## Summary

- routes: **69** — 49 static, 20 dynamic, from `app/**/page.tsx`
- component domains: **36** — 265 files under `components/`, 260 of them `.tsx`
- route handlers: **12** — `app/**/route.ts`, listed below and not a UI surface
- status: **mock** 13 · **fixture** 51 · **db** 14 · **live** 7 · **prototype** 20
- templates: Both templates 22 · AlignSynch 39 · QuizHub 42 · No template yet 2
- capability written as `undocumented`: **0**

Status is the judgement half and the wiring is what checks it: `db` reaches `lib/db/`, `live` reaches an `/api` write, `fixture` reaches a module under `data/`, and `mock` reaches no `lib/db/` module and no record fixture — the media registry is an asset and page copy is copy, so a surface whose numbers are literals is still a stand-in.

Two things this page deliberately does not own. The app's own route table is `content/routes.ts` (E10 holds it to the filesystem); the route list here is derived from `app/` again rather than read out of that table, so the two can never be a copy of each other. And the media a surface draws is `data/media.ts`, generated from `public/` — a domain here says which files it has, never which images it addresses.

## Undocumented

None: every catalogued surface has a `capability` sentence. A surface nobody has described belongs here — write `undocumented` as its `capability` and the summary above counts it — rather than inventing one.

## Both templates

### Routes

- `/` — **fixture**
  - capability: The front page: QuizHub leads with category, latest and featured shelves, top players and live winners; AlignSynch leads with the two questions each party answers and the four assessment templates.
  - components: `components/categories`, `components/home`, `components/media`, `components/ui`
  - reads: 15 record fixtures — `data/assessments.ts`, `data/authored-quizzes.ts`, `data/browse-quizzes.ts` (+12 more)

- `/dashboard/user` — **db**
  - capability: The signed-in person's account home: their saved profile, wallet, recent activity and their quizzes, read from Postgres.
  - components: `components/identity`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/identity/sign-out-button.tsx`, `lib/auth/client.ts`, `lib/auth/server.ts`, `lib/auth/sign-out.ts`

- `/login` — **live**
  - capability: Sign in with a real Neon Managed Auth session, with pending, invalid-credentials, Google-only and network states.
  - components: `components/auth`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/account-providers.ts`, `lib/db/client.ts`, `lib/db/demo-accounts.ts` · an `/api` path — `lib/auth/client.ts`, `lib/auth/server.ts`

- `/privacy` — **fixture**
  - capability: The draft privacy policy: what the build actually collects, why, where it lives and what the reader can ask for, behind a draft notice that cannot be dismissed.
  - components: `components/legal`
  - reads: 3 fixture modules of page copy, assets or decisions — no records

- `/profile/[username]` — **db**
  - capability: A public profile read from Postgres: header, stats, achievements, followers, quiz history and created quizzes.
  - components: `components/identity`, `components/media`, `components/profile`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/server.ts`

- `/register` — **live**
  - capability: Create a real Neon Managed Auth account: personal details, then email, password and the terms agreement.
  - components: `components/auth`, `components/ui`
  - reads: an `/api` path — `lib/auth/client.ts`

- `/settings` — **live**
  - capability: The parts of your account you can change — display name, handle, bio and the country pair — saved through the guarded POST /api/profile.
  - components: `components/identity`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/identity/settings-view.tsx`, `components/identity/sign-out-button.tsx`, `lib/auth/client.ts`, `lib/auth/server.ts`, `lib/auth/sign-out.ts`

- `/support` — **fixture**
  - capability: The help centre: FAQ, help categories and a contact form.
  - components: `components/support`, `components/ui`
  - reads: 7 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+4 more)

- `/support/articles/[slug]` — **fixture**
  - capability: One help article from the knowledge base, with related articles and a 'was this helpful?' prompt.
  - components: `components/content`, `components/support`, `components/ui`
  - reads: 6 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+3 more)

- `/terms` — **fixture**
  - capability: The draft terms of service: the rules for using the product, its liability and dispute clauses, and a draft notice that cannot be dismissed.
  - components: `components/legal`
  - reads: 3 fixture modules of page copy, assets or decisions — no records

### Component domains

- `components` — **mock**
  - capability: The files at the root of components/: the next-themes provider the root layout wraps the document in.
  - files (1): `theme-provider.tsx`
  - routes: every route — imported by `app/layout.tsx`, no page imports it directly

- `components/auth` — **live**
  - capability: The sign-in and sign-up forms, including pending, invalid-credentials and network states, plus the two demo surfaces `/login` draws only in demo mode: the anchor to the PIN gate and, under a valid unlock cookie, the three role buttons.
  - files (5): `demo-entry.tsx`, `demo-gate.tsx`, `demo-roles.tsx`, `login-view.tsx`, `register-view.tsx`
  - routes (3): `/demo`, `/login`, `/register`
  - notes: The demo surfaces are decided on the server (`lib/auth/demo-surface.ts`) and render nothing outside demo mode; the PIN gate itself is `/demo` (`components/auth/demo-gate.tsx`), not this route.

- `components/content` — **mock**
  - capability: The block renderer every article record is drawn through: paragraphs, headings, lists, images and quotes.
  - files (1): `content-blocks.tsx`
  - routes (3): `/creator-tips/[slug]`, `/news/[slug]`, `/support/articles/[slug]`
  - notes: Holds no words of its own — the blocks arrive from `content/blocks.ts` through props.

- `components/home` — **fixture**
  - capability: Both front pages: the QuizHub shelves (hero, category slider, latest, featured, top players, winners, testimonials) and the AlignSynch two-question block.
  - files (11): `alignment-home.tsx`, `categories-slider.tsx`, `featured-quizzes.tsx`, `hero-section.tsx`, `latest-quizzes.tsx`, `live-winners.tsx`, `newsletter-section.tsx`, `player-testimonials.tsx`, `quizzes-by-difficulty.tsx`, `resources-and-referral.tsx`, `top-players-carousel.tsx`
  - routes (1): `/`

- `components/identity` — **live**
  - capability: The account surfaces: the signed-in home, the member profile, the settings form that POSTs /api/profile, sign-out and the demo-account notice.
  - files (5): `account-home.tsx`, `demo-account-notice.tsx`, `member-profile.tsx`, `settings-view.tsx`, `sign-out-button.tsx`
  - routes (3): `/dashboard/user`, `/profile/[username]`, `/settings`

- `components/layout` — **fixture**
  - capability: The shell: header, sidebar, the layout that composes them, the sidebar context they share and the footer.
  - files (7): `app-version.tsx`, `footer.tsx`, `header.tsx`, `main-layout.tsx`, `nav-menus.tsx`, `sidebar-context.tsx`, `sidebar.tsx`
  - routes (6): `/affiliate`, `/categories`, `/creator-tips`, `/creator-tips/[slug]`, `/login`, `/tournaments` — and every other route through `app/layout.tsx`

- `components/legal` — **mock**
  - capability: The one view `/terms` and `/privacy` render: the draft banner first, then the section stack, with the fixture's paragraphs and `- ` lists as its only markup vocabulary.
  - files (1): `legal-page.tsx`
  - routes (4): `/privacy`, `/terms`, `/v1/privacy`, `/v1/terms`
  - notes: The copy arrives as a prop from `data/pages/legal` (the two route entries claim it), so this domain reads no data module of its own.

- `components/media` — **mock**
  - capability: The one media resolver: a file, a remote URL or a generated default drawn from a seed, in that order, with a fallback on error and no image file behind the last tier.
  - files (2): `generated-avatar.tsx`, `media.tsx`
  - routes (26): `/`, `/affiliate`, `/battle`, `/categories`, `/categories/[slug]`, `/chat`, `/creator-tips`, `/creator-tips/[slug]`, `/daily-challenge`, `/dashboard`, `/dashboard/user`, `/explore`, `/explore/featured`, `/leaderboard`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/news`, `/news/[slug]`, `/profile/[username]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/settings`, `/tournaments`, `/tournaments/[id]`

- `components/not-found` — **mock**
  - capability: The 404 body: floating glyph decoration and a go-back button.
  - files (2): `floating-glyphs.tsx`, `go-back-button.tsx`
  - routes: none — no route imports this domain today

- `components/profile` — **fixture**
  - capability: The public profile in ten parts: cover, header, stats, achievements, activity, followers, following, quiz history, created quizzes and a message modal.
  - files (11): `message-modal.tsx`, `profile-achievements.tsx`, `profile-activity.tsx`, `profile-cover.tsx`, `profile-created-quizzes.tsx`, `profile-followers.tsx`, `profile-following.tsx`, `profile-header.tsx`, `profile-quiz-history.tsx`, `profile-stats.tsx`, `user-profile.tsx`
  - routes (1): `/profile/[username]`

- `components/support` — **fixture**
  - capability: The support centre: header, help categories, knowledge base, FAQ, contact form and the article detail.
  - files (7): `article-detail.tsx`, `contact-form.tsx`, `knowledge-base.tsx`, `support-categories.tsx`, `support-faq.tsx`, `support-header.tsx`, `support-page.tsx`
  - routes (2): `/support`, `/support/articles/[slug]`

- `components/ui` — **mock**
  - capability: The shadcn primitives every screen composes, plus this repo's own chart, drawer, motion and circular-progress additions.
  - files (51): `accordion.tsx`, `alert-dialog.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `circular-progress.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `input.tsx`, `label.tsx`, `menubar.tsx`, `motion.tsx`, `navigation-menu.tsx`, `page-header.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `toggle-group.tsx`, `toggle.tsx`, `tooltip.tsx`, `use-mobile.tsx`, `use-toast.ts`
  - routes (41): `/`, `/admin/gaps`, `/admin/instances`, `/affiliate`, `/battle`, `/categories`, `/categories/[slug]`, `/chat`, `/create/editor`, `/create/generator`, `/creator-tips`, `/creator-tips/[slug]`, `/daily-challenge`, `/dashboard`, `/dashboard/user`, `/demo`, `/demo/admin`, `/explore`, `/explore/featured`, `/leaderboard`, `/login`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/news`, `/news/[slug]`, `/pricing`, `/profile/[username]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/quiz/[id]/play`, `/register`, `/search`, `/settings`, `/support`, `/support/articles/[slug]`, `/tournaments`, `/tournaments/[id]`, `/v1/initiator/templates/new`, `/welcome` — and every other route through `app/layout.tsx`
  - notes: Renders only the props it is given; the tokens it paints with come from app/globals.css.

## AlignSynch

### Routes

- `/admin/gaps` — **db**
  - capability: The Gap across a population: the eight kinds the model defines, counted over relationships both parties have finished, read under each relationship's own Setting. Nameless aggregates — no party, no score, no ranking — and a Setting with fewer complete relationships than the floor states that instead of charting.
  - components: `components/console`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/gap-rows.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: The console's one relationship-specific screen and the only caller of `lib/admin/gap-aggregates.ts`. Its generic form is response analytics (stat cards, one distribution per measure, a comparison axis); what varies is the measure (`gapOf` over eight kinds), the population (complete instances) and the comparison (Setting). Admin only: `requireAdmin()` first, so a member gets the 404 `/demo/admin` documents. No migration and no stored aggregate — every number is a function of the `opinion` rows.

- `/admin/instances` — **db**
  - capability: Every relationship in the database, for an operator: the template, both seats' identity state, mode, Setting, the derived stage, when it was created and when anything last happened to it — filterable by stage, mode, Setting and "stalled".
  - components: `components/admin`, `components/ui`
  - reads: Postgres — `lib/db/admin-instances.ts`, `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: Admin-only, and the first caller of `requireAdmin()` outside `/demo/admin`: a member gets the 404 a URL that never existed returns, a signed-out visitor is sent to `/login?next=` this path. The blind rule holds for an admin too — the read selects seats, mode, Setting and the stage, never an opinion, a score, a Gap or an answered count, so there is no column and no prop through which an answer could reach the page. Read-and-filter only: no delete, no force-complete. Every filter is client-side over the one read (`lib/db/admin-instances.ts`).

- `/assessment` — **db**
  - capability: The published assessment templates, each with its create form: pick a template and open a two-party instance from the templates that read from Postgres.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/rows.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/server.ts`

- `/assessment/[slug]` — **db**
  - capability: One assessment instance from Postgres: both parties' answers per Aspect, the Opinions and Values behind them, and the Gap between the two.
  - components: `components/assessment`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/client.ts`, `lib/db/rows.ts`

- `/assessment/instances` — **db**
  - capability: Every instance the signed-in account is a party to, with both parties and where each one stands: yours to answer, awaiting the other party, or complete with the Gap open.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/my-instances.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: Filtered by party.user_id against the session — never a name, a query parameter or a role, so an admin sees their own list and no one else's. A row says only where the instance stands: the blind rule holds in the list too, and nothing here draws a score, a count or a Gap.

- `/assessment/instances/[instanceId]` — **db**
  - capability: The screen both parties share: answer blind while the other has not, then read the report and the Gap once both have answered.
  - components: `components/assessment`, `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/rows.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/server.ts`
  - notes: The viewer is resolved from the party cookie in Postgres, never from the URL — a browser with no token for the instance gets a 404. While the invitation is unclaimed the link is drawn as selectable text with a copy control beside it, and a refused clipboard selects that text and says so (#257).

- `/assessment/templates` — **db**
  - capability: The template library: the platform's own templates plus the ones this account wrote, with a tab for each, a status filter, a title search, and open/duplicate/archive on every row.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/template-library.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: `record.author_user_id` is the whole rule — `NULL` is a built-in, the author's id is a template a person wrote, and the read returns `author_user_id IS NULL OR author_user_id = $1`, so another account's template is never in the payload. A template written before `0011_console_columns.sql` has no author and therefore reads as built-in; the page says so in its own band rather than leaving it to be discovered. Archiving flips `record.status` to `archived` (author only): the catalogue stops listing it and `createInstanceFromTemplate` refuses it, while every instance already made from it keeps its own copy of the Aspects and still opens. Duplicating copies the record and its items into a new template authored by the caller, whatever state the source is in.

- `/assessment/templates/[templateId]` — **db**
  - capability: One template, read-only: its Aspects in authored order with their Left and Right Values, how many instances were made from it, who wrote it and whether it is archived. The place the editor will land later.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/template-library.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: The 'open' action. Read-only on purpose — editing is a separate decision, and the spec puts the editor on this same route when it exists. The read applies the same author rule as the library, so another account's template is a 404 here and nothing distinguishes it from an id that does not exist.

- `/assessment/templates/new` — **fixture**
  - capability: Write a template: a title and one to eight Aspects, each a question with a Left Value and a Right Value, saved as a published record with no parties.
  - components: `components/assessment-flow`
  - reads: an `/api` path — `lib/auth/server.ts`
  - notes: `fixture` and not `db` on purpose: the page renders page copy and resolves the session, and the one thing that reaches Postgres is the endpoint it posts to — `app/(mainlayout)/assessment/templates/save/route.ts` (moved one segment deeper when `/assessment/templates` became the library page, because Next refuses a page and a route handler in one segment), which writes the record and item rows through `lib/flow/templates.ts`. The save writes `record.author_user_id` from the session, so a template written here appears under "Mine" on `/assessment/templates`; a save from a request with no session would write NULL and read as a built-in, which cannot happen because the route gates on `currentUser()`. Since #255 this is the app's only writer of a template; the four seeded ones come from `data/assessments.ts` and carry no author.

- `/dashboard` — **db**
  - capability: The signed-in console's Overview: four counts of the viewer's own relationships — awaiting the other party, needing the viewer's answers, complete and unread — plus the templates available, each figure linking to the list it counts.
  - components: `components/console`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/my-instances.ts`, `lib/db/rows.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/server.ts`
  - notes: Every figure is arithmetic over `listMyInstances(user.userId)` plus the length of the published-template read, and each card links to `/assessment/instances?filter=<id>` (or `/assessment` for the templates) where the same predicate filters the same array (`lib/flow/overview.ts`), so a count cannot disagree with its list. No percentage, no total, and no authored metric: the numbers `data/pages/dashboard.ts` rejected for `/dashboard/user` (#164) have no equivalent here and were not re-created. The blind rule holds by construction — the three relationship counts are the three `MyInstanceState` values, derived from the viewer's own answered count and their own `unlock_seen_at`.

- `/demo` — **mock**
  - capability: The demo PIN gate: one four-digit field and a submit. A correct PIN sets a signed, httpOnly unlock cookie and redirects to `/login`, where the three role buttons appear.
  - components: `components/auth`, `components/ui`
  - reads: 3 fixture modules of page copy, assets or decisions — no records
  - notes: Exists only under DEMO_AUTH=1, and refused when VERCEL_ENV=production unless DEMO_ALLOW_PRODUCTION=1 is also set; outside demo mode the route answers the same 404 a URL that never existed does. `mock` rather than `db` since #218: the gate reads no Postgres — it compares the PIN and signs a cookie, and the credential read moved to the role action behind `/login`.

- `/demo/admin` — **db**
  - capability: The admin-only check the demo's role buttons prove: it prints the session and the role it read from Postgres, and a member account asking for it gets a 404 rather than a 403. Reachable by URL — the demo's Admin button lands on `/admin/instances` instead, and this page's own button opens it.
  - components: `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: The first caller of requireAdmin(); a demo-only surface, so it answers 404 outside demo mode like every other /demo route. A proof, not a destination: nothing in the flow links here.

- `/invite/[token]` — **db**
  - capability: What an invitation says, and the button that claims it — a single-use token spent by a POST once the invited party accepts.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/rows.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/server.ts`

- `/v1` — **prototype**
  - capability: The prototype's persona picker — a stand-in for /login that offers the six personas instead of an email/password form, and lands the chosen persona on their own screen.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/admin` — **prototype**
  - capability: The Admin persona's landing: every relationship and template in the store, with the gap aggregates counted across the population.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/coach` — **prototype**
  - capability: The Coach persona's landing — read-only observation of relationships shared with the coach, with an advice thread and no scoring or answering.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/counterparty` — **prototype**
  - capability: The Counterparty persona's landing: claimable invitations and the relationships they have joined, each pointing at the shared answer sheet.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/initiator` — **prototype**
  - capability: The Initiator persona's landing: their templates, their relationships, and the counts that link to each list.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/initiator/relationships` — **prototype**
  - capability: The Initiator's relationships and invitations, with the invite and re-invite action inline on each row.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/initiator/templates` — **prototype**
  - capability: The Initiator's template library, with an inline form that copies a template into a relationship.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/initiator/templates/new` — **prototype**
  - capability: The template author — a variation of the quiz editor that writes a template to the in-browser store.
  - components: `components/ui`, `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/pricing` — **prototype**
  - capability: The four plan tiers re-painted from the live fixture, with every paid CTA disabled so nothing is charged in the prototype.
  - components: `components/v1`
  - reads: an `/api` path — `data/billing-plans.ts`

- `/v1/privacy` — **prototype**
  - capability: The same draft Privacy Policy the live page renders, shown inside the prototype's chrome.
  - components: `components/legal`
  - reads: 3 fixture modules of page copy, assets or decisions — no records

- `/v1/relationships/[id]` — **prototype**
  - capability: The one screen every role opens a relationship from — invitation, claim, progress, the blind answers table and the advice thread.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/relationships/[id]/answer` — **prototype**
  - capability: The answer sheet — one party answers every Aspect, Feel and Wish (or all four in Advanced Mode), then submits.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/relationships/[id]/report` — **prototype**
  - capability: The report — the eight gap kinds grouped under the glossary's headings, with the Setting's verdict on top, unlocked only when both parties have submitted.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/service` — **prototype**
  - capability: The Service user's landing: the support queue of invitations, accounts and stuck relationships, with a resolve action per ticket.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/fixtures.ts`

- `/v1/support` — **prototype**
  - capability: The help centre stated without the taxonomy the alignment build does not offer, reading the brand record's mailbox for the contact line.
  - components: `components/v1`
  - reads: an `/api` path — `data/billing-plans.ts`

- `/v1/templates` — **prototype**
  - capability: The catalogue of six relationship types — one card each with the name, who it is for, its Aspect count, the price, and the two actions View and See an example.
  - components: `components/v1`
  - reads: 1 record fixture — `data/v1/relationship-types.ts`

- `/v1/templates/[type]` — **prototype**
  - capability: The template page a person decides on — who the type is for and not for, the Aspects listed plainly, a three-step session walkthrough with the blind rule, the price with the counterparty paying nothing, and one primary Start action.
  - components: `components/v1`
  - reads: 2 record fixtures — `data/v1/fixtures.ts`, `data/v1/relationship-types.ts`

- `/v1/templates/[type]/demo` — **prototype**
  - capability: A real completed-session report rendered from fixture answers for the type, labelled Example with You/Them names, sharing the live report's body component — the value shown before anyone pays.
  - components: `components/v1`
  - reads: 2 record fixtures — `data/v1/fixtures.ts`, `data/v1/relationship-types.ts`

- `/v1/terms` — **prototype**
  - capability: The same draft Terms of Service the live page renders, shown inside the prototype's chrome.
  - components: `components/legal`
  - reads: 3 fixture modules of page copy, assets or decisions — no records

- `/welcome` — **fixture**
  - capability: The public AlignSynch landing page in its own chrome: what a Gap is, how it works, four opinions and two modes.
  - components: `components/marketing`, `components/ui`
  - reads: 3 fixture modules of page copy, assets or decisions — no records

### Component domains

- `components/admin` — **mock**
  - capability: The operator's registry table: a stage tab row, mode and Setting selects and a stalled toggle over one filterable table of relationships.
  - files (1): `instance-registry.tsx`
  - routes (1): `/admin/instances`
  - notes: `mock` in this file's vocabulary — it renders the props it is handed. The rows are read by the page (`lib/db/admin-instances.ts`) and passed down, because a client component must not reach `pg`; that boundary is why this domain imports no data module and why the route entry above is the one that claims `db`.

- `components/assessment` — **mock**
  - capability: The assessment report: each Aspect's two Opinions, the Values behind them and the Gap between the parties.
  - files (2): `assessment-report.tsx`, `assessment-unreadable.tsx`
  - routes (2): `/assessment/[slug]`, `/assessment/instances/[instanceId]`
  - notes: Reads nothing itself — the instance arrives as props from the route that read Postgres, which is why the surface is `mock` and the route above it is `db`. Since #204 it also draws the one failure state the route can describe: `assessment-unreadable.tsx` prints the database layer's own sentence when the read did not answer, instead of Next's 500 and a digest.

- `components/assessment-flow` — **db**
  - capability: The two-party flow: the published template list, the invite view, the blind answer form and the instance screen both parties share.
  - files (10): `answer-form.tsx`, `instance-view.tsx`, `invite-link.tsx`, `invite-view.tsx`, `my-instances.tsx`, `reinvite-form.tsx`, `template-detail.tsx`, `template-form.tsx`, `template-library.tsx`, `template-list.tsx`
  - routes (7): `/assessment`, `/assessment/instances`, `/assessment/instances/[instanceId]`, `/assessment/templates`, `/assessment/templates/[templateId]`, `/assessment/templates/new`, `/invite/[token]`
  - notes: Reads and writes Postgres through lib/flow/store.ts, so it is not a prop-only domain like components/assessment beside it.

- `components/console` — **mock**
  - capability: The console's generic shapes: a stat-card grid of linked figures with the Overview built from it (a header naming the viewer, four counts and the honest empty state for an account with no relationships), and the response-analytics surface — a population's numbers as stat cards, one distribution per measure and a comparison axis, taking the aggregate as a prop so the measure is a plugin rather than a component.
  - files (4): `gap-analysis.tsx`, `gap-histogram.tsx`, `overview.tsx`, `stat-card-grid.tsx`
  - routes (2): `/admin/gaps`, `/dashboard`
  - notes: Reads nothing itself: counts and aggregates arrive as props from the route that read Postgres, which is why the domain is `mock` and the `/dashboard` and `/admin/gaps` routes above it are `db` (the same split `components/assessment` records). `stat-card-grid.tsx` is the extracted shape of `components/dashboard/dashboard-overview.tsx` with its metrics removed — `value` is a `number` the caller computed — so the next expression can pass its own rows through the grid without inheriting a wallet balance. Its two callers are `/dashboard` (the viewer's own counts, `lib/flow/overview.ts`) and `/admin/gaps` with AlignSynch's measure (`gapOf` over the eight kinds, `lib/admin/gap-aggregates.ts`); the quiz expression of the analytics surface is the per-question correct rate `components/my-quizzes/quiz-statistics.tsx` mocks. `data/pages/overview.ts` holds every word (E23 budget 0).

- `components/marketing` — **fixture**
  - capability: The public pages' own chrome: the marketing header (the brand mark, the shell's public menu and a server-resolved account slot) and the landing page's bands. The footer is the shell's (`components/layout/footer.tsx`), mounted by the group's layout; there is no sidebar.
  - files (2): `marketing-header.tsx`, `marketing-landing.tsx`
  - routes (1): `/welcome`

- `components/v1` — **prototype**
  - capability: The /v1 prototype — the whole AlignSynch product, UI-only, against an in-browser store rather than Postgres.
  - files (22): `admin-home.tsx`, `answer-sheet.tsx`, `coach-home.tsx`, `counterparty-home.tsx`, `initiator-overview.tsx`, `manage-tab.tsx`, `marketing-views.tsx`, `persona-bar.tsx`, `persona-picker.tsx`, `relationship-detail.tsx`, `relationship-list.tsx`, `report-body.tsx`, `report-view.tsx`, `service-home.tsx`, `start-relationship-button.tsx`, `template-catalogue.tsx`, `template-demo.tsx`, `template-editor.tsx`, `template-library.tsx`, `template-page.tsx`, `v1-shell.tsx`, `v1-ui.tsx`
  - routes (17): `/v1`, `/v1/admin`, `/v1/coach`, `/v1/counterparty`, `/v1/initiator`, `/v1/initiator/relationships`, `/v1/initiator/templates`, `/v1/initiator/templates/new`, `/v1/pricing`, `/v1/relationships/[id]`, `/v1/relationships/[id]/answer`, `/v1/relationships/[id]/report`, `/v1/service`, `/v1/support`, `/v1/templates`, `/v1/templates/[type]`, `/v1/templates/[type]/demo`
  - notes: Guardrail #336, version 1. The whole /v1 prototype: six personas with the persona bar as the auth stand-in, an in-browser store (templates, relationships, accounts, tickets) seeded from `data/v1/fixtures.ts`, and the real gap/stage arithmetic wrapped by `lib/v1/derive.ts`. The template editor (`template-editor.tsx`) varies `components/create/quiz-editor.tsx` (tabbed authoring, per-Aspect accordions, store-backed Save/Publish/Archive/Delete, no preview); the answer sheet, report, lists and the persona picker vary their `components/assessment-flow` / `components/auth` ancestors the same way. The public relationship taxonomy (`data/v1/relationship-types.ts` — six types with Aspect sets) drives `template-catalogue.tsx`, `template-page.tsx` and `template-demo.tsx`; the report's body is extracted into `report-body.tsx` so the live report and the demo share one renderer, and `start-relationship-button.tsx` is the prototype's Start CTA. `prototype` until the owner approves it.

## QuizHub

### Routes

- `/affiliate` — **fixture**
  - capability: The affiliate programme: how to start earning, the profit calculator, programme features, success stories, FAQ and a closing CTA. Not freely available: `commerce.affiliate` ships it off on every template, and the route answers 404 while it is off (#291).
  - components: `components/affiliate`, `components/layout`, `components/media`, `components/ui`
  - reads: 1 record fixture — `data/metrics.ts`

- `/battle` — **fixture**
  - capability: A head-to-head quiz battle: choose a mode, join a lobby, play the same question set live and land on a results screen.
  - components: `components/battle`, `components/media`, `components/ui`
  - reads: 1 record fixture — `data/battle-modes.ts`

- `/categories` — **fixture**
  - capability: Every quiz category as a tile generated from its slug, with a how-it-works block and a closing CTA.
  - components: `components/categories`, `components/layout`, `components/media`, `components/ui`
  - reads: 9 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/categories.ts` (+6 more)

- `/categories/[slug]` — **fixture**
  - capability: One category's quizzes, under the tile generated for that category.
  - components: `components/categories`, `components/media`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/create/editor` — **mock**
  - capability: Hand-write a quiz in an editor: questions, answer options, media slots and a live draft pane.
  - components: `components/create`, `components/ui`
  - reads: 1 fixture module of page copy, assets or decisions — no records
  - notes: The editor state is literals inside components/create — nothing is saved anywhere.

- `/create/generator` — **fixture**
  - capability: Generate a quiz from a topic, a difficulty and a count, previewing the draft the generator would emit.
  - components: `components/create`, `components/ui`
  - reads: 2 record fixtures — `data/mock-quizzes.ts`, `data/reward-windows.ts`

- `/creator-tips` — **fixture**
  - capability: Editorial tips for quiz creators, browsable by category with featured and latest grids.
  - components: `components/creator-tips`, `components/layout`, `components/media`, `components/ui`
  - reads: 6 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+3 more)

- `/creator-tips/[slug]` — **fixture**
  - capability: One creator-tip article, with its related tips.
  - components: `components/content`, `components/creator-tips`, `components/layout`, `components/media`, `components/ui`
  - reads: 6 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+3 more)

- `/daily-challenge` — **fixture**
  - capability: One quiz a day: today's quiz, your challenge stats, a daily leaderboard, badge progress and your history.
  - components: `components/daily-challenge`, `components/media`, `components/ui`
  - reads: 3 record fixtures — `data/daily-challenge.ts`, `data/metrics.ts`, `data/players.ts`

- `/explore` — **fixture**
  - capability: Explore quizzes through one shelf per catalogue slot, with filters, featured cards and a category strip.
  - components: `components/explore`, `components/media`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/explore/featured` — **fixture**
  - capability: The featured tabs: one six-card shelf block per featured slot.
  - components: `components/explore`, `components/media`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/leaderboard` — **fixture**
  - capability: The player leaderboard: podium, summary stats and a filterable ranked table. Not freely available: `community.leaderboard` ships it off for every visitor, and only an admin session reaches it — through the flag's `adminBypass` (#184) — while its rows are still the `data/players.ts` mock.
  - components: `components/leaderboard`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: The Postgres reach listed here is the flag's role gate (`lib/auth/require-role.ts` reading `user_profile.role`), not the boards: the rows the page renders are still `data/players.ts`, and the read happens before them.

- `/my-quizzes` — **fixture**
  - capability: Your own quizzes — drafts, published and their analytics — as a grid of quiz cards.
  - components: `components/media`, `components/my-quizzes`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/my-quizzes/[id]` — **fixture**
  - capability: One of your quizzes in detail: its questions, results, analytics and reward window.
  - components: `components/media`, `components/my-quizzes`, `components/ui`
  - reads: 10 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+7 more)

- `/my-quizzes/[id]/statistics` — **mock**
  - capability: Per-quiz statistics: completion, question-level correct rates, time spent and a leaderboard of players.
  - components: `components/media`, `components/my-quizzes`, `components/ui`
  - reads: 2 fixture modules of page copy, assets or decisions — no records
  - notes: The numbers are literals inside components/my-quizzes/quiz-statistics.tsx, headed 'Mock data for the quiz' — no fixture backs them, and this entry records the mock rather than fixing it.

- `/news` — **fixture**
  - capability: Product news and updates, featured first, as article records.
  - components: `components/media`, `components/news`, `components/ui`
  - reads: 6 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+3 more)

- `/news/[slug]` — **fixture**
  - capability: One news article with share, its comment thread, the author and related articles.
  - components: `components/content`, `components/media`, `components/news`, `components/ui`
  - reads: 7 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+4 more)

- `/pricing` — **live**
  - capability: Plan comparison read from billing_plan with a checkout per sellable tier, the viewer's own plan marked, an FAQ and a closing CTA.
  - components: `components/pricing`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts` · an `/api` path — `components/pricing/plan-checkout-button.tsx`, `components/pricing/pricing-plans.tsx`, `data/billing-plans.ts`, `lib/auth/server.ts`

- `/quiz-discussions` — **fixture**
  - capability: Every discussion thread across quizzes, with each quiz's comment count and result beside it.
  - components: `components/media`, `components/quiz`, `components/ui`
  - reads: 10 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+7 more)

- `/quiz/[id]` — **fixture**
  - capability: One quiz's overview: header, details, question preview, reviews and the play entry point.
  - components: `components/media`, `components/quiz`, `components/ui`
  - reads: 13 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+10 more)

- `/quiz/[id]/discussion` — **fixture**
  - capability: The comment thread under one quiz.
  - components: `components/media`, `components/quiz`, `components/ui`
  - reads: 10 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+7 more)

- `/quiz/[id]/play` — **fixture**
  - capability: Play one quiz question by question, with a timer, the results screen and a review modal.
  - components: `components/quiz`, `components/ui`
  - reads: 8 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+5 more)

- `/search` — **fixture**
  - capability: Search the built index over quizzes and categories, rendering hits as quiz cards.
  - components: `components/search`, `components/ui`
  - reads: 11 record fixtures — `data/assessments.ts`, `data/authored-quizzes.ts`, `data/browse-quizzes.ts` (+8 more)

- `/tournaments` — **fixture**
  - capability: Quiz tournaments: the featured championship, the full list, categories, how it works and a CTA.
  - components: `components/layout`, `components/media`, `components/tournaments`, `components/ui`
  - reads: 1 record fixture — `data/metrics.ts`

- `/tournaments/[id]` — **fixture**
  - capability: One tournament: overview, key dates, stats, categories, rules, prizes and its leaderboard.
  - components: `components/media`, `components/tournaments`, `components/ui`
  - reads: 1 record fixture — `data/metrics.ts`

### Component domains

- `components/affiliate` — **fixture**
  - capability: The nine affiliate-programme sections the /affiliate route composes.
  - files (9): `about-quizhub.tsx`, `affiliate-cta.tsx`, `affiliate-faq.tsx`, `affiliate-hero.tsx`, `how-to-start.tsx`, `profit-calculator.tsx`, `program-features.tsx`, `success-stories.tsx`, `why-partner.tsx`
  - routes (1): `/affiliate`

- `components/battle` — **fixture**
  - capability: The battle screens: mode selection, the lobby, the live round and its results.
  - files (5): `active-battle.tsx`, `battle-lobby.tsx`, `battle-mode-selection.tsx`, `battle-page.tsx`, `battle-results.tsx`
  - routes (1): `/battle`

- `components/categories` — **fixture**
  - capability: The category grid, the tile generated from a slug, the category detail page and the how-it-works block.
  - files (6): `categories-cta.tsx`, `categories-data.tsx`, `categories-how-it-works.tsx`, `categories-page.tsx`, `category-detail-page.tsx`, `category-tile.tsx`
  - routes (3): `/`, `/categories`, `/categories/[slug]`

- `components/create` — **fixture**
  - capability: The quiz editor, the generator form and the draft shape they share.
  - files (4): `quiz-draft.ts`, `quiz-editor.tsx`, `quiz-generator-templates.ts`, `quiz-generator.tsx`
  - routes (2): `/create/editor`, `/create/generator`

- `components/creator-tips` — **fixture**
  - capability: The creator-tips index and detail: hero, category strip, featured tips, tip cards, related tips and the CTA.
  - files (9): `creator-tips-categories.tsx`, `creator-tips-cta.tsx`, `creator-tips-hero.tsx`, `creator-tips-page.tsx`, `featured-tips.tsx`, `related-tips.tsx`, `tip-card.tsx`, `tip-detail.tsx`, `tips-grid.tsx`
  - routes (2): `/creator-tips`, `/creator-tips/[slug]`

- `components/daily-challenge` — **fixture**
  - capability: The daily challenge: header, today's quiz, your stats, the daily leaderboard, rewards, history and the completed state.
  - files (8): `completed-challenge.tsx`, `daily-challenge-header.tsx`, `daily-challenge-page.tsx`, `daily-history.tsx`, `daily-leaderboard.tsx`, `daily-quiz.tsx`, `daily-rewards.tsx`, `daily-stats.tsx`
  - routes (1): `/daily-challenge`

- `components/dashboard` — **fixture**
  - capability: The prototype dashboard shell: overview, affiliate and wallet panes, an earnings chart, my-quizzes and settings panes.
  - files (9): `affiliate-dashboard.tsx`, `dashboard-header.tsx`, `dashboard-overview.tsx`, `dashboard-page.tsx`, `earnings-chart.tsx`, `my-quizzes-dashboard.tsx`, `recent-quizzes.tsx`, `settings-dashboard.tsx`, `wallet-dashboard.tsx`
  - routes: none — no route imports this domain today
  - notes: No route renders this domain any more — /dashboard/user is the account home since #164, and only dashboard-page.tsx imports the panes. A candidate to delete or to relayout, not a surface to pick yet.

- `components/explore` — **fixture**
  - capability: The explore page and its featured twin: header, filters, quiz lists, the category strip and shelf blocks.
  - files (7): `explore-categories.tsx`, `explore-featured.tsx`, `explore-filters.tsx`, `explore-header.tsx`, `explore-quiz-list.tsx`, `explore-quizzes-page.tsx`, `featured-quizzes-page.tsx`
  - routes (2): `/explore`, `/explore/featured`

- `components/header` — **fixture**
  - capability: The chat drawer, the notification drawer and the notification icon the shell header used to mount.
  - files (3): `ChatDrawer.tsx`, `NotificationDrawer.tsx`, `notification-icon.tsx`
  - routes: none — no route imports this domain today
  - notes: No route imports this domain: the shell header is components/layout/header.tsx. Catalogued rather than deleted because the drawers read the notification and chat fixtures.

- `components/leaderboard` — **fixture**
  - capability: The leaderboard screens: podium, summary stats, filters and the ranked table.
  - files (5): `leaderboard-filters.tsx`, `leaderboard-page.tsx`, `leaderboard-podium.tsx`, `leaderboard-stats.tsx`, `leaderboard-table.tsx`
  - routes (1): `/leaderboard`

- `components/my-quizzes` — **fixture**
  - capability: Your quizzes, one quiz in detail, and the per-quiz statistics screen.
  - files (3): `my-quizzes.tsx`, `quiz-details.tsx`, `quiz-statistics.tsx`
  - routes (3): `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`

- `components/news` — **fixture**
  - capability: The news index and the article page.
  - files (2): `news-article.tsx`, `news-page.tsx`
  - routes (2): `/news`, `/news/[slug]`

- `components/pricing` — **live**
  - capability: The plan cards — prices and sellability from billing_plan, a checkout button per sellable tier — the FAQ and the closing CTA.
  - files (4): `plan-checkout-button.tsx`, `pricing-cta.tsx`, `pricing-faq.tsx`, `pricing-plans.tsx`
  - routes (1): `/pricing`

- `components/quiz` — **fixture**
  - capability: The quiz surfaces: header, details, question, timer, results, the play screen, comments, discussion and the review modal.
  - files (11): `comment.tsx`, `question-discussion.tsx`, `quiz-details.tsx`, `quiz-discussion-page.tsx`, `quiz-discustion.tsx`, `quiz-header.tsx`, `quiz-play.tsx`, `quiz-question.tsx`, `quiz-results.tsx`, `quiz-timer.tsx`, `review-modal.tsx`
  - routes (4): `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/quiz/[id]/play`

- `components/search` — **mock**
  - capability: The search result list, rendering indexed hits as quiz cards.
  - files (1): `search-results.tsx`
  - routes (1): `/search`
  - notes: Renders the rows the route hands it; the index itself is data/searchdata.ts.

- `components/settings` — **fixture**
  - capability: Ten account panes: account, appearance, connected accounts, notifications, privacy, profile, quiz preferences, security, subscription and the missing-icon set.
  - files (10): `account-settings.tsx`, `appearance-settings.tsx`, `connected-accounts.tsx`, `missing-icons.tsx`, `notification-settings.tsx`, `privacy-settings.tsx`, `profile-settings.tsx`, `quiz-preferences.tsx`, `security-settings.tsx`, `subscription-settings.tsx`
  - routes: none — no route imports this domain today
  - notes: No route renders this domain — /settings is components/identity/settings-view since #164. The panes are the prototype's, and they are catalogued so a template can pick one rather than rediscover it.

- `components/tournaments` — **fixture**
  - capability: The tournament screens: featured, list, filters, categories, detail, overview, key dates, rules, prizes, leaderboard, discussion, CTA and the id helper they share.
  - files (17): `featured-tournament.tsx`, `tournament-categories.tsx`, `tournament-cta.tsx`, `tournament-detail.tsx`, `tournament-discussion.tsx`, `tournament-filters.tsx`, `tournament-header.tsx`, `tournament-how-it-works.tsx`, `tournament-ids.ts`, `tournament-leaderboard.tsx`, `tournament-list.tsx`, `tournament-overview.tsx`, `tournament-page.tsx`, `tournament-prizes.tsx`, `tournament-rules.tsx`, `tournament-schedule.tsx`, `tournament-testimonials.tsx`
  - routes (2): `/tournaments`, `/tournaments/[id]`

## No template yet

Catalogued, claimed by no template yet.

### Routes

- `/chat` — **fixture**
  - capability: A message thread: conversation list, composer, per-message rendering and a conversation search, over the committed chat fixture.
  - components: `components/chat`, `components/media`, `components/ui`
  - reads: 1 record fixture — `data/chat-data.ts`
  - notes: A messaging mock that neither product story includes yet — quiz play and assessment are the two stories this tree tells — so it is catalogued here for a future template to claim rather than deleted or implemented.

### Component domains

- `components/chat` — **fixture**
  - capability: The chat surfaces: conversation list, thread, composer, message bubble, search and a small dropdown.
  - files (7): `chat-conversation.tsx`, `chat-input.tsx`, `chat-message.tsx`, `chat-page.tsx`, `chat-sidebar.tsx`, `chat-utils.ts`, `simple-dropdown.tsx`
  - routes (1): `/chat`
  - notes: No template claims messaging yet — the same scope decision as /chat, recorded here so the domain is not orphaned in the catalogue.

## Route handlers

HTTP handlers, not screens: they have no `page.tsx` and render nothing, so they carry no template affinity and no status of their own. The surfaces they serve are catalogued above.

- `/api/auth/[...path]` — `app/api/auth/[...path]/route.ts`
- `/api/billing/checkout` — `app/api/billing/checkout/route.ts`
- `/api/billing/webhook` — `app/api/billing/webhook/route.ts`
- `/api/profile` — `app/api/profile/route.ts`
- `/api/version` — `app/api/version/route.ts`
- `/assessment/instances/[instanceId]/answers` — `app/(mainlayout)/assessment/instances/[instanceId]/answers/route.ts`
- `/assessment/instances/[instanceId]/invite` — `app/(mainlayout)/assessment/instances/[instanceId]/invite/route.ts`
- `/assessment/new` — `app/(mainlayout)/assessment/new/route.ts`
- `/assessment/templates/[templateId]/duplicate` — `app/(mainlayout)/assessment/templates/[templateId]/duplicate/route.ts`
- `/assessment/templates/[templateId]/status` — `app/(mainlayout)/assessment/templates/[templateId]/status/route.ts`
- `/assessment/templates/save` — `app/(mainlayout)/assessment/templates/save/route.ts`
- `/invite/[token]/claim` — `app/(mainlayout)/invite/[token]/claim/route.ts`
