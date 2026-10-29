# Quizhub

A quiz platform on Next.js 16 (App Router), TypeScript, Tailwind and shadcn/ui. It is
**frontend-only**: no `app/api`, no database, no auth backend. Every page renders from static
modules — `content/` is the zod content model, `data/` holds the fixtures that satisfy it, and
`public/` holds the media. Editing a fixture changes the rendered page; there is nothing to seed and
no environment variables to set.

## Prerequisites

| Tool | Version      | Why                                                             |
| ---- | ------------ | --------------------------------------------------------------- |
| Node | 24, `.nvmrc` | Next 16 requires ≥ 20.9; CI reads the same file                 |
| pnpm | 12.16.1      | `packageManager` + lockfile pin; the gate refuses another major |

`/usr/bin/node` is 18.19.1 on many machines and shadows a newer runtime on `PATH`. A shell on 18
cannot build this tree, and the gate stops before running a single step:

```
✗ runtime parity: .nvmrc pins Node 24, this shell has Node v18.19.1.
```

`nvm use` reads `.nvmrc`, but only in an interactive shell; in a script or an agent shell, put a
Node 24 `bin` directory first on `PATH`. Check `node -v && pnpm -v` before anything else.

## Install, dev, build

```bash
pnpm install --frozen-lockfile   # the same install CI does
pnpm dev                         # next dev --turbo, http://localhost:3000
pnpm build                       # next build, 34 routes
pnpm start                       # serve the build, port 3000 (PORT=4000 pnpm start to move it)
```

Nothing reads `process.env` under `app/`, `components/`, `lib/` or `hooks/`, so there is no
`.env.example` and no `.env` to create.

## The gate

```bash
bash scripts/verify.sh           # green = shippable
```

One script, two callers. CI (`.github/workflows/ci.yml`, job `typecheck / lint / build`) runs this
script and nothing else, and the pre-push hook execs it. A check that lives only in the YAML is a
guaranteed red push; a check that lives only in the script is a green local run that CI contradicts.
Install the hook once per clone:

```bash
bash scripts/install-hooks.sh    # core.hooksPath=scripts/git-hooks
git config --unset core.hooksPath   # undo
```

The script runs, in order, and stops at the first failure, naming the failing step: `deps`
(`pnpm install --frozen-lockfile`) → `typecheck` (`next typegen && tsc --noEmit`) → `lint`
(`biome check`) → `format:check` (`biome format`) → `data:check` → `build` (`next build`). A `test`
step runs when `package.json` defines one; today it does not, so the gate prints it as skipped.

The depth follows the diff. It classifies the change against `origin/main` and prints
`lane=docs|content|config|code`, keeping the highest lane present: a docs-only diff runs whitespace,
relative links and biome (~2 s), a `content/**` diff skips `next build`, and only `app/`,
`components/`, `lib/` or `hooks/` pay for the full gate. `GATE_LANE=full bash scripts/verify.sh`
forces all of it — use it after a dependency bump, a `tsconfig` change, or any diff you do not trust.

Individual steps are scripts too: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
`pnpm data:check`. The layer table, the classifier and the build semaphore are in
[docs/REPO-LAYERS.md](docs/REPO-LAYERS.md); measured timings and the ruleset that makes the CI check
required are in [docs/GATE.md](docs/GATE.md).

## Layout — four layers

Each layer says how much of the gate a change to it should pay for.

| Layer             | Paths                                                                                                                 | Gate depth                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Config / tooling  | `.github/**`, `scripts/**`, `AGENTS.md`, `biome.jsonc`, `tsconfig*.json`, `package.json`, `next.config.mjs`, `.nvmrc` | shell syntax, then typecheck + data:check                  |
| Content and media | `content/**` (schema + invariants), `data/**` (fixtures), `public/**` (media)                                         | typecheck + `data:check`, no `next build`                  |
| Code              | `app/**`, `components/**`, `lib/**`, `hooks/**`                                                                       | the full gate, including `next build`                      |
| Documentation     | `docs/**`, `*.md`                                                                                                     | whitespace and relative links (biome formats Markdown too) |

Content is the second row: `content/` holds the zod schemas (`quiz`, `article`, `blocks`, `category`,
`social`, `search`, `routes`) and the derivations over them, `data/` holds fixtures that must satisfy
them, `public/` holds images and other assets. `pnpm data:check` fails when a fixture drifts from the
schema, breaks a collection invariant, or — for hardcoded links and asset paths — when the UI
references a route or a file that does not exist.

## Where the docs live

| File                                                             | What it answers                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                           | command table with verified results, conventions, pitfalls               |
| [docs/ENV-SPEC.md](docs/ENV-SPEC.md)                             | environment, team, integrations, the P1–P4 stage gates and exit criteria |
| [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md)                   | how the orchestrating agent asks, queues work and recovers               |
| [docs/GATE.md](docs/GATE.md)                                     | gate baseline, first-pass yield, required-check ruleset                  |
| [docs/REPO-LAYERS.md](docs/REPO-LAYERS.md)                       | lane table, classifier rules, build semaphore                            |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md)                         | the content model: entities, invariants, strictness                      |
| [docs/P2-INVENTORY.md](docs/P2-INVENTORY.md)                     | every hardcoded string and media literal P2 has to retire                |
| [docs/p1-migration/MIGRATION.md](docs/p1-migration/MIGRATION.md) | the P1 model, field by field                                             |

`AGENTS.md` is the agent-facing companion to this file, and the two must agree on commands, package
manager and Node version; a command change belongs in both.

## Status

- **P1 — data abstraction: complete.** One zod model in `content/`, fixtures only in `data/`, cards
  projected (`selectQuizCard`) rather than authored.
- **P2 — media and content templatization: closing.** Every rendered string and media reference
  should come from the schema; the remaining work is ranked in
  [docs/P2-INVENTORY.md](docs/P2-INVENTORY.md).
- **P3 — bulk generation: next.** The generator exists and is reproducible:

  ```bash
  pnpm gen --count 20 --seed 42   # writes data/generated/{quizzes,promotions}.ts, gitignored
  ```

  The same seed rewrites byte-identical files. It is not yet green against the collection
  invariants: `pnpm data:check` reads `data/generated/` when it exists and fails `E17`, because the
  generated promotions are placed on curated explore slots that the curation map renders with
  different quizzes — 7 errors at `--count 20 --seed 42`. Until that is settled, remove
  `data/generated/` before running the gate.
- **P4 — multi-usecase: after P3.** A second vertical config, opened only once P3 passes.

Stage-by-stage definitions of done are §5 of [docs/ENV-SPEC.md](docs/ENV-SPEC.md); the CI gate
itself is documented in [docs/GATE.md](docs/GATE.md) and
[docs/REPO-LAYERS.md](docs/REPO-LAYERS.md).
