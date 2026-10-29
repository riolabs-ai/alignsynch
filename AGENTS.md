# AGENTS.md — quizhub (alignsynch)

Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui quiz platform. **Frontend-only**: no
`app/api`, no database, no auth backend. `content/` holds the zod content model, `data/` holds the
fixtures that must satisfy it, and `pnpm data:check` fails the build when a fixture drifts. Remote:
`github.com/riolabs-ai/alignsynch`.

## Commands (repo root, `pnpm` only — the lockfile is `pnpm-lock.yaml` v9)

| Command                          | Verified             | Notes                                                         |
| -------------------------------- | -------------------- | ------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | exit 0, ~0.1 s warm  | pnpm `12.16.1`; CI installs the same way                      |
| `pnpm typecheck`                 | exit 0, 4–5 s        | `next typegen && tsc --noEmit`, `strict: true`                |
| `pnpm data:check`                | exit 0, 5–6 s        | tsc → 157 `node:test` cases → validator; prints record counts |
| `pnpm lint`                      | exit 0, ~0.8 s       | `biome check`; **0 errors**, 232 warnings, 12 infos           |
| `pnpm format:check`              | exit 0, ~0.4 s       | `biome format`, 313 files; CI gate                            |
| `pnpm build`                     | exit 0, ~50–76 s     | `next build`; 34 routes, 31 static pages                      |
| `pnpm dev`                       | 200 on all 34 routes | `next dev --turbo`, port 3000                                 |
| `pnpm start`                     | 200 after `build`    | production server, port 3000 by default                       |
| `pnpm format` / `pnpm lint:fix`  | write modes          | must leave `format:check` at exit 0                           |

Node must be **≥ 20.9** and the PATH is the only thing that decides which node you get:

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"   # node 24.22.0 + pnpm 12.16.1
# or, in an interactive shell: nvm use   (.nvmrc = 24)
```

CI (`.github/workflows/ci.yml`) runs `install → typecheck → data:check → lint → format:check →
build` on every push and PR; the job name is `typecheck / lint / build`.

## Layout

- `content/` — schemas (`quiz`, `article`, `blocks`, `category`, `categories`, `social`, `search`,
  `routes`) and the derivations over them. **Never import React or Next here**: `data:check`
  compiles it with `tsconfig.datacheck.json` into `.datacheck/` and runs it under plain node.
- `data/` — the fixture modules (quizzes, promotions, news, tips, kb, social, notifications, search,
  current quiz, categories). Card shapes are projections (`selectQuizCard`), never authored arrays;
  a per-slot campaign is an engagement-only overlay (`data/promotions.ts`), never a second record.
- `scripts/data-check.ts` — the validator: per-record schema pass, then collection invariants
  E0–E17 plus W1–W6 warnings. `scripts/__tests__/data-model.test.ts` is the negative-case suite and
  `scripts/__tests__/promotion-invariants.test.ts` is the negative-case suite for E14–E17/W6.
  E10 is the one that reads the UI tree: it extracts every literal `href`,
  `router.push`/`replace`/`redirect` in `components/` + `app/` and every `public/` asset literal,
  and fails on a route the manifest cannot match or a file `public/` does not have.
  `scripts/ui-refs.ts` holds the pure extraction (no `fs`), so the cases test it directly.
- `app/(mainlayout)/**` — every product page behind the header/sidebar shell; `app/(auth)/**` —
  login/register, no shell. Dynamic segments: `quiz/[id]/{play,discussion}`,
  `my-quizzes/[id]/{statistics}`, `categories/[slug]`, `news/[slug]`, `creator-tips/[slug]`,
  `profile/[username]`, `support/articles/[id]`, `tournaments/[id]`.
- `components/<feature>/` — one directory per feature; `components/ui/` is shadcn primitives.
- `docs/p1-migration/{MIGRATION.md,ledger.json}` — what the P1 model changed, field by field.
- Generated, not part of the build: `.next/`, `.datacheck/`, `node_modules/`, `.migration/`. An
  untracked `lib/quizhub/` is a static HTML template drop — nothing imports it.

## Conventions (measured, not aspirational)

- Server Components by default: 178 of 259 TS/TSX files under `app/`, `components/`, `hooks/` and
  `lib/` carry `"use client"`. Add it only for hooks, state or event handlers.
- Import through `@/` (`tsconfig.json` paths); class merging through `cn()` from `@/lib/utils`;
  extend `components/ui/*` instead of hand-rolling primitives.
- Biome owns formatting and linting (`biome.jsonc`): 2-space, `lineWidth: 100`,
  `organizeImports` off, `pnpm-lock.yaml` excluded. `.prettierrc` is gone — never reintroduce it.
- Fixture types come from `content/` (`z.infer`, every object `.strict()`). A new field means:
  edit the schema, edit the fixture, run `pnpm data:check`. An unknown key is a hard error, not a
  silent extra.
- Lint rules that still have violations on `main` are pinned to `warn` in `biome.jsonc`; flip each
  one to `error` as its violations are fixed instead of adding suppressions.

## Pitfalls

- **`/usr/bin/node` is 18.19.1** and shadows newer runtimes, so every Next command dies with
  `You are using Node.js 18.19.1. For Next.js, Node.js version ">=20.9.0" is required.` Fix the
  PATH (above) before touching code.
- **`next/image` needs an intrinsic size.** Without `width`/`height` or `fill`, dev renders a 500:
  `Image with src "/category/animal.webp" is missing required "width" property.` `next build`
  still passes, so CI cannot see it. Use `fill` inside a `position: relative` parent.
- **Never read a clock in a render path.** A label from `new Date()` or `toLocale*` is rendered
  once by the server and re-rendered at hydration; the two disagree and every page logs React
  `#418` (hydration mismatch). `content/core.ts` owns the fixture clock (`DEMO_NOW_ISO`) and every
  label there is a pure function of the ISO instant — `data/` carries instants only, the UI calls
  `formatRelative` / `formatClockTime` / `formatDayHeading`, and `data:check` E10 fails when a
  social fixture is dated after the clock.
- **`params` is a Promise in Next 16.** Every dynamic route must take
  `params: Promise<{ id: string }>` and unwrap it (`await params` in an `async` page, or
  `use(params)`); a synchronous `params.id` logs `params is a Promise and must be unwrapped with
  await or React.use()` and renders with `undefined`. The two `my-quizzes/[id]` pages that still
  did this were fixed in issue #20 — `/my-quizzes/1/statistics` used to render
  `href="/my-quizzes/undefined"`.
- **A hardcoded `href` or asset path is checked, not trusted.** `data:check` E10 fails on an
  `href` no route in `content/routes.ts` matches and on an asset literal with no file under
  `public/` — that is how `/dashboard`, `/signup` and `/testimonials/jessica.png` 404ed for so
  long. Legacy paths from the pre-P1 shell now 308 to the real route in `next.config.mjs`; never
  add a second page to satisfy a link. There is no asset allowlist: E10 fails on any literal with
  no file under `public/`, so a new missing image is a red build, exactly like a dead link.
- **`public/category/*.webp` are placeholders:** all 23 files are the same 1536×1024 PNG stamped
  with its own dimensions. Category art is a content task, not a styling bug.
- `pnpm data:check` prints exactly one warning, `[W2] published quiz
  "quiz-ultimate-world-history-trivia" has no publishedAt`. Add a `publishedAt` or set `draft`;
  do not invent a date to silence it.
- 235 lint warnings are the current baseline. Compare counts, not vibes: a new warning is a
  regression even though `pnpm lint` exits 0.
- Stop `pnpm dev` before `pnpm build` — both write `.next/` and a concurrent run corrupts it.

## Docs

`docs/ENV-SPEC.md` is the environment, team, integration and P1–P4 gate spec, and carries the P1
completion record and QA evidence. Read it before adding tooling or a dependency.
