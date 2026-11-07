# Getting started

## Prerequisites

- **Node 24** — [`.nvmrc`](../../.nvmrc) pins `24`, and `package.json` asks for `>=20.9.0`. Use 24:
  `pnpm parity` refuses to run when the shell's Node major disagrees with `.nvmrc`.
- **pnpm 12.16.1** — `packageManager` pins it; the lockfile is `pnpm-lock.yaml` v9 and `pnpm-lock.yaml`
  is the only lockfile (`npm i` produces a second one that nothing reads).
- **Nothing else.** The gate runs with no `DATABASE_URL`, no auth secrets and no network. A database is
  only needed for the `db:*` and `demo:*` scripts.

```bash
nvm use                                   # or:
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
node -v                                   # v24.x
pnpm -v                                   # 12.16.1
```

`/usr/bin/node` is 18 on many boxes and shadows newer runtimes, which is why every Next command fails
with `You are using Node.js 18.19.1` until the PATH is fixed.

## Installation

```bash
pnpm install --frozen-lockfile
bash scripts/install-hooks.sh   # once per clone: core.hooksPath = scripts/git-hooks
```

The hook just execs [`scripts/verify.sh`](../../scripts/verify.sh), so it can never drift from CI. It
checks the **working tree**, not the commit — stash WIP you do not intend to ship.

## First run

```bash
pnpm dev          # next dev --turbo on :3000
```

No environment file is needed to browse the fixture-backed routes: every product page except
`/assessment/[slug]` reads `data/`, and the shell renders a signed-out header rather than failing. The
gated console routes answer 500 `NEON_AUTH_BASE_URL is not set` on a tree with no auth env — that is
documented behaviour, not a broken clone.

## The gate

```bash
bash scripts/verify.sh      # deps → glossary → release:check → typecheck → lint → format:check → data:check → test → parity → build
pnpm check:fast             # the inner loop: the cheap half, no build
```

The gate prints its `lane` and skips the steps that cannot see a file in the diff: a `docs/`-only
change is ~2 s, a `content/` change skips `next build`, and only `app/`, `components/`, `lib/` or
`hooks/` pay for the build. Force the full run with `GATE_LANE=full bash scripts/verify.sh` after a
dependency bump or a `tsconfig` change. Layer table: [`docs/REPO-LAYERS.md`](../REPO-LAYERS.md).

The four steps worth knowing individually:

| Command           | What it proves                                                             |
| ----------------- | -------------------------------------------------------------------------- |
| `pnpm typecheck`  | `next typegen && tsc --noEmit`, `strict: true`                             |
| `pnpm lint`       | `biome check` plus the brand-class rule (`scripts/lint-brand-classes.mjs`) |
| `pnpm data:check` | every fixture against its schema, plus collection invariants E0–E39        |
| `pnpm test`       | the `node:test` suites, including the negative cases for each invariant    |

## The database and the demo seed

```bash
neon env pull .env.local        # writes DATABASE_URL and the NEON_* names
pnpm db:migrate                 # applies db/migrations/*.sql in order
pnpm db:seed                    # data/assessments.ts → rows, idempotent
pnpm db:verify                  # proves the rows still say what the fixture says
```

`pnpm db:seed` mirrors the fixtures and prints record counts; with `DEMO_AUTH=1` it also creates the
three demo identities and binds two of them to Avery and Rowan. The demo branch is shared, so the seed
takes a session-level advisory lock (`algn/1`, `scripts/db-seed-lock.mjs`) and a second seeder waits
rather than interleaving. A killed seed leaves a **half-seeded** branch — content intact, no demo
identities — and the next successful seed is the recovery, not a manual repair.

The end-to-end proof:

```bash
pnpm demo:verify                # seed the bundle, drive the app, diff against data/verify/
pnpm demo:verify --update       # rewrite the observed half (the PR shows the diff)
```

`demo:verify` refuses to run when `data/bundles/demo-dataset.alignsynch.json` is not the canonical
export of `data/assessments.ts`, because a seed that installs a dataset the fixtures disagree with is
drift no later check would name.

## Common workflows

### Add a fixture field

1. edit the zod schema in [`content/`](modules/content.md);
2. edit the fixture in [`data/`](modules/data.md);
3. `pnpm data:check` — an unknown key is a hard error, not a silent extra;
4. if the record is seeded: `pnpm db:seed && pnpm db:verify`.

### Add a surface

1. pick the existing surface this one is a variation of
   ([`docs/TEMPLATE-DOCTRINE.md`](../TEMPLATE-DOCTRINE.md) asks three questions, in order);
2. add the page under the right route group and its copy module in `data/pages/`;
3. `pnpm data:check` — E10 fails a dead `href`, E39 a public route the manifest does not know.

### Regenerate a generated page

```bash
pnpm glossary        # docs/glossary.md from the schema comments — never edit the page
pnpm ui:registry     # docs/ui-registry.md
```

## Configuration

- `.env.local` — gitignored, written by `neon env pull`. Holds `DATABASE_URL` (unpooled for
  `db:migrate`), `NEON_AUTH_*`, `NEON_OBJSTORE_*` and the mail/billing keys.
- `BRAND` — `quizhub` or `alignsynch`; picks the template. Defaults to `quizhub`.
- `FLAG_<NAME>=1|0` — an operator override for one flag in
  [`data/flags.ts`](modules/data.md), read per call. `FLAG_PRODUCT_QUIZ_SURFACES=1` shows the quiz
  product on an alignment build.
- `PAYMENT_JOB_SECRET` / `CRON_SECRET` — the payment job's bearer token. Unset means the endpoint
  answers 503 and does nothing.
- `next.config.mjs` has **no** `env` block on purpose: anything added there is inlined into the client
  bundle.

On a workstation that has them, the repo's toolchain scripts are
`~/.hermes/profiles/alignsynch/bin/node24.sh <cmd>` (Node 24 without touching the PATH) and
`~/.hermes/profiles/alignsynch/bin/withenv.sh <cmd>` (the repo secrets, for the `db:*` commands). A
plain shell has no credentials — never assume one is in the environment.

## Where to go next

- [Architecture](architecture.md) — how a request becomes a page.
- [Module map](README.md) — the ten modules, one page each.
- [Sequence diagrams](diagrams/sequences.md) — three walks through the tree.
- [`docs/GATE.md`](../GATE.md) — the current gate numbers and how to re-measure them.
- [`AGENTS.md`](../../AGENTS.md) — the rules a change must obey.
