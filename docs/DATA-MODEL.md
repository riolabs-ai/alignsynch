# Data model — AlignSynch (quizhub)

One typed model: `content/*.ts` zod schemas are the single source of truth; types are `z.infer`red,
every `data/*` fixture is validated at build by `pnpm data:check` (134 tests, exit 0). A drift is a
red build. `content/` has no React/Next import. Full history: docs/p1-migration/MIGRATION.md.

## Inventory — every `data/*` module → entity (62 quizzes · 9 news · 6 tips · 8 kb · 5 contacts · 5 conv · 6 notifs)

| module                      | entity (count)                                                           | storage / view                        |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| data/quizzes.ts             | Quiz ×62 (mock 20 + currentQuiz 1 + created 5 + authored 16 + browse 20) | THE one list; `quizById`/`quizBySlug` |
| data/mock-quizzes.ts        | Quiz ×20 generator templates (draft, private)                            | storage                               |
| data/currentQuiz.ts         | Quiz ×1 playable                                                         | storage                               |
| data/created-quizzes.ts     | Quiz ×5 (§7; published, no questions)                                    | storage                               |
| data/authored-quizzes.ts    | Quiz ×16 (decision-A card-only)                                          | storage                               |
| data/browse-quizzes.ts      | Quiz ×20 (d2 card-only)                                                  | storage                               |
| data/quiz-catalogue.ts      | none — 13 shelves (ordered ids) + 7 `catalogueAliases`                   | curation view, no records             |
| data/quiz-analytics.ts      | QuizAnalytics ×6 keyed by quiz id                                        | storage (engagement)                  |
| data/categories.ts          | Category ×25 (quiz rows + derived `count`)                               | view of content/categories.ts         |
| data/news-data.ts           | NewsArticle ×9 + news Category ×7 (re-export)                            | storage                               |
| data/creator-tips-data.ts   | Tip ×6 + tip Category ×6 (re-export)                                     | storage                               |
| data/knowledge-base-data.ts | KbArticle ×8                                                             | storage                               |
| data/chat-data.ts           | Contact ×5, Conversation ×5 (+ derived mock views)                       | storage                               |
| data/notifications.ts       | Notification ×6                                                          | storage                               |
| data/searchdata.ts          | SearchIndex ×74 derived rows                                             | derived, never authored               |

Demoted to views, not retired: `quiz-catalogue.ts` (was a 40-record second collection), `categories.ts`
(was a 22-row copy), `searchdata.ts` (was an unrelated catalog).

## Entities (identity · owner · lifecycle)

- `Quiz` — id `quiz-<slug>` (kebab, E1); `slug` frozen = URL identity; owner `author: PersonRef?`; lifecycle `status: draft|published|archived` (never inferred from `publishedAt`).
- `Question`/`QuestionOption` — ids `quiz-<quiz>-q<n>` / option ids `a..f`; answer key `correctOptionId` (option id, never an index — D4). Owned by exactly one Quiz.
- `QuizSettings` — authoring knobs; `timeLimitSeconds` in seconds (0 = none), `visibility`.
- `QuizStats` — engagement (plays, capacity, rating, rewardCents, badge, limitedTimeEndsAt, recentPlayers); NOT content; invariant `plays <= capacity`.
- `QuizPromotion` — engagement overlay keyed `(quizId, slot)`; engagement keys only (see Merge).
- `Category` — one table, `scope: quiz|news|tip|kb`; editorial id `scope-slug`, quiz id `=slug`; `count` derived (`deriveCategoryCounts`), never stored.
- `ContentBlock` — 6-variant union (heading/paragraph/list/note/image/markdown); bodies only; `markdown` is a legacy escape hatch, tip-only.
- `NewsArticle`/`Tip`/`KbArticle` — `zContentBase` + `body: ContentBlock[]`.
- `Contact`/`Message` (=the issue's "ChatMessage")/`Conversation`/`Notification` — social domain; `lastMessage`, `unread`, `recentMessages` are derived, never stored.
- `ImageRef`/`PersonRef` — primitives; no JSX / `StaticImageData` in data.
- `SearchIndex`/`RouteManifest` — derived / declarative; never authored.

## Invariants (`data:check`; E = hard, W = declared drift — each names its proving test)

| code        | invariant                                                                                                                                                                          | proven by                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| E0          | every record parses against its schema; every object `.strict()`                                                                                                                   | data-check.ts `validateCollection`                                               |
| E1          | ids unique across all four kinds + category table                                                                                                                                  | data-check.ts `assertUnique`; quiz-collection.test.ts                            |
| E2          | `kind/slug` unique (slug is URL identity)                                                                                                                                          | data-check.ts `assertUnique`                                                     |
| E3          | question ids unique; card outputs re-parse as their card type                                                                                                                      | data-check.ts; data-model.test.ts                                                |
| E4          | a record references only its own category scope                                                                                                                                    | data-check.ts `assertCategoryScopes`                                             |
| E5/E6       | contacts, conversations, notification links/icons resolve; message ids unique                                                                                                      | data-check.ts `checkContactRefs`/`checkConversationRefs`/`checkNotificationRefs` |
| E7          | `content/routes.ts` and the `app/` tree agree, both directions                                                                                                                     | data-check.ts `walkRoutes`                                                       |
| E8          | every search row names a real quiz/category/curated page                                                                                                                           | data-check.ts index checks                                                       |
| E9          | exactly one `Quiz` type (`types/quiz.ts` absent, no local `Quiz` declarations)                                                                                                     | data-check.ts E9 regex; data-model.test.ts                                       |
| E10         | hardcoded `href`/asset literals in `components/` + `app/` resolve; no route exports a metadata function Next never reads; every social instant sits at or before the fixture clock | data-check.ts E10 blocks; data-model.test.ts `ui-refs` + `fixture clock`         |
| E11         | every shelf id resolves against the one collection                                                                                                                                 | data-check.ts `shelves`; quiz-collection.test.ts                                 |
| E12         | one record per subject (normalised title unique), and a `catalogueAlias` is never a record of its own                                                                              | data-check.ts `subjectKey`/`assertUnique`; quiz-collection.test.ts               |
| E13         | every analytics key names a real quiz record                                                                                                                                       | data-check.ts analytics check                                                    |
| E14/E15/E16 | promotion join+identity; window and prize; one quiz advertises one set of numbers (issue #27 called these E11–E13; those codes were taken)                                         | data-check-promotions.ts; promotion.test.ts / promotion-invariants.test.ts       |
| W1          | published quiz, no questions — 24: `data/created-quizzes.ts:30` `questions: []` (+19 browse)                                                                                       | data-check.ts warn                                                               |
| W2          | published quiz, no `publishedAt` — 42: `data/created-quizzes.ts:16-49` (published, no date)                                                                                        | data-check.ts warn                                                               |
| W3          | renderable quiz category with neither `image` nor `iconKey` — 0: `content/categories.ts` (science/history/art carry `iconKey` only)                                                | data-check.ts `assertRenderableCategories`                                       |
| W4          | reward, no window — 32: `data/authored-quizzes.ts:399` `rewardCents: 750`, no `limitedTimeEndsAt`                                                                                  | data-check.ts warn                                                               |
| W5          | browse record on no shelf — 0: `data/browse-quizzes.ts` (every browse card is shelved)                                                                                             | data-check.ts warn                                                               |
| W6          | campaign staged outside the quiz's published life — warns, never fails (staging against a draft is legitimate)                                                                     | data-check-promotions.ts                                                         |

## Strictness

| object                                                                                                                                                                                    | mode                   | unknown key                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| every `z*` schema in `content/` (Quiz, Question, QuizStats, QuizPromotion, Category, ContentBlock, Article, Contact, Message, Conversation, Notification, SearchIndex rows, RoutePattern) | strict                 | reject — validation error                            |
| legacy input interfaces `content/blocks.ts` (`LegacyNewsSection`, `LegacyKbSection`)                                                                                                      | n/a (boundary adapter) | not parsed; converted losslessly to `ContentBlock[]` |

`featured` is omit-or-true: `featured: false` is unrepresentable. No object is passthrough.

## Projection vs storage

Storage = the entities above. Views are **derived, never authored**, and carry no content keys
(`title`/`slug`/`summary`/`categoryIds`/`questions`/`cover`/`author`) of their own — those come from the
record: `selectQuizCard`→`QuizCard`, `selectQuizAuthoringCard`→`QuizAuthoringCard`, `selectQuizForPlay`,
`deriveUnread`/`deriveLastMessage`/`selectRecentMessages`, `deriveCategoryCounts`, `buildSearchIndex`→
`SearchIndex`. `lib/quiz-cards.ts` is the only place a component touches a card shape.

## Overlay / merge (`QuizPromotion`)

- Key `(quizId, slot)`; id `promo-<kebab>`; `quizId` resolves to a `Quiz` (join key, not a copy).
- Field-wise merge into `QuizStats`: `undefined` **inherits** the catalog value, `null` **cancels** (`limitedTimeEndsAt` only). Content keys are unrepresentable — no `labelOverride`, no shadow identity.
- Window: applies iff `status === "published"` AND `now >= publishedAt` AND `startsAt <= now < effectiveEnd` (half-open), `effectiveEnd = min(endsAt, catalog.limitedTimeEndsAt, overlay.limitedTimeEndsAt)`; a slot may shorten an offer, never extend it.
- After merge `spotsLeft`/`almostFull`/`limitedTime` are recomputed; `plays <= capacity` re-checked, violation **throws**.
- Edge cases — expired/future-dated: outside the window the card is the catalog projection field for field (no error, no half-applied merge); duplicate: `(quizId, slot)` unique (E13), one prize per quiz via `activePromotionFor` (first in collection order).

## Migration / port order (each step independently verifiable with `pnpm data:check`)

1. `content/core.ts` + `content/category.ts` + `content/categories.ts` (primitives, taxonomy) → E0/E4.
2. `content/quiz.ts` (Quiz + projections) → data-model.test.ts.
3. `content/article.ts` + `content/blocks.ts` (editorial) → E0/E1.
4. `content/social.ts` → E5/E6.
5. `content/search.ts` + `content/route-manifest.ts` + `content/routes.ts` → E7/E8.
6. `data/*` fixtures (already ported) → E0–E11.
7. Promotion fixture `data/promotions.ts` → E14–E16/W6 in `data:check` (landed, B-01).
   Adding content: add to the right `data/` module, run `data:check`; widen a schema **before** a fixture, never silently.

## P3 variation dimensions

- **count** (N quizzes) — representable (array of any length).
- **difficulty** — representable (`zDifficulty`: easy|medium|hard).
- **vertical** — representable via `Category.scope` + `categoryIds` (4 scopes exist).
- **seed** — **not representable**: no seed/rand key; deterministic generation needs a schema change (a `seed` on `QuizSettings` or a separate generation record).
- **locale** — **not representable**: single-language plain strings; i18n needs a per-field map or a `translations` overlay.

## Out of scope

- Database / Prisma layer (a later order — do not design here).
- Tournament domain (`zTournamentRef` is a minimal ref only; `prizeCents` vs `rewardCents` unresolved).
- User / profile domain (`lib/data/users.ts` nested `CreatedQuiz` — a profile-model change).
- Quiz results / per-question `correctPercentage` tables (observed results, not content).
- Auth, accounts, route metadata (D14).
- The promotion fixture's own copy — the fixture landed in B-01 (`data/promotions.ts`); this page defines the model, not the campaign.
