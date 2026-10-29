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
pnpm data:check   # tsc (content + data + scripts) -> node:test (157 cases) -> validator
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
WARN  98  [W1] 24, [W2] 42, [W4] 32   (W3: 0, W5: 0)
```

Repeated diagnostics are grouped by code and message template, so a gap that
affects the whole collection prints as one line with a count instead of 98 lines.
The 98 are real: 24 published records are card records with no questions, 42 carry
no authored date, and 32 advertise a reward that never expires. See "D2 — the card
grids read the model" and "Two collections, one winner".

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
| `data/browse-quizzes.ts`                         | the 20 card-only quizzes the D2 grids carried and the migration never did                                                                                                                                                                          |
| `data/quiz-catalogue.ts`                         | curation only: 13 ordered shelf id lists + `catalogueAliases`; no `Quiz` records                                                                                                                                                                   |
| `scripts/data-check.ts`                          | the validator: per-record schema pass, then the collection-level invariants                                                                                                                                                                        |
| `scripts/__tests__/data-model.test.ts`           | 28 negative tests (one per drift class) + 5 fixture-clock cases                                                                                                                                                                                    |
| `scripts/__tests__/quiz-collection.test.ts`      | the 62 records, the frozen slugs, the Science overlay case, one record per subject                                                                                                                                                                 |

Every object in `content/` is `.strict()`: an unknown key is an error. That is the
mechanism, not a style choice — a field added to a fixture without a schema entry
fails `data:check` by name.

## What the migration changed

### The eight things that were actually wrong

| drift                           | before                                                                                                              | now                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 two `Quiz` types             | `types/quiz.ts` (`id: number`, settings required) vs `Quiz` in `data/mock-quizzes.tsx`                              | one `zQuiz` in `content/quiz.ts`; `types/quiz.ts` deleted, guarded by `E9`                                                                                                   |
| D2 four card shapes             | quiz card / preview card / authoring card / featured card, each its own literal                                     | `selectQuizCard()` and `selectQuizAuthoringCard()` project one `Quiz`; cards are never authored                                                                              |
| D3 colliding ids                | `id: 1…20` reused across quizzes, questions, categories, search rows                                                | kebab-case ids, namespaced (`quiz-1`, `quiz-1-q1`, `history`) and unique across the whole model                                                                              |
| D4 answer key                   | `correctAnswer: number` (index into `options`)                                                                      | `correctOptionId: "a"…"f"`, validated to name an existing option; 100/100 answers preserved                                                                                  |
| D5 difficulty                   | `"Medium"`, `"medium"`, `"medium "`                                                                                 | `zDifficulty` = `easy \| medium \| hard`                                                                                                                                     |
| D6 three category vocabularies  | 22 quiz subjects, 14 browse categories, 4 search categories, 3 per-kind string unions                               | one 45-row table, four scopes, `categoryIds` is the only join                                                                                                                |
| D7 quizzes had no category      | 0/20 quizzes carried a category (tags were prose)                                                                   | 42/42 carry `categoryIds`, derived once from the tag alias map (or authored with the record) and then frozen                                                                 |
| D8 three body shapes            | news `sections`, tips markdown string, kb sections, plus an inline redeclaration                                    | one `ContentBlock[]` union for all three                                                                                                                                     |
| D9 six time formats             | `"2 days ago"`, `"May 15, 2025"`, `Date.now()` at module import, …                                                  | one ISO-8601 instant (`publishedAt`, `sentAt`, `lastSeenAt`, `limitedTimeEndsAt`); prose is derived at render                                                                |
| D10 framework objects in data   | `icon: <Trophy />`, `StaticImageData`, `string \| StaticImageData`                                                  | `ImageRef {src, alt}` and `iconKey` into `NOTIFICATION_ICON_KEYS`                                                                                                            |
| D11 stored derived values       | `spotsLeft`, `almostFull`, `unread`, `recentMessages`, `count`, `quizCount` authored by hand                        | derived: `zQuizStats` + `spotsLeftOf`, `deriveUnread`, `deriveCategoryCounts`, `buildSearchIndex`                                                                            |
| D12 duplicated `recentMessages` | a hand-written array whose avatars disagreed with the conversations 3/5 of the time                                 | `selectRecentMessages()` over the real conversation                                                                                                                          |
| D13 dead links                  | 2 notification routes with no page, 2 accidental `/profile/<word>` matches                                          | `routeManifest` + `matchRoute` + `checkNotificationRefs`; `data:check` walks `app/` in both directions                                                                       |
| D14 dead `Metadata` export      | `app/(mainlayout)/categories/[slug]/page.tsx` exports `Metadata`, which Next never reads                            | `generateMetadata` over the same lookup (fixed after this change; `E10` fails the build if the dead export returns)                                                          |
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
  `sentAt`. `recentMessages` is deleted; the drawer derives it and formats
  `lastMessageAt` at render time against the fixture clock (`DEMO_NOW_ISO`) — no
  formatted string and no clock reading lives in `data/`.
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
    at all, none was added (`W2` is the one published quiz with no `publishedAt`).
- **One anchor, and it is in the past.** Every instant in `data/` is at or before
  `2026-10-29T10:00:00.000Z`, the instant this migration ran: `notifications` sit 10m / 1h /
  3h / 5h / 1d / 2d before it (`09:50`, `09:00`, `07:00`, `05:00`, then `10:00` on the two
  previous days), and `chat-data` inside the same window. Nothing is later than the anchor.
  A stored instant in the future is the one way a static fixture renders as nonsense, and
  it did: an earlier revision anchored `notifications` at `12:00Z`, so `formatRelative`
  drew the newest two rows as `"in 1 hour"` and `"in 22 minutes"`. `E9`-style enforcement
  is not available here (the anchor is a policy, not a schema), so this paragraph is the
  rule: author instants backwards from the migration instant, never forwards from it.
  **The one exception is an expiry.** `data/quiz-catalogue`'s `limitedTimeEndsAt`
  values are anchored at the same instant and deliberately point forward (12h, 24h,
  36h, 48h after it), because a window that had already closed would render every
  limited-time card as expired. A future _expiry_ is a countdown; a future
  _presence_ or _creation_ instant is the D9 bug this paragraph forbids.
- **The anchor ages.** These are static fixtures and `formatRelative` runs at render time,
  so today's `"10m ago"` reads `"3 weeks ago"` next month. That is the honest reading of a
  frozen snapshot; the alternative — computing `Date.now()` at module import — makes the
  fixture non-deterministic and un-diffable, and is exactly what D9 removed.

So the claim "no fixture value was invented" holds for **fields and dates**, not for times
of day: dates were preserved, times of day were chosen, and the anchor ages.
### The 21 records that were missing from `data/`

The first pass ported the 21 pre-migration quizzes and stopped there. `quiz-migration.md`
§7 and §10 produce 21 more records, and they existed only in the migration harness
(`migrated/quizzes.json`), so nothing in the app could join to them and a per-slot
promotion keyed on `quiz-science-quiz-space-exploration` could not resolve (E11).

Now ported, field-for-field:

| module                     | records | source                                      |
| -------------------------- | ------- | ------------------------------------------- |
| `data/created-quizzes.ts`  | 5       | §7 — the `CreatedQuiz` records              |
| `data/authored-quizzes.ts` | 16      | §10 — decision A's card-only quizzes        |
| `data/quizzes.ts`          | 42      | the composition + `quizById` / `quizBySlug` |

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
   `author: MarvelFan`, not the overlays' `CosmicMind`. A second record for the same
   subject would fail E10 and fork the identity (A4).
3. **Two deliberate deviations from the harness output** are kept in `data/currentQuiz`:
   its `tags` facets (`history`, `world events`) survive, and its images keep
   `alt: ""`. The harness dropped the tags and wrote alt strings from the prompts.
   Neither is a join key or a card field, so neither affects a projection; both are
   recorded here rather than silently swapped.

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

**Field mapping** (card literal → model), applied to the 20 card records that became
`data/browse-quizzes.ts` and to the 7 aliased ids that resolve to a record the
migration already owned:

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

**Conflicts the consolidation forced** (one truth instead of five snapshots; the
losing values are in `ledger.json` and were not invented):

- `Science Quiz: Space Exploration`: 2,453/3,000 players, `$10.00`, "Entertainment",
  no difficulty (home + featured pages) **vs** 178/500, `$7.50`, Science, Hard
  (explore, category, my-quizzes). **Superseded by B-01:** the record keeps the
  catalogue's 2,453/3,000 · `$10.00` · `MarvelFan`; 2,105/2,500 · `$7.50` ·
  `CosmicMind` is a **per-slot promotion overlay** (`zQuizPromotion`), not a second
  record. The card still shows those numbers where the slot carries the campaign.
- `Literature: Classic Novels`: 1,298/1,500 vs 298/300 vs 300/300. The authoring
  surface wins, which is also the only one that says `completed`.
- `Math Puzzles & Problems`: 156 plays vs 0 (it is a draft with 0% completion and
  `$0` revenue on the authoring surface). The draft wins.
- `Music Through the Decades` 1,000 → 300 seats, `Technology & Gadgets` 1,000 → 250,
  `Sports Trivia Challenge` 1,000 → 250 (the marketing cards overstated capacity).
- Dashboard `plays` 42/28/15/8 → the collection's 285/178/412/0.
- `Sports Trivia Challenge`'s slug collides with the generator template of the same
  title, so the card folds onto that frozen record: `quiz-sports-trivia` is a
  `catalogueAlias` for `quiz-11`, not an id of its own (E2 enforces the slug, E12
  keeps the alias out of the collection).

**Authoring that was unavoidable, and is recorded as such:** `summary` on every
record (schema-required, never displayed); `difficulty` on the nine featured-page
records that carried none; `competition`-free defaults for `timeLimitSeconds` on the
13 marketing records that never stated a duration (`0` = no limit, the model's own
encoding of "not stated").

### Two collections, one winner

`d2/card-projections` and `feat/b01-quiz-data` each landed a `Quiz[]` collection and
neither tree could see the other. Merged, they are a red build (E1), not a drift, so
one had to win per record. Measured on the two modules:

| module                                                            | records |
| ----------------------------------------------------------------- | ------- |
| `data/quizzes.ts` (mock 20 + current 1 + created 5 + authored 16) | 42      |
| the D2 catalogue that became `data/browse-quizzes.ts`             | 40      |
| **ids in both** — the migration's record wins                     | 13      |
| **same card, id invented by D2** — folded onto the frozen record  | 7       |
| **genuinely new titles** — added                                  | 20      |
| **final collection**                                              | **62**  |

The seven folded ids are the interesting ones: six were the same title as an existing
record (four of them with identical engagement numbers as well), and the seventh is
`Sports Trivia Challenge`, which is the generator template `quiz-11` — D2 renamed the
id to dodge the E2 slug collision rather than pointing at the template. They live in
`catalogueAliases` instead of being records, so the evidence that the two trees
spelled one subject two ways survives without forking the identity.

| D2's id                                       | the frozen record                                   |
| --------------------------------------------- | --------------------------------------------------- |
| `quiz-brain-teasers-and-logic-puzzles`        | `quiz-brain-teasers-logic-puzzles`                  |
| `quiz-famous-inventors-and-discoveries`       | `quiz-famous-inventors-discoveries`                 |
| `quiz-mathematical-puzzles-and-brain-teasers` | `quiz-mathematical-puzzles-brain-teasers`           |
| `quiz-world-geography-capitals-and-landmarks` | `quiz-world-geography-challenge-capitals-landmarks` |
| `quiz-technology-and-gadgets`                 | `quiz-technology-gadgets`                           |
| `quiz-music-through-decades`                  | `quiz-music-through-the-decades`                    |
| `quiz-sports-trivia`                          | `quiz-11`                                           |

`data/quiz-catalogue.ts` is curation only now — 13 ordered id lists plus the alias
table, no records, resolving through `quizById`. `data/quiz-analytics.ts` followed the
fold: the `Sports Trivia Challenge` snapshot is keyed `quiz-11`, because a key that
names no record renders "no data" forever (E13).

E11 and E12 keep the two halves honest: every shelf id resolves to a record in the one
collection, every authoring-card projection parses as a `QuizAuthoringCard` (E3 covers
the same for `QuizCard`), no two records share a normalised title, and no alias has
come back as a record.

## Invariants `data:check` enforces

Per-record (`E0`): every record parses against its schema, every object strict.

Collection-level:

| code        | invariant                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E1` / `E2` | ids unique across all four kinds; `kind/slug` unique (a slug is URL identity)                                                                                                                                 |
| `E3`        | question ids unique across quizzes; every `selectQuizCard()` output parses as a `QuizCard` (a published quiz with no questions is `W1`, not an error)                                                         |
| `E4`        | a record may only reference categories in its own scope; every `data/categories` row is in the table with a non-negative derived count                                                                        |
| `E5`        | contact refs resolve; notification `link` matches a real route and `iconKey` is in the registry                                                                                                               |
| `E6`        | conversation → contact refs resolve                                                                                                                                                                           |
| `E7`        | `content/routes.ts` and the `app/` tree agree in both directions (34 routes)                                                                                                                                  |
| `E8`        | every search row names a real quiz / category / curated page                                                                                                                                                  |
| `E9`        | `content/quiz.ts` exists and `types/quiz.ts` does not; no file under `components/`, `app/`, `lib/` declares its own `Quiz` (one `Quiz` type; positive control included)                                       |
| `E10`       | no `app/` page or layout exports a metadata function Next never reads (`Metadata`, `GenerateMetadata`, …); `categories/[slug]` must export `generateMetadata`                                                 |
| `E11`       | every shelf id resolves to a record in the one collection, and every `selectQuizAuthoringCard()` output parses as a `QuizAuthoringCard`                                                                       |
| `E12`       | one record per subject: no two records share a normalised title, and no `catalogueAlias` has come back as a record                                                                                            |
| `E13`       | every analytics key names a record — an authoring snapshot of a quiz the collection does not hold renders as "no data" forever, so it fails here instead                                                      |
| `E14`       | every `promotions[].quizId` resolves to a record; `id` and `(quizId, slot)` are unique; no content key parses (`strict()` rejects `title`, `author`, `slug`, …)                                               |
| `E15`       | `endsAt > startsAt` when present; a slot window never extends the catalog window; a `rewardCents` that differs from the catalog is bounded by it, and `0` is rejected                                         |
| `E16`       | overlays that are live at the same time for one quiz agree field-wise on every engagement key they both set (sequential campaigns may differ)                                                                 |
| `E17`       | every `promotions[].slot` parses canonically, indexes a position a shelf actually produces, and that position renders the quiz the overlay names (a slot nobody renders fails the build, not silently no-ops) |

Warnings are advisory and do not fail the build: `W1` published quiz with no
questions, `W2` published quiz with no `publishedAt`, `W3` a renderable category with
no quizzes, `W4` a reward with no limited-time window, `W5` a browse record no shelf
shows (dead card), `W6` a campaign staged outside the quiz's published life
(`startsAt` before `publishedAt`, or a target that is not `published`).

**Two codes that mean more than one thing — check which document you are reading.** Issue #27 asked for
`E11`/`E12`/`E13`, but all three were already taken here (card shelves, one record per subject, analytics
keys), so the promotion rules shipped as `E14`–`E17` above. Separately, the C1 harness documents
(`quiz-migration.md`, `quiz-invariants.md`) use `W4` for _"two card records disagreeing about one quiz"_ —
which B-01 took to **0** — while this validator's `W4` is _"a reward with no limited-time window"_ and stays
**32**. An overlay can never change a catalog window, so B-01 does not move this `W4` and does not claim to.

### The warning census (98 warnings, measured)

| code | count | who                                                                                                                     |
| ---- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| `W1` | 24    | the 5 `CreatedQuiz` records and the 19 browse card records: a card record carries an engagement snapshot, not questions |
| `W2` | 42    | every published record — no card, `CreatedQuiz`, authored quiz or browse card ever carried a publication instant        |
| `W4` | 32    | a prize with no window; only 4 of the 36 rewarded records carry `limitedTimeEndsAt`                                     |
| `W3` | 0     | every renderable quiz category has at least one quiz                                                                    |
| `W5` | 0     | every browse record is on at least one shelf                                                                            |

These are the §10 debt figures of `quiz-migration.md`, reproduced by the collection
itself rather than by the harness, plus the honest cost of the 20 browse cards d2
contributed: no question, date or expiry was invented to silence a warning.

### The promotions collection (B-01, issue #27)

One quiz is merchandised twice with different numbers. `Science Quiz: Space
Exploration` appears at two slots — the explore page's and the featured page's
`popular[1]` — as **2105/2500 players · $7.50 · 4.8 · `popular` · no countdown**,
against a catalog record of **2453/3000 · $10.00 · 4.9 · `hot` · a 48 h window**.
A card is a projection of one record (decision 5), so the second snapshot cannot be a
card-local override and must not be a second record (that is `E12`). It is a third,
**engagement-only** record: `data/promotions.ts`, keyed `(quizId, slot)`,
`strict()`, with no key that can carry content.

| what                              | value                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| records                           | 2 (`promo-science-quiz-space-exploration-1`/`-2`), one per slot, identical                                                               |
| window                            | `startsAt: 2025-01-01T00:00:00.000Z`, **no `endsAt`** — bounded by the catalog's `2025-01-03T00:00:00.000Z`, so no end date was invented |
| countdown                         | `limitedTimeEndsAt: null` cancels the **display** only; the campaign stays bounded                                                       |
| prize                             | `rewardCents: 750` against a catalog `1000` — legal because the window bounds it (`E15`)                                                 |
| `author`                          | **not overridable**: the record keeps `MarvelFan`, the authored card said `CosmicMind`, and no overlay key can carry an author           |
| fidelity                          | **31/31** authored card records reproduce their stats through `selectQuizCard` with the 2 overlays, **29/31** without them               |
| C1 `W4` (two records disagreeing) | **0** (was 2). This validator's `W4` is a different code and stays 32 — see above                                                        |

Rules: the overlay applies iff `startsAt ≤ now < min(endsAt, catalog window, overlay
countdown)` **and** the quiz is `published` and past `publishedAt`; outside the window
the card equals the catalog projection field for field. Concurrent overlays of one quiz
must agree (`E16`), and the seat rule is re-checked **after** the merge (a merged
`plays > capacity` throws rather than rendering a negative `spotsLeft`).

How it reaches a page (P3). Overlays are keyed by **slot string**, shelves by **name**, and
neither derives from the other, so the join is written down once as data:
`data/quiz-catalogue.ts::slotShelves` maps a slot group (`explore-page/popular`) to the shelf
that renders it (`explorePopular`). `slotForPosition(shelf, index)` is its inverse;
`parseSlot()` accepts the canonical `group/popular[<n>]` form only (so `[01]` is a mismatch,
not a silent near-miss), and the inverse map throws at import if two slots name one shelf.
`lib/quiz-cards.ts::shelfCards()` asks for each position's slot and passes the resolved
promotion into `selectQuizCard()`, so a merchandised card renders the campaign and every
other shelf (`homeFeatured`, `exploreAll`, …) stays the catalog projection — a campaign is a
_place_, not a property of the record. `E17` is the join's guard: a slot that names a shelf
or index nobody renders, or a position that renders a different quiz, fails `data:check`
instead of shipping a campaign that silently never runs. `/quiz/<id>` projects
`quizDetailCard()` — the **quiz-scoped** campaign (A3) — on the server at one instant and
prints `formatCurrency(stats.rewardCents)`, so the detail page cannot advertise a prize the
card does not (`$7.50` while the campaign runs, `$10.00` before and after).

Two qualifications, stated because a green check is easy to over-read. **The explore page's
slot has no live surface**: `explore-page/popular[1]` maps to `explorePopular`, which only
`components/explore/explore-featured.tsx` renders, and nothing imports that component
(`/explore` renders `ExploreQuizzesPage` → `ExploreQuizList` over `exploreAll`). The join,
the campaign and `E17` are correct for the slot, but no page shows it —
`explore-featured/popular[1]` is the one that renders on screen today. And the `featured`
page is **request-time** on purpose (`export const dynamic = "force-dynamic"`): a static
prerender would evaluate the card projection at build time, so the HTML a crawler or first
paint receives would carry the catalog snapshot — or, for a build made inside the window,
freeze the campaign numbers permanently. Everything else in the app is still statically
prerendered and still formats countdowns at build time; that is the older D9 debt, not
something this join introduced.

The full C1 spec, the four product answers and the signed-off acceptance table live
in `quiz-promotion-backlog.md` and `quiz-migration.md` §12.4 (harness documents,
delivered with the card that implemented B-01).

## Consequences worth knowing

- **The search palette is honest now.** It indexes 42 quizzes, 14 categories, 3
  creators and 15 pages (74 rows). Before the P1 model it listed 4 quizzes that did
  not exist (plus 8 more in an inline copy inside
  `components/search/search-results.tsx`) and creator counts of 87/34/56. Only
  `visibility: "public"` records enter it, so the 20 private generator templates stay
  out; 42 of the 62 records are public.
- **Category tiles show derived counts.** 16 of the 25 quiz subjects now have at
  least one quiz, so 9 still show `0` — they are real, empty taxonomy rows, not a
  stored count drifting from the collection (which is what 113-vs-20 was).
- **Authorship is content.** 19 records name an author: the 16 authored quizzes
  (MarvelFan, GeoExplorer, …), `quiz-11` (SportsNut) and two of the browse cards.
  A merchandising overlay can never carry one — `zQuizPromotion` has no `author`
  key (B-01 §A4).
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

- **Authorship** — 19 of the 62 records name an `author`; the 20 generator templates,
  the 5 `CreatedQuiz` records and 18 browse cards still do not, so search `creators[]`
  keeps `quizCount: 0` until they are assigned. Assigning one is a content decision,
  not a migration one.
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
