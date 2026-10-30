# QA Dogfood Pass — P4 · Production build, every route

- **`main` sha tested:** `f5e1b00a2d1fe59419fcb5f2fe0d9eff6dfbf3e9` (`f5e1b00a`)
- **Build:** `pnpm build` (Next.js 16.1.6, Turbopack) — exit 0, 30 static pages + dynamic routes
- **Server:** `pnpm start` on **port 3000**, Node `v24.22.0`, pnpm `12.16.1`
- **Method:** real browser (Chromium via CDP), console/network/uncaught-error hooks on every route, screenshots at 1440 px and 390 px, automated placeholder + broken-image + horizontal-overflow scan, then manual verification of the two fixture claims (promotions, PageCopy).
- **Date:** 2026-10-30

## Executive summary

41 URLs walked (every route in the build output plus extra dynamic-route ids and a
404). **0 console errors, 0 failed network requests, 0 broken images, 0 placeholder
strings, 0 horizontal overflow** on any route at either width — the P1–P3 content/model
work holds up: no hydration-mismatch family (`#418/#425/#423`), no dead asset paths.

Five defects found (details + GitHub issues below):

| #   | Severity | Category            | Issue | One line                                                                                      |
| --- | -------- | ------------------- | ----- | --------------------------------------------------------------------------------------------- |
| 1   | High     | Visual / Functional | #109  | Mobile sidebar never hides — covers content on every page at <1280 px                         |
| 2   | High     | Content             | #110  | Campaign overlay never renders — catalog numbers everywhere (window is 21 months in the past) |
| 3   | Medium   | Functional          | #111  | `/profile/<username>` ignores the username; always renders hardcoded Alex Johnson             |
| 4   | Medium   | Functional          | #112  | `/categories/`, `/news/`, `/tournaments/` return 200 with fallback content for unknown ids    |
| 5   | Low      | Content             | #113  | Default `<title>` is the placeholder "Quiz Making Website - Play & Earn Money"                |

PR: #108 · `main` sha tested: `f5e1b00a2d1fe59419fcb5f2fe0d9eff6dfbf3e9`

## Route-by-route table

Screenshots live in `docs/qa-p4-screenshots/` (committed alongside this file). Status
is the HTTP status; "console" is the count of captured console errors/warnings; the
verdict is against the acceptance criteria (broken / blank / mismatched / 404).

| Route                                                     | Status | Console | 1440 px                        | 390 px                        | Verdict                            |
| --------------------------------------------------------- | ------ | ------- | ------------------------------ | ----------------------------- | ---------------------------------- |
| `/`                                                       | 200    | 0       | home-1440.png                  | home-390.png                  | OK (sidebar bug #1 visible at 390) |
| `/explore`                                                | 200    | 0       | explore-1440.png               | explore-390.png               | OK (campaign bug #2)               |
| `/explore/featured`                                       | 200    | 0       | explore-featured-1440.png      | explore-featured-390.png      | OK (campaign bug #2)               |
| `/quiz/quiz-science-quiz-space-exploration`               | 200    | 0       | quiz-space-1440.png            | quiz-space-390.png            | OK (campaign bug #2)               |
| `/quiz/quiz-ultimate-world-history-trivia`                | 200    | 0       | quiz-history-trivia-1440.png   | quiz-history-trivia-390.png   | OK                                 |
| `/quiz/quiz-world-geography-challenge-capitals-landmarks` | 200    | 0       | quiz-geography-1440.png        | quiz-geography-390.png        | OK                                 |
| `/quiz/quiz-brain-teasers-logic-puzzles`                  | 200    | 0       | quiz-brain-1440.png            | quiz-brain-390.png            | OK                                 |
| `/quiz/quiz-ultimate-world-history-trivia/play`           | 200    | 0       | quiz-play-1440.png             | quiz-play-390.png             | OK                                 |
| `/quiz/quiz-ultimate-world-history-trivia/discussion`     | 200    | 0       | quiz-discussion-1440.png       | quiz-discussion-390.png       | OK                                 |
| `/quiz/quiz-science-quiz-space-exploration/discussion`    | 200    | 0       | quiz-space-discussion-1440.png | quiz-space-discussion-390.png | OK                                 |
| `/leaderboard`                                            | 200    | 0       | leaderboard-1440.png           | leaderboard-390.png           | OK                                 |
| `/daily-challenge`                                        | 200    | 0       | daily-challenge-1440.png       | daily-challenge-390.png       | OK                                 |
| `/battle`                                                 | 200    | 0       | battle-1440.png                | battle-390.png                | OK                                 |
| `/tournaments`                                            | 200    | 0       | tournaments-1440.png           | tournaments-390.png           | OK (PageCopy renders)              |
| `/tournaments/science-showdown`                           | 200    | 0       | tournament-detail-1440.png     | tournament-detail-390.png     | OK                                 |
| `/search`                                                 | 200    | 0       | search-1440.png                | search-390.png                | OK                                 |
| `/profile/alexjohnson`                                    | 200    | 0       | profile-1440.png               | profile-390.png               | OK                                 |
| `/profile/sarahwilliams`                                  | 200    | 0       | profile-sarah-1440.png         | profile-sarah-390.png         | **bug #3** (shows Alex Johnson)    |
| `/my-quizzes`                                             | 200    | 0       | my-quizzes-1440.png            | my-quizzes-390.png            | OK                                 |
| `/my-quizzes/quiz-world-geography-challenge`              | 200    | 0       | my-quizzes-id-1440.png         | my-quizzes-id-390.png         | OK                                 |
| `/my-quizzes/quiz-world-geography-challenge/statistics`   | 200    | 0       | my-quizzes-stats-1440.png      | my-quizzes-stats-390.png      | OK                                 |
| `/dashboard/user`                                         | 200    | 0       | dashboard-1440.png             | dashboard-390.png             | OK                                 |
| `/login`                                                  | 200    | 0       | login-1440.png                 | login-390.png                 | OK                                 |
| `/register`                                               | 200    | 0       | register-1440.png              | register-390.png              | OK                                 |
| `/support`                                                | 200    | 0       | support-1440.png               | support-390.png               | OK                                 |
| `/support/articles/kb-getting-started`                    | 200    | 0       | support-article-1440.png       | support-article-390.png       | OK                                 |
| `/news`                                                   | 200    | 0       | news-1440.png                  | news-390.png                  | OK                                 |
| `/news/10-strategies-for-creating-engaging-quizzes`       | 200    | 0       | news-article-1440.png          | news-article-390.png          | OK                                 |
| `/categories`                                             | 200    | 0       | categories-1440.png            | categories-390.png            | OK                                 |
| `/categories/science`                                     | 200    | 0       | category-science-1440.png      | category-science-390.png      | OK                                 |
| `/categories/architecture`                                | 200    | 0       | category-architecture-1440.png | category-architecture-390.png | OK                                 |
| `/creator-tips`                                           | 200    | 0       | creator-tips-1440.png          | creator-tips-390.png          | OK                                 |
| `/creator-tips/writing-effective-quiz-questions`          | 200    | 0       | creator-tip-detail-1440.png    | creator-tip-detail-390.png    | OK                                 |
| `/chat`                                                   | 200    | 0       | chat-1440.png                  | chat-390.png                  | OK                                 |
| `/create/editor`                                          | 200    | 0       | create-editor-1440.png         | create-editor-390.png         | OK                                 |
| `/create/generator`                                       | 200    | 0       | create-generator-1440.png      | create-generator-390.png      | OK                                 |
| `/affiliate`                                              | 200    | 0       | affiliate-1440.png             | affiliate-390.png             | OK                                 |
| `/pricing`                                                | 200    | 0       | pricing-1440.png               | pricing-390.png               | OK                                 |
| `/quiz-discussions`                                       | 200    | 0       | quiz-discussions-1440.png      | quiz-discussions-390.png      | OK                                 |
| `/settings`                                               | 200    | 0       | settings-1440.png              | settings-390.png              | OK                                 |
| `/nonexistent-route-xyz` (404)                            | 404    | 0       | notfound-404-1440.png          | notfound-404-390.png          | OK (custom 404 renders)            |

## Defects

### 1. Mobile sidebar never hides — covers content on every page (High, Visual/Functional)

- **Route:** every `(mainlayout)` route (the shell `components/layout/sidebar.tsx`).
- **Repro:** open any product page at ≤390 px (any width < 1280 px). The `<aside>`
  sidebar stays `position:fixed; left:0; width:250px`, covering ~64 % of the viewport.
- **Expected:** `collapsed` (set true by `SidebarProvider` when `width < 1280`) applies
  `max-xl:-translate-x-full`, sliding the sidebar off-screen; content is full-width.
- **Actual:** the class `max-xl:-translate-x-full` **is** on the element and the custom
  property `--tw-translate-x` computes to `-100%`, but the computed `transform` resolves
  to `matrix(1, 0, 0, 1, 0, 0)` (identity). The sidebar never moves; it is permanently
  visible over the page content.
- **Evidence:** `docs/qa-p4-screenshots/home-390.png` (drawer open, obscuring hero +
  content), plus the live probe: `aside` `left:0 right:250`, `transform` identity despite
  `--tw-translate-x:-100%`.

### 2. Campaign promotion overlay never renders (High, Content)

- **Route:** `/explore` (Popular tab), `/explore/featured` (Popular tab),
  `/quiz/quiz-science-quiz-space-exploration` (detail).
- **Repro:** load any of the above. The merchandised quiz is
  `quiz-science-quiz-space-exploration`; its campaign is `promo-science-quiz-space-exploration-1/2`.
- **Expected** (fixture claim): `Popular 👑 · 2.1k players · $7.50`, plays `2105` /
  capacity `2500`, rating `4.8`, no countdown.
- **Actual:** every surface prints the **catalog** numbers — `Hot 🔥 · 2.5k players ·
  $10.00`, `2453` plays / `3000` capacity, `547 spots left`, rating `4.9`.
- **Root cause:** the campaign is bounded by `startsAt: 2025-01-01` and the catalog's
  `limitedTimeEndsAt: 2025-01-03`, while the pages evaluate the window against the
  request-time clock (`new Date()` → 2026-10-30; the fixture clock `DEMO_NOW_ISO` is
  2026-10-29). `isPromotionActive()` therefore always returns `false` and the overlay
  falls back to the catalog. The campaign numbers cannot be observed anywhere in a
  production build.

### 3. `/profile/<username>` ignores the username (Medium, Functional)

- **Route:** `/profile/<username>` (`app/(mainlayout)/profile/[username]/page.tsx`).
- **Repro:** load `/profile/sarahwilliams` (or any username).
- **Expected:** a profile for the named user, backed by `data/players.ts` (the 10-player
  fixture with handles `alexjohnson`, `sarahwilliams`, …).
- **Actual:** the page always renders a module-scope hardcoded `const user` (Alex
  Johnson) and never reads `params.username`. `/profile/sarahwilliams` returns 200 with
  `Alex Johnson`, level 42, followers 1243 — numbers that also disagree with
  `data/players.ts` (level 78, followers 1248). `/profile/nonexistent-user` also returns
  200 with the same person.

### 4. Dynamic routes return 200 with fallback content for unknown ids (Medium, Functional)

Three routes render the wrong page (no `notFound()`) instead of a 404 for an unknown id:

- `/categories/<unknown>` → 200. Metadata correctly says "Category Not Found", but the
  body renders a generic "Quizzes" grid (category name is `undefined`).
- `/news/<unknown>` → 200. Renders the **news index** page (featured articles), not an
  article or a not-found state.
- `/tournaments/<unknown>` → 200. Always renders the "Science Showdown" mock; the `id`
  is ignored.

(For contrast, `/creator-tips/<unknown>` and `/my-quizzes/<unknown>` correctly 404.)

### 5. Placeholder document `<title>` on most routes (Low, Content)

- **Route:** root layout `app/layout.tsx:13` (`metadata.title`).
- **Actual:** `Quiz Making Website - Play & Earn Money` is the browser-tab title for
  ~20 routes that don't set their own metadata (home, explore, quiz detail/play/discussion,
  dashboard, login, register, my-quizzes, chat, create/*, affiliate, pricing,
  quiz-discussions, support article, 404). The product brand is "QuizHub", and several
  other routes additionally render "QuizMaker" (`/search`, `/news`). This is placeholder
  copy that predates the brand.

## Explicit "not a defect" notes

- **`/quiz/<unknown>` → 200 template card.** Documented in
  `app/(mainlayout)/quiz/[id]/page.tsx`: "the mock survives as a visible fallback rather
  than a silent second source of truth." Not a defect.
- **`/support/articles/<unknown>` → 200 "Article Not Found".** Renders an explicit
  not-found state (soft 404). Not a defect, though it should arguably return 404.
- **`/profile/<username>` ignores `username` (the "always Alex" behaviour).** This is a
  real mismatch — reported as defect #3 — but note the repo is frontend-only (no auth
  backend), so a single hardcoded user may be intended scaffolding. Flagged for the
  `needs-validation` label to decide.
- **Warnings baseline.** `pnpm data:check` and `pnpm lint` warnings are the known
  baseline (per AGENTS.md) and were not re-derived here; this pass is about the rendered
  product, not lint counts.

## Testing notes

- **Covered:** all 41 enumerated URLs (34 build-output routes plus extra quiz ids, a
  second profile, a second category, and a 404). Each at 1440 px and 390 px, with
  console-error/uncaught/unhandled-rejection hooks, resource-timing 4xx/5xx scan, broken
  `<img>` scan, and placeholder-text scan.
- **Not covered:** interactive flows that require real auth (login submit, quiz
  completion end-to-end, creating a quiz); keyboard-only navigation; screen-reader
  pass; cross-browser. The build is served with `next start`, so no dev-only behaviour
  was exercised.
- **Blockers:** none.
