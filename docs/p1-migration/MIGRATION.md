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
pnpm data:check   # tsc (content + data + scripts) -> node:test (75 cases) -> validator
pnpm typecheck    # next typegen && tsc --noEmit
pnpm lint         # biome check (includes the formatter gate)
pnpm build        # next build
```

`data:check` compiles the model with `tsconfig.datacheck.json` (CommonJS, no
bundler, no framework imports) into `.datacheck/` and then runs it under plain
node. That is why `content/` must never import React or Next.

Today's output:

```
PASS  42 quizzes, 185 questions, 9 news, 6 tips, 8 kb, 45 categories,
      5 contacts, 5 conversations, 6 notifications, 54 search rows
      34 routes match app/, 0 unknown category ids, 0 dead links
WARN  41  [W1] 5, [W2] 23, [W4] 13   (W3: 0)
```

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
| `data/quizzes.ts`                                | the whole quiz collection (42) plus `quizById` / `quizBySlug` — the only list a join may read                                                                                                                                                      |
| `data/authored-quizzes.ts`                       | the 16 card-only quizzes decision A authored (`quiz-migration.md` §10 — generated)                                                                                                                                                                 |
| `data/created-quizzes.ts`                        | the 5 `CreatedQuiz` records (§7 — generated)                                                                                                                                                                                                       |
| `scripts/data-check.ts`                          | the validator: per-record schema pass, then the collection-level invariants                                                                                                                                                                        |
| `scripts/__tests__/data-model.test.ts`           | 28 negative tests; one per drift class                                                                                                                                                                                                             |
| `scripts/__tests__/quiz-collection.test.ts`      | 14 collection tests: the 42 records, the frozen slugs, the Science overlay case                                                                                                                                                                    |

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

## Invariants `data:check` enforces

Per-record (`E0`): every record parses against its schema, every object strict.

Collection-level:

| code        | invariant                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E1` / `E2` | ids unique across all four kinds; `kind/slug` unique (a slug is URL identity)                                                                                           |
| `E3`        | question ids unique across quizzes; every `selectQuizCard()` output parses as a `QuizCard` (a published quiz with no questions is `W1`, not an error)                   |
| `E4`        | a record may only reference categories in its own scope; every `data/categories` row is in the table with a non-negative derived count                                  |
| `E5`        | contact refs resolve; notification `link` matches a real route and `iconKey` is in the registry                                                                         |
| `E6`        | conversation → contact refs resolve                                                                                                                                     |
| `E7`        | `content/routes.ts` and the `app/` tree agree in both directions (34 routes)                                                                                            |
| `E8`        | every search row names a real quiz / category / curated page                                                                                                            |
| `E9`        | `content/quiz.ts` exists and `types/quiz.ts` does not; no file under `components/`, `app/`, `lib/` declares its own `Quiz` (one `Quiz` type; positive control included) |

Warnings are advisory and do not fail the build: `W1` published quiz with no
questions, `W2` published quiz with no `publishedAt`, `W3` a renderable category with
no quizzes, `W4` a reward with no limited-time window.

### The warning census (41 warnings, measured)

| code | count | who                                                                                                                           |
| ---- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| `W1` | 5     | the 5 `CreatedQuiz` records: their content was never in the repo (a question _count_ was)                                     |
| `W2` | 23    | every published record — no card, `CreatedQuiz` or generator template ever carried a publication instant                      |
| `W4` | 13    | a prize with no window (`quiz-11` $3.00 and 12 authored quizzes); only 4 of the 17 rewarded records carry `limitedTimeEndsAt` |
| `W3` | 0     | every renderable quiz category now has at least one quiz                                                                      |

These are the §10 debt figures of `quiz-migration.md` (W1 5 / W2 23 / W3-there 13),
reproduced by the collection itself rather than by the harness. None is a defect to
paper over: `publishedAt` and prize windows are content decisions, and `questions`
for the 5 `CreatedQuiz` records does not exist to copy.

## Consequences worth knowing

- **The search palette is honest now.** It indexes 22 quizzes, 14 categories, 3
  creators and 15 pages (54 rows). Before the P1 model it listed 4 quizzes that did
  not exist (plus 8 more in an inline copy inside
  `components/search/search-results.tsx`) and creator counts of 87/34/56. Only
  `visibility: "public"` records enter it, so the 20 private generator templates stay
  out; 22 of the 42 records are public.
- **Category tiles show derived counts.** 16 of the 25 quiz subjects now have at
  least one quiz, so 9 still show `0` — they are real, empty taxonomy rows, not a
  stored count drifting from the collection (which is what 113-vs-20 was).
- **Authorship is content.** 17 records name an author: the 16 authored quizzes
  (MarvelFan, GeoExplorer, …) and `quiz-11` (SportsNut). A merchandising overlay can
  never carry one — `zQuizPromotion` has no `author` key (B-01 §A4).
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
- **Authorship** — 17 of the 42 records name an `author`; the 20 generator templates and
  the 5 `CreatedQuiz` records still do not, so search `creators[]` keeps `quizCount: 0`
  until they are assigned. Assigning one is a content decision, not a migration one.
- **`rewardCents`** lives in `QuizStats`; `Tournament` keeps `prizeCents`. If the two
  should share one shape, that is a tournament-model change.
- **Taxonomy** — the quiz scope is A's 22 subjects corrected (`architechture` →
  `architecture`) plus `science`, `history`, `art` from B, 25 total. The asset
  filename is still misspelled on disk (`public/category/architechture.webp`); the
  row points at the real file so the tile renders.
- **Playable-quiz visibility** is assumed `public`; the fixture never said.
