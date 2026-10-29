# P1 — the quiz-first content model

`content/` is the single source of truth for every fixture in `data/`. zod schemas
define the shape, TypeScript types are `z.infer`red from them, and `pnpm data:check`
validates every module at build time. A fixture that drifts from the model is a red
build, not a field the UI silently carries.

- Issue: [#10](https://github.com/riolabs-ai/alignsynch/issues/10)
- Spec: `content-model.md` (the audit that catalogued drifts D1–D18)
- Machine-readable edit log: [`ledger.json`](./ledger.json) — one row per changed
  field, with the old value, the new value and the reason.

## Run it

```bash
pnpm data:check   # tsc (content + data + scripts) -> node:test (83 cases) -> validator
pnpm typecheck    # next typegen && tsc --noEmit
pnpm lint         # biome check (includes the formatter gate)
pnpm build        # next build
```

`data:check` compiles the model with `tsconfig.datacheck.json` (CommonJS, no
bundler, no framework imports) into `.datacheck/` and then runs it under plain
node. That is why `content/` must never import React or Next.

Today's output:

```
PASS  62 quizzes, 185 questions, 9 news, 6 tips, 8 kb, 45 categories,
      5 contacts, 5 conversations, 6 notifications, 74 search rows
      34 routes match app/, 0 unknown category ids, 0 dead links
WARN  98
  [W2] ×42 published quiz "<id>" has no publishedAt (no date is invented for it)
  [W4] ×32 quiz "<id>" offers a reward with no limited-time window
  [W1] ×24 published quiz "<id>" has no questions
```

Repeated diagnostics are grouped by code and message template, so a gap that
affects the whole catalogue prints as one line with a count instead of 98 lines.
The 98 are real: the 5 `CreatedQuiz` records and 19 of the 20 browse cards have no
questions, no published record carries an authored date, and 32 advertise a reward
that never expires. See "D2 — the card grids read the model".

CI runs `pnpm data:check` as its own step, after typecheck and before build.

## Layout

| path                                             | what                                                                                                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/core.ts`                                | primitives (`zId`, `zSlug`, `zIsoDateTime`, `zDifficulty`, `zPublishStatus`, `zContentKind`), `zContentBase`, `zImageRef` + `staticToImageRef`, `zPersonRef`, and the render-time formatters (`formatCurrency`, `formatDate`, `formatRelative`, …) |
| `content/quiz.ts`                                | `zQuiz`, `zQuestion`, `zQuizSettings`, `zQuizStats`, and the card projections (`selectQuizCard`, `zQuizCard`, `zQuizAuthoringCard`)                                                                                                                |
| `content/category.ts`                            | `zCategory` + the taxonomy helpers (`deriveCategoryCounts`, `assertCategoryScopes`, `quizCategoryBySlug`, …)                                                                                                                                       |
| `content/categories.ts`                          | the seed table: 25 quiz subjects + 20 editorial categories                                                                                                                                                                                         |
| `content/article.ts`                             | `zNewsArticle`, `zTip`, `zKbArticle` over one `ContentBlock` union                                                                                                                                                                                 |
| `content/blocks.ts`                              | the six block schemas a body is built from                                                                                                                                                                                                         |
| `content/social.ts`                              | `zContact`, `zMessage` (text XOR image), `zConversation`, `zNotification` + derivation helpers                                                                                                                                                     |
| `content/route-manifest.ts`, `content/routes.ts` | the route table and the matcher that makes a dead link unrepresentable                                                                                                                                                                             |
| `content/search.ts`                              | `buildSearchIndex()` — the search index is derived, never authored                                                                                                                                                                                 |
| `data/quizzes.ts`                                | the whole quiz collection (62) plus `quizById` / `quizBySlug` — the only list a join may read                                                                                                                                                      |
| `data/authored-quizzes.ts`                       | the 16 card-only quizzes decision A authored (`quiz-migration.md` §10 — generated)                                                                                                                                                                 |
| `data/created-quizzes.ts`                        | the 5 `CreatedQuiz` records (§7 — generated)                                                                                                                                                                                                       |
| `data/browse-quizzes.ts`                         | the 20 card-only quizzes the migration's 8 fixture files never held (from `d2/card-projections`)                                                                                                                                                   |
| `data/quiz-catalogue.ts`                         | the card **shelves** — 13 ordered id lists + `catalogueAliases`; holds no records of its own                                                                                                                                                       |
| `data/quiz-analytics.ts`                         | authoring metrics (`completionRate`, `averageScore`, `revenueCents`) keyed by quiz id                                                                                                                                                              |
| `lib/quiz-cards.ts`                              | `quizCard` / `quizAuthoringCard` / `shelfCards` — the only place a component touches a card shape                                                                                                                                                  |
| `scripts/data-check.ts`                          | the validator: per-record schema pass, then the collection-level invariants                                                                                                                                                                        |
| `scripts/__tests__/data-model.test.ts`           | 28 negative tests; one per drift class                                                                                                                                                                                                             |
| `scripts/__tests__/quiz-collection.test.ts`      | 22 collection tests: the 62 records, the frozen slugs, the shelves, the Science overlay case                                                                                                                                                       |

Every object in `content/` is `.strict()`: an unknown key is an error. That is the
mechanism, not a style choice — a field added to a fixture without a schema entry
fails `data:check` by name.

## What the migration changed

### The eight things that were actually wrong

| drift                           | before                                                                                                              | now                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 two `Quiz` types             | `types/quiz.ts` (`id: number`, settings required) vs `Quiz` in `data/mock-quizzes.tsx`                              | one `zQuiz` in `content/quiz.ts`; `types/quiz.ts` deleted, guarded by `E9`                                                                                                   |
| D2 four card shapes             | quiz card / preview card / authoring card / featured card, each its own literal                                     | `selectQuizCard()` and `selectQuizAuthoringCard()` project one `Quiz`; cards are never authored, and one card is one record (`E11`)                                          |
| D3 colliding ids                | `id: 1…20` reused across quizzes, questions, categories, search rows                                                | kebab-case ids, namespaced (`quiz-1`, `quiz-1-q1`, `history`) and unique across the whole model                                                                              |
| D4 answer key                   | `correctAnswer: number` (index into `options`)                                                                      | `correctOptionId: "a"…"f"`, validated to name an existing option; 100/100 answers preserved                                                                                  |
| D5 difficulty                   | `"Medium"`, `"medium"`, `"medium "`                                                                                 | `zDifficulty` = `easy \| medium \| hard`                                                                                                                                     |
| D6 three category vocabularies  | 22 quiz subjects, 14 browse categories, 4 search categories, 3 per-kind string unions                               | one 45-row table, four scopes, `categoryIds` is the only join                                                                                                                |
| D7 quizzes had no category      | 0/20 quizzes carried a category (tags were prose)                                                                   | 62/62 carry `categoryIds`, derived once from the tag alias map (or authored with the record) and then frozen                                                                 |
| D8 three body shapes            | news `sections`, tips markdown string, kb sections, plus an inline redeclaration                                    | one `ContentBlock[]` union for all three                                                                                                                                     |
| D9 six time formats             | `"2 days ago"`, `"May 15, 2025"`, `Date.now()` at module import, …                                                  | one ISO-8601 instant (`publishedAt`, `sentAt`, `lastSeenAt`, `limitedTimeEndsAt`); prose is derived at render                                                                |
| D10 framework objects in data   | `icon: <Trophy />`, `StaticImageData`, `string \| StaticImageData`                                                  | `ImageRef {src, alt}` and `iconKey` into `NOTIFICATION_ICON_KEYS`                                                                                                            |
| D11 stored derived values       | `spotsLeft`, `almostFull`, `unread`, `recentMessages`, `count`, `quizCount` authored by hand                        | derived: `zQuizStats` + `spotsLeftOf`, `deriveUnread`, `deriveCategoryCounts`, `buildSearchIndex`                                                                            |
| D12 duplicated `recentMessages` | a hand-written array whose avatars disagreed with the conversations 3/5 of the time                                 | `selectRecentMessages()` over the real conversation                                                                                                                          |
| D13 dead links                  | 2 notification routes with no page, 2 accidental `/profile/<word>` matches                                          | `routeManifest` + `matchRoute` + `checkNotificationRefs`; `data:check` walks `app/` in both directions                                                                       |
| D14 dead `Metadata` export      | `app/(mainlayout)/categories/[slug]/page.tsx` exports `Metadata`, which Next never reads                            | **not fixed here** — a page-level bug, not a data-model one (see Deferred)                                                                                                   |
| D15 three `categories` exports  | three shapes, three imports, all named `categories`                                                                 | one table in `content/categories.ts`; `data/*` re-exports scoped views with derived counts                                                                                   |
| D16 kb category                 | `category: "Getting Started"` (display name) vs a `SupportCategory` union                                           | `categoryIds: ["kb-getting-started"]` against the kb scope                                                                                                                   |
| D17 three identity namespaces   | authors in quizzes, `creators` in search, `users` in `lib/data`, none joinable                                      | `zPersonRef {id?, name, avatar?, role?, bio?}` everywhere, with no `username` on it; `id` is the only join and it is optional, so search creators come from `lib/data/users` |
| D18 search as a catalogue       | `data/searchdata.ts` listed 4 quizzes (`q1`…`q4`) that exist nowhere, plus counts 42/38/65/29 and creators 87/34/56 | `buildSearchIndex()` derives every row from live records; a row whose path does not resolve is a hard error                                                                  |

### Fixture edits, module by module

Every field-level edit is in `ledger.json`. Summary:

- **`data/mock-quizzes`** — 20 generator templates: numeric ids → `quiz-<n>`, slug
  from title, `description` → `summary`, tags → `categoryIds` via the alias map,
  question ids namespaced per quiz, answer index → option id, `settings.timeLimit`
  documented as minutes and stored as seconds (every record held `0`, so no value
  moved).
- **`data/currentQuiz`** — the one playable quiz: namespaced ids, difficulty
  lowercased, category name → id, static images → `ImageRef`. All five question
  images and five explanations preserved.
- **`data/news-data`** — 9 articles: `excerpt` → `summary`, prose dates → ISO
  instants, category **names** → ids (the stray 8th name `Updates` →
  `news-platform-updates`), cover → `ImageRef`, three section shapes → one
  `ContentBlock[]`.
- **`data/creator-tips-data`** — 6 tips: markdown body wrapped as a single legacy
  markdown block, verbatim; category → `tip-<slug>` id; dates → ISO.
- **`data/knowledge-base-data`** — 8 articles: string category → `kb-<slug>` id,
  three section shapes → one `ContentBlock[]`. The fixture never had an author,
  cover or date, so none was invented.
- **`data/chat-data`** — 5 contacts, 5 conversations: prose presence → `lastSeenAt`
  instants, derived preview columns dropped, `text` → `body`, `timestamp` →
  `sentAt`. `recentMessages` is deleted; the drawer derives it.
- **`data/notifications`** — 6 notifications: JSX icon → registry key, prose time →
  ISO, `description` → `body`, and four links re-pointed at routes that exist
  (`/affiliate`, `/create/editor`, and two real profile slugs).
- **`data/categories.tsx` → `data/categories.ts`** — the deleted 22-row copy had
  numeric ids and a stored `count` summing to 113 against 20 real quizzes. It is now
  a view of `content/categories.ts` with the count derived from the live collection.
- **`data/searchdata.ts`** — rewritten as a derivation (see D18).
- **tip / news category arrays** — a fourth and fifth copy of the editorial
  vocabularies; they now re-export their scope from the single table with counts
  derived.

Four modules were renamed `.tsx` → `.ts` (`categories`, `currentQuiz`, `news-data`,
`notifications`): they contained JSX, which is how D10 got in.

### The 21 records that were missing from `data/`

The first pass ported the 21 pre-migration quizzes and stopped there. `quiz-migration.md`
§7 and §10 produce 21 more records, and they existed only in the migration harness
(`migrated/quizzes.json`), so nothing in the app could join to them and a per-slot
promotion keyed on `quiz-science-quiz-space-exploration` had no record to resolve.

Now ported, field-for-field:

| module                     | records | source                                       |
| -------------------------- | ------- | -------------------------------------------- |
| `data/created-quizzes.ts`  | 5       | §7 — the `CreatedQuiz` records               |
| `data/authored-quizzes.ts` | 16      | §10 — decision A's card-only quizzes         |
| `data/browse-quizzes.ts`   | 20      | d2's card grids, outside the 8 fixture files |
| `data/quizzes.ts`          | 62      | the composition + `quizById` / `quizBySlug`  |

Three things about the port that are easy to miss:

1. **`quiz-11` is part of the join, not just a template.** `explore-page/new[2]` and
   `explore-featured/new[2]` both promote `Sports Trivia Challenge`, which resolves to
   the _generator template_ `quiz-11`. The migration lifted that card's engagement
   snapshot onto the record (§5): `status: "published"`, `plays: 124`, `capacity: 1000`,
   `rating: 4.4`, badge `new`, `rewardCents: 300`, author `SportsNut`, cover
   `/sports-trivia-quiz.png`. Its `settings` are untouched — `visibility: "private"`,
   so it stays out of the search index. Without this, 2 of the 31 card records cannot
   reproduce their numbers.
2. **The merchandised Science snapshot is not a record.** `2105/2500 · $7.50 · 4.8 ·
   popular` is a per-slot overlay (`zQuizPromotion`, B-01); the record keeps the
   catalog's `2453/3000 · $10.00 · 4.9 · hot · 2025-01-03T00:00:00.000Z` and
   `author: MarvelFan`, not the overlay's `CosmicMind`. A second record for the same
   subject would fail `E11` and fork the identity (A4).
3. **Two deliberate deviations from the harness output** are kept in `data/currentQuiz`:
   its `tags` facets (`history`, `world events`) survive, and its images keep
   `alt: ""`. The harness dropped the tags and wrote alt strings from the prompts.
   Neither is a join key or a card field, so neither affects a projection; both are
   recorded here rather than silently swapped.

## Two collections, one winner

`d2/card-projections` (PR #24) and `feat/b01-quiz-data` (PR #26) each landed a quiz
collection, and neither tree could see the other. Measured before reconciling:

| branch                | module                                               | records |
| --------------------- | ---------------------------------------------------- | ------- |
| `feat/b01-quiz-data`  | `data/quizzes.ts` + `authored-`/`created-quizzes.ts` | 42      |
| `d2/card-projections` | `data/quiz-catalogue.ts`                             | 40      |

`E1` fails on duplicate ids, so the merge was a red build, not silent drift. The
overlap was 13 ids — and the 27 "new" ids were not all new: **7 of them were the
same card under an id d2 invented**. Six carried the migration title (four of them
the migration's engagement numbers as well):

| d2's id                                       | the frozen record                                   | evidence it is one card                                            |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `quiz-brain-teasers-and-logic-puzzles`        | `quiz-brain-teasers-logic-puzzles`                  | same title, 3241/5000 · $8.00 · 4.7                                |
| `quiz-famous-inventors-and-discoveries`       | `quiz-famous-inventors-discoveries`                 | same title, 112/1000 · $5.00 · 4.4                                 |
| `quiz-mathematical-puzzles-and-brain-teasers` | `quiz-mathematical-puzzles-brain-teasers`           | same title, 1543/2000 · $6.50 · 4.6                                |
| `quiz-technology-and-gadgets`                 | `quiz-technology-gadgets`                           | same title, 175 plays · $7.00                                      |
| `quiz-world-geography-capitals-and-landmarks` | `quiz-world-geography-challenge-capitals-landmarks` | same title, 1872/2000 · $7.50 · 4.8                                |
| `quiz-sports-trivia`                          | `quiz-11`                                           | same title; d2 renamed the id to dodge the `E2` slug collision     |
| `quiz-music-through-decades`                  | `quiz-music-through-the-decades`                    | same title with `the` elided; a 5/50 snapshot of a 210/1000 record |

**The 20 that were left are new content** — card titles no fixture file ever showed
(`Geography Starters`, `Philosophy & Ethics`, `Advanced Quantum Physics`, …). They
were added to `data/quizzes.ts`'s composition, not kept beside it: one list, one
`quizById`, and `data/categories.ts` / `data/searchdata.ts` / the shelves all read it.

**The final count is 62, not 69.** 42 + 27 would have added those 7 cards a second
time; the ticket's arithmetic assumed every non-overlapping id was a new subject.
The acceptance it encodes — "no second record for that subject" — is what `E11`
now enforces over the whole collection.

### Canonical winner, per conflict

The migration's records win every disagreement, per `quiz-migration.md` §5/§8/§10
(ids and slugs frozen by E8). d2's own rulings are untouched in `ledger.json` under
`data/quiz-catalogue`; this table is the _reconciliation_ row, and the canonical
values are the ones the collection now holds.

| id                                    | d2's snapshot                               | canonical (wins)                                            | why                                                                                                                   |
| ------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `quiz-science-quiz-space-exploration` | 178/500 · $7.50 · 4.9 · author `CosmicMind` | 2453/3000 · $10.00 · 4.9 · `hot` · 2025-01-03 · `MarvelFan` | §5 unions the snapshots; the 178/500 · $7.50 · 4.8 · `popular` variant is the per-slot overlay (B-01), never a record |
| `quiz-history-through-the-ages`       | 25/50 · $5.00                               | 1532 plays · published, no questions                        | the `CreatedQuiz` record (§7); card-only stats are not a content edit                                                 |
| `quiz-literature-classic-novels`      | 300/300 · $5.00                             | 1298/1500 · $5.00                                           | §5's authored record wins over the authoring surface's snapshot                                                       |
| `quiz-world-geography-challenge`      | 285/300 · $5.00 · 4.8                       | 1245 plays · published, no questions                        | §7 record; the 285/300 card snapshot is a card, not the quiz                                                          |
| `quiz-music-through-the-decades`      | `Music Through Decades`, 5/50               | 210/1000 · $5.50 · 4.5                                      | one record per card; the 5/50 card folds onto it                                                                      |
| `quiz-technology-gadgets`             | 250 capacity · 4.8                          | 1000 capacity · 4.6                                         | §5's record; the card's 250 was the authoring surface's seat bar                                                      |
| `quiz-11` (`Sports Trivia Challenge`) | `quiz-sports-trivia`, 124/250 · 4.5         | 124/1000 · 4.4 · `new` · `SportsNut`                        | the frozen `quiz-11`; d2's id was a rename, and E8 freezes the slug                                                   |

`data/quiz-catalogue.ts` keeps the seven aliases in `catalogueAliases` so the ruling
is data, not folklore: `E10` resolves every shelf id against the collection and
`E11` fails if an alias ever becomes a record again.

### Generated instants: what was preserved and what was chosen

D9 collapsed six time formats into ISO-8601 instants, which forced a decision the old
fixtures never had to make: **a date is not a time.** Precisely:

- **Dates are preserved.** Every calendar date comes from the record it replaced.
- **Times of day were chosen** wherever the source had none:
  - `data/news-data` — `"May 15, 2025"` → `2025-05-15T03:00:00.000Z`. The fixture named a
    day, so the time of day is picked, not measured (all nine articles sit at `T03:00Z`).
  - `data/chat-data` — `"2h ago"` / `"online"` prose → `sentAt` / `lastSeenAt` instants.
    The gaps between messages are the prose; the wall-clock instants behind them are picked.
  - `data/creator-tips-data`, `data/notifications` — same rule. Where a record had no date
    at all, none was added (`W2` is every published record with no `publishedAt`).
- **One anchor, and it is in the past.** Every instant in `data/` is at or before
  `2026-10-29T10:00:00.000Z`, the instant this migration ran: `notifications` sit 10m / 1h /
  3h / 5h / 1d / 2d before it (`09:50`, `09:00`, `07:00`, `05:00`, then `10:00` on the two
  previous days), and `chat-data` inside the same window. Nothing is later than the anchor.
  A stored instant in the future is the one way a static fixture renders as nonsense, and
  it did: an earlier revision anchored `notifications` at `12:00Z`, so `formatRelative`
  drew the newest two rows as `"in 1 hour"` and `"in 22 minutes"`. `E9`-style enforcement
  is not available here (the anchor is a policy, not a schema), so this paragraph is the
  rule: author instants backwards from the migration instant, never forwards from it.
- **The four limited-time windows are the migration's, not d2's.** The records that carry
  `stats.limitedTimeEndsAt` — `quiz-science-quiz-space-exploration`,
  `quiz-brain-teasers-logic-puzzles`, `quiz-ancient-civilizations-egypt-greece-rome`,
  `quiz-world-of-fantasy-literature` — hold the values the migration fixtures pinned
  (`2025-01-02` / `2025-01-03`), because the migration wins the conflict. They are
  therefore _live at the fixture instant_ (`2025-01-01`, which is how the 31 card records
  reproduce `limitedTime: true`) and expired at the wall clock; d2's `2026-10-30`
  replacements lost with its snapshots. Forward-dating them is a content decision for
  the promotion work (B-01), not a data-model one.
- **The anchor ages.** These are static fixtures and `formatRelative` runs at render time,
  so a frozen `"10m ago"` reads `"3 weeks ago"` next month. That is the honest reading of a
  snapshot; the alternative — computing `Date.now()` at module import — makes the
  fixture non-deterministic and un-diffable, and is exactly what D9 removed.

So the claim "no fixture value was invented" holds for **fields and dates**, not for times
of day: dates were preserved, times of day were chosen, and the anchor ages.

### Consumers

25 files under `components/`, `app/` and `lib/` were rewired to read the model instead of
the old literals:
`components/content/content-blocks.tsx` (renders the block union),
`components/header/notification-icon.tsx` (the icon registry), the quiz play and
editor paths, chat + notification drawer, news, creator tips, knowledge base,
categories, and the header's search palette. `components/create/quiz-draft.ts` is
the editor's local `Quiz` draft, explicitly typed against `content/quiz.ts` so a
draft and a stored record cannot diverge. `components/quiz/quiz-play.tsx` reads
`selectQuizForPlay()`; the only type it declares is the renderer's question view
(`PlayQuestion`), and renderer views are never named `Quiz` — `E9` now fails the
build if one is.

## D2 — the card grids read the model

`selectQuizCard()` and `selectQuizAuthoringCard()` existed but no shipped component
called them: the home, explore, category and my-quizzes grids each re-authored the
same quizzes as card literals, with up to five different engagement snapshots for
one quiz (`World Geography Challenge` was 285/300 on four surfaces and 42 plays on
the dashboard). That is the rest of D2.

**Direction, per surface** (written before the edits):

| surface                                             | direction    | source                                                                                |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| home: featured, latest, by-difficulty               | model-backed | `data/quiz-catalogue.ts` shelves `homeFeatured`, `homeLatest`, `homeEasy/Medium/Hard` |
| explore: featured, all quizzes, list, featured page | model-backed | shelves `exploreTrending/Popular/New`, `exploreAll`, `featuredTrending/Popular/New`   |
| categories: detail page                             | model-backed | shelf `exploreAll` (the page's category filter is deferred, see below)                |
| my-quizzes: grid + list                             | model-backed | shelf `myQuizzes` via `selectQuizAuthoringCard` + `data/quiz-analytics.ts`            |
| dashboard: recent quizzes, my-quizzes dashboard     | model-backed | shelf `myQuizzes` via `selectQuizAuthoringCard`                                       |
| my-quizzes / quiz detail pages                      | **deferred** | question-level surfaces, see `## Deferred`                                            |
| profile: created quizzes                            | **deferred** | profile domain, see `## Deferred`                                                     |

**What is authored now, and what is not.** A _shelf_ is an ordered list of quiz ids
(curation: which quiz sits in which carousel). The card itself is always a
projection — `lib/quiz-cards.ts` is the only place a component touches a card
shape. `profile-created-quizzes.tsx`'s local `QuizCard` component was renamed
`ProfileQuizCard` rather than reused; there is no second card type.

**Field mapping** (card literal → model), applied to all 40 records d2 consolidated —
of which 20 were new content and 13 were the migration's own records under an existing
id (the remaining 7 were the same cards under invented ids, see "Two collections, one
winner"):

| card literal                                      | model                                                                      | note                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id: 1..18`                                       | `id: "quiz-<slug>"`                                                        | D3; `slug` is the title, kebab-cased                                                                                   |
| `title`                                           | `title`                                                                    | unchanged                                                                                                              |
| —                                                 | `summary`                                                                  | **new**: required by the schema, never rendered on a card                                                              |
| `image` / `img`                                   | `cover.src`                                                                | `alt` is the title                                                                                                     |
| `category: "Mathematics"`                         | `categoryIds: ["math"]` + taxonomy label                                   | the fixture's free-text label is not a join key (D6/D7)                                                                |
| `category: "Entertainment"` on the space quiz     | `["space"]`                                                                | the label contradicted the quiz                                                                                        |
| `difficulty: "Medium"`                            | `difficulty: "medium"`                                                     | D5                                                                                                                     |
| `createdBy` / `creatorAvatar`                     | `author.name` / `author.avatar`                                            | `PersonRef`, no invented ids (D17)                                                                                     |
| `timeLimit: 15` (minutes)                         | `settings.timeLimitSeconds: 900`                                           | D1                                                                                                                     |
| `status: "active" \| "draft" \| "completed"`      | `published \| draft \| archived`                                           | three vocabularies → one                                                                                               |
| `players`                                         | `stats.plays`                                                              |                                                                                                                        |
| `maxPlayers`                                      | `stats.capacity`                                                           |                                                                                                                        |
| `spotsLeft`, `almostFull`                         | **derived** (`capacity - plays`, ratio ≤ 10%)                              | never authored again                                                                                                   |
| `reward: "$5.00"` / `reward: 5`                   | `stats.rewardCents: 500`                                                   | one money unit                                                                                                         |
| `rating`, `totalRatings`                          | `stats.rating`, `stats.ratingCount`                                        |                                                                                                                        |
| `badge: { type, label }`                          | `stats.badge`                                                              | unchanged                                                                                                              |
| `limitedTime: true, expiresIn: 172800`            | `stats.limitedTimeEndsAt: <instant>`                                       | **not** a stored duration: anchored at the demo epoch `2026-10-29T12:00Z` + the original duration (48h, 36h, 24h, 12h) |
| `recentPlayers`                                   | `stats.recentPlayers`                                                      | `PersonRef[]`                                                                                                          |
| `createdAt`, `lastUpdated`                        | `createdAt`, `stats.updatedAt`                                             |                                                                                                                        |
| `stats.completionRate`, `averageScore`, `revenue` | `data/quiz-analytics.ts` (→ `QuizAnalytics`, incl. the new `revenueCents`) | engagement, not content (D11)                                                                                          |

Two projection fields were added because cards render them and the projections did
not carry them: `timeLimitSeconds` (all cards print "20 min") and, on the authoring
card, `capacity` + `spotsLeft` (the seat bar). `QuizAnalytics.revenueCents` is the
one content-model addition: authoring earnings sat next to `averageScore` in the
fixture, and dropping them would have deleted a shipped metric.

**Conflicts d2's consolidation forced** (one truth instead of five snapshots; the
losing values are in `ledger.json` and were not invented). These are d2's rulings on
_its own_ tree — the reconciliation overrides six of its seven rulings, because the
migration's record is canonical wherever the two collections overlapped (see
"Canonical winner, per conflict"). The overrides are marked **superseded**:

- **superseded** — `Science Quiz: Space Exploration`: d2 took 178/500, `$7.50`, author
  `CosmicMind` from the three browse surfaces. The migration's §5 union wins instead:
  2,453/3,000, `$10.00`, `MarvelFan`, and the 178/500 · `$7.50` · `popular` snapshot
  becomes a per-slot overlay (B-01).
- `Literature: Classic Novels`: 1,298/1,500 vs 298/300 vs 300/300. d2 took 300/300;
  **superseded** by §5's 1,298/1,500. (d2's `status: archived` reading is also not the
  record's — it stays published with no questions.)
- `Math Puzzles & Problems`: 156 plays vs 0 (it is a draft with 0% completion and
  `$0` revenue on the authoring surface). The draft wins. **Kept.**
- `Music Through the Decades` 1,000 → 300 seats, `Technology & Gadgets` 1,000 → 250,
  `Sports Trivia Challenge` 1,000 → 250 (the marketing cards overstated capacity).
  **All three superseded**: the migration's records hold 1,000 capacity each, and the
  narrower seat counts were the authoring surface's.
- Dashboard `plays` 42/28/15/8 → the catalogue's 285/178/412/0. **Kept** as a ruling
  on which snapshot a card shows, not as a record value. Its `quiz-world-geography-challenge`
  row (285/300) is **superseded** by the §7 record's 1245 plays, though.
- **superseded** — `Sports Trivia Challenge`'s slug collides with the generator
  template of the same title, so d2 made a second record `quiz-sports-trivia`. There is
  one record: `quiz-11`, the template. Renaming it was the wrong fix for E2; pointing
  the card at the existing record is the right one (E8 freezes the slug anyway).

**Authoring that was unavoidable, and is recorded as such:** `summary` on every
record (schema-required, never displayed); `difficulty` on the nine featured-page
records that carried none; `competition`-free defaults for `timeLimitSeconds` on the
13 marketing records that never stated a duration (`0` = no limit, the model's own
encoding of "not stated").

E10 keeps the two halves honest now: every shelf id resolves against `data/quizzes.ts`,
every one of the 20 browse records appears on at least one shelf (`W5` otherwise), and
every alias in `catalogueAliases` points at a record that exists. E11 is the guard this
merge added: no two records share a normalised title, so the drift d2 and the migration
each produced independently cannot return as an "extra" record.

## Invariants `data:check` enforces

Per-record (`E0`): every record parses against its schema, every object strict.

Collection-level:

| code        | invariant                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `E1` / `E2` | ids unique across all four kinds; `kind/slug` unique (a slug is URL identity)                                                                                                        |
| `E3`        | question ids unique across quizzes; every `selectQuizCard()` / `selectQuizAuthoringCard()` output parses as its card type (a published quiz with no questions is `W1`, not an error) |
| `E4`        | a record may only reference categories in its own scope; every `data/categories` row is in the table with a non-negative derived count                                               |
| `E5`        | contact refs resolve; notification `link` matches a real route and `iconKey` is in the registry                                                                                      |
| `E6`        | conversation → contact refs resolve                                                                                                                                                  |
| `E7`        | `content/routes.ts` and the `app/` tree agree in both directions (34 routes)                                                                                                         |
| `E8`        | every search row names a real quiz / category / curated page                                                                                                                         |
| `E9`        | `content/quiz.ts` exists and `types/quiz.ts` does not; no file under `components/`, `app/`, `lib/` declares its own `Quiz` (one `Quiz` type; positive control included)              |
| `E10`       | every shelf id resolves to a record in `data/quizzes.ts`, and no `catalogueAliases` id is also a record                                                                              |
| `E11`       | one record per subject: no two quizzes share a normalised title, and every alias points at a record that exists                                                                      |

Warnings are advisory and do not fail the build: `W1` published quiz with no
questions, `W2` published quiz with no `publishedAt`, `W3` a renderable category with
no quizzes, `W4` a reward with no limited-time window, `W5` a browse record no
shelf shows (dead card).

### The warning census (98 warnings, measured)

| code | count | who                                                                                                 |
| ---- | ----- | --------------------------------------------------------------------------------------------------- |
| `W1` | 24    | the 5 `CreatedQuiz` records and 19 of the 20 browse cards: their content was never in the repo      |
| `W2` | 42    | every published record — no card, `CreatedQuiz` or generator template carried a publication instant |
| `W4` | 32    | a prize with no window; only 4 of the 36 rewarded records carry `limitedTimeEndsAt`                 |
| `W3` | 0     | every renderable quiz category has at least one quiz                                                |
| `W5` | 0     | every browse card is on at least one shelf — curation and collection agree                          |

`W1`/`W2`/`W4` were 5 / 23 / 13 against the migration's 42 and are 24 / 42 / 32 against
the 62. The increase is entirely the 20 browse cards, which are card records: they
have no questions, no authored date, and (19 of them) a reward with no expiry. None of
those is a defect to paper over — inventing a question, a date or an expiry to silence
a warning is the drift this migration exists to remove. `W3` and `W5` are zero.

## Consequences worth knowing

- **The search palette is honest now.** It indexes 42 quizzes, 14 categories, 3
  creators and 15 pages (74 rows). Before the P1 model it listed 4 quizzes that did
  not exist (plus 8 more in an inline copy inside
  `components/search/search-results.tsx`) and creator counts of 87/34/56. Only
  `visibility: "public"` records enter it, so the 19 private generator templates stay
  out; 42 of the 62 records are public.
- **Category tiles show derived counts.** 16 of the 25 quiz subjects now have at
  least one quiz, so 9 still show `0` — they are real, empty taxonomy rows, not a
  stored count drifting from the collection (which is what 113-vs-20 was).
- **Authorship is content.** 19 records name an author: the 16 authored quizzes
  (MarvelFan, GeoExplorer, …), `quiz-11` (SportsNut) and 2 of the browse cards. A
  merchandising overlay can never carry one — `zQuizPromotion` has no `author` key
  (B-01 §A4).
- **Notification icons are a registry**, so a new icon is a one-line addition to
  `NOTIFICATION_ICON_KEYS` plus a case in `components/header/notification-icon.tsx`.

## Adding content

1. Add the record to the right `data/` module. The type will reject an unknown key.
2. Run `pnpm data:check`. A new id, slug, category id or link that collides or does
   not resolve fails there with the record's index and field path.
3. If the field genuinely does not exist in the model, add it to the schema in
   `content/` first — then the fixture — and record the change here or in
   `ledger.json`. Never widen a fixture to fit a broken schema silently.

## Deferred

- **D14** — `app/(mainlayout)/categories/[slug]/page.tsx` exports `Metadata`
  instead of `generateMetadata`, so the route has no metadata and the function is
  dead code. Fixing it changes page behaviour, not fixture shape, so it is not in
  this change.
- **Authorship** — 19 of the 62 records name an `author`; the 19 draft generator templates, the
  5 `CreatedQuiz` records and 18 browse cards do not, so search `creators[]` keeps
  `quizCount: 0` until they are assigned. Assigning one is a content decision, not a
  migration one.
- **`rewardCents`** lives in `QuizStats`; `Tournament` keeps `prizeCents`. If the two
  should share one shape, that is a tournament-model change.
- **Taxonomy** — the quiz scope is A's 22 subjects corrected (`architechture` →
  `architecture`) plus `science`, `history`, `art` from B, 25 total. The asset
  filename is still misspelled on disk (`public/category/architechture.webp`); the
  row points at the real file so the tile renders.
- **Playable-quiz visibility** is assumed `public`; the fixture never said.
- **Card detail pages** — `components/my-quizzes/quiz-details.tsx` and
  `components/quiz/quiz-details.tsx` still hold authored data. They are not card
  grids: they render a per-question table (`correctPercentage`, per-option
  `isCorrect`) and a `recentPlayers` scoreboard, i.e. observed _results_, which the
  content model does not own (D11). Their headers duplicate card fields, so they
  become projections once a results/analytics record exists; their question tables
  should then read `Question[]` from the same record. Deliberately out of D2.
- **Profile created quizzes** — `components/profile/profile-created-quizzes.tsx`
  renders `CreatedQuiz` from `lib/data/users.ts`, a field of the `User` record
  (`createdQuizzes[]`), not a catalogue card. `zQuizAuthoringCard` was designed
  from its shape (`mostMissedQuestion`, `highestScore`, `tournament`), but the
  fixture is nested in the user domain. Its local `QuizCard` component was renamed
  `ProfileQuizCard` so it stops colliding with the model's `QuizCard`; moving the
  fixture onto the catalogue is a profile-model change, not a card projection.
- **Category scoping on `categories/[slug]`** — the page projects
  `shelfCards("exploreAll")` and ignores the slug, exactly as its authored array
  did (that array was the same four records on every category route). Giving it a
  per-category shelf, or a `selectQuizCardsByCategory()`, is the next step; until
  then every category route lists the whole `exploreAll` shelf.
