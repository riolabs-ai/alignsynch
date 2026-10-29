# AGENTS.md — alignsynch (quizhub)

Next.js 16 App Router + TypeScript + Tailwind. Remote: `github.com/riolabs-ai/alignsynch`.
Default branch: `main`. Package manager: `pnpm` (`pnpm-lock.yaml`).

This file is written for agents first: every command below is one an agent runs, and the
numbers are measured, not estimated.

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

## The gate: one script, two callers

```bash
bash scripts/verify.sh       # THE gate. ~45 s locally, green = shippable
```

It runs, in order, and stops at the first failure (printing the failing step and its exit
code): `deps (pnpm install --frozen-lockfile)` → `typecheck` (`next typegen && tsc
--noEmit`) → `lint` (`biome check`) → `format:check` (`biome format`) → `data:check` →
`test` → `build` (`next build`). `data:check` and `test` run only when `package.json`
defines that script; otherwise they are skipped with a visible `○ … skipped` line, so the
same script is correct on `main` (no `data:check` yet) and on branches that carry it.

CI (`.github/workflows/ci.yml`) runs **only** `bash scripts/verify.sh`. Never add a check
step to the YAML — a check that lives only in CI is a guaranteed red push, and a check
that lives only in the script is a green CI nobody can reproduce.

Runtime parity is enforced by the script, not by convention: it refuses to run when the
shell's Node major disagrees with `.nvmrc` (`24`) or when `pnpm` is not `12.x`.

```bash
nvm use                       # or: export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
bash scripts/install-hooks.sh  # once per clone: installs the pre-push hook
```

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

## Deliberate stacking

Cards that depend on another card's output branch from that branch and open the PR against
it, so the stack stays linear. Do not rebase or reorder someone else's open PR to get your
own branch moving; land the parent first. `main` branch protection is not yet configured
(see `docs/GATE.md`), so "CI is green" is currently a human convention, not an enforced
gate.

## Numbers

Baseline and how to re-measure: `docs/GATE.md`. As of 2026-10-29: gate p50 **45 s** locally,
CI job p50 **55 s**, first-pass yield **81.8 %** (18/22 pushes green on the first run).
