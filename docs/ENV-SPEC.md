# Environment, tooling, team & ops spec — Quizhub prototype phase

Scope: how we _work_, not what we build. Product scope is frozen to Quizhub's existing
features and data until the three prototype gates below pass. One machine, one operator,
one profile.

## 0. Scope gate

| Phase                                 | Allowed                                                  | Blocked                     |
| ------------------------------------- | -------------------------------------------------------- | --------------------------- |
| **P1 Data abstraction**               | Quizhub screens, existing `data/*`, schema + validators  | new features, new verticals |
| **P2 Media & content templatization** | components reading from schema, `public/` media registry | page-specific one-offs      |
| **P3 Bulk generation / variation**    | generator scripts emitting validated fixtures            | persisted DB, auth          |
| **P4 Multi-usecase wiring**           | a second vertical config (eLearning or other)            | — (opens only after P1–P3)  |

Hard non-goals until P3 passes: auth, multi-tenancy, payments, a live database, deployment,
i18n, and any eLearning/course schema.

## 1. Runtime and profiles

- **One profile: `default`.** Profiles (`blueberry`, `rio`, `rory`) each carry their own
  skills, memory, cron and `state.db`; splitting this work across them buys nothing and
  doubles every config change. Isolation here comes from the repo's `AGENTS.md`, not a profile.
- Model: `deepseek-flash` (1M ctx, vision) with `deepseek-v4-pro` behind `/model pro` for
  escalations; fallback chain is same-key first, then nous → openrouter → xiaomi.
- Node `v24.22.0` (nvm, what `.nvmrc` pins) or `v26.12.1` (Hermes-managed binary), **pnpm `12.16.1`**
  (the only package manager here; lockfile v9), Python `3.14.9`. **No Docker, no `psql`, no
  `neonctl`** — any proposal needing a daemon or container is out.
- **Node resolution is fragile:** `/usr/bin/node` is `v18.19.1` and shadows both runtimes, which
  fails Next 16's `>=20.9.0` engine check. Put a node-24 bin dir first on `PATH`
  (`$HOME/.nvm/versions/node/v24.22.0/bin` or `~/.hermes/tools/node-*/bin`); `nvm use` works only
  in an interactive shell. Verified live: v18 → every Next command fails, v24.22.0 → all gates pass.
  CI pins `node-version-file: .nvmrc` and `pnpm/action-setup@v6` at `12.16.1`.
- Config is written only via `hermes config set`; secrets only in `~/.hermes/.env`;
  `hermes doctor` is the pre-flight check before blaming code.

## 2. Team: four roles, one agent surface

Specialists are **roles, not instances** — a role is a skill bundle plus a PR scope. Run
them as `delegate_task` children (bounded, isolated context, share the process) and only
escalate to a spawned `codex` / `claude-code` run for long implementation stretches.

| Role                    | Skills                                        | Owns                                  | Done when                                                                           |
| ----------------------- | --------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| **Spec** (orchestrator) | `app-foundation-bootstrap`, `spike`, `github` | decision tables, issue set, milestone | a decision cites a verified command                                                 |
| **Build**               | `test-driven-development`                     | one issue = one branch = one PR       | gates pass locally (`typecheck` + `data:check` + `lint` + `format:check` + `build`) |
| **Review**              | `requesting-code-review`, `simplify-code`     | diff review, verdict                  | `kanban_request_changes` or approve                                                 |
| **QA/Docs**             | `dogfood`, `code-wiki`, `agents-md-authoring` | flow checks, wiki, `AGENTS.md` upkeep | commands in `AGENTS.md` re-run clean                                                |

Rules: children inherit `deepseek-flash` (pinned in `delegation.*`), never the escalated
model; **one agent per shared file** (route through a kanban card, not a chat message); no
role writes `AGENTS.md` except QA/Docs.

## 3. Integrations: on vs. deferred

| On                                                        | Why it stays                            | Verified                                                   |
| --------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `gh` CLI, keyring account **jadenblack**                  | issues, PRs, milestones, `gh project`   | `push/triage` on the repo, `gh project list` → `rio.stack` |
| Project Manager plugin + 2 services + 5-min refresh timer | repo cockpit, working-tree UI           | dashboard tab renders all 5 repos (`:9119`)                |
| MCP `context7`, `deepwiki`                                | versioned library docs, public-repo Q&A | both enabled                                               |
| Hindsight memory                                          | cross-session decisions                 | active                                                     |
| Hermes cron                                               | scheduled refresh, digests              | 1 timer + 1 paused job                                     |

| Deferred                                     | Reason                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Neon local / Prisma Postgres proxy           | needs Docker + `neonctl`; absent. Local DB = **Prisma + SQLite file**        |
| MCP `vercel`, `sentry`, `supabase`, `linear` | need a deployment / real DB / second tracker                                 |
| GitHub MCP                                   | duplicates `gh`, adds a second token surface                                 |
| Extra Hermes plugins                         | each adds tool schemas every session; 65 catalog entries, 0 needed for P1–P3 |

## 4. CLI ops (the whole list we use)

```bash
pnpm install --frozen-lockfile                  # pnpm 12.16.1, lockfile v9
pnpm typecheck                                  # next typegen && tsc --noEmit
pnpm data:check                                 # content model + every fixture + E0–E9
pnpm lint                                       # biome check (0 errors; warnings are baseline)
pnpm format:check                               # biome format gate, 295 files
pnpm build && pnpm start                        # production gate
pnpm dev                                        # next dev --turbo, port 3000
gh issue create|list|view ; gh pr create ; gh project list --owner riolabs-ai
systemctl --user status project-manager{,-proxy}.service
systemctl --user start project-manager-refresh.service   # force a repo snapshot refresh
hermes doctor ; hermes tools list ; hermes cron list
```

## 5. Prototype gates (definition of done, per stage)

**P1 — data abstraction. COMPLETE.**

One `zod` schema is the single source of the content model: `content/` (9 schema modules plus the
route manifest) defines every shape, `data/` holds nothing but fixtures, and every card is a
projection (`selectQuizCard`) rather than an authored array.

Evidence (`pnpm data:check`, commit `ed3377c4`, CI run `40857620600` — job
`typecheck / lint / build`, all six steps green):

```
PASS  21 quizzes, 105 questions, 9 news, 6 tips, 8 kb, 45 categories,
      5 contacts, 5 conversations, 6 notifications, 20 search rows
      34 routes match app/, 0 unknown category ids, 0 dead links
      28/28 node:test cases, E0–E9 invariants
WARN  1  [W2] published quiz "quiz-ultimate-world-history-trivia" has no publishedAt
```

- `types/quiz.ts` deleted; `data:check` E9 fails if it (or a stray `any` in `data/`) reappears.
- Gate evidence, re-run from a fresh shell on node `v24.22.0` during this docs pass:
  `install` 0 · `typecheck` 0 (4–5 s) · `data:check` 0 (5–6 s) · `lint` 0 errors, 235 warnings,
  13 infos · `format:check` 0 (299 files) · `build` 0 (34 routes, 32 static pages) · `dev` 200 on
  all 34 routes.
- Landed as PR #16 (`content/zod-model`); the migration is documented in
  `docs/p1-migration/MIGRATION.md` with a per-field `ledger.json`.

**P2 — media & content templatization.** Every string and media reference a page shows
comes from the schema; media is addressed by registry key, not by literal `/public` path.
_Exit:_ swapping one fixture file changes a rendered page with no `.tsx` edit. **Next up.**

**P3 — bulk generation / variation.** A generator emits N variants from templates and
validates them with the same schema. _Exit:_ `pnpm gen -- --count 20 --seed 42`
produces reproducible, schema-valid fixtures; re-running is idempotent.

**P4 — multi-usecase wiring.** A second vertical config proves the abstraction without
touching Quizhub's screens.

## 6. QA — the P1 dogfood pass

Method: two production builds served side by side (`main` @ `5898d534` vs the P1 branch @
`ed3377c4` plus the `next/image` fixes in this PR), 123 URLs each — the 23 static routes plus every
internal link discovered on them — compared as visible text with the shared layout stripped out
(`<main>` region only), then a browser pass at 1440×900 recording console errors, broken images and
horizontal overflow. `pnpm dev` was swept across all 34 routes on both trees.

**What matches.** Status codes are identical (121×200, 2×404 on both). 112 of 123 pages are
text-identical inside `<main>`; layout, spacing and image geometry are unchanged.

**What moved (all explained by the model, none a layout regression):** derived category counts
replace the stored ones (`data/categories.tsx` claimed 113 quizzes across 25 subjects against 21
real ones) so `/` and `/categories` now read 0–5 instead of 2–9, and 10 subjects read **0** because
no quiz references them; tip categories likewise ("8 articles" → "1 article"); dates render from ISO
(`"Apr 1, 2025"`); an author role and one missing news category badge now render; the
`Architechture` → `Architecture` typo is fixed; the chat sidebar now formats fixture timestamps, and
because several are fixed datetimes already in the future at build time it reads `in 1 hour` where
`main` recorded `15h ago`.

**Fixed in this PR.** `next dev` returned 500 on `/`, `/categories`, `/quiz/[id]`,
`/quiz/[id]/play`, `/my-quizzes/[id]` and `/statistics` with
`Image with src "/category/animal.webp" is missing required "width" property.` — dev-only, so
`pnpm build` passed and CI never saw it. Five `next/image` call sites now use `fill` inside a
`relative` parent; all 34 dev routes return 200 and production output is unchanged.

**Open.** React `#418` (hydration mismatch) on **every** route, from `formatRelative()` being
called at module scope in `data/chat-data.ts` — on `main` only `/chat` showed it. Tracked as a P1
follow-up; it does not block the gates but it is a console error on every page.

**Pre-existing, not caused by P1:** `/dashboard` and `/signup` 404 from the sidebar, footer and
categories CTA; `/testimonials/jessica.png` 404s; all 23 `public/category/*.webp` are the same
1536×1024 placeholder stamped with its dimensions; `app/(mainlayout)/my-quizzes/[id]/{,statistics/}page.tsx`
read `params.id` synchronously (Next 16 requires awaiting `params`), so those pages render without
an id.

### 6.1 The three pre-existing defects, fixed (issue #20)

Same pass, follow-up PR. The dead links were four, not two — `/earnings` and `/analytics` in
`components/layout/sidebar-tooltip-fix.tsx` were dead too and no gate could see any of them, because
`data:check` only proved links the _content model_ emits, never an `href` typed into a component.

| defect                                                                             | fix                                                                                        | evidence                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `/dashboard`, `/earnings`, `/analytics` in the sidebar; `/dashboard` in the footer | point at `/dashboard/user`, `/dashboard/user?tab=wallet`, `/dashboard/user?tab=my-quizzes` | crawl: 0 pages render a legacy `href`                                                               |
| `/signup` in the categories CTA                                                    | point at `/register`                                                                       | same                                                                                                |
| `/testimonials/jessica.png` on the tournament pages                                | point at `/avatars/mind.webp` (no such file ever existed in `public/`)                     | crawl: 75 `<img>` URLs, 0 broken                                                                    |
| `params.id` read synchronously in both `my-quizzes/[id]` pages                     | `async` + `await params`                                                                   | before: `href="/my-quizzes/undefined"` + the dev warning; after: `href="/my-quizzes/1"`, no warning |

Regression guard: `data:check` gained **E10**. It extracts every literal `href`,
`router.push`/`replace`/`redirect` and every `public/` asset literal under `components/` + `app/`
(`scripts/ui-refs.ts`), resolves the routes against `content/routes.ts` and the assets against
`public/`, and fails on either. Negative control on the real tree: re-adding
`href="/signup"` + `/testimonials/jessica.png` in one component produced
`FAIL 2 error(s)` with `file:line` for both, and nothing else. 6 new cases cover the extraction
(34 total, up from 28). 11 asset literals that were already 404ing before this change (chat
avatars, `easy-quiz-*.png`, `/quiz/q16.png`, `/wizard.png`, `/science-quiz-lab.png`) were frozen in
`KNOWN_MISSING_ASSETS` — the list may only shrink; filing them is a content task, and §6.2 is that
task done: the allowlist is gone and E10 has no baseline.

The three legacy paths from the pre-P1 shell (`/dashboard`, `/signup`, and the two dashboard tabs)
308 to the real route in `next.config.mjs`, so a bookmark or cached markup does not land on a 404.
A redirect is not a second page — `app/` + `content/routes.ts` stay the only source of routes,
which is why this is not a violation of the earlier "do not fix by adding routes" note.

### 6.2 The 11 baselined asset references, fixed (#20 follow-up)

E10 shipped with an 11-entry `KNOWN_MISSING_ASSETS` allowlist: asset literals that were already
404ing on `main`, frozen only so the guard could land without a red tree. This pass deletes the
allowlist and the filter that read it by pointing every reference at a file that exists. E10 now has
no baseline — the footer reads `0 known-missing assets`, and a missing image fails the build the
same way a dead link does.

| reference (was)                              | file                                | now                           | why                                                                                                                      |
| -------------------------------------------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/avatars/chat-avatar-1..5.png` (5 rows)     | `chat/chat-window.tsx`              | 5 existing `public/avatars/*` | the avatar library; five distinct files, no repeats inside one contact list                                              |
| `/easy-quiz-1.png` (Culinary World Tour)     | `explore/featured-quizzes-page.tsx` | `/category/food.webp`         | the Food category's own art (`content/categories.ts`) — the card's category is Food                                      |
| `/easy-quiz-2.png` (Artistic Masterpieces)   | `explore/featured-quizzes-page.tsx` | `/placeholder.svg`            | no art asset exists (the Art category carries an `iconKey`, not an image), so the card uses the component's own fallback |
| `/easy-quiz-3.png` (Famous Inventors)        | `explore/featured-quizzes-page.tsx` | `/technology-quiz.png`        | closest existing illustration: inventions/technology                                                                     |
| `/quiz/q16.png` (World History Through Time) | `home/quizzes-by-difficulty.tsx`    | `/quiz/q18.png`               | `public/quiz/` ships q1–q15, q17, q18 — q16 never existed; q18 was the one file in that set nothing referenced           |
| `/wizard.png` (author avatar fallback)       | `news/news-article.tsx`             | `/avatars/wizard.webp`        | same name, correct directory                                                                                             |
| `/science-quiz-lab.png` (Science Showdown)   | `tournaments/tournament-detail.tsx` | `/space-exploration-quiz.png` | what `tournament-list.tsx` already shows for `science-showdown`; the list card and the detail hero now agree             |

Evidence: `pnpm data:check` exit 0 with `34` cases passing and the footer
`109 hardcoded links + 478 asset refs resolve in components/ and app/ (0 known-missing assets)`;
the five affected pages were crawled in `pnpm dev` with 0 broken `<img>` and 0 failed asset
requests (`/chat`, `/explore/featured`, `/`, a news article, `/tournaments/science-showdown` and
`/tournaments/global-championship`); `typecheck`, `lint` (235 warnings, unchanged), `format:check`
and `build` all exit 0. Negative control: re-adding `/quiz/q16.png` — one of the eleven — in a probe
component now fails with `[E10] components/__review_probe.tsx:6 references "/quiz/q16.png"`, which
is what "no baseline" means. This is a path fix, not an art pass: every raster in `public/` is still
a grey placeholder stamped with its own dimensions, so the images are honest about being
placeholders — they just resolve now.

## 7. Repo ops

**Origin is the source of truth.** GitHub owns the work; the kanban board is a dispatch
mirror of it, never a second backlog. Every card carries its issue, every issue carries its
card:

| Thing     | Lives on                                                | Carries                                            |
| --------- | ------------------------------------------------------- | -------------------------------------------------- |
| Work item | GitHub issue (milestone = epic)                         | `Kanban: t_xxxxxxxx` in the body                   |
| Dispatch  | kanban card                                             | `GitHub: #N — <url>` as the first line of the body |
| Review    | **the PR** (comments + `request-changes`), not an issue | PR body: `Closes #N` + card id                     |
| Result    | issue comment + close via the PR merge                  | card `complete` with summary + issue url           |

Rules: a card without an issue is not work; an issue with no milestone is not scheduled;
one branch and one PR per issue; required checks = every step of the `verify` job (`typecheck`,
`data:check`, `lint`, `format:check`, `build`); the `AGENTS.md`
command table changes in the same PR that changes a command. Parallel streams get one
kanban card each — never a shared branch. Board `alignsynch` is project-scoped; the shared
`default` board belongs to other work and must not be used for this repo.

## 8. Decisions and open questions

- **P1 content model: quiz-first — decided.** Quizhub screens map 1:1 onto the existing
  fixtures, and the brief freezes scope to Quizhub until P3. A lesson-first model is a P4
  question, not a P1 one.
- P2 media registry: **typed TS map** until P3 needs generated manifests, then JSON + zod.
- P4 second vertical: deliberately unset until P3 passes.
