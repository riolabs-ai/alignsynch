# AGENTS.md — quizhub (alignsynch)

Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui quiz platform. **Frontend-only**: no
`app/api`, no database, no auth backend. `content/` holds the zod content model, `data/` holds the
fixtures that must satisfy it, and `pnpm data:check` fails the build when a fixture drifts. Remote:
`github.com/riolabs-ai/alignsynch`.

## Commands (repo root, `pnpm` only — the lockfile is `pnpm-lock.yaml` v9)

| Command                          | Verified             | Notes                                                                   |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | exit 0, ~0.1 s warm  | pnpm `12.16.1`; CI installs the same way                                |
| `pnpm typecheck`                 | exit 0, 4–5 s        | `next typegen && tsc --noEmit`, `strict: true`                          |
| `pnpm data:check`                | exit 0, 5–6 s        | tsc → 28 `node:test` cases → validator; prints record counts            |
| `pnpm lint`                      | exit 0, ~0.8 s       | `biome check`; **0 errors**, 235 warnings, 13 infos on the current tree |
| `pnpm format:check`              | exit 0, ~0.4 s       | `biome format`, 299 files; CI gate                                      |
| `pnpm build`                     | exit 0, 56–76 s      | `next build`; 34 routes, 32 static pages                                |
| `pnpm dev`                       | 200 on all 34 routes | `next dev --turbo`, port 3000                                           |
| `pnpm start`                     | 200 after `build`    | production server, port 3000 by default                                 |
| `pnpm format` / `pnpm lint:fix`  | write modes          | must leave `format:check` at exit 0                                     |

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
  E0–E16 plus W1–W6 warnings. `scripts/__tests__/data-model.test.ts` is the negative-case suite and
  `scripts/__tests__/promotion-invariants.test.ts` is the negative-case suite for E14–E16/W6.
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
- **`data/chat-data.ts` formats times at module scope** (`formatRelative(...)`), so server and
  client disagree and every page logs React error `#418` (hydration mismatch) in the console.
  Until that is fixed, feed ISO timestamps to client components and format at render time.
- **`params` is a Promise in Next 16.** `app/(mainlayout)/my-quizzes/[id]/page.tsx` and
  `.../statistics/page.tsx` read `params.id` synchronously; dev logs `params is a Promise and must
  be unwrapped with await or React.use()` and the id arrives `undefined`. Fix while you are there.
- **Known dead links:** `/dashboard`, `/signup` (sidebar, footer, categories CTA) and
  `/testimonials/jessica.png` 404. Pre-existing, tracked as content/nav cleanup — do not "fix" by
  adding routes.
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
