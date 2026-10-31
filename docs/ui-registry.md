# UI registry

Every surface this tree can render, as a resource a template can pick from rather than a set of screens somebody has to remember. This page is generated: do not edit it.

It has two halves, and each one is owned by a different place:

- **structural** — every component domain with its file count and files, and which routes import it. Derived from `components/` and `app/` by `scripts/gen-ui-registry.mjs` on every run; never typed.
- **judgement** — `status`, `templates`, `capability` and an optional `notes` per surface, in `data/ui-registry.ts`, zod-validated. One entry per surface, and a surface is a route or a component domain, never a file.

`bash scripts/verify.sh` regenerates the page and compares it byte for byte, then checks the two halves against each other: a surface in the tree with no entry fails, an entry for a surface that is gone fails, and a `status` the surface's own imports contradict fails. `pnpm ui:registry` is how you fix any of them.

**`templates` is a scope decision, not a render fact.** Both brands render this one route table — `data/brand.ts` swaps a record, not a page — so a surface is listed here under a template when that template's product story needs it: a quiz-specific implementation is QuizHub's, the alignment product's is AlignSynch's, and a surface both need unchanged is under both. A surface no template claims yet has an empty list and sits in _No template yet_, which is where a candidate for the next vertical starts its life.

## Summary

- routes: **45** — 31 static, 14 dynamic, from `app/**/page.tsx`
- component domains: **33** — 237 files under `components/`, 232 of them `.tsx`
- route handlers: **9** — `app/**/route.ts`, listed below and not a UI surface
- status: **mock** 11 · **fixture** 51 · **db** 9 · **live** 7
- templates: Both templates 22 · AlignSynch 12 · QuizHub 42 · No template yet 2
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
  - capability: Sign in with a real Neon Managed Auth session, with pending, invalid-credentials and network states.
  - components: `components/auth`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/demo-accounts.ts` · an `/api` path — `lib/auth/client.ts`, `lib/auth/server.ts`

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
  - reads: 6 record fixtures — `data/article-publication.ts`, `data/creator-tips-data.ts`, `data/knowledge-base-alignsynch-data.ts` (+3 more)

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
  - routes (2): `/privacy`, `/terms`
  - notes: The copy arrives as a prop from `data/pages/legal` (the two route entries claim it), so this domain reads no data module of its own.

- `components/media` — **mock**
  - capability: The one media resolver: a file, a remote URL or a generated default drawn from a seed, in that order, with a fallback on error and no image file behind the last tier.
  - files (2): `generated-avatar.tsx`, `media.tsx`
  - routes (25): `/`, `/affiliate`, `/battle`, `/categories`, `/categories/[slug]`, `/chat`, `/creator-tips`, `/creator-tips/[slug]`, `/daily-challenge`, `/dashboard/user`, `/explore`, `/explore/featured`, `/leaderboard`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/news`, `/news/[slug]`, `/profile/[username]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/settings`, `/tournaments`, `/tournaments/[id]`

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
  - routes (36): `/`, `/affiliate`, `/battle`, `/categories`, `/categories/[slug]`, `/chat`, `/create/editor`, `/create/generator`, `/creator-tips`, `/creator-tips/[slug]`, `/daily-challenge`, `/dashboard/user`, `/demo`, `/demo/admin`, `/explore`, `/explore/featured`, `/leaderboard`, `/login`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/news`, `/news/[slug]`, `/pricing`, `/profile/[username]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/quiz/[id]/play`, `/register`, `/search`, `/settings`, `/support`, `/support/articles/[slug]`, `/tournaments`, `/tournaments/[id]` — and every other route through `app/layout.tsx`
  - notes: Renders only the props it is given; the tokens it paints with come from app/globals.css.

## AlignSynch

### Routes

- `/assessment` — **db**
  - capability: The published assessment templates, each with its create form: pick a template and open a two-party instance from the templates that read from Postgres.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/rows.ts` · an `/api` path — `data/billing-plans.ts`

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

- `/assessment/templates/new` — **fixture**
  - capability: Write a template: a title and one to eight Aspects, each a question with a Left Value and a Right Value, saved as a published record with no parties.
  - components: `components/assessment-flow`
  - reads: an `/api` path — `lib/auth/server.ts`
  - notes: `fixture` and not `db` on purpose: the page renders page copy and resolves the session, and the one thing that reaches Postgres is the endpoint it posts to — `app/(mainlayout)/assessment/templates/route.ts`, which writes the record and item rows through `lib/flow/templates.ts` (no new table, no new column, and no author field, because the content model has none). Signed in only, on both the page and the post. Since #255 this is the app's only writer of a template; the four seeded ones come from `data/assessments.ts`.

- `/demo` — **mock**
  - capability: The demo PIN gate: one four-digit field and a submit. A correct PIN sets a signed, httpOnly unlock cookie and redirects to `/login`, where the three role buttons appear.
  - components: `components/auth`, `components/ui`
  - reads: 3 fixture modules of page copy, assets or decisions — no records
  - notes: Exists only under DEMO_AUTH=1, and refused when VERCEL_ENV=production unless DEMO_ALLOW_PRODUCTION=1 is also set; outside demo mode the route answers the same 404 a URL that never existed does. `mock` rather than `db` since #218: the gate reads no Postgres — it compares the PIN and signs a cookie, and the credential read moved to the role action behind `/login`.

- `/demo/admin` — **db**
  - capability: The admin-only check behind the demo's Admin role button (drawn on `/login` under a valid unlock): it prints the session it read from Postgres, and a member account asking for it gets a 404 rather than a 403.
  - components: `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/server.ts`
  - notes: The first caller of requireAdmin(); a demo-only surface, so it answers 404 outside demo mode like every other /demo route.

- `/invite/[token]` — **db**
  - capability: What an invitation says, and the button that claims it — a single-use token spent by a POST once the invited party accepts.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/rows.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/server.ts`

- `/welcome` — **fixture**
  - capability: The public AlignSynch landing page in its own chrome: what a Gap is, how it works, four opinions and two modes.
  - components: `components/marketing`
  - reads: 3 fixture modules of page copy, assets or decisions — no records

### Component domains

- `components/assessment` — **mock**
  - capability: The assessment report: each Aspect's two Opinions, the Values behind them and the Gap between the parties.
  - files (2): `assessment-report.tsx`, `assessment-unreadable.tsx`
  - routes (2): `/assessment/[slug]`, `/assessment/instances/[instanceId]`
  - notes: Reads nothing itself — the instance arrives as props from the route that read Postgres, which is why the surface is `mock` and the route above it is `db`. Since #204 it also draws the one failure state the route can describe: `assessment-unreadable.tsx` prints the database layer's own sentence when the read did not answer, instead of Next's 500 and a digest.

- `components/assessment-flow` — **db**
  - capability: The two-party flow: the published template list, the invite view, the blind answer form and the instance screen both parties share.
  - files (8): `answer-form.tsx`, `instance-view.tsx`, `invite-link.tsx`, `invite-view.tsx`, `my-instances.tsx`, `reinvite-form.tsx`, `template-form.tsx`, `template-list.tsx`
  - routes (5): `/assessment`, `/assessment/instances`, `/assessment/instances/[instanceId]`, `/assessment/templates/new`, `/invite/[token]`
  - notes: Reads and writes Postgres through lib/flow/store.ts, so it is not a prop-only domain like components/assessment beside it.

- `components/marketing` — **fixture**
  - capability: The AlignSynch landing sections — its own header, body and footer — rendered in their own chrome with no sidebar.
  - files (3): `marketing-footer.tsx`, `marketing-header.tsx`, `marketing-landing.tsx`
  - routes (1): `/welcome`

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
- `/assessment/instances/[instanceId]/answers` — `app/(mainlayout)/assessment/instances/[instanceId]/answers/route.ts`
- `/assessment/instances/[instanceId]/invite` — `app/(mainlayout)/assessment/instances/[instanceId]/invite/route.ts`
- `/assessment/new` — `app/(mainlayout)/assessment/new/route.ts`
- `/assessment/templates` — `app/(mainlayout)/assessment/templates/route.ts`
- `/invite/[token]/claim` — `app/(mainlayout)/invite/[token]/claim/route.ts`
