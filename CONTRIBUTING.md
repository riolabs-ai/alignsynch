# Contributing to AlignSynch

This page is for a person who has just cloned this repository. If you are an AI agent working in
this tree, read [AGENTS.md](./AGENTS.md) instead — it is the agent document and carries the rules
this page only points at. The two files must not drift, so this page links to the docs that own
the details instead of copying them.

AlignSynch is a Next.js 16 + TypeScript application. One template codebase ships two brands —
AlignSynch and QuizHub — from one tree.

## Prerequisites

| Requirement | Where it is pinned                                        | Notes                                                                                                                    |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Node 24     | `.nvmrc` is `24`; `package.json` `engines.node` is `24.x` | `/usr/bin/node` is **18.19.1** on many machines and shadows newer runtimes — check `node --version` before anything else |
| pnpm 12.x   | `package.json` `packageManager` is `pnpm@12.16.1`         | the lockfile is `pnpm-lock.yaml` v9                                                                                      |

The trap, stated plainly: `/usr/bin/node` is 18.19.1, and Next 16 refuses to run on it
(`You are using Node.js 18.19.1 … ">=20.9.0" is required`). Fix the PATH before touching code:

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"   # node 24.22.0 + pnpm 12.16.1
# or, in an interactive shell:
nvm use   # reads .nvmrc (= 24)
```

## Install and run

```bash
pnpm install --frozen-lockfile   # never a bare `pnpm install` — it rewrites the lockfile
pnpm dev                         # next dev --turbo, port 3000
```

`pnpm dev` and `pnpm build` must never run at once — both write `.next/`, and a concurrent run
corrupts it. Stop the dev server before building.

## The gate

There is exactly one gate command:

```bash
bash scripts/verify.sh
```

It prints a `lane=` and drops the steps that cannot see your diff. The lane is resolved once from
the files that differ from `origin/main`, highest wins:

| Lane      | What changed                                                           | What it runs                                            |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `docs`    | `docs/**`, `*.md`                                                      | whitespace + biome (links run in every lane)            |
| `content` | `content/**`, `data/**`, `public/**`                                   | the above + typecheck + data:check, **no** `next build` |
| `config`  | `.github/**`, `scripts/**`, `package.json`, `tsconfig*`, `AGENTS.md`   | content depth + `bash -n` on every script               |
| `code`    | `app/**`, `components/**`, `lib/**`, `hooks/**` (and anything unknown) | the full gate, including `next build`                   |

A lane is depth, never a different check. Force the full gate with `GATE_LANE=full
bash scripts/verify.sh` after a dependency bump or a `tsconfig` change.

CI runs the same script — the job is `typecheck / lint / build` (a matrix over the two brands,
with a `typecheck / lint / build` job that reports the required context). **Never add a check
step to `.github/workflows/ci.yml`**: a check that lives only in CI is a guaranteed red push, and
a check that lives only in the script is a green CI nobody can reproduce. Put it in
`scripts/verify.sh`.

## Branch and PR rules

Start every change from a freshly fetched `main`:

```bash
git fetch origin --prune
git switch main
git pull --ff-only
git switch -c <type>/<slug>
```

Then prove the tree is the one you think it is, before the first edit:

```bash
git rev-parse --abbrev-ref HEAD              # must print your branch — never HEAD
git rev-parse HEAD                           # must equal: git rev-parse origin/main
node -p "require('./package.json').version"  # must equal origin/main's package.json version
```

`HEAD` is the trap: detached, `git push` succeeds and moves nothing. A version that disagrees with
`origin/main` is a tree that is behind, not ahead.

PRs are **squash-merged**. The `main` branch has a ruleset that requires the
`typecheck / lint / build` context on the **exact head** you pushed — so a stale or red head
cannot merge, and the head you prove green is the head the lead merges.

## Where things live

The docs are grouped by the question they answer. [`docs/README.md`](docs/README.md) is the hub —
start there. The pages most people need:

| Question                                                  | Document                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| What is this repo, and how do I build in it?              | [`AGENTS.md`](AGENTS.md)                                               |
| Where is every document, by question?                     | [`docs/README.md`](docs/README.md)                                     |
| What does the gate cost, and how do I re-measure it?      | [`docs/operations/gate.md`](docs/operations/gate.md)                   |
| How do I cut a release?                                   | [`docs/operations/releasing.md`](docs/operations/releasing.md)         |
| How does one core express many brands?                    | [`docs/guides/template-doctrine.md`](docs/guides/template-doctrine.md) |
| What environment, integrations and gate does this run on? | [`docs/reference/env-spec.md`](docs/reference/env-spec.md)             |
| How do I export or import a template or demo dataset?     | [`docs/guides/bundles.md`](docs/guides/bundles.md)                     |

Link, do not summarise: a number copied into two places goes stale in one of them.

## What a good PR contains

- The issue it closes (`#<n>` in the title or body — no issue, no build).
- What changed and why — the outcome, not the diff.
- The gate's output: `bash scripts/verify.sh`, with the `lane=` and the seconds it printed.
- Screenshots for a UI change.
