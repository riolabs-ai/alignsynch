# The QuizHub capability map

Every surface the quiz expression can put in front of a reader, what each one is actually made of
today, and what it would cost to make it what it looks like. This is the registry the template
doctrine refers to: **what this template can do**, so a future brand picks from it instead of
inventing a screen and a data model beside it.

Measured at `0ebc7828` (`origin/main`, 2026-11-01) by reading every page module in the list and the
components in its import closure — not by reading the specification PDF (that analysis is
[SPEC-DRIFT.md](SPEC-DRIFT.md) and [specs/](specs/)), and not by trusting
[ui-registry.md](ui-registry.md), which answers a narrower question (§1.4).

**This is a registry, not a backlog.** Nothing here is proposed, scheduled or estimated in days. A
capability's size is written as tables, endpoints and screens — the countable parts — and where a
number cannot be counted it says `unknown`.

## How a row was decided

For each route: open the page module, follow every import into `components/`, then follow what those
components read. The row records five things and the fourth is the point of the document:

| column                            | what it answers                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `route`                           | the pattern as `content/routes.ts` spells it, exercised with the params [boundary.ts](../tests/parity/boundary.ts) uses |
| `component(s)`                    | the page module's component closure — the files that decide what is drawn                                               |
| `what it presents today`          | the screen as a reader meets it, in one clause per band                                                                 |
| `data source today`               | **what the records on that screen are made of** — the honesty mechanism                                                 |
| `what a full-stack version needs` | the rows, endpoints and rules that are missing, in the order they would have to land                                    |

### The four data-source values

The same four the registry uses, with one clarification this page needed in practice:

- **`fixture`** — the records the screen presents are projected from a committed module under `data/`
  (directly, or through `lib/quiz-cards.ts`, `lib/players.ts`, `lib/article-records.ts`,
  `lib/quiz-detail.ts`). A fixture is real _data_: it is authored once, checked by `data:check`, and
  swapping a row changes the screen.
- **`db`** — at least one record the screen presents was read from Postgres through `lib/db/**`.
- **`mock`** — the records are literals **inside the component file**, or values invented at render
  (`Math.random`). This is the value that matters most: a mock looks exactly like a fixture on
  screen, and nothing distinguishes them in a review except the import list.
- **`none`** — nothing is presented but copy. No records at all, in any form.

Two boundary calls, made once so each row can be read:

1. **A number is not a record.** A metric literal from `data/metrics.ts` does not make a surface
   `fixture` if the rows around it are component literals. The column answers "what are the rows",
   and the footnotes name the metric fixture where one is also read.
2. **Page copy is copy.** A surface whose only reach is `data/pages/**` is `none`. `data/pages/**`
   is the wording of a screen, not a record of anything.

## Part 1 — the surfaces, measured per route

### 1.1 The twenty-two routes the quiz product owns

These are the routes `requireQuizProduct()` closes on the alignment build
([boundary.ts](../tests/parity/boundary.ts)). Every one of them renders on `quizhub`.

| route                         | component(s)                                                                       | what it presents today                                                                                                                                              | data source today | what a full-stack version needs                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/daily-challenge`            | `components/daily-challenge/**` (8)                                                | today's five-question challenge, four header stats, a performance/category chart pair, a five-day history, three daily boards, six badges and streak rewards¹       | **mock**          | a `daily_challenge` row per day (date, quiz, window, published), one attempt per player, a submit endpoint, a board query scoped to that day's window, and badge awards as rows                                 |
| `/categories`                 | `categories-page.tsx`, `category-tile.tsx`                                         | 25 subject tiles with a count per subject, a client-side search filter, a how-it-works band, the footer                                                             | **fixture**       | nothing for the list itself; the counts need a `record_category` join and a `count(*)` over published records, and the search must narrow a query rather than a 25-element array                                |
| `/categories/[slug]`          | `category-detail-page.tsx`                                                         | one subject's quizzes as cards from a committed shelf, the subject's generated tile, a 404 when the slug is not a subject                                           | **fixture**       | a category row, a join to records, and a paginated read; today the set is one hardcoded shelf and an unknown slug cannot be per-record                                                                          |
| `/battle`                     | `components/battle/**` (5)                                                         | mode selection (2 modes), a lobby of invented players, a live round whose scores and times are invented at render, results with a rematch¹                          | **mock**          | a match row with participants, a server-authoritative question feed, per-answer timing stored server-side, a scoring service the client cannot run, and a transport (WS/SSE, or a poll with a cursor)           |
| `/explore`                    | `components/explore/**` (7)                                                        | three curated shelves as tabs, three cards each, a filter row, a category strip, a grid/list toggle                                                                 | **fixture**       | a curation table (shelf, position, quiz), a search index, and sort/filter over aggregates that are actually earned (plays, rating) — the campaign overlay model exists (`data/promotions.ts`) but has no table  |
| `/explore/featured`           | `featured-quizzes-page.tsx`                                                        | the same three shelves as paginated tabs, 9 per page                                                                                                                | **fixture**       | the same as `/explore`, plus a promotion table keyed `(quizId, slot, window)`; the slot names are already declared and checked (`data:check` E28)                                                               |
| `/tournaments`                | `components/tournaments/**` (17)                                                   | a featured championship, six tournament cards from one component literal, category chips, four filters, how-it-works, testimonials¹                                 | **mock**          | `tournament` rows (format, rounds, questions per round, entry window, prize, status), `tournament_entry` rows, and standings as a view over results; the chips and filters already name values, the rows do not |
| `/tournaments/[id]`           | `tournament-detail.tsx` + six tab panels                                           | one record chosen from a two-id allow-list, then overview, key dates, rules, a leaderboard of ten inline rows, prizes, schedule and a discussion of inline threads¹ | **mock**          | the tournament row, its rounds and schedule as rows, standings as a query, discussion as comments — and a real 404 instead of an allow-list in `tournament-ids.ts`                                              |
| `/creator-tips`               | `components/creator-tips/**` (9)                                                   | six tip articles as cards, a category strip, a featured band, a grid                                                                                                | **fixture**       | an article record per tip through `lib/article-records.ts` (the seam already exists); `record.record_type = 'article'` is already legal in the schema                                                           |
| `/creator-tips/[slug]`        | `tip-detail.tsx`                                                                   | one article body through the block renderer, related tips by category, a 404 for an unpublished tip                                                                 | **fixture**       | the record read by slug; nothing else changes, because the published-only rule is already one function                                                                                                          |
| `/quiz-discussions`           | `quiz-discussion-page.tsx`                                                         | every discussion across quizzes, each with a comment count, last activity, the quiz and the viewer's result                                                         | **fixture**       | a `quiz_comment` table with authorship, an aggregate query for count and last activity, pagination, and a moderation state                                                                                      |
| `/quiz/[id]`                  | `quiz-details.tsx` (700 lines)                                                     | the record's card, a question preview, a leaderboard tab and a reviews tab — and a literal template card when the id is not a record                                | **fixture**       | a record read (`record` / `item` / `response_option` exist), a reviews table, a results table, and an end to the template fallback once every URL is a row                                                      |
| `/quiz/[id]/play`             | `quiz-play.tsx` (486), `quiz-question.tsx`, `quiz-results.tsx`, `review-modal.tsx` | the record's questions one at a time, a timer, per-answer feedback, a results screen, a review modal; correctness is `optionId === correctOptionId` in the browser  | **fixture**       | an attempt row created when play starts (that is what resume needs), one idempotent submit, a server-side grader, and a result row — `item` has no `correct_option_id` column today                             |
| `/quiz/[id]/discussion`       | `quiz-discustion.tsx`                                                              | the viewer's result beside per-question threads                                                                                                                     | **fixture**       | a result row for the viewer, comments as rows (threading is already exactly one level), and a view that stays correct when replayed after submit                                                                |
| `/create/editor`              | `quiz-editor.tsx` (701), `quiz-draft.ts`                                           | a local draft form — questions, options, media slots, settings — seeded with an "Untitled Quiz" literal; save shows a toast                                         | **mock**          | a write path (there is no quiz endpoint at all), drafts as rows, `record.author_user_id` (the column exists), versioning so two tabs cannot overwrite, and the publish transition                               |
| `/create/generator`           | `quiz-generator.tsx`, `quiz-generator-templates.ts`                                | N drafts composed from the 20 `data/mock-quizzes` templates by the topic word typed and a difficulty filter, then handed to the editor                              | **fixture**       | a template library as rows, a generator (model or rules) behind one function, and the same save path as the editor; today "generation" is a shuffle and a retitle                                               |
| `/my-quizzes`                 | `my-quizzes.tsx` (569)                                                             | six authoring cards from the `myQuizzes` shelf with status tabs, search, a per-row action menu, and analytics on each card                                          | **fixture**       | ownership (`record.author_user_id` exists), status from the row, and the three analytics numbers as aggregates over attempts instead of `data/quiz-analytics.ts`                                                |
| `/my-quizzes/[id]`            | `my-quizzes/quiz-details.tsx` (548)                                                | one record's questions, five recent players, per-question accuracy, an analytics snapshot                                                                           | **fixture**       | a record read, a results join for the players table, and accuracy as a per-item aggregate over stored answers instead of an array projection                                                                    |
| `/my-quizzes/[id]/statistics` | `quiz-statistics.tsx` (1,100)                                                      | four tabbed panels — overview, question analysis, player demographics, engagement — every number from one literal object; the route's `id` is accepted and ignored  | **mock**          | everything: attempts and answers as rows, time buckets, per-question aggregates, and a demographic split the model does not have at all                                                                         |
| `/affiliate`                  | `components/affiliate/**` (9)                                                      | nine bands — how to start, a profit calculator computing locally, features, success stories, FAQ, CTA — over `data/metrics.ts`¹                                     | **fixture**       | an affiliate row per account, referral attribution, conversions, and a payout ledger with webhooks; the flag says exactly this and ships the page off on every brand                                            |
| `/chat`                       | `components/chat/**` (7)                                                           | contacts and conversations from `data/chat-data.ts`, a composer that appends locally and invents a reply after a random delay¹                                      | **fixture**       | `conversation` / `message` rows, membership, a transport, read state and a retention rule; nothing persists today, not even for the sender                                                                      |
| `/dashboard/user`             | `components/identity/account-home.tsx`                                             | the signed-in person's name, email and saved profile, plus three honest empty states ("nothing here yet")                                                           | **db**            | once quizzes and attempts are rows, the three empty states become three queries; this is already the only quiz route that reads Postgres                                                                        |

¹ _Mixed rows, named precisely._ The column answers "what are the rows", so a surface that reads a
fixture for its numbers and holds its records in the component is still `mock`; the reverse is never
true.

- `/daily-challenge` — the questions (`dailyQuizData`), the five history rows and the two chart
  series are literals in `daily-quiz.tsx`, `daily-history.tsx` and `daily-stats.tsx`. The header
  numbers are `data/metrics.ts`, the six badges `data/daily-challenge.ts`, the three boards
  `data/players.ts` through `lib/players.ts`. The completed-state rank is
  `Math.floor(Math.random() * 50) + 1`.
- `/battle` — `battleModes` and the round options are `data/battle-modes.ts`; the two player arrays,
  the six-player lobby and every final score are in `battle-page.tsx`, drifting in `active-battle.tsx`
  and invented again in `handleBattleComplete`.
- `/tournaments` — `featured-tournament.tsx` and the prizes/rules bands read `data/metrics.ts`; the
  six-card list is a literal in `tournament-list.tsx`, with its own `category`, `prize` and
  `participants` per row.
- `/tournaments/[id]` — the record is a literal in `tournament-detail.tsx` switched on the id; the
  leaderboard is `leaderboardData` in `tournament-leaderboard.tsx`, the discussion is
  `mockDiscussions` + `mockComments`, and the subjects are `TOURNAMENT_SUBJECTS`.
- `/affiliate` — every record the programme would need (referral, conversion, payout) is absent;
  what the page has is `data/metrics.ts` numbers and words. `commerce.affiliate` is `false` on every
  template, so the route answers 404 before any of it renders.
- `/chat` — `mockContacts` and `mockConversations` are `data/chat-data.ts`, so the seed is a fixture;
  the send path is the mock (local append plus `Math.random() * 2000 + 1000` ms reply).

**The fourteen records that no fixture holds.** Counting the literals named above: four in
`components/daily-challenge/`, two player arrays in `components/battle/`, one in
`components/tournaments/tournament-list.tsx`, five on the tournament detail route, one seeded draft
in `components/create/quiz-editor.tsx`, one dataset in
`components/my-quizzes/quiz-statistics.tsx`. Six of the twenty-two routes read at least one.

#### Totals — the twenty-two routes

| data source | routes |
| ----------- | ------ |
| **fixture** | **15** |
| **db**      | **1**  |
| **mock**    | **6**  |
| **none**    | **0**  |

So: **15 fixture, 1 db, 6 mock, 0 none — 22 routes.** No quiz route renders from Postgres except the
account home, and six of the twenty-two invent their records at render time.

### 1.2 The other twenty-eight routes in `content/routes.ts`

`content/routes.ts` holds 50 patterns (35 static, 15 dynamic) and `data:check` E10 holds it to the
filesystem in both directions. The 22 above are the quiz product's; these 28 are the rest, and they
render on `quizhub` as well — the shared account and chrome surfaces both expressions use, the
alignment console (which nothing 404s on the quiz build), and the legal and auth pages.

| route                                | component(s)                                               | what it presents today                                                                                                         | data source today | what a full-stack version needs                                                                                         |
| ------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/`                                  | `components/home/**` (11)                                  | a closed switch on the brand: QuizHub leads with category, latest and featured shelves, top players and live winners           | **fixture**       | curation and aggregates behind the shelves, and a win feed that is a query over results rather than an array            |
| `/admin/gaps`                        | `components/console/gap-analysis.tsx`, `gap-histogram.tsx` | the Gap across a population: eight kinds counted over relationships both parties finished, per Setting, nameless and unranked  | **db**            | already real; the aggregate is a function of the `opinion` rows, with no stored total                                   |
| `/admin/instances`                   | `components/admin/instance-registry.tsx`                   | every relationship in the database, for an operator, filterable by stage, mode, Setting and stalled                            | **db**            | already real; read-and-filter only, with no opinion or score in the read                                                |
| `/assessment`                        | `components/assessment-flow/**`                            | the published assessment templates, each with its create form — the one DB-backed list in the tree                             | **db**            | already real; the gap is the entitlement gate's copy, not the read                                                      |
| `/assessment/instances`              | `components/assessment-flow/**`                            | every instance the caller is a party to, with where each one stands                                                            | **db**            | already real                                                                                                            |
| `/assessment/templates`              | `components/assessment-flow/template-library.tsx`          | the template library: platform templates and the caller's own, a status filter, a title search, open/duplicate/archive per row | **db**            | already real; the author filter is `author_user_id IS NULL OR author_user_id = $1`                                      |
| `/assessment/templates/[templateId]` | `template-detail.tsx`                                      | one template read-only: its Aspects with their Values, how many instances came from it, who wrote it                           | **db**            | already real; "not yours" and "does not exist" are deliberately the same 404                                            |
| `/assessment/templates/new`          | `template-form.tsx`                                        | a form: a title and one to eight Aspects, saved through a route handler                                                        | **none**          | already writes: `POST /assessment/templates/save` sets `record.author_user_id` from the session                         |
| `/assessment/[slug]`                 | `components/assessment/**`                                 | one instance: both parties' opinions per Aspect and the eight gaps                                                             | **db**            | already real                                                                                                            |
| `/assessment/instances/[instanceId]` | `components/assessment-flow/**`                            | the screen both parties share: answer blind, then read the report once both have answered                                      | **db**            | already real; the answer POST is the model for an idempotent submit (409 on a frozen sheet)                             |
| `/dashboard`                         | `components/console/overview.tsx`, `stat-card-grid.tsx`    | the alignment console's Overview: four counts of the viewer's own relationships, each linking to the list it counts            | **db**            | already real; on the quiz build it is the same page reading the same rows, and an account there has none                |
| `/demo`                              | `components/auth/demo-gate.tsx`                            | a four-digit PIN field; a correct PIN sets a signed cookie                                                                     | **none**          | demo-only, and answers 404 outside demo mode                                                                            |
| `/demo/admin`                        | —                                                          | the session and the role it read from Postgres                                                                                 | **db**            | a proof, not a destination                                                                                              |
| `/invite/[token]`                    | `components/assessment-flow/**`                            | what an invitation says and the button that claims it                                                                          | **db**            | already real                                                                                                            |
| `/leaderboard`                       | `components/leaderboard/**` (5)                            | a podium, summary stats and a filterable ranked table                                                                          | **fixture**       | a ranking query over results; today `community.leaderboard` ships it off and only an admin session reaches it           |
| `/login`                             | `components/auth/login-view.tsx`                           | a sign-in form, with pending, invalid-credential and network states; the demo role buttons in demo mode                        | **none**          | auth only — the form posts to a server action reading `neon_auth` and `demo_account`; nothing on the screen is a record |
| `/news`                              | `components/news/news-page.tsx`                            | nine news articles as records, featured first                                                                                  | **fixture**       | the article record read; same seam as the tips                                                                          |
| `/news/[slug]`                       | `news-article.tsx`                                         | one article, share, a comment thread, the author, related articles                                                             | **fixture**       | an article record plus a comments table                                                                                 |
| `/pricing`                           | `components/pricing/**` (4)                                | plan comparison read from `billing_plan`, a checkout per sellable tier, the viewer's own plan marked                           | **db**            | already real, including the entitlement read and the checkout endpoint                                                  |
| `/privacy`                           | `components/legal/legal-page.tsx`                          | the draft privacy policy behind a banner that cannot be dismissed                                                              | **none**          | a legal document; the only "needs" is review, not schema                                                                |
| `/profile/[username]`                | `components/profile/**` (11)                               | a member's public profile from `user_profile`, or a demo persona when no member has that handle                                | **db**            | the fixture branch is the demo persona; the quiz history, achievements and followers inside it are not in the table yet |
| `/register`                          | `components/auth/register-view.tsx`                        | a two-step sign-up form                                                                                                        | **none**          | writes through Neon Managed Auth; nothing rendered is a record                                                          |
| `/search`                            | `components/search/search-results.tsx`                     | the built index over quizzes and categories, hits rendered as quiz cards                                                       | **fixture**       | a real index: `buildSearchIndex()` is a function over fixtures, so the swap is one module, not one screen               |
| `/settings`                          | `components/identity/settings-view.tsx`                    | display name, handle, bio and the country pair, saved through a guarded POST                                                   | **db**            | already real                                                                                                            |
| `/support`                           | `components/support/**` (7)                                | the help centre: categories, knowledge base, FAQ, contact form                                                                 | **fixture**       | the article record read                                                                                                 |
| `/support/articles/[slug]`           | `article-detail.tsx`                                       | one help article with related articles and a "was this helpful?" prompt                                                        | **fixture**       | the article record read                                                                                                 |
| `/terms`                             | `components/legal/legal-page.tsx`                          | the draft terms behind a banner that cannot be dismissed                                                                       | **none**          | a legal document                                                                                                        |
| `/welcome`                           | `components/marketing/**` (3)                              | the AlignSynch landing page in its own chrome — copy, not a quiz surface, but nothing 404s it                                  | **none**          | none; it is the alignment expression's marketing page rendering under a quiz brand's chrome                             |

#### Totals — these twenty-eight routes

| data source | routes |
| ----------- | ------ |
| **fixture** | **7**  |
| **db**      | **14** |
| **mock**    | **0**  |
| **none**    | **7**  |


### 1.3 The totals, and what they say

Every route in `content/routes.ts` appears in exactly one of the two tables above: 22 + 28 = 50.

| data source | quiz-owned (22) | other (28) | total (50) |
| ----------- | --------------- | ---------- | ---------- |
| **fixture** | 15              | 7          | **22**     |
| **db**      | 1               | 14         | **15**     |
| **mock**    | 6               | 0          | **6**      |
| **none**    | 0               | 7          | **7**      |

**22 fixture, 15 db, 6 mock, 7 none — 50 routes.** The quiz product's own twenty-two are **15
fixture, 6 mock, 1 db, 0 none**.

- **Six of the twenty-two quiz routes invent their records.** `/daily-challenge`, `/battle`, both
  tournament routes, `/create/editor` and `/my-quizzes/[id]/statistics`. Four of them — both
  tournament routes, `/battle` and `/daily-challenge` — are the screens a reader would most likely
  describe as "working".
- **One quiz route reads Postgres**, and it is the account home — a page whose content is a session,
  not a quiz.
- **Fifteen read fixtures.** Those are the good ones: the rows exist, are validated, and a change to
  the fixture changes the screen. What they lack is a write path and a table, not a model.
- **No quiz surface has a write path.** The app has twelve route handlers and not one of them
  creates, edits, publishes, deletes or plays a quiz. Authoring, playthrough and scoring are all
  client state.
- **The articles are the closest thing to full-stack content in the quiz product**, and they are
  still a fixture read: `lib/article-records.ts` is the seam, `record.record_type = 'article'` is
  already legal in the schema, and nothing else would change.

### 1.4 Where this disagrees with `docs/ui-registry.md`

The registry's `status` column is a **wiring** claim, checked mechanically: `fixture` means the
surface's import closure reaches a module under `data/`, `mock` means it reaches neither a database
module nor a record fixture. That check is right about imports and silent about provenance, so four
routes carry different values here than there:

| route               | registry | this page | why                                                                                                                                                      |
| ------------------- | -------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/daily-challenge`  | fixture  | **mock**  | the route reaches `data/metrics.ts`, `data/daily-challenge.ts` and `data/players.ts`; the day's quiz, the history and both charts are component literals |
| `/battle`           | fixture  | **mock**  | it reaches `data/battle-modes.ts` for two option lists; the players and every score are literals                                                         |
| `/tournaments`      | fixture  | **mock**  | it reaches `data/metrics.ts` for the featured band's numbers; the six rows are a literal                                                                 |
| `/tournaments/[id]` | fixture  | **mock**  | it reaches `data/metrics.ts` and `data/media.ts`; the record, the standings and the threads are literals                                                 |

That is not a bug in the registry — a `fixture` status is true of what it measures (the surface does
read a committed module) — but it is exactly the distinction a brand choosing a surface needs, which
is why the column exists here as well.

## Part 2 — the capability catalogue

Eleven capabilities. For each: what exists (and as what), what is missing, the countable size, and
which AlignSynch surface would consume it. **Size is structural** — tables, endpoints, screens — and
it is not a schedule. "Reusable" marks a piece that is already general enough to serve the next
expression without a rewrite.

| capability           | what exists today                                                                | the honest state         |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| Authoring            | editor + generator UI; a DB-backed template authoring flow for the other product | mock UI, no write path   |
| Playthrough          | play UI, timer, review modal, client-side correctness                            | fixture read, no session |
| Scoring & results    | projection functions over arrays; a real two-party submit with status codes      | no grader, no result row |
| Statistics           | eight chart panels; a generic stat-card grid; a gap histogram                    | all numbers literals     |
| Social               | comment fixture, threads, discussion and review screens                          | no write, no moderation  |
| Ranking              | six boards of ten players; podium and table screens                              | fixture behind a flag    |
| Competition          | battle, tournaments, daily challenge — screens only                              | no match state           |
| Discovery            | shelves, filters, categories, a built search index                               | fixture curation         |
| Identity             | `user_profile` read and write; profile, settings, account home                   | real, thin               |
| Commerce             | `billing_plan`/`subscription`/`event`, adapters, webhook, checkout, entitlements | real                     |
| Notifications / chat | a notification fixture no route imports; a chat fixture with no transport        | mock                     |

### Authoring — create, edit, delete, publish, drafts

**What exists.** `components/create/quiz-editor.tsx` (701 lines) is a complete authoring form: title,
description, difficulty, tags, questions with options and a radio answer key, media slots, a settings
drawer and a live preview. `quiz-generator.tsx` composes drafts from 20 templates. `my-quizzes.tsx`
is the list with status tabs, search and row actions. All of it is client state seeded from literals,
and the save button is a toast.

For the other expression the same capability is **real**: `/assessment/templates/new` writes a record
and its items, `/assessment/templates/[templateId]/status` archives, `/assessment/templates/save`
sets `record.author_user_id` from the session, and `/assessment/templates/[templateId]/duplicate`
copies. That is the reusable part — a form, a save endpoint, and an author filter on the read.

**What is missing.** Any endpoint that writes a quiz (there are none), drafts as rows, an ownership
check on the read, a version so two tabs cannot overwrite, and the publish transition. `record` and
`item` exist and would hold a quiz; `item` has no `correct_option_id` column and `record` has no
`difficulty`, so the schema is close but not sufficient.

**Rough size.** 2 schema changes (an answer key on `item`; difficulty and quiz settings on `record`
or a `quiz` side table), 4 endpoints (create, update, publish, delete), 3 screens whose read path
changes (`/create/editor`, `/my-quizzes`, `/my-quizzes/[id]`). Effort: unknown.

**Who consumes it.** `/assessment/templates/new` and `/assessment/templates` — the only authoring
flow in the tree that persists anything, and the model for the endpoints a quiz authoring path needs.

### Playthrough — start, submit, resume, review

**What exists.** `quiz-play.tsx` (486 lines) plays a record's questions with a timer, per-question
feedback, a results screen and a review modal. The record is resolved on the server
(`selectQuizForPlay`), so the questions are real data. `quiz-results.tsx` renders the score and the
review, and `review-modal.tsx` a per-question replay.

**What is missing.** A session record: no attempt is created when play starts, so nothing can be
resumed; no submit endpoint, so nothing is stored; no idempotency key, so a retried submit could
double-count once a write exists; and no server-side grader, because the browser compares
`optionId === correctOptionId`.

The reusable half is in AlignSynch: `POST /assessment/instances/[instanceId]/answers` takes one
party's whole sheet, refuses a non-party with 403, an unknown instance with 404, a frozen sheet with
**409**, and resolves the party from a cookie rather than a form field. That is the shape an attempt
submit needs.

**Rough size.** 2 tables (`quiz_attempt`, `quiz_answer`), 3 endpoints (start, submit, resume), 2
screens (play, discussion) whose data path changes. Effort: unknown.

**Who consumes it.** `/assessment/instances/[instanceId]` — a blind answer form with one submission
per party and a frozen state after both.

### Scoring & results — score, correct/incorrect, the results hero

**What exists.** The projection functions are real and tested: `scorePercent`,
`selectQuizLeaderboard`, `selectQuizResults`, `selectQuestionAccuracy`, `selectViewerResult` in
`content/quiz-result.ts`; `quizDetailModel` in `lib/quiz-detail.ts`; `gapOf` for the other product.
`QuizSettings.passingScore` exists on the model and is rendered as a Passed/Failed badge in the authoring players table.

**What is missing.** A grader (the score is computed in the browser and never sent), a result row,
and a replay-safe results view — today a reload loses the attempt entirely, which is the honest
behaviour given nothing was stored.

**Rough size.** 1 table (the result, or the attempt with a derived score), 1 endpoint (submit), 2
screens (`/quiz/[id]/play`, `/quiz/[id]/discussion`). Effort: unknown.

**Who consumes it.** `/assessment/[slug]`'s report (the gap is `gapOf` over stored opinions) and
`/admin/gaps`' aggregates — both already compute their headline from rows, not from literals.

### Statistics — per-record charts, distributions, accuracy

**What exists.** A full chart vocabulary: `components/ui/chart.tsx`, recharts panels for bars, lines,
areas, pies and scatter, and `components/console/stat-card-grid.tsx` — the generic "four numbers,
each a link to its list" shape. `quiz-statistics.tsx` (1,100 lines) is four tabbed panels of UI; its
numbers are one literal object and its route param is ignored.

**What is missing.** Aggregates over rows: completion rate needs a denominator (attempts started)
that does not exist; per-question accuracy needs stored answers; the demographic split needs a model
that does not exist in any content module.

**Rough size.** 0 new tables if attempts land; 4–6 queries; 2 screens (`/my-quizzes/[id]/statistics`,
`/my-quizzes/[id]`). Effort: unknown.

**Who consumes it.** `/admin/gaps` (one distribution per measure, no composite score) and
`/dashboard` (four counts, each linking to its list). Both are already generic over a measure.

### Social — comments, threads, discussion feeds

**What exists.** `data/quiz-comments.ts` (14 records) with `questionId` and one-level `parentId`;
three projections in `content/quiz-result.ts` (`selectCommentThreads`, `selectQuizDiscussions`,
`byCommentCountDesc`); two screens (`/quiz-discussions`, `/quiz/[id]/discussion`) and a review screen
that threads by question. One comment UI (`components/quiz/comment.tsx`) with likes and replies.

**What is missing.** Authorship as a foreign key (today a comment carries a `PersonRef` with a name
and an id string), moderation state, pagination, edit/delete, and any write endpoint. There is no
rate limit and no reporting control.

**Rough size.** 1 table, 3 endpoints (post, edit, moderate), 3 screens. Effort: unknown.

**Who consumes it.** `/news/[slug]`'s comment thread is the only comment surface in AlignSynch and it
is a fixture; no assessment surface has comments.

### Ranking — leaderboard, podium, filters

**What exists.** `data/players.ts` — ten players, six boards, eight prize events, one collection —
and `lib/players.ts` as the single projection. Screens: `/leaderboard` (podium, summary stats,
filters, table), plus boards on `/daily-challenge` and `/quiz/[id]` (the tournament board is a literal of its own).

**What is missing.** A ranking query: rank is a window function at read time, never a column; an
integrity rule (only completed, server-scored attempts; a tie-break that is written down; the window
definitions — today, week, all time — as intervals); and the boards themselves, which are fixture
arrays with a stored `rank` that E24 requires to equal the index.

**Rough size.** 0 new tables over attempts; 1 view or query set; 1 screen. Effort: unknown.

**Who consumes it.** `/admin/instances` — a filterable registry over rows — is the closest list
shape; AlignSynch has no ranking surface, and should not grow one to serve this template.

### Competition — tournaments, battles, lobbies, live state

**What exists.** Screens, and nothing under them: 17 components for tournaments, 5 for battle, 8 for
the daily challenge. Two battle modes are records (`data/battle-modes.ts`); a tournament's id set is
an allow-list (`tournament-ids.ts`); the daily challenge's quiz is a literal.

**What is missing.** Scheduling (a tournament is a window, rounds and a start instant), match state
(lobby → live → result, with a party list and a cursor), a transport, standings, and any payout. The
battle screen's score is invented at render, so even the _display_ contract for a live match is
unwritten.

**Rough size.** 4 tables (`tournament`, `tournament_entry`, `battle_match`, `battle_participant`),
4 endpoints plus a transport, 5 screens. The largest capability in this map by every measure.
Effort: unknown.

**Who consumes it.** Nothing in AlignSynch. The nearest concept is `/assessment/instances` (two
parties, one shared screen, no live state), and it is not the same object.

### Discovery — explore shelves, categories, search, filters

**What exists.** Three curated shelves per surface (`data/quiz-catalogue.ts`), a filter row with
difficulty/sort/time, a category strip, `deriveCategoryCounts` over the live collection, and
`buildSearchIndex()` — a real index function over the fixtures, consumed by `/search`. The
merchandising overlay (`data/promotions.ts`) is keyed by page slot and checked (E28).

**What is missing.** Curation as rows (a shelf position is a committed array index, so the CMS is a
file), a queryable index (the search is a function over an in-memory collection), sort by earned
aggregates, and pagination — `/explore` renders one shelf per tab with no cursor.

**Rough size.** 2 tables (`shelf`, `shelf_position` — or one with a position column), 1 index
(Postgres FTS or `pg_trgm`), 2 screens. Effort: unknown.

**Who consumes it.** `/assessment` (published templates as a list) and `/assessment/templates` (a
library with a status filter and a title search over one read). Both are discovery surfaces; both
filter client-side today, for the same reason.

### Identity — profile, history, achievements, followers

**What exists.** `user_profile` (handle, display name, bio, country pair, role), read by handle and
by user id, written through `POST /api/profile` with a guard. Screens: `/profile/[username]` (a
member branch and a demo-persona fallback), `/settings` (the four editable fields), `/dashboard/user`
(the honest empty states). `lib/auth/*` is real Neon Managed Auth with demo roles.

**What is missing.** The profile's quiz history, achievements and followers are drawn from
`components/profile/**` over fixture personas; there is no follow table, no achievement award table,
and no privacy rule beyond "public profile". The member branch renders because the row exists, not
because the activity behind it does.

**Rough size.** 2 tables (`follow`, `achievement_award`) plus a history query over attempts; 2
screens. Effort: unknown.

**Who consumes it.** `/profile/[username]`, `/settings`, `/dashboard/user` — all three already read
their own row, so a quiz history tab is an additional query, not a new surface.

### Commerce — pricing, plans, entitlements, checkout

**What exists.** The most complete capability in the tree, and not a quiz one:
`billing_plan`, `billing_subscription`, `billing_event` tables; a port and adapters
(`lib/billing/adapters`), a webhook handler, `startCheckout`, `entitlementForAccount`,
`subscriptionGrantsPaid`, `instanceGateRefusal`; `/pricing` reads plan rows and marks the viewer's
own plan; instance creation is gated by entitlement.

**What is missing.** Nothing structural for a subscription product. What a quiz product would add is
not modelled: a paid quiz, a tip jar, a tournament entry fee — each is a product row plus an
attribution, and none of them exists.

**Rough size.** 0 new tables for plans; 1 table for a per-quiz product; 1 endpoint if a quiz can be
bought. Effort: unknown.

**Who consumes it.** `/pricing` (live), the assessment create gate, and `/api/billing/checkout` —
which is also the answer to `/affiliate`'s missing payout path.

### Notifications and chat — transport, read state, retention

**What exists.** `data/notifications.ts` (six records) read by `components/header/**`, a domain no
route imports; `data/chat-data.ts` (five contacts and five conversations, with their threads and
messages) read by `/chat`; an email path that is real — `lib/flow/email.ts` sends the invitation and
`lib/flow/unlock-notice.ts` the unlock, and both fall back to showing the text in the app when they
cannot send.

**What is missing.** A transport (there is no socket, no SSE, no poll), read state, retention and any
delivery guarantee for in-app messages. The chat's send path is local append plus a random-delay
reply, so there is nothing to deliver _to_.

**Rough size.** 2 tables (`notification`, `message`) with a read mark each, 1 transport, 2 screens.
Effort: unknown.

**Who consumes it.** `/invite/[token]` plus the reinvite action — the only notification AlignSynch
sends — and the email path those already use. A transport is not needed for email; it is needed the
day a surface shows two parties the same thread.

## Part 3 — the app this UI describes

If every surface above were real, this is what the webapp is. Written as a specification, because it
is the specification the fixtures are a partial implementation of — and the reason to write it down
is that a future brand should be able to read this instead of reverse-engineering a card grid.

**The one rule that keeps it honest.** _A surface renders rows it read; when there are no rows it
says so._ Every failure in Part 1 is a violation of one half of that sentence — a literal instead of
a row, or a number where the empty state belongs.

### The entities

"Table today" is what the schema has now; "table it needs" is what a full-stack version would add.
"Owner" is the module that defines the type, and it is the only place the shape is allowed to live.

| entity                                              | table today                                                                        | table it needs                                                        | owner                                    | fixture standing in today                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Record** (quiz, article, assessment)              | `record` — id, slug, `record_type`, status, date, title, summary, `author_user_id` | same table; a quiz needs `difficulty` and its settings                | `content/record.ts`                      | `data/quizzes.ts` (62), `data/news-data.ts` (9), `data/creator-tips-data.ts` (6), `data/knowledge-base-data.ts` (9) |
| **Item** (question, Aspect)                         | `item` — record, item_id, position, prompt, `scale_kind`, left/right value         | plus `correct_option_id` for an `options` item                        | `content/record.ts`                      | the `questions` array inside `data/quizzes.ts`                                                                      |
| **Response option**                                 | `response_option`                                                                  | unchanged                                                             | `content/record.ts`                      | `options` inside each question                                                                                      |
| **Quiz stats** (plays, seats, prize, badge, rating) | none                                                                               | `quiz_stats` or columns on `record`                                   | `content/quiz.ts`                        | `stats` on each `data/quizzes.ts` record                                                                            |
| **Promotion** (slot campaign)                       | none                                                                               | `quiz_promotion (quiz_id, slot, starts_at, ends_at, reward_cents, …)` | `content/quiz.ts`                        | `data/promotions.ts` (2)                                                                                            |
| **Quiz analytics** (completion, avg score, revenue) | none                                                                               | aggregates over attempts, or a snapshot table                         | `data/quiz-analytics.ts`                 | `data/quiz-analytics.ts` (6 snapshots)                                                                              |
| **Category**                                        | none — a TS constant                                                               | `category` + `record_category`                                        | `content/categories.ts`                  | `content/categories.ts` (25 quiz subjects, 20 editorial)                                                            |
| **Player**                                          | none                                                                               | `player`, or derive from `user_profile`                               | `content/people.ts`                      | `data/players.ts` (10)                                                                                              |
| **Leaderboard row / board**                         | none                                                                               | a query over attempts (window function), 6 boards as intervals        | `content/people.ts`                      | `data/players.ts` (6 boards)                                                                                        |
| **Win event**                                       | none                                                                               | `win_event`                                                           | `content/people.ts`                      | `data/players.ts` (8)                                                                                               |
| **Attempt** (one play)                              | none                                                                               | `quiz_attempt` (quiz, player, started, submitted, score)              | `content/quiz-result.ts`                 | `data/quiz-results.ts` (17)                                                                                         |
| **Answer** (one item on one attempt)                | none                                                                               | `quiz_answer` (attempt, item, option, correct, seconds)               | `content/quiz-result.ts`                 | `answers` on 1 of the 17 results                                                                                    |
| **Review**                                          | none                                                                               | `quiz_review` (quiz, author, stars, body)                             | `content/quiz-result.ts`                 | `data/quiz-reviews.ts` (5)                                                                                          |
| **Comment**                                         | none                                                                               | `quiz_comment` (quiz, question?, author, body, parent)                | `content/quiz-result.ts`                 | `data/quiz-comments.ts` (14)                                                                                        |
| **Daily challenge**                                 | none                                                                               | `daily_challenge` (date, quiz, window, published)                     | `content/daily-challenge.ts`             | badges only (`data/daily-challenge.ts`, 6); the day's quiz is a literal                                             |
| **Badge / award**                                   | none                                                                               | `badge` + `badge_award`                                               | `content/daily-challenge.ts`             | `data/daily-challenge.ts` (6 badges)                                                                                |
| **Battle mode**                                     | none                                                                               | a config table, or keep the constant                                  | `content/battle.ts`                      | `data/battle-modes.ts` (2)                                                                                          |
| **Battle match / participant**                      | none                                                                               | `battle_match` + `battle_participant`                                 | `content/battle.ts`                      | `mockPlayers` / `mockGroupPlayers` in `battle-page.tsx`                                                             |
| **Tournament**                                      | none                                                                               | `tournament` + `tournament_entry`; standings as a view                | `content/quiz.ts` (`TournamentRef` only) | the six rows in `tournament-list.tsx`, the literal in `tournament-detail.tsx`                                       |
| **Article publication**                             | `record.status` **already holds it**                                               | delete the shadow                                                     | `content/article.ts`                     | `data/article-publication.ts`                                                                                       |
| **Chat conversation / message**                     | none                                                                               | `conversation` + `message`                                            | `content/social.ts`                      | `data/chat-data.ts`                                                                                                 |
| **Notification**                                    | none                                                                               | `notification` + a read mark                                          | `content/social.ts`                      | `data/notifications.ts` (6)                                                                                         |
| **Metric**                                          | none — and none wanted                                                             | nothing: a metric is a query or it is deleted                         | `content/metrics.ts`                     | `data/metrics.ts`                                                                                                   |
| **User profile**                                    | `user_profile`                                                                     | unchanged                                                             | `content/identity.ts`                    | none — real                                                                                                         |
| **Assessment template**                             | `record` with `record_type = 'assessment'`                                         | unchanged                                                             | `content/assessment.ts`                  | `data/assessments.ts` (8)                                                                                           |
| **Assessment instance**                             | `assessment_instance`                                                              | unchanged                                                             | `content/assessment.ts`                  | `data/assessments.ts` (4 seeded instances)                                                                          |
| **Party**                                           | `party`                                                                            | unchanged                                                             | `content/assessment.ts`                  | inside those 4 seeded instances                                                                                     |
| **Opinion**                                         | `opinion`                                                                          | unchanged                                                             | `content/assessment.ts`                  | inside those 4 seeded instances                                                                                     |
| **Instance invite**                                 | `instance_invite`                                                                  | unchanged                                                             | `content/assessment.ts`                  | none — real                                                                                                         |
| **Billing plan / subscription / event**             | `billing_plan`, `billing_subscription`, `billing_event`                            | unchanged                                                             | `data/billing-plans.ts`, `lib/billing/`  | `data/billing-plans.ts` (4 plans, seeded)                                                                           |

### The relationships

```
record 1─n item 1─n response_option
record (quiz) 1─n quiz_attempt 1─n quiz_answer
record 1─n comment             (quiz-scoped; a question-scoped comment also names an item)
record 1─n quiz_review
record 1─n quiz_promotion   (keyed by slot, not a property of the record)
record n─n category          (record_category)
quiz_attempt n─1 player      (a player is a user_profile, or a seeded persona)
daily_challenge n─1 record   (the day's quiz)
tournament 1─n tournament_entry n─1 player
tournament 1─n battle_match 1─n battle_participant
record (assessment) 1─1 assessment_instance 1─2 party 1─n opinion
record n─1 user_profile      (author_user_id)
```

### The lifecycles

- **A quiz** is drafted → published → archived. Publication is a status, never a date comparison; the
  author is `record.author_user_id` and an edit is allowed only to the author; questions are
  replaceable as a set while the record is a draft, and append-only once it has an attempt.
- **An attempt** is started (a row, so it can be resumed) → answered (rows, one per item, written at
  submit, not per click) → submitted once → scored by the server → frozen. A second submit for the
  same attempt is a **refusal with a status code**, not a silent overwrite.
- **A result** is derived from the attempt: `score = count(correct)` over its answers, percent, and
  time. It is never stored as a formatted string, and it is never an aggregate row unless the sheet
  is genuinely absent.
- **A discussion** is created by a comment on a quiz (optionally on one item); a reply names a parent
  and nests once; moderation is a state on the comment, not a delete.
- **A tournament** opens for registration → runs for its window (rounds advance by time) → closes and
  its standings freeze. Standings are a query over attempts inside the window.
- **An article** is published or a draft, and the only consequence of the difference is that a draft
  has no URL.

### The rules that keep it honest

1. **One record, one identity.** A card is a projection of a record; a second record for the same
   subject is the drift `data/quiz-catalogue.ts` exists to prevent (`catalogueAliases`).
2. **A response is a value on the item's scale.** Never a column per question, never a JSON blob per
   answer.
3. **No formatted string is stored.** Cents, seconds, percents and ISO instants are stored; the
   formatter runs at the render edge.
4. **`now` is a parameter.** Every countdown, window and rank is evaluated against an instant the
   caller passes, so server and client agree.
5. **The score is the sheet.** If a result carries answers, its score is recomputed from them; a
   score that disagrees with its sheet is a validation error, not a display bug.
6. **Rank is computed at read time**, over completed attempts only, with the tie-break written down.
7. **Empty is a state, not a zero.** A surface with no rows says so; it does not print a plausible
   number from a fixture.

## Part 4 — what is genuinely unused capability

Ten quiz surfaces that no current brand consumes. "No current brand" is exact: `quizhub` is the demo
expression and AlignSynch sells none of them. On the alignment build `requireQuizProduct()` closes
five outright — `/tournaments`, `/battle`, `/daily-challenge`, `/chat`, `/affiliate` — `/leaderboard`
is closed by its own flag for every visitor but an admin, and the editorial and search surfaces still
render there because a news article is not quiz-shaped. The question for each is whether it is a
**template asset** — worth keeping because the next expression could claim it — or **dead weight**.

| surface             | what it would take to switch on                                                                                   | verdict                                                                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tournaments**     | a tournament domain (rows + entry + standings view) and a real id read instead of the two-id allow-list           | **template asset** — the screen is complete and generic; the domain is the whole cost, and it is the same domain a league or cohort competition would need                                                                            |
| **Battle**          | server-authoritative matches, a transport, per-answer timing stored server-side                                   | **template asset, with a caveat**: the only surface whose _display contract_ is unwritten, because scores are invented at render. Switch-on is a build from the row up                                                                |
| **Daily challenge** | a `daily_challenge` row per day, an attempt per player, a board query scoped to the day                           | **template asset** — the cheapest of the three competition screens to make real, and the one with the smallest domain                                                                                                                 |
| **Leaderboard**     | a ranking query over attempts plus an integrity rule; the screen, podium and filters already exist                | **template asset** — and the only one of the ten already switched _off_ honestly: `community.leaderboard` is closed to non-admins on every build                                                                                      |
| **Chat**            | a message table, membership, transport, read state, retention                                                     | **template asset** — catalogued under _No template yet_ on purpose; deleting it would delete the messaging story for the next expression                                                                                              |
| **Search**          | swap `buildSearchIndex()` (a function over fixtures) for a queryable index; the screen renders hits already       | **template asset** — one module boundary, no screen change                                                                                                                                                                            |
| **Affiliate**       | an affiliate row, attribution, conversions, and a payout ledger; the programme currently pays nobody on any brand | **dead weight as a surface** — keep the nine bands as a catalogue asset, but the route is switched off everywhere and the honest description is "a page that pays nobody". Do not carry it as a capability until a payout path exists |
| **Creator tips**    | nothing new — it is an article record read, and `lib/article-records.ts` is already the seam                      | **template asset**, and one of the two closest to real                                                                                                                                                                                |
| **News**            | the same article record read                                                                                      | **template asset** — the editorial template for any product with announcements                                                                                                                                                        |
| **Knowledge base**  | the same article record read, with a brand-scoped set (`data/knowledge-base.ts`)                                  | **template asset** — the support template, already read through the same three functions                                                                                                                                              |

Two calls worth stating plainly rather than burying in a table:

- **Affiliate is the one genuine dead weight.** It is not a mock of something that could work; it is a
  programme with no ledger, a calculator that computes locally, and a flag that has been `false` since
  it was declared. The components are worth keeping because a future brand may want the page shape;
  the _route_ claims a capability nobody has.
- **Battle is the one asset whose cost is misread most often.** It looks like the most complete
  screen of the ten — four stages, a lobby, a live round — and it is the furthest from real, because
  the two things a battle needs (an authoritative score and a transport) are exactly the two things a
  screen cannot fake convincingly.

## Re-measuring this page

The numbers here are properties of a commit, not of the product. To re-derive them:

```sh
# the route set — 50 patterns, and the 22 the quiz product owns
grep -cE '^  "/' content/routes.ts          # 50
grep -c 'route: "' tests/parity/boundary.ts # 22

# the mock sites — a comment is a hint, not the method: 8 hits in 7 files, and
# active-battle.tsx, chat-page.tsx and quiz-generator-templates.ts are not among them
grep -rn "Mock data\|Mock tournament data\|Mock players" components/

# the write paths a quiz does not have
find app -name route.ts | sort              # 12, none of them a quiz
```

If a route's `data source today` changes, the row changes here first — a surface that becomes real
while this page still calls it `mock` is a document that has started lying, which is the failure mode
it was written to catch.

## What this is not

- **Not a backlog.** Nothing in Parts 1–4 is proposed. A capability's size is a shape, not a
  schedule.
- **Not a claim that a rendered surface is real.** That is what the fourth column is for.
- **Not a replacement for [ui-registry.md](ui-registry.md)**, which is generated, gate-checked, and
  answers "what exists and what is it wired to". This page answers "what is it made of, and what would
  it cost" — the two questions a brand asks before it claims a surface.
- **Not a decision about any brand.** Which of these AlignSynch claims is [TEMPLATE-DOCTRINE.md](TEMPLATE-DOCTRINE.md)'s
  question; this page only records what is there to claim.
