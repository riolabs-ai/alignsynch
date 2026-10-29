# P2 inventory — hardcoded strings and literal media paths

Read-only analysis for gate **P2 (media & content templatization)**. It exists to size the work
before any schema is written: every literal a page renders that the model does not supply, where it
lives, and which single PR can retire it.

Generated at `8929ec10` from `253` TS/TSX files under `components/` and `app/`
and `103` files under `public/`. `lib/quizhub/` (the untracked template
drop, issue #1) is not on disk in a clean checkout and is out of scope.

**This page is a measurement, and the tree has moved since.** WU-12 deleted 14 of the files measured
here — 3,101 lines, 0 insertions, 149 of the 2,614 nodes (184 with the 35 chrome nodes they carried)
— in `195881b4` (PR #66), and kept one on purpose. The tables below are the `8929ec10` snapshot with
that deletion taken out: rows that died with those files are gone, and each affected table states what
it lost. Every path this page still names exists on `main`; re-check any of them with
`git cat-file -e origin/main:<path>` before opening one, because the next WU card can delete it too.

- **Full hit list:** [`docs/p2-inventory/hits.csv`](p2-inventory/hits.csv) — 2,614 rows,
  `tier,unit,file,line,kind,literal,should_come_from,fixture_carries,route,island`. Every hit in this
  page cites the same `file:line` the CSV carries, and `fixture_carries` answers "does a fixture
  already own this value?" per row: **26 yes**, **45 partial** (a fixture references the same asset
  path, so the component should have read it from the fixture), **2,092 no**, **451 n/a** (chrome and
  route metadata, out of scope).
- **The CSV is frozen; this page is not.** `hits.csv` keeps all 2,614 `8929ec10` rows, including the
  149 WU-12 rows whose files were deleted, because pruning it would make the 2,614 total and every
  unit baseline on this page unreproducible — and a baseline you cannot reproduce is not a baseline.
  **"Hits remaining" for any unit = its CSV rows minus the rows whose `file` is listed by
  `git show --name-only 195881b4`** (149 rows, all WU-12). The tables here already apply that filter
  and say so where it moves a number; a raw row count of the CSV will always read 2,614 while the
  tree holds 2,430.
- **Method:** TypeScript compiler AST, not grep. A hit is a _node_: a JSX text node, a JSX attribute
  value, a string literal, or a `metadata` field. One rendered sentence split by inline markup
  (`<span>Play</span> Quiz`) is two nodes, so counts are node counts, not sentence counts (W11).

## The finding in one paragraph

This tree has **2,614** display/media nodes that no schema supplies, and only **26** of them are a
literal copy of a value the model already owns. The rest are not a naming problem — they are three
different problems wearing the same clothes: **29 mock-data islands inside components** (246 invented
records: players, scores, transactions, search results — carrying 134 of the 280 media literals),
**48 invented metrics** rendered as copy (`+4 from last month`, `+125 XP`), and **1,809 page-copy
strings** with no home at all (1,118 of them on editorial pages, the rest product microcopy). The
media surface is small and sharp: **280 literal refs, 24 distinct paths** — 96 of them are the
string `"/placeholder.svg"` used as a fallback.

Those are the `8929ec10` numbers. WU-12 has since deleted five of the 29 islands and 34 of the 280
media refs (see WU-12 under "P2 work units (ranked)" below), which is the one place this page reports
the tree rather than the measurement.

## Summary by directory

| directory                  | files | hits | MOCK | MEDIA | DUP | METRIC | COPY | META | CHROME |
| -------------------------- | ----- | ---- | ---- | ----- | --- | ------ | ---- | ---- | ------ |
| components/tournaments     | 15    | 279  | 8    | 33    | 2   | 6      | 207  | 0    | 23     |
| components/settings        | 10    | 258  | 0    | 2     | 7   | 2      | 209  | 0    | 38     |
| components/dashboard       | 10    | 218  | 4    | 2     | 0   | 15     | 166  | 0    | 31     |
| components/home            | 15    | 183  | 31   | 16    | 0   | 5      | 105  | 0    | 26     |
| components/quiz            | 10    | 171  | 29   | 13    | 0   | 1      | 101  | 0    | 27     |
| components/my-quizzes      | 4     | 182  | 6    | 8     | 0   | 0      | 122  | 0    | 46     |
| components/profile         | 10    | 138  | 0    | 8     | 0   | 0      | 111  | 0    | 19     |
| components/battle          | 5     | 139  | 0    | 9     | 8   | 2      | 96   | 0    | 24     |
| components/daily-challenge | 7     | 120  | 30   | 1     | 1   | 10     | 70   | 0    | 8      |
| components/explore         | 6     | 130  | 0    | 12    | 0   | 0      | 78   | 0    | 40     |
| components/affiliate       | 9     | 90   | 0    | 9     | 0   | 5      | 73   | 0    | 3      |
| components/layout          | 4     | 89   | 0    | 2     | 4   | 0      | 76   | 0    | 7      |
| components/leaderboard     | 5     | 77   | 15   | 2     | 4   | 0      | 44   | 0    | 12     |
| components/create          | 2     | 89   | 0    | 0     | 0   | 0      | 64   | 0    | 25     |
| components/categories      | 5     | 54   | 0    | 7     | 0   | 0      | 40   | 0    | 7      |
| app/(auth)                 | 2     | 59   | 0    | 0     | 0   | 0      | 46   | 0    | 13     |
| components/chat            | 6     | 58   | 5    | 9     | 0   | 0      | 31   | 0    | 13     |
| components/support         | 6     | 58   | 0    | 0     | 0   | 0      | 41   | 0    | 17     |
| components/search          | 1     | 50   | 0    | 0     | 0   | 0      | 37   | 0    | 13     |
| components/news            | 2     | 52   | 0    | 6     | 0   | 1      | 30   | 0    | 15     |
| components/creator-tips    | 8     | 30   | 0    | 6     | 0   | 0      | 19   | 0    | 5      |
| components/pricing         | 3     | 24   | 0    | 0     | 0   | 1      | 20   | 0    | 3      |
| app/not-found.tsx          | 1     | 10   | 0    | 0     | 0   | 0      | 10   | 0    | 0      |
| components/header          | 3     | 14   | 0    | 1     | 0   | 0      | 7    | 0    | 6      |
| app/(mainlayout)           | 14    | 31   | 6    | 0     | 0   | 0      | 1    | 24   | 0      |
| components/ui              | 5     | 8    | 0    | 0     | 0   | 0      | 4    | 0    | 4      |
| components/content         | 1     | 1    | 0    | 0     | 0   | 0      | 1    | 0    | 0      |
| app/layout.tsx             | 1     | 2    | 0    | 0     | 0   | 0      | 0    | 2    | 0      |

`MOCK` = a record lives in the component. `MEDIA` = a literal `public/` path. `DUP` = a literal the
schema already owns. `METRIC` = a rendered number the schema does not supply. `COPY` = page copy.
`META` = route metadata. `CHROME` = framework microcopy (declared out of scope, W10).

The `files` column counts the `8929ec10` tree; `hits` includes the nodes WU-12 deleted. It took 14
files out of 9 of these rows (`categories`, `chat`, `dashboard`, `explore`, `home`, `layout`,
`my-quizzes`, `quiz`, `ui`), which is 149 hits — so each of those rows is 149-in-part higher than the
tree in front of you.

## What the schema already supplies — and what no fixture carries

| tier   | hits | owned by                                               | verdict                                          |
| ------ | ---- | ------------------------------------------------------ | ------------------------------------------------ |
| MOCK   | 134  | nothing — the component is the store                   | **defect**: a fixture must own the record        |
| MEDIA  | 146  | nothing — a literal path                               | **defect**: a registry key must address the file |
| DUP    | 26   | `Quiz.title`, `Category.name`, `QuizStats.badge.label` | **defect**: replace with the selector            |
| METRIC | 48   | nothing — invented numbers                             | **defect**: fixture field, formatted in the view |
| COPY   | 1809 | nothing                                                | **gap**: needs a route-keyed copy model          |
| META   | 26   | nothing                                                | **declared out of scope** (D14, W7)              |
| CHROME | 425  | n/a — framework microcopy                              | **declared out of scope** (W10)                  |

WU-12's commit took 20 MOCK, 14 MEDIA, 8 METRIC, 107 COPY and 35 CHROME nodes out of the measured
tree, so the tree in front of you carries 114 MOCK, 132 MEDIA, 40 METRIC, 1,702 COPY and 390 CHROME —
2,430 of the 2,614 nodes. The table above stays the `8929ec10` measurement so the other units'
baselines do not move.

### MOCK — 24 islands, 216 records, 114 media literals

A module-level `const` whose initialiser is two or more object records. This is the sharpest class:
the record is _stored in the component_, so no fixture swap can ever change the page, and
`data:check` cannot see it (E0 validates `data/`, not `components/`).

At `8929ec10` this was 29 islands, 246 records and 134 media literals. WU-12 deleted five of them
with their files in `195881b4` (30 records, 20 media refs), which is why the table lists 24.

| island (file:line)                                   | const              | records | media refs | distinct paths |
| ---------------------------------------------------- | ------------------ | ------- | ---------- | -------------- |
| components/daily-challenge/daily-leaderboard.tsx:11  | leaderboardData    | 30      | 30         | 10             |
| components/search/search-results.tsx:33              | mockSearchData     | 22      | 0          | 0              |
| components/leaderboard/leaderboard-page.tsx:31       | leaderboardData    | 15      | 15         | 11             |
| app/(mainlayout)/profile/[username]/page.tsx:10      | user               | 14      | 6          | 5              |
| components/categories/categories-data.tsx:29         | categoriesData     | 14      | 0          | 0              |
| components/explore/explore-categories.tsx:25         | categories         | 13      | 0          | 0              |
| components/quiz/quiz-details.tsx:17                  | quizData           | 11      | 13         | 13             |
| components/quiz/quiz-discustion.tsx:13               | mockQuizResult     | 10      | 3          | 3              |
| components/home/live-winners.tsx:11                  | initialWinners     | 8       | 8          | 8              |
| components/home/top-players-carousel.tsx:13          | topPlayers         | 8       | 8          | 8              |
| components/my-quizzes/quiz-details.tsx:45            | quizData           | 8       | 6          | 6              |
| components/daily-challenge/daily-stats.tsx:20        | performanceData    | 7       | 0          | 0              |
| components/dashboard/earnings-chart.tsx:8            | data               | 6       | 0          | 0              |
| components/daily-challenge/daily-history.tsx:7       | pastChallenges     | 5       | 0          | 0              |
| components/daily-challenge/daily-quiz.tsx:19         | dailyQuizData      | 5       | 0          | 0              |
| components/daily-challenge/daily-stats.tsx:30        | categoryData       | 5       | 0          | 0              |
| components/dashboard/wallet-dashboard.tsx:44         | transactions       | 5       | 0          | 0              |
| components/home/player-testimonials.tsx:16           | testimonials       | 5       | 0          | 0              |
| components/quiz/quiz-discussion-page.tsx:30          | recentDiscussions  | 5       | 5          | 5              |
| components/quiz/quiz-discussion-page.tsx:119         | popularDiscussions | 5       | 5          | 5              |
| components/tournaments/tournament-discussion.tsx:40  | mockDiscussions    | 5       | 5          | 5              |
| components/dashboard/affiliate-dashboard.tsx:20      | referrals          | 4       | 4          | 4              |
| components/quiz/quiz-discussion-page.tsx:208         | yourDiscussions    | 3       | 3          | 3              |
| components/tournaments/tournament-discussion.tsx:129 | mockComments       | 3       | 3          | 3              |

Two of these are outright duplicates of a fixture the model already has:
`components/categories/categories-data.tsx` (14 rows) is the third copy of the taxonomy that
`content/categories.ts` replaced in P1, and `components/search/search-results.tsx` (22 rows) shadows
the 74 derived `SearchIndex` rows. The rest are domains the model does not have yet: players,
leaderboards, transactions, discussions, testimonials.

### MEDIA — 280 literal refs, 24 distinct paths

All 280 resolve to a real file, which is why E10 is green: E10 proves the path is not a 404,
it cannot prove the path is _addressed by the model_. 134 sit inside a mock
island (they die with it); the other 146 are literal
`src=`/`image:` values in JSX, and 96 of those are the same fallback string.

WU-12 deleted 34 of these refs with its files in `195881b4` — 14 outside an island and 20 inside the
five islands it removed — so the tree carries 246 (132 literal, 114 inside islands) and the fallback
literal drops from 96 to 83. The path table is the `8929ec10` count and does not change: the files
that died were not the only reference to any of these paths.

| literal path                      | refs | role        |
| --------------------------------- | ---- | ----------- |
| `/placeholder.svg`                | 96   | fallback    |
| `/avatars/alex.png`               | 21   | avatar set  |
| `/avatars/wizard.webp`            | 20   | avatar set  |
| `/avatars/sarah.webp`             | 19   | avatar set  |
| `/avatars/king.webp`              | 15   | avatar set  |
| `/avatars/brain.png`              | 15   | avatar set  |
| `/avatars/guru.png`               | 14   | avatar set  |
| `/avatars/master.png`             | 13   | avatar set  |
| `/avatars/genious.png`            | 13   | avatar set  |
| `/avatars/champion.png`           | 13   | avatar set  |
| `/avatars/mind.webp`              | 13   | avatar set  |
| `/abstract-geometric-shapes.png`  | 7    | content art |
| `/space-exploration-quiz.png`     | 5    | content art |
| `/world-map-quiz.png`             | 4    | content art |
| `/ancient-civilizations-quiz.png` | 2    | content art |
| `/technology-quiz.png`            | 2    | content art |
| `/about-affiliate.png`            | 1    | content art |
| `/quiz-ai-illustration.png`       | 1    | content art |
| `/quiz/q17.png`                   | 1    | content art |
| `/world-landmarks.png`            | 1    | content art |
| `/brain-teasers-puzzles.png`      | 1    | content art |
| `/history-mysteries.png`          | 1    | content art |
| `/qr-code-generic.png`            | 1    | content art |
| `/sports-trivia-quiz.png`         | 1    | content art |

Top files by literal media refs:

| file                                                 | media literals |
| ---------------------------------------------------- | -------------- |
| `components/daily-challenge/daily-leaderboard.tsx`   | 31             |
| `components/quiz/quiz-details.tsx`                   | 19             |
| `components/leaderboard/leaderboard-page.tsx`        | 15             |
| `components/quiz/quiz-discussion-page.tsx`           | 14             |
| `components/tournaments/tournament-leaderboard.tsx`  | 12             |
| `components/tournaments/tournament-discussion.tsx`   | 11             |
| `components/home/live-winners.tsx`                   | 9              |
| `components/home/top-players-carousel.tsx`           | 9              |
| `components/my-quizzes/quiz-details.tsx`             | 9              |
| `components/tournaments/tournament-list.tsx`         | 7              |
| `components/tournaments/tournament-testimonials.tsx` | 7              |
| `app/(mainlayout)/profile/[username]/page.tsx`       | 6              |

Three of the `8929ec10` top files (27 refs between them) were deleted by WU-12 and are not listed here,
which is why the section total above is 246, not 280.

The fallback is worth calling out on its own: `"/placeholder.svg"` appears 96 times as
`cover?.src ?? "/placeholder.svg"`. It is one key (`fallback.cover` / `fallback.avatar`), not 96 decisions.

### DUP — 26 literals the schema already owns

Exact matches against the 25 quiz-scope `Category.name` values, the 6 `QuizStats.badge.label` copies
and `Quiz.title` (≥ 12 chars). No substring matching: a literal that merely _contains_ a title is page
copy, and matching it would turn "All Tournaments" into a category reference.

| file:line                                                  | literal                | should come from |
| ---------------------------------------------------------- | ---------------------- | ---------------- |
| `components/battle/battle-mode-selection.tsx:131`          | `Science`              | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:132`          | `History`              | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:133`          | `Geography`            | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:135`          | `Sports`               | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:253`          | `Science`              | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:254`          | `History`              | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:255`          | `Geography`            | `Category.name`  |
| `components/battle/battle-mode-selection.tsx:257`          | `Sports`               | `Category.name`  |
| `components/daily-challenge/daily-challenge-header.tsx:69` | `Science & Technology` | `Quiz.title`     |
| `components/layout/footer.tsx:166`                         | `Science`              | `Category.name`  |
| `components/layout/footer.tsx:175`                         | `History`              | `Category.name`  |
| `components/layout/footer.tsx:193`                         | `Literature`           | `Category.name`  |
| `components/layout/footer.tsx:202`                         | `Sports`               | `Category.name`  |
| `components/leaderboard/leaderboard-filters.tsx:64`        | `Science`              | `Category.name`  |
| `components/leaderboard/leaderboard-filters.tsx:65`        | `History`              | `Category.name`  |
| `components/leaderboard/leaderboard-filters.tsx:70`        | `Literature`           | `Category.name`  |
| `components/leaderboard/leaderboard-filters.tsx:72`        | `Sports`               | `Category.name`  |
| `components/settings/quiz-preferences.tsx:242`             | `Science`              | `Category.name`  |
| `components/settings/quiz-preferences.tsx:256`             | `History`              | `Category.name`  |
| `components/settings/quiz-preferences.tsx:270`             | `Geography`            | `Category.name`  |
| `components/settings/quiz-preferences.tsx:284`             | `Literature`           | `Category.name`  |
| `components/settings/quiz-preferences.tsx:296`             | `Movies`               | `Category.name`  |
| `components/settings/quiz-preferences.tsx:308`             | `Music`                | `Category.name`  |
| `components/settings/quiz-preferences.tsx:320`             | `Sports`               | `Category.name`  |
| `components/tournaments/tournament-overview.tsx:152`       | `General Knowledge`    | `Category.name`  |
| `components/tournaments/tournament-overview.tsx:156`       | `Science & Technology` | `Quiz.title`     |

The category literals are the model's own taxonomy written out by hand in a filter list
(`battle-mode-selection`, `leaderboard-filters`, `settings/quiz-preferences`, `layout/footer`): 25 rows
in `content/categories.ts`, re-typed in six places. `deriveCategoryCounts` cannot fix that — only
rendering `quizCategories` can.

### METRIC — 48 invented numbers

A number with a unit or a delta sign, in copy, that no fixture produces. 48 nodes; the
largest cluster is the dashboard's month-over-month deltas and the daily-challenge reward table.
WU-12 deleted 8 of them in `195881b4` — four in the dashboard stats island, three in the referral CTA,
one in the create-quiz section — so the tree carries 40 and WU-4's baseline stays 48.

| file:line                                                  | literal                                                | should come from |
| ---------------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| `components/affiliate/affiliate-hero.tsx:23`               | `Join our affiliate program and earn up to 30% commi…` | `fixture field`  |
| `components/affiliate/affiliate-hero.tsx:64`               | `$1M+`                                                 | `fixture field`  |
| `components/affiliate/affiliate-hero.tsx:96`               | `75% of monthly goal`                                  | `fixture field`  |
| `components/affiliate/profit-calculator.tsx:186`           | `Based on your audience and our 30% commission rate`   | `fixture field`  |
| `components/affiliate/why-partner.tsx:184`                 | `Up to 30%`                                            | `fixture field`  |
| `components/battle/battle-mode-selection.tsx:74`           | `Group Battle (3-10 players)`                          | `fixture field`  |
| `components/battle/battle-mode-selection.tsx:206`          | `Create or join a group battle with 3-10 players com…` | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:174`   | `+125 XP`                                              | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:189`   | `, which is faster than 65% of participants.`          | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:227`   | `+50 Coins`                                            | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:247`   | `+25 Coins (4-day streak)`                             | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:257`   | `+50 XP`                                               | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:271`   | `+75 Coins`                                            | `fixture field`  |
| `components/daily-challenge/completed-challenge.tsx:277`   | `+125 XP`                                              | `fixture field`  |
| `components/daily-challenge/daily-challenge-header.tsx:81` | `500 Coins`                                            | `fixture field`  |
| `components/daily-challenge/daily-rewards.tsx:52`          | `+50 Coins`                                            | `fixture field`  |
| `components/daily-challenge/daily-rewards.tsx:59`          | `+100 Coins`                                           | `fixture field`  |
| `components/dashboard/affiliate-dashboard.tsx:240`         | `20% Commission`                                       | `fixture field`  |
| `components/dashboard/affiliate-dashboard.tsx:248`         | `25% Commission`                                       | `fixture field`  |
| `components/dashboard/affiliate-dashboard.tsx:256`         | `30% Commission`                                       | `fixture field`  |
| `components/dashboard/affiliate-dashboard.tsx:264`         | `35% Commission`                                       | `fixture field`  |
| `components/dashboard/dashboard-overview.tsx:21`           | `from last month`                                      | `fixture field`  |
| `components/dashboard/dashboard-overview.tsx:36`           | `+4 from last month`                                   | `fixture field`  |
| `components/dashboard/dashboard-overview.tsx:47`           | `+118 from last month`                                 | `fixture field`  |
| `components/dashboard/dashboard-overview.tsx:58`           | `+2.1% from last month`                                | `fixture field`  |
| `components/dashboard/dashboard-overview.tsx:170`          | `You earned $2.50 from quiz plays`                     | `fixture field`  |

### COPY — 1809 page-copy strings

The bulk, and the part that needs a decision rather than a regex. Split by surface:

- **editorial** (1118):
  home, categories, explore, affiliate, pricing, news, support, creator-tips, battle,
  daily-challenge, tournaments, the shell (header/footer), auth pages and 404. A second vertical
  changes this copy.
- **product** (691):
  settings, dashboard, profile, create, my-quizzes, chat. A second vertical reuses these screens —
  the labels are framework microcopy, not content (W8).

Top COPY files:

| file                                                 | COPY | route                       |
| ---------------------------------------------------- | ---- | --------------------------- |
| `components/profile/profile-created-quizzes.tsx`     | 60   | /profile/[username]         |
| `components/battle/battle-mode-selection.tsx`        | 50   | /battle                     |
| `components/my-quizzes/quiz-statistics.tsx`          | 50   | /my-quizzes/[id]/statistics |
| `components/create/quiz-editor.tsx`                  | 45   | /create/generator           |
| `components/tournaments/tournament-rules.tsx`        | 40   | /tournaments/[id]           |
| `components/dashboard/settings-dashboard.tsx`        | 39   | /dashboard/user             |
| `components/settings/subscription-settings.tsx`      | 39   | /settings                   |
| `components/search/search-results.tsx`               | 37   | /search                     |
| `components/tournaments/tournament-overview.tsx`     | 36   | /tournaments/[id]           |
| `app/(auth)/register/page.tsx`                       | 35   | /register                   |
| `components/settings/security-settings.tsx`          | 35   | /settings                   |
| `components/dashboard/dashboard-overview.tsx`        | 34   | /dashboard/user             |
| `components/dashboard/wallet-dashboard.tsx`          | 33   | /dashboard/user             |
| `components/settings/notification-settings.tsx`      | 33   | /settings                   |
| `components/my-quizzes/quiz-details.tsx`             | 32   | /my-quizzes/[id]            |
| `components/dashboard/affiliate-dashboard.tsx`       | 31   | /dashboard/user             |
| `components/daily-challenge/completed-challenge.tsx` | 29   | /daily-challenge            |
| `components/my-quizzes/my-quizzes.tsx`               | 29   | /my-quizzes                 |
| `components/layout/header.tsx`                       | 26   | /                           |

WU-12 deleted 107 of these 1,809 strings with its files (`195881b4`), 29 of them in a single unrouted
explore component, so the tree carries 1,702 and every other unit's baseline is unchanged.

### META — 26 route metadata strings

`export const metadata = { title, description }` is page copy in a module the content model does not
reach. `docs/DATA-MODEL.md` already declares route metadata out of scope (D14); it is inventoried
here so the decision is recorded rather than forgotten (W7).

| file:line                                      | field    | literal                                                            |
| ---------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `app/(mainlayout)/battle/page.tsx:5`           | metadata | `Quiz Battle \| QuizHub`                                           |
| `app/(mainlayout)/battle/page.tsx:6`           | metadata | `Challenge friends or random players to real-time quiz battles`    |
| `app/(mainlayout)/categories/page.tsx:4`       | metadata | `Quiz Categories \| QuizHub`                                       |
| `app/(mainlayout)/categories/page.tsx:5`       | metadata | `Browse all quiz categories and find quizzes that match your int…` |
| `app/(mainlayout)/creator-tips/page.tsx:6`     | metadata | `Quiz Creator Tips - Learn How to Create Better Quizzes`           |
| `app/(mainlayout)/creator-tips/page.tsx:7`     | metadata | `Discover tips, strategies, and best practices for creating enga…` |
| `app/(mainlayout)/daily-challenge/page.tsx:4`  | metadata | `Daily Challenge \| Quizhub`                                       |
| `app/(mainlayout)/daily-challenge/page.tsx:5`  | metadata | `Take on today's quiz challenge and compete with others for the …` |
| `app/(mainlayout)/leaderboard/page.tsx:5`      | metadata | `Leaderboard \| QuizHub`                                           |
| `app/(mainlayout)/leaderboard/page.tsx:6`      | metadata | `See who's leading the pack in our global quiz rankings.`          |
| `app/(mainlayout)/news/[slug]/page.tsx:5`      | metadata | `Article \| QuizMaker News`                                        |
| `app/(mainlayout)/news/[slug]/page.tsx:6`      | metadata | `Read the latest quiz news and updates.`                           |
| `app/(mainlayout)/news/page.tsx:4`             | metadata | `Quiz News & Updates \| QuizMaker`                                 |
| `app/(mainlayout)/news/page.tsx:5`             | metadata | `Stay updated with the latest quiz trends, updates, and communit…` |
| `app/(mainlayout)/search/page.tsx:4`           | metadata | `Search Results \| QuizMaker`                                      |
| `app/(mainlayout)/search/page.tsx:5`           | metadata | `Search for quizzes, categories, creators, and more on QuizMaker.` |
| `app/(mainlayout)/settings/page.tsx:4`         | metadata | `Account Settings \| QuizHub`                                      |
| `app/(mainlayout)/settings/page.tsx:5`         | metadata | `Manage your account settings and preferences`                     |
| `app/(mainlayout)/support/page.tsx:5`          | metadata | `Support - QuizHub`                                                |
| `app/(mainlayout)/support/page.tsx:6`          | metadata | `Get help and support for your QuizHub account`                    |
| `app/(mainlayout)/tournaments/[id]/page.tsx:6` | metadata | `Tournament Details \| QuizHub`                                    |
| `app/(mainlayout)/tournaments/[id]/page.tsx:7` | metadata | `View details, rules, and standings for this quiz tournament.`     |
| `app/(mainlayout)/tournaments/page.tsx:5`      | metadata | `Quiz Tournaments \| QuizHub`                                      |
| `app/(mainlayout)/tournaments/page.tsx:6`      | metadata | `Participate in exciting quiz tournaments and win amazing prizes.` |
| `app/layout.tsx:13`                            | metadata | `Quiz Making Website - Play & Earn Money`                          |
| `app/layout.tsx:14`                            | metadata | `Create quizzes, play games, and earn money with our multi-vendo…` |

### CHROME — 425 framework microcopy (out of scope, W10)

Nav labels, form labels, table headers, sort options, a11y strings, toast verbs, unit suffixes,
single-word button verbs. The rule, stated so the split is reproducible: a string is **chrome** when
it would be identical in a different vertical (`Search`, `Email`, `Save`, `Grid view`,
`Today`), and **content** when a vertical would change it. 12 of them, for calibration:

| file:line                          | literal                    |
| ---------------------------------- | -------------------------- |
| `app/(auth)/login/page.tsx:61`     | `Email`                    |
| `app/(auth)/login/page.tsx:66`     | `Enter your email`         |
| `app/(auth)/login/page.tsx:72`     | `Password`                 |
| `app/(auth)/login/page.tsx:77`     | `Enter your password`      |
| `app/(auth)/register/page.tsx:210` | `Select your skill level`  |
| `app/(auth)/register/page.tsx:237` | `John`                     |
| `app/(auth)/register/page.tsx:249` | `Smith`                    |
| `app/(auth)/register/page.tsx:264` | `john@example.com`         |
| `app/(auth)/register/page.tsx:278` | `+1 (555) 123-4567`        |
| `app/(auth)/register/page.tsx:305` | `Select country`           |
| `app/(auth)/register/page.tsx:335` | `Create a strong password` |
| `app/(auth)/register/page.tsx:365` | `Confirm your password`    |

## Entities the inventory implies

The noun a hit needs before it can move. Nothing here is designed in this card — this is the list the
work units assert, and the schema that must exist first.

| noun                                         | identity                             | owner                             | currently               | hits          |
| -------------------------------------------- | ------------------------------------ | --------------------------------- | ----------------------- | ------------- |
| `MediaEntry`                                 | path-derived key (`category/animal`) | `data/media.ts` typed map         | 280 literals, 24 paths  | 280           |
| `Player` / `LeaderboardRow`                  | username + avatar + score + window   | new `Player` fixture (WU-1)       | 76 records in 6 islands | 107           |
| `DiscussionComment`, `Review`, `Testimonial` | id + author ref + body + instant     | new social rows                   | 8 islands               | see WU-2/WU-9 |
| `PageCopy`                                   | route pattern                        | `content/pages.ts`                | `/` migrated (WU-6)     | 1118          |
| `MetricSnapshot`                             | (owner, period)                      | `data/quiz-analytics.ts` widening | invented in JSX         | 48            |

`PageCopy`'s path is no longer a guess — WU-6 wrote it, and the section below documents it. The
`Player` fixture is still unwritten (WU-1 creates it), so this card names no path for it on purpose:
the names it used to print were guesses, and a doc that cites a file nobody has written is the failed
lookup WU-12 was about.

### `PageCopy` — the shape WU-7…WU-11 reuse

WU-6 built the object and the ratchet; the rest of the copy units only add rows to two tables. Read
this before starting one.

**Where it lives**

| file                    | what it is                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/pages.ts`      | the shape: `zPageCopy`, `zPageCopySection`, `zPageCopyItem`, `zPageCopyLink`, and the `budget`/`table` records. Zod, no React — `data:check` compiles it for plain node |
| `lib/page-copy.ts`      | the readers: `sectionOf`, `itemOf`, `itemLabel`, `itemValue`, `fillLabel`, `headingLines`. No zod, because client components import them                                |
| `data/pages/<route>.ts` | one route's copy, parsed at import (`zPageCopy.parse`) — `data/pages/home.ts` is the worked example                                                                     |
| `data/pages/index.ts`   | the table: route pattern → parsed `PageCopy`                                                                                                                            |
| `data/pages/budget.ts`  | the ratchet: route pattern → `{ page, dirs, fixture, budget }`                                                                                                          |

**The shape**

```
PageCopy        { eyebrow?, heading, subtitle?, cta?, secondaryCta?, sections? }
PageCopySection { id, heading, body?, cta?, secondaryCta?, items? }
PageCopyItem    { id, label, value? }          // ordered; `value` for a value-over-caption stat
PageCopyLink    { label, href }                // href must be root-relative
```

Four conventions carry the whole thing, and a later unit that breaks one makes the gate weaker:

- **`heading` spells a hard break as `\n`** and the view turns it into `<br />` (`headingLines`).
  The break is copy, so it may not be markup in a fixture.
- **`items` is the escape hatch that is not a junk drawer.** Tab labels, stat captions, inline
  microcopy (`"N players joined"`), empty states (`"Uncategorised"`) are `{ id, label }` pairs. The
  fixture owns the words, the view owns which ids it renders and in what order (`TABS` in
  `featured-quizzes.tsx`, `LADDERS`, `PERKS`, `STATS` are module-level consts in their component), and
  E23 fails when a view asks for an id the fixture does not carry — so a renamed id is a red build,
  not a blank band.
- **a number is never spelled into the copy.** `"Only {count} spots left"` + `fillLabel(label, {
  count })`; an unfilled placeholder renders visibly rather than collapsing to `""`.
- **`cta` is a link.** A button with no destination is not copy — it is a control, and its label is
  an `item`. E23 resolves every `href` in a fixture against `content/routes.ts`, because moving a
  link out of JSX otherwise hides it from E10.

**The ratchet (E23), in two halves**

`scripts/copy-refs.ts` holds the arithmetic and `scripts/data-check.ts` reports it; the negative cases
are `scripts/__tests__/page-copy.test.ts` (22 cases).

1. **leaf rule** — a JSX text node or string attribute value longer than 24 chars in an attributed
   file is an error on its own, and the message names `file:line` and the fixture to move it to.
   Technical attributes are not copy (`className`, `href`, `alt`, `variant`, `aria-*`; `alt` belongs
   to `MediaEntry.alt`), and a glyph-only segment (`$`, `"`, an emoji) is not a string. A copy unit
   does **not** change `alt` text on the way through: `/`'s cards keep the literal `alt="cover img"`
   because migrating copy must leave the rendered page identical — adopting a registry alt is
   E17–E19's decision, not a side effect of moving a heading.
2. **budget** — the _count_ of leaf literals in the route's surface may not exceed the recorded
   number, short labels included. `/` is recorded at **0**; a unit lowers a budget and raising one is
   a reviewable diff, never a re-baseline.

**Attribution is by reachability, not by directory.** The surface is the route's page module plus the
import closure inside the directories the route declares (`dirs`). That is what keeps two cards from
fighting: WU-12 deleted the fourteen components no page imported, and a budget that counted a
directory instead of a graph would have made every deletion a budget regression. The same pass proves
the fixture is reachable from the page module — copy written and not wired changes nothing.

**Migrating a route (the five steps a later unit repeats)**

1. Add `data/pages/<route>.ts` with `zPageCopy.parse({...})`, and the row in `data/pages/index.ts`.
2. Add the `data/pages/budget.ts` row: `page` (the route module), `dirs` (its component directories),
   `fixture`, and `budget: 0`.
3. Run `pnpm data:check`. It now lists every literal still in the surface, with `file:line`, and fails
   on the sentences first (24-char rule) and then on the count.
4. Move each string into the fixture, pass the section down from the page, and replace the literal
   with `copy.heading` / `itemLabel(copy, "id")` / `fillLabel(...)`.
5. Repeat until the route measures 0. If two routes render one band, the _page_ decides which
   fixture's section that component receives — never the component itself, or the copy inverts the
   dependency.

## Invariants (proposed for P2; E = hard, W = declared deviation)

Each names the check that proves it, per the P1 convention in `docs/DATA-MODEL.md`.

| code | invariant                                                                                                                    | proof                                                                                                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E17  | no `components/**` or `app/**` file contains a literal `public/` asset path                                                  | `data:check` E17 returns 0 asset refs (246 today, 280 measured)                                                                                                                                                                       |
| E18  | registry ⇄ disk is a bijection — every `MediaEntry.src` is a file, every file under `public/images`+avatars has an entry     | `data:check` E18: two-way walk, both directions 0 orphans (P2b item 3)                                                                                                                                                                |
| E19  | every `ImageRef.src` in `data/` equals a `MediaEntry.src`                                                                    | `data:check` E19 over `data/*` (today 73 fixture paths, all literal)                                                                                                                                                                  |
| E20  | no display literal equals a `Category.name`, `Quiz.title` or `badge.label`                                                   | `data:check` E20: DUP tier = 0 (today: 26)                                                                                                                                                                                            |
| E21  | no module-level record array in `components/**` (≥ 2 object elements)                                                        | `data:check` E21: island scan = 0 (24 after WU-12; 29 measured)                                                                                                                                                                       |
| E22  | no metric literal (digit + unit/delta) in a component                                                                        | `data:check` E22 (40 after WU-12; 48 measured)                                                                                                                                                                                        |
| E23  | every route in `content/routes.ts` has a `PageCopy` key; an editorial component renders no leaf literal longer than 24 chars | `data:check` E23: surface = page module + import closure inside the route's `dirs`; a literal > 24 chars is an error naming `file:line`, and the count may not exceed `data/pages/budget.ts`. `/` measures **0**. Established by WU-6 |
| W7   | route metadata `title`/`description` stays hardcoded (26 strings, 13 routes)                                                 | declared: D14, `docs/DATA-MODEL.md` out-of-scope                                                                                                                                                                                      |
| W8   | product-surface microcopy stays hardcoded (691 strings)                                                                      | declared: chrome, not content — a vertical reuses the screens                                                                                                                                                                         |
| W9   | the tournament domain ships static in P2 (`zTournamentRef` is a ref only)                                                    | declared: DATA-MODEL out-of-scope; WU-11 is a decision, not a build                                                                                                                                                                   |
| W10  | chrome stays hardcoded (425 strings)                                                                                         | declared: identical across verticals                                                                                                                                                                                                  |
| W11  | a rendered sentence split by inline markup is counted as N nodes                                                             | declared: extraction is AST-node based, so counts are upper bounds on sentences                                                                                                                                                       |

## Strictness (for the two objects P2 introduces)

| object                          | mode   | unknown key | note                                                                                                                                                                                                                                      |
| ------------------------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MediaEntry` (`data/media.ts`)  | strict | reject      | `{ src, alt, width, height, kind }`; key is path-derived, so the map is exhaustive by construction                                                                                                                                        |
| `PageCopy` (`content/pages.ts`) | strict | reject      | keyed by route pattern; `eyebrow?/heading/subtitle?/cta?/secondaryCta?/sections?`, a section is `id/heading/body?/cta?/secondaryCta?/items?`, an item is `id/label/value?` — never `labelOverride` on a record, and no copy key on `Quiz` |

`ImageRef` does **not** change in P2 (decision D-P2-1): `src` stays a path and E19 pins it to the
registry, so no fixture is rewritten. Switching `ImageRef` to `{ key, alt }` is a P3 change (the JSON
manifest in ENV-SPEC §277), and doing it now would rewrite 73 fixture refs for no exit-criterion gain.

## Projection vs storage

Copy is storage, not a projection: `PageCopy` is authored per route and carries no record data. The
media registry is storage keyed by file, and a component reads a key. Cards keep deriving everything
else: `selectQuizCard` stays the only place a component touches a quiz shape, and no copy field is
added to `Quiz` — the moment a `copy` key reaches a record, P2 has forked the base record.

## P2 work units (ranked)

Each unit is one vertical slice: one schema change, one fixture (or one deletion), one mechanical swap,
one PR. Sizes come from the CSV, not from estimates. Order is chosen so the cheap structural work lands
first and every later unit shrinks rather than grows the surface.

| unit  | hits | files | MOCK | MEDIA | DUP | METRIC | COPY | scope                                                          |
| ----- | ---- | ----- | ---- | ----- | --- | ------ | ---- | -------------------------------------------------------------- |
| WU-12 | 8    | 1     | 0    | 2     | 0   | 0      | 6    | Dead components: 14 deleted in 195881b4, 1 kept for #41        |
| WU-1  | 107  | 8     | 61   | 2     | 0   | 0      | 44   | People and leaderboard fixture (Player, LeaderboardRow)        |
| WU-4  | 40   | 19    | 0    | 0     | 0   | 40     | 0    | Invented metrics and deltas → analytics fixture                |
| WU-5  | 26   | 6     | 0    | 0     | 26  | 0      | 0    | Category, badge and difficulty literals → schema selectors     |
| WU-2  | 117  | 7     | 35   | 12    | 0   | 0      | 70   | Quiz detail, playback and discussion mocks → the Quiz fixture  |
| WU-3  | 68   | 7     | 0    | 7     | 0   | 0      | 61   | Search results and chat mocks → derived index / chat fixture   |
| WU-6  | 78   | 10    | 0    | 11    | 0   | 0      | 67   | Home page copy → route copy fixture                            |
| WU-7  | 126  | 8     | 0    | 2     | 0   | 0      | 124  | Shell, auth and 404 copy                                       |
| WU-8  | 95   | 8     | 0    | 13    | 0   | 0      | 82   | Categories and explore page copy                               |
| WU-9  | 205  | 29    | 0    | 21    | 0   | 0      | 184  | Marketing page copy (affiliate, pricing, news, support, creat… |
| WU-10 | 176  | 12    | 0    | 10    | 0   | 0      | 166  | Battle and daily-challenge copy + mode data                    |
| WU-11 | 248  | 15    | 8    | 33    | 0   | 0      | 207  | Tournament copy and mode data (needs the domain decision)      |
| OUT   | 720  | 41    | 10   | 19    | 0   | 0      | 691  | Product-surface microcopy (settings, dashboard, profile, crea… |

Every row is the `8929ec10` measurement except **WU-12**, which shows what is left after `195881b4`:
149 of its 157 hits and 13 of its 14 hit-carrying files are gone, and the survivor is 8 hits on one
file. The other rows are untouched on purpose — a card that wants "hits remaining" subtracts
`git show --name-only 195881b4` from the CSV, not from this table.

**One issue per unit** (all labelled `tech-debt` + `needs-validation`): #47 WU-12 (closed by #66) · #48 WU-1 · #49 WU-4 · #50 WU-5 · #51 WU-2 · #52 WU-3 · #53 WU-6 · #54 WU-7 · #55 WU-8 · #56 WU-9 · #57 WU-10 · #58 WU-11. Tracking issue: #46.

### Ranked list

1. **WU-12 — dead components (landed: 14 deleted, 8 hits left).** The cheapest unit in the gate, and it
   is done: PR #66 deleted 14 of the 15 files at `195881b4` — 3,101 lines, 0 insertions, 149 of these
   157 hits — and #47 is closed. `git show --stat 195881b4` is the file list; it is not repeated here,
   because a page that prints deleted paths is the page that sends the next worker to a 404.

   One file survived on purpose: `components/explore/explore-featured.tsx` (8 hits — 6 COPY, 2 MEDIA).
   It has no importer on `main`, but `components/explore/explore-quizzes-page.tsx` imports
   `ExploreFeatured` on #41's branch, so deleting it would delete-conflict with a mergeable PR. That is
   not dead work: it is 8 hits that belong to whichever explore card runs next — WU-8 is the closest.

   The card's original caveat was wrong in a harmless direction: it claimed the shadcn `sidebar`
   primitive was imported only by the tooltip-fix file, so the pair had to go together. The tooltip-fix
   file imports `./sidebar-context`, not `./sidebar`, so both were independently dead and both went.

2. **WU-1 — `Player` / `LeaderboardRow` fixture** (107 hits): the six
   leaderboard islands. Unblocks /leaderboard, /daily-challenge and the two home widgets.
3. **WU-4 — metrics** (40): widen `QuizAnalytics` (or add a
   `MetricSnapshot`) so `+4 from last month` is computed, not typed.
4. **WU-5 — taxonomy literals** (26): render `quizCategories` and
   `badge.label` instead of re-typing them; six files, mechanical.
5. **WU-2 — quiz surface mocks** (117): `quiz-details`, `my-quizzes/quiz-details`,
   `quiz-discustion`, results and discussion pages read the existing fixture.
6. **WU-3 — search and chat mocks** (68): delete `mockSearchData`, render
   `buildSearchIndex`; chat reads `data/chat-data.ts`.
7. **WU-6 — home copy** (78): **done.** Established `PageCopy` (`content/pages.ts`), the readers,
   `data/pages/home.ts` and the E23 ratchet; `/` measures 0 leaf literals of a recorded budget of 0,
   and renders identically to the pre-migration page (DOM-equal, hero screenshot pixel-identical).
8. **WU-7 — shell/auth/404** (126): the second `PageCopy` consumer; also renders the footer
   category column from `quizCategories`.
9. **WU-8 — categories + explore** (95).
10. **WU-9 — marketing pages** (205): affiliate, pricing, news, support, creator-tips.
11. **WU-10 — battle + daily-challenge** (176).
12. **WU-11 — tournaments** (248): blocked on a decision, not on effort —
    the domain is declared out of scope in `docs/DATA-MODEL.md`, so either the domain comes in first or
    tournament copy is a static `PageCopy` fixture with no tournament records.

Representative hits per unit (full list in the CSV):

**WU-12** · Dead components: landed, 8 hits remain on 1 file

- `components/explore/explore-featured.tsx:102` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/explore/explore-featured.tsx:135` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/explore/explore-featured.tsx:72` — `Featured Quizzes` → `route-keyed page copy`
- `components/explore/explore-featured.tsx:185` — `Play Now` → `route-keyed page copy`
- The other 149 (`COPY` 107, `MOCK` 20, `MEDIA` 14, `METRIC` 8) went with their files in `195881b4`.
  Their rows are still in the CSV — that is the frozen baseline — but no path on this page points at
  a file the commit deleted.

**Why "157 hits / 14 files" and not 15 files.** The unit was scoped as 15 files; `hits.csv` shows 157
WU-12 rows over 14 distinct files because the fifteenth, the `components/ui` `breadcrumb` primitive,
carries 0 hits — an unimported shadcn primitive with no literal in it, invisible to a hit count and
deleted in the same commit. So "14" never meant "14 files to delete": it meant "14 files with at least
one hit", and the delete list was always 15. After `195881b4` the same arithmetic reads 8 hits over 1
file, with 149 hits and all 14 files gone.

**WU-1** · People and leaderboard fixture (Player, LeaderboardRow) (107 hits, 8 files)

- `components/daily-challenge/daily-leaderboard.tsx:13` — `/avatars/wizard.webp` → `fixture in components (leaderboardData)`
- `components/home/live-winners.tsx:15` — `/avatars/alex.png` → `fixture in components (initialWinners)`
- `components/home/top-players-carousel.tsx:18` — `/avatars/alex.png` → `fixture in components (topPlayers)`
- `components/leaderboard/leaderboard-page.tsx:35` — `/avatars/alex.png` → `fixture in components (leaderboardData)`
- `components/leaderboard/leaderboard-podium.tsx:42` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/leaderboard/leaderboard-table.tsx:108` — `/placeholder.svg` → `media key (public/placeholder.svg)`

**WU-4** · Invented metrics and deltas → analytics fixture (40 hits, 19 files)

- `components/affiliate/affiliate-hero.tsx:23` — `Join our affiliate program and earn up to 30% commissio…` → `fixture field (number/delta), formatted in the view`
- `components/affiliate/profit-calculator.tsx:186` — `Based on your audience and our 30% commission rate` → `fixture field (number/delta), formatted in the view`
- `components/affiliate/why-partner.tsx:184` — `Up to 30%` → `fixture field (number/delta), formatted in the view`
- `components/battle/battle-mode-selection.tsx:74` — `Group Battle (3-10 players)` → `fixture field (number/delta), formatted in the view`
- `components/daily-challenge/completed-challenge.tsx:174` — `+125 XP` → `fixture field (number/delta), formatted in the view`
- `components/daily-challenge/daily-challenge-header.tsx:81` — `500 Coins` → `fixture field (number/delta), formatted in the view`

**WU-5** · Category, badge and difficulty literals → schema selectors (26 hits, 6 files)

- `components/battle/battle-mode-selection.tsx:131` — `Science` → `Category.name`
- `components/daily-challenge/daily-challenge-header.tsx:69` — `Science & Technology` → `Quiz.title`
- `components/layout/footer.tsx:166` — `Science` → `Category.name`
- `components/leaderboard/leaderboard-filters.tsx:64` — `Science` → `Category.name`
- `components/settings/quiz-preferences.tsx:242` — `Science` → `Category.name`
- `components/tournaments/tournament-overview.tsx:152` — `General Knowledge` → `Category.name`

**WU-2** · Quiz detail, playback and discussion mocks → the Quiz fixture (117 hits, 7 files)

- `app/(mainlayout)/profile/[username]/page.tsx:14` — `/avatars/alex.png` → `fixture in components (user)`
- `components/quiz/quiz-details.tsx:20` — `/quiz/q17.png` → `fixture in components (quizData)`
- `components/quiz/quiz-discussion-page.tsx:45` — `/avatars/alex.png` → `fixture in components (recentDiscussions)`
- `components/quiz/quiz-discustion.tsx:41` — `/avatars/genious.png` → `fixture in components (mockQuizResult)`
- `components/quiz/comment.tsx:60` — `/avatars/master.png` → `media key (public/avatars/master.png)`
- `components/quiz/question-discussion.tsx:92` — `/avatars/master.png` → `media key (public/avatars/master.png)`

**WU-3** · Search results and chat mocks → derived index / chat fixture (68 hits, 7 files)

- `components/chat/chat-conversation.tsx:98` — `/placeholder.svg?height=40&width=40` → `media key (public/placeholder.svg)`
- `components/chat/chat-input.tsx:55` — `/placeholder.svg?height=300&width=400` → `media key (public/placeholder.svg)`
- `components/chat/chat-message.tsx:49` — `/placeholder.svg?height=28&width=28` → `media key (public/placeholder.svg)`
- `components/chat/chat-sidebar.tsx:164` — `/placeholder.svg?height=48&width=48` → `media key (public/placeholder.svg)`
- `components/header/ChatDrawer.tsx:52` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/chat/chat-page.tsx:220` — `Chat Settings` → `route-keyed page copy`

**WU-6** · Home page copy → route copy fixture (78 hits, 10 files)

- `components/home/categories-slider.tsx:41` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/home/featured-quizzes.tsx:98` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/home/latest-quizzes.tsx:44` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/home/live-winners.tsx:132` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/home/quizzes-by-difficulty.tsx:116` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/home/top-players-carousel.tsx:199` — `/placeholder.svg` → `media key (public/placeholder.svg)`

**WU-7** · Shell, auth and 404 copy (126 hits, 8 files)

- `components/layout/header.tsx:394` — `/avatars/brain.png` → `media key (public/avatars/brain.png)`
- `app/(auth)/login/page.tsx:25` — `Welcome to QuizHub` → `route-keyed page copy`
- `app/(auth)/register/page.tsx:118` — `Join the Quiz Revolution` → `route-keyed page copy`
- `app/not-found.tsx:66` — `Oops! Quiz Not Found` → `route-keyed page copy`
- `components/header/NotificationDrawer.tsx:35` — `Mark all read` → `route-keyed page copy`
- `components/header/ThemeToggle.tsx:21` — `Toggle theme` → `route-keyed page copy`

**WU-8** · Categories and explore page copy (95 hits, 8 files)

- `components/categories/categories-how-it-works.tsx:14` — `/placeholder.svg?height=200&width=300` → `media key (public/placeholder.svg)`
- `components/categories/categories-page.tsx:51` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/categories/category-detail-page.tsx:232` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/explore/explore-quiz-list.tsx:171` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/explore/featured-quizzes-page.tsx:177` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/categories/categories-cta.tsx:27` — `Discover Your Next Challenge` → `route-keyed page copy`

**WU-9** · Marketing page copy (affiliate, pricing, news, support, creator-tips) (205 hits, 29 files)

- `components/affiliate/about-quizhub.tsx:61` — `/about-affiliate.png` → `media key (public/about-affiliate.png)`
- `components/affiliate/success-stories.tsx:14` — `/avatars/wizard.webp` → `media key (public/avatars/wizard.webp)`
- `components/affiliate/why-partner.tsx:53` — `/avatars/sarah.webp` → `media key (public/avatars/sarah.webp)`
- `components/creator-tips/featured-tips.tsx:26` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/creator-tips/tip-card.tsx:20` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/creator-tips/tip-detail.tsx:63` — `/placeholder.svg` → `media key (public/placeholder.svg)`

**WU-10** · Battle and daily-challenge copy + mode data (176 hits, 12 files)

- `components/battle/active-battle.tsx:315` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/battle/battle-lobby.tsx:88` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/battle/battle-page.tsx:54` — `/avatars/wizard.webp` → `media key (public/avatars/wizard.webp)`
- `components/battle/battle-results.tsx:90` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/daily-challenge/daily-leaderboard.tsx:112` — `/placeholder.svg` → `media key (public/placeholder.svg)`
- `components/battle/battle-mode-selection.tsx:58` — `Challenge friends or random players to real-time quiz b…` → `route-keyed page copy`

**WU-11** · Tournament copy and mode data (needs the domain decision) (248 hits, 15 files)

- `components/tournaments/tournament-discussion.tsx:47` — `/avatars/alex.png` → `fixture in components (mockDiscussions)`
- `components/tournaments/featured-tournament.tsx:19` — `/abstract-geometric-shapes.png` → `media key (public/abstract-geometric-shapes.png)`
- `components/tournaments/tournament-detail.tsx:45` — `/placeholder.svg?key=85jbh` → `media key (public/placeholder.svg)`
- `components/tournaments/tournament-header.tsx:34` — `/abstract-geometric-shapes.png` → `media key (public/abstract-geometric-shapes.png)`
- `components/tournaments/tournament-leaderboard.tsx:42` — `/avatars/wizard.webp` → `media key (public/avatars/wizard.webp)`
- `components/tournaments/tournament-list.tsx:27` — `/space-exploration-quiz.png` → `media key (public/space-exploration-quiz.png)`

## Out of scope

- **Product-surface microcopy** — 691 strings across
  settings, dashboard, profile, create, my-quizzes and chat (W8). Not content: a second vertical reuses
  these screens. If it ever needs templating, that is an i18n pass, not P2.
- **Route metadata** — 26 strings on 13 routes (W7, D14).
- **Chrome** — 425 strings: nav, forms, a11y, sort/filter options, unit suffixes, toast verbs (W10).
- **The tournament domain** — WU-11 stays open until `zTournamentRef` grows into an entity.
- **`lib/quizhub/`** — untracked template drop (issue #1), not part of the tree, not scanned.
- **Non-React sources** — `content/` and `data/` are the model, not the UI; their strings are _supposed_
  to be literals.
- **No schema, fixture or component change is made in this card.** P2b owns the registry
  (media), WU-1…WU-11 own the rest.

## Reproducing the numbers

The extractor walks `components/` and `app/` with the TypeScript compiler API (`ts.createSourceFile`),
classifies each node by the rules above, and writes `hits.csv`. It is attached to the card that
produced this page; the rules are stated in "Summary by directory" and the W-items so a reviewer can
re-derive any tier by hand from the CSV.

That extractor is not in this repo, so **nobody can re-run it against the current tree from here** —
which is why this page keeps the `8929ec10` measurement and states WU-12's deletion as an explicit
delta instead of quietly rewriting totals it cannot recompute. To get a live "hits remaining" figure,
filter the CSV: `grep -v` the paths from `git show --name-only 195881b4`, or read the same filter from
the header note. When the extractor is finally checked in, regenerate the page rather than editing
these numbers by hand.
