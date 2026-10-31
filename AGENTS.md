# AGENTS.md — quizhub (alignsynch)

Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui quiz platform. **Content-first**: every
product route reads the TypeScript fixtures in `data/`, and exactly one route,
`/assessment/[slug]`, reads six Postgres tables instead (#145). `app/api/auth/[...path]` proxies
Neon's Managed Auth; the app owns no users or sessions table. The gate is still database-free —
`bash scripts/verify.sh` never opens a connection and `pnpm build` passes with `DATABASE_URL`
unset. `content/` holds the zod content model, `data/` holds the fixtures that must satisfy it,
and `pnpm data:check` fails the build when a fixture drifts. Remote:
`github.com/riolabs-ai/alignsynch`.

## Start every card with a fresh `main`

A stale tree is a gate failure, not a style issue: a branch tested against a tree nobody
ships produces green checks that mean nothing, and "green locally" becomes a lie.

```bash
git fetch origin --prune
git switch main
git pull --ff-only           # main must be a fast-forward of origin/main
git switch -c <type>/<slug>  # branch from the tip you just fetched
```

If `pull --ff-only` refuses, local `main` has diverged: do not merge it back into shape.
`git switch -c backup/main-<date>` to keep the work, then `git switch main` +
`git reset --keep origin/main`. Never open a card against a `main` that is behind.

## Commands (repo root, `pnpm` only — the lockfile is `pnpm-lock.yaml` v9)

| Command                          | Verified             | Notes                                                                                                                  |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bash scripts/verify.sh`         | exit 0, 1–95 s       | the gate; depth follows the diff, see [REPO-LAYERS](docs/REPO-LAYERS.md)                                               |
| `pnpm install --frozen-lockfile` | exit 0, ~0.1 s warm  | pnpm `12.16.1`; CI installs the same way                                                                               |
| `pnpm typecheck`                 | exit 0, 4–5 s        | `next typegen && tsc --noEmit`, `strict: true`                                                                         |
| `pnpm data:check`                | exit 0, 5–6 s        | tsc → 171 `node:test` cases → validator; prints record counts                                                          |
| `pnpm gen`                       | exit 0, ~0.1 s       | `node scripts/gen-fixtures.mjs`; bulk fixtures → `data/generated/` (gitignored, validated by `data:check`)             |
| `pnpm bundles <cmd>`             | exit 0, ~4 s         | `scripts/bundles.ts`; export/import a template or the demo dataset (#147) — see [BUNDLES](docs/BUNDLES.md)             |
| `pnpm glossary`                  | exit 0, ~0.1 s       | `node scripts/gen-glossary.mjs`; writes `docs/glossary.md` from the schema comments — never edit the page (#138)       |
| `pnpm glossary:check`            | exit 0, ~0.1 s       | the read-only form the gate runs in every lane; exit 1 plus the first difference when the page is stale                |
| `pnpm db:migrate`                | exit 0, ~1 s         | `node scripts/db-migrate.mjs`; applies `db/migrations/*.sql` in order via `schema_migrations`; wants the unpooled URL  |
| `pnpm db:seed`                   | exit 0, ~1 s         | mirrors `data/assessments.ts` into the six tables, idempotent, prints counts; removes the temp e2e auth user first     |
| `pnpm db:verify`                 | exit 0, ~1 s         | the DB port of E31 (drift) plus the party rules, read through `lib/db/**`; exit 1 with a named failure per violation   |
| `pnpm objstore:smoke`            | exit 0, <1 s         | put → get → bytes compared → deleted; reads `NEON_OBJSTORE_*` (falls back to the `AWS_*` names `neon env pull` writes) |
| `pnpm lint`                      | exit 0, ~1.6–2.6 s   | `biome check` then `node scripts/lint-brand-classes.mjs`; **0 errors**, 203 warnings, 34 infos                         |
| `pnpm format:check`              | exit 0, ~0.4 s       | `biome format`, 442 files; CI gate                                                                                     |
| `pnpm build`                     | exit 0, ~50–76 s     | `next build`; `/assessment/[slug]` is request-time since #145 (no `generateStaticParams`, no build-time DB read)       |
| `pnpm dev`                       | 200 on all 34 routes | `next dev --turbo`, port 3000                                                                                          |
| `pnpm start`                     | 200 after `build`    | production server, port 3000 by default                                                                                |
| `pnpm format` / `pnpm lint:fix`  | write modes          | must leave `format:check` at exit 0                                                                                    |

Node must be **≥ 20.9** and the PATH is the only thing that decides which node you get:

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"   # node 24.22.0 + pnpm 12.16.1
# or, in an interactive shell: nvm use   (.nvmrc = 24)
```

CI (`.github/workflows/ci.yml`) runs `bash scripts/verify.sh` on every push, PR and
merge-queue group; the job name is `typecheck / lint / build`.

## The gate: one script, two callers

```bash
bash scripts/verify.sh       # THE gate. ~45 s locally, green = shippable
```

It runs, in order, and stops at the first failure (printing the failing step and its exit
code): `deps (pnpm install --frozen-lockfile)` → `glossary` (`pnpm glossary:check`) →
`release:check` (`bash scripts/release.sh --check`) → `typecheck` (`next typegen && tsc --noEmit`) →
`lint` (`biome check` + the brand rule, see below) → `format:check`
(`biome format`) → `data:check` → `test` → `parity` → `build` (`next build`). `data:check`,
`test` and `parity` run only when `package.json` defines that script; otherwise they are
skipped with a visible `○ … skipped` line, so the same script is correct on `main` (no
`data:check` yet) and on branches that carry it.

`glossary` runs in **every** lane, including docs: `docs/glossary.md` is generated from the
schema comments, so a stale page is drift no typecheck can see, and the three files it reads
(`content/*.ts`, `scripts/`, `docs/`) classify into three different lanes. It costs ~0.1 s.
`release:check` sits beside it for the same reason: `CHANGELOG.md` is generated from the
commits and is also the published release notes, so an entry that names a version
`package.json` does not carry, or that has lost its Known limits block, is drift in a document
people read. The runbook is [`docs/RELEASING.md`](docs/RELEASING.md).

The gate costs what the change costs: it prints `lane=docs|content|config|code` and drops
the steps that cannot see a file in the diff — a `docs/`-only change is ~2 s, a
`content/` change skips `next build`, and only `app/`, `components/`, `lib/` or `hooks/`
pay for the build. A lane is depth, never a different check, and CI's job name is
unchanged. Force the full gate with `GATE_LANE=full bash scripts/verify.sh` (after a
dependency bump, a `tsconfig` change, or any diff you do not trust). Layer table,
classifier and build semaphore: **`docs/REPO-LAYERS.md`**.

CI (`.github/workflows/ci.yml`) runs **only** `bash scripts/verify.sh`. Never add a check
step to the YAML — a check that lives only in CI is a guaranteed red push, and a check
that lives only in the script is a green CI nobody can reproduce.

The one exception is the `glossary` step (#138): it regenerates `docs/glossary.md` and fails
on a diff, in the workflow the issue names. It is not a CI-only check — `verify.sh` runs the
same generator in every lane — it is a second caller of a check that already exists locally,
placed before the gate so a stale page fails under its own step name. Add no others.

**Two brands, one gate (#171).** The repo ships `BRAND=quizhub` and `BRAND=alignsynch` from one
tree, and CI now builds both: the job is a matrix over `brand`, so the two lanes are
`typecheck / lint / build (quizhub)` and `… (alignsynch)`. Because GitHub suffixes a matrix
leg's check-run name, the required context `typecheck / lint / build` is reported by a `gate`
job that only collects `needs: [verify]` — do not rename it, and add no step to it. Keeping
QuizHub identical is `pnpm parity`: seven routes rendered under both brands, hashed into
`tests/parity/manifest.txt` (`route | brand | sha256`) and described in
`tests/parity/summaries/`. Full HTML is never committed — a mismatch writes the render to
`tests/parity/artifacts/` and CI uploads it. A hash is rewritten with
`pnpm parity:update --reason "…"` and the PR says which routes moved and why; never widen the
harness to make one match ([`tests/parity/README.md`](tests/parity/README.md)). Parity also asserts
the **brand boundary** (#300): the twenty-two routes the quiz product owns
(`tests/parity/boundary.ts`) render on `quizhub` and answer `404` on `alignsynch`, where they are
gated by `product.quiz-surfaces` (`lib/brand-boundary.ts::requireQuizProduct()`).

Runtime parity is enforced by the script, not by convention: it refuses to run when the
shell's Node major disagrees with `.nvmrc` (`24`) or when `pnpm` is not `12.x`.

```bash
nvm use                       # or: export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
bash scripts/install-hooks.sh  # once per clone: installs the pre-push hook
```

## The database — one route, six tables, no ORM (#145)

Postgres is Neon; the app tables live in `public` and Neon's Managed Auth lives in its own
`neon_auth` schema, which the app never migrates. The six tables in
`db/migrations/0001_content_model.sql` mirror `content/record.ts` and `content/assessment.ts`
(`record`, `item`, `response_option`, `assessment_instance`, `party`, `opinion`) and nothing
else: every column exists because a schema defines it, and `lib/db/rows.ts` `safeParse`s rows
back through those schemas, so the model stays the single source of truth.

- **No ORM, no Prisma, no Drizzle.** `pg` is the only driver and `pg` + `@types/pg` are the
  only dependencies this layer adds.
- **The Gap is a function**: no `gap` column, table, view or generated column anywhere. A
  migration that adds one is a defect, and `db:migrate` / `db:verify` both fail on the name.
- **No build-time database.** `/assessment/[slug]` is `force-dynamic` with no
  `generateStaticParams()`, so `pnpm build` passes with `DATABASE_URL` unset — the gate and CI
  have no connection string and must not need one. The `db:*` scripts are **not** gate steps.
- **Secrets stay server-side.** `DATABASE_URL` and friends are in `.env.local` (gitignored,
  written by `neon env pull`) and never in `next.config.mjs`'s `env` block, which is inlined
  into the client bundle.
- **`pnpm db:seed` reads `data/assessments.ts`**, so a fixture edit is one `db:seed` away from
  the database; `pnpm db:verify` is what proves the rows still say what the fixture says.
- The `db:*` scripts import TypeScript source directly through `scripts/ts-modules.mjs` (a node
  resolve hook for the `@/` alias and extensionless imports), which is why `db:verify` runs the
  same mapper the page runs instead of a second copy of the rule.

## Pre-push hook (install path, not an assumption)

```bash
bash scripts/install-hooks.sh   # sets core.hooksPath=scripts/git-hooks
git config --get core.hooksPath # verify
git config --unset core.hooksPath   # undo
```

`scripts/git-hooks/pre-push` just execs `scripts/verify.sh`, so the hook can never drift
from CI. Because `core.hooksPath` makes git ignore `.git/hooks/` entirely, any hook you
already had must move into `scripts/git-hooks/` to keep running.

Two consequences, both deliberate:

- the hook checks the **working tree**, so uncommitted work is gated too — `git stash` WIP
  you do not intend to ship before pushing a review branch;
- `git push --no-verify` exists for real emergencies only. A `--no-verify` push followed by
  a red CI run is the exact 35-minute loop this repo is trying to delete.

Three red CI runs on the same head means **stop pushing**: reproduce with
`bash scripts/verify.sh`, read the whole log, fix the step. A fourth blind retry is a
process bug.


## Layout

- `content/` — schemas (`quiz`, `record`, `assessment`, `article`, `blocks`, `category`, `categories`,
  `social`, `search`, `routes`) and the derivations over them. `record.ts` is the one root content
  type (a quiz and an assessment are both records); `quiz.ts` and `assessment.ts` import it and never
  each other. **Never import React or Next here**: `data:check`
  compiles it with `tsconfig.datacheck.json` into `.datacheck/` and runs it under plain node.
- `data/` — the fixture modules (quizzes, assessments, promotions, news, tips, kb, social,
  notifications, search, current quiz, categories). Card shapes are projections (`selectQuizCard`),
  never authored arrays;
  a per-slot campaign is an engagement-only overlay (`data/promotions.ts`), never a second record.
- `scripts/data-check.ts` — the validator: per-record schema pass, then collection invariants
  E0–E21 plus W1–W6 warnings. `scripts/__tests__/data-model.test.ts` is the negative-case suite and
  `scripts/__tests__/promotion-invariants.test.ts` is the negative-case suite for E14–E17/W6,
  and `scripts/__tests__/explore-curation.test.ts` pins which authored tab block each explore
  shelf owns (the 3-vs-6 decision in `docs/p1-migration/MIGRATION.md`).
  E10 is the one that reads the UI tree: it extracts every literal `href`,
  `router.push`/`replace`/`redirect` in `components/` + `app/` and every `public/` asset literal,
  and fails on a route the manifest cannot match or a file `public/` does not have.
  `scripts/ui-refs.ts` holds the pure extraction (no `fs`), so the cases test it directly.
  E21 is the second one that reads the UI tree: `scripts/island-refs.ts` finds module-scope record
  arrays and fixture text pasted into a component. It binds `components/search/**`,
  `components/chat/**` and the header palette; copies still sitting in the other feature
  directories are counted on the summary line every run instead of being allowed silently.
  E34 is the third, and the only one that reads the **import graph**: `scripts/client-graph.ts`
  walks every `"use client"` module's runtime imports and fails when one reaches `lib/db/**`, `pg`
  or a Node builtin — the bundle has no browser build for those, so the route 500s at request time
  while `next build` stays green. `import type` is erased and stays legal; a value import from the
  same module is not. The census (`N "use client" entries walked, 0 reaching a server-only module`)
  prints every run.
- `content/bundle.ts` + `scripts/bundles.ts` — the bundle (#147): a template or a demo dataset as
  one versioned JSON document, and the CLI that exports and imports it. The canonical demo
  bundle is committed at `data/bundles/demo-dataset.alignsynch.json`; an import writes the tenant
  store to `data/generated/assessments.json` (gitignored, the active set when present). Refusals
  are `B1`–`B6`, and `data:check` E32 keeps the committed bundle equal to the fixtures. Read
  `docs/BUNDLES.md` before changing either.
- `app/(mainlayout)/**` — every product page behind the header/sidebar shell; `app/(auth)/**` —
  login/register, no shell. Dynamic segments: `quiz/[id]/{play,discussion}`,
  `my-quizzes/[id]/{statistics}`, `categories/[slug]`, `news/[slug]`, `creator-tips/[slug]`,
  `profile/[username]`, `support/articles/[id]`, `tournaments/[id]`.
- `components/<feature>/` — one directory per feature; `components/ui/` is shadcn primitives.
- `docs/p1-migration/{MIGRATION.md,ledger.json}` — what the P1 model changed, field by field.
- Generated, not part of the build: `.next/`, `.datacheck/`, `node_modules/`, `.migration/`.
- `db/migrations/` — plain SQL, one file per migration; `lib/db/` — the `pg` pool
  (`client.ts`), the row→model mapping (`rows.ts`, pure and testable) and the assessment reads
  (`assessments.ts`). `lib/objstore.ts` — the SigV4 client for Neon object storage.
- `lib/quizhub/` — a **vendored** static HTML template drop (`index.html` + `assets/`, `css/`, `js/`,
  `scss/`), kept as reference and out of the build: nothing imports it. It is listed in `.gitignore`,
  so it never shows in `git status` and `biome check` (`vcs.useIgnoreFile`) never lints it — do not
  delete it as dead code, and do not commit it back into the tree.

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
- **A brand colour is a token, never a palette step.** `pnpm lint` runs
  `scripts/lint-brand-classes.mjs` after biome and fails on `indigo-*`, `purple-*`, `violet-*` or
  `bg-gradient-to-*` anywhere under `components/` and `app/` (#187 stage 4). There is no allowlist
  and no suppression: the palette has exactly one home, `data/brand.ts`, painted through
  `bg-action` / `text-action` / `border-action` by `lib/brand-theme.ts`. If a role has no token,
  add one to the record — do not exempt the line, and do not compose a gradient in a component
  (gradients belong to the token layer, `app/globals.css`). Status hues (`blue`, `amber`, `green`,
  `red`, `slate`) are deliberately outside the rule: "warning" and "trending" mean the same thing
  under both brands.
- `pnpm gen` emits **quizzes only** into `data/generated/`, and `pnpm gen --count 20 --seed 42 &&
  pnpm data:check` is a green gate. Promotions are curated (`data/promotions.ts`), never generated:
  a campaign names a slot that `data/quiz-catalogue.ts` renders (E17), and a generated quiz is in
  no shelf, so a generated one could never run — `data:check` E26 rejects a
  `data/generated/promotions.ts` and `pnpm gen` deletes a leftover.

## Pitfalls

- **`/usr/bin/node` is 18.19.1** and shadows newer runtimes, so every Next command dies with
  `You are using Node.js 18.19.1. For Next.js, Node.js version ">=20.9.0" is required.` Fix the
  PATH (above) before touching code.
- **`next/image` needs an intrinsic size.** Without `width`/`height` or `fill`, dev renders a 500:
  `Image with src "/category/animal.webp" is missing required "width" property.` `next build`
  still passes, so CI cannot see it. Use `fill` inside a `position: relative` parent.
- **A client component may not value-import server code, and the build will not tell you.** A
  `"use client"` module that imports a _value_ from a module which reaches `lib/db/**` or `pg`
  compiles — `typecheck`, `lint`, `data:check`, `vitest` and `next build` all stay green — and then
  every route behind the shell answers **500** at request time, because the browser graph has no
  `pg` build (#228). `import type` is erased and is the correct way to pass props across the
  boundary. `data:check` **E34** now walks the graph and fails on the crossing; if you see it,
  resolve the value on the server and pass it down, or move the pure derivation into a module that
  imports no `lib/db/**` — never "fix" it by adding `"use client"` to the database module.
- **Never read a clock in a render path.** A label from `new Date()` or `toLocale*` is rendered
  once by the server and re-rendered at hydration; the two disagree and every page logs React
  `#418` (hydration mismatch). `content/core.ts` owns the fixture clock (`DEMO_NOW_ISO`) and every
  label there is a pure function of the ISO instant — `data/` carries instants only, the UI calls
  `formatRelative` / `formatClockTime` / `formatDayHeading`, and `data:check` E10 fails when a
  social fixture is dated after the clock.
- **A page that renders a slot must be request-time.** `shelfCards()` projects a campaign
  against the instant it is given, so a static prerender evaluates the campaign window at
  _build_ time: the HTML carries the catalog snapshot, or — for a build inside the window —
  freezes the campaign numbers for good. `/explore` and `/explore/featured` are the two routes
  that render shelves named by `data/quiz-catalogue.ts::slotShelves`, and both are
  `export const dynamic = "force-dynamic"` and hand one server instant (`now`) down to the
  client component. Adding a slot surface means making its route request-time in the same
  change.
- **A snapshot key is a harness label, not a shelf position.** `scripts/__tests__/fixtures/
  card-records.ts` keys its rows `explore-page/*` and `explore-featured/*`, and those two groups
  are the opposite way round from the pages that render them — the six-card tabs are
  `/explore/featured`'s, the three-card block is `/explore`'s. `explore-page/popular[3]` is not
  the fourth card of `/explore`. `explore-curation.test.ts` states the mapping and
  `docs/p1-migration/MIGRATION.md` records the decision to keep `/explore` at three cards a tab.
- **`params` is a Promise in Next 16.** Every dynamic route must take
  `params: Promise<{ id: string }>` and unwrap it (`await params` in an `async` page, or
  `use(params)`); a synchronous `params.id` logs `params is a Promise and must be unwrapped with
  await or React.use()` and renders with `undefined`. The two `my-quizzes/[id]` pages that still
  did this were fixed in issue #20 — `/my-quizzes/1/statistics` used to render
  `href="/my-quizzes/undefined"`.
- **A hardcoded `href` or asset path is checked, not trusted.** `data:check` E10 fails on an
  `href` no route in `content/routes.ts` matches and on an asset literal with no file under
  `public/` — that is how `/dashboard`, `/signup` and `/testimonials/jessica.png` 404ed for so
  long. The asset extractor reads **quoted source text, comments included** (unlike the brand-class
  rule, which parses the AST), so a path spelled in a doc comment that describes an image the tree
  does not have is an E10 failure at that comment's line — describe the path instead of quoting one
  that does not exist. Legacy paths from the pre-P1 shell now 308 to the real route in
  `next.config.mjs`; never add a second page to satisfy a link. There is no asset allowlist: E10
  fails on any literal with no file under `public/`, so a new missing image is a red build, exactly
  like a dead link.
- **A fixture row is imported, never pasted.** `data:check` E21 fails on a module-scope record array
  in `components/search/**` or `components/chat/**` and on any quiz title or chat message body
  written into one of those components (or the header palette) — as a literal, JSX text or a
  comment. The `/search` page and the palette both render `querySearchIndex()` over
  `data/searchdata.ts`, which is `buildSearchIndex()` over the real collections; a row that only
  exists in a component cannot be edited by changing a fixture, which is how two unrelated search
  catalogs survived two migrations.
- **`public/category/` no longer exists, on purpose.** All 23 files were the same 1536×1024 PNG
  stamped with its own dimensions (blob `df44187d`); issue #130 deleted them and every quiz
  subject's tile is generated from its slug (`lib/category-gradient.ts` +
  `components/categories/category-tile.tsx`) with a monogram from the name. The registry keeps a
  `generated: true` entry per subject in `data/media.ts` (no `src`, no size), which is why
  `media[<category key>].src` does not typecheck — take `FileMediaKey`/`mediaSrc()` for anything
  that needs a path. A real, distinct image is still the winning case: drop the file under
  `public/category/`, add `image` to the row in `content/categories.ts`, run
  `node scripts/gen-media.mjs`.
- `pnpm data:check` prints **0** warnings and no errors on the current tree. It printed 98 before
  #124 repaired the published fixtures (`W1` 24 — a published record with no questions; `W2` 42 — no
  `publishedAt`; `W4` 32 — a prize with no window); every published quiz now carries its questions, a
  date and a reward window, so the census is empty and `W3`/`W5` were already 0. From here a non-zero
  `W` count is a regression, not the baseline: no date, question or window is invented to silence one,
  and the record of what each repair changed is in `docs/p1-migration/MIGRATION.md`.
- 195 lint warnings / 34 infos are the current baseline (measured on `main` at `37c1d7c` and
  unchanged by #145). Compare counts, not vibes: a new warning is a
  regression even though `pnpm lint` exits 0.
- Stop `pnpm dev` before `pnpm build` — both write `.next/` and a concurrent run corrupts it.

## Voice capture: memo → issue → card (ops loop)

A voice note is an issue intake channel, not a chat toy. Four steps, all reproducible on one
machine; STT never leaves it (issue [#32](https://github.com/riolabs-ai/alignsynch/issues/32)).

1. **Capture.** Drop the clip on disk and keep it with the ticket — a bare transcript loses the
   tone, the numbers read aloud, and any "this part is broken" inflection. 20 s is the practical
   ceiling for one memo = one issue.
2. **Transcribe locally.** `stt.enabled: true`, `stt.provider: local` (faster-whisper `base`, Silero
   VAD on, `stt.language: en`). The `stt` toolset must be enabled (`hermes tools enable stt`); it is
   a **config-only** toolset (`_CONFIG_ONLY_TOOLSETS` in `hermes_cli/tools_config.py`) — it gates the
   transcription of inbound voice messages and voice mode, and registers no agent-callable tool, so
   "enabled" is verified by transcribing a clip, never by looking for a tool in the list.
   The Python extra is not installed by default: `hermes pm install --extra stt-whisper`. Without it
   the resolver reports `STT provider 'local' configured but unavailable` and falls to `none` — do
   **not** "fix" that by pointing `stt` at a cloud provider.
3. **File the issue.** The PM role turns the transcript into a ticket: verbatim transcript in the
   body above the summary, labels from the labels that already exist (`enhancement`, `ci`,
   `tech-debt`, `documentation`, `needs-validation`, `bug` — there is no `ops` label; adding one is a
   deliberate repo decision, not a reflex), milestone `#1 Hardening & validation` (the only one) when
   the work is in scope for it, and the acceptance line written as something a command can prove.
   The transcription command and the provider it used go in the body, so the ticket is auditable.
4. **Mirror the card.** The kanban card cites the issue number and carries the same acceptance
   criteria; when the card is worked, its handoff carries the commands that were run, not a summary
   of them. One memo → one issue → one card; a memo that wants three changes is three issues.

Measured on this machine (keep the numbers honest when re-checking):

| Check                                                                                | Result                               |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| 13.06 s clip, `unshare -rn` (no network, `huggingface.co` unreachable), model `base` | transcript in 2.9 s, near-verbatim   |
| Same clip, cold model cache (first run on this machine)                              | 9.8 s, including the model fetch     |
| 6.65 s Xiaomi-generated WAV → same local STT, offline                                | transcript in 3.4 s, near-verbatim   |
| `faster-whisper 1.2.1` present / absent                                              | `provider: local` / `provider: none` |

The `base` model mis-hears proper nouns ("Neuphonic" → "pneumonic"). That is a model-size limit, not
a config bug: raise `stt.local.model` (`small` / `medium`) for memos dense in product names, and
never "correct" a transcript into something the speaker did not say.

### Xiaomi: TTS yes (as a command provider), ASR not through `stt` today

`tts.providers.xiaomi` is wired in `~/.hermes/config.yaml` against `XIAOMI_BASE_URL`
(`https://token-plan-sgp.xiaomimimo.com/v1`) and backed by `~/.hermes/scripts/xiaomi_tts.py`; select
it with `hermes config set tts.provider xiaomi` (default stays `nous`). It is a **command** provider,
not a Python plugin provider — the config layer docs call that the supported path.

- **Endpoint:** Xiaomi synthesises through `POST {base}/chat/completions` with `model:
  mimo-v2.5-tts`, the text in an **`assistant`** message, and `audio: {format: wav, voice:
  mimo_default}`; the audio arrives base64 in `choices[0].message.audio.data`. `POST
  /v1/audio/speech` is documented as OpenAI-client compatible but returns **404** from this gateway
  (openresty), so a spike that only tries `/audio/speech` concludes "no TTS" — it is there, on the
  chat route.
- **Output:** `wav`, 24 kHz mono PCM16, ~47 KB/s (6.65 s ≈ 319 KB). Round-trip through the local STT
  is intelligible, so this is usable for voice-memo playback, not just for the spike.
- **Secrets:** command providers run with Hermes secrets scrubbed, so the provider needs
  `env_passthrough: [XIAOMI_API_KEY, XIAOMI_BASE_URL]`. Without it the script exits 2 with
  `XIAOMI_API_KEY is empty` — the error names the real cause.
- **Quota:** the text models on this gateway are `mimo-v2.6-flash` / `mimo-v2.6-pro`; TTS/ASR are the
  `mimo-v2.5-*` family (`-tts`, `-tts-voiceclone`, `-tts-voicedesign`, `-asr`). There is no v2.7.
  Spikes stay at a handful of short calls; that is the whole budget.
- **ASR has no route through `stt` today — and the reason is not "no base URL":** `mimo-v2.5-asr`
  is on `/v1/models`, but `xiaomi` is not a registered STT provider name. Unknown names pass
  through the explicit resolver untouched, so `stt.provider: xiaomi` fails as
  _provider-not-registered_. The OpenAI-compatible providers **do** accept a base URL —
  `stt.openai.base_url` is read and honoured (`_direct_openai_credentials`), and
  `stt.deepinfra.base_url`, `stt.xai.base_url` / `XAI_STT_BASE_URL`,
  `stt.elevenlabs.base_url` / `ELEVENLABS_STT_BASE_URL` exist too. So the untested route is
  `stt.provider: openai` + `stt.openai.base_url: https://token-plan-sgp.xiaomimimo.com/v1` +
  `stt.openai.model: mimo-v2.5-asr`. **Untested, not impossible:** it was left alone because it
  spends ASR quota outside this spike's budget, and for a non-OpenAI-shaped API the zero-Python
  alternative is `stt.providers.<name>: {type: command}` (same registry as TTS) or
  `HERMES_LOCAL_STT_COMMAND`; a plugin `TranscriptionProvider` is the heavier option. Neither is
  planned: local faster-whisper is the offline answer and the ops constraint is that audio does
  not leave the machine.

## Deliberate stacking

Cards that depend on another card's output branch from that branch and open the PR against
it, so the stack stays linear. Do not rebase or reorder someone else's open PR to get your
own branch moving; land the parent first. `main` requires the `typecheck / lint / build`
check through a repository **ruleset** (strict: branch must be up to date), so a red or stale
head cannot merge — see `docs/GATE.md` for the evidence and for why the classic
`/branches/main/protection` endpoint returns 404 and must not be trusted.

## Numbers

Baseline and how to re-measure: `docs/GATE.md`. As of 2026-10-29: gate p50 **45 s** locally,
CI job p50 **55 s**, first-pass yield **81.8 %** (18/22 pushes green on the first run).

## Docs

`docs/ENV-SPEC.md` is the environment, team, integration and P1–P4 gate spec, and carries the P1
completion record and QA evidence. Read it before adding tooling or a dependency.

`docs/ORCHESTRATION.md` is the orchestrator's behavioural contract: decisions arrive as `clarify`
forms (never prose option lists), blocked cards carry the `❓ DECISION REQUIRED` block, block kinds
are declared, the board is re-carded when it drains, and it records the traps that have already cost
this repo a day — a PR URL in a kanban comment freezes that card for 24 h, after a reboot every
`running` card must be `reclaim`ed before any status is trusted, and a `scratch` workspace makes a
worker fall back to the operator's checkout.
