# The four layers, and why the gate costs what your change costs

Issue: [#30](https://github.com/riolabs-ai/alignsynch/issues/30) built one gate:
`scripts/verify.sh`, called by CI and by the pre-push hook. It was **flat** — a
one-line typo in `docs/` and a refactor of `app/` both paid the 40–76 s
`next build`. With eight agent workers on one 8-core box, that stopped being a
convenience problem:

| Measurement (2026-10-29, 31 GB / 8-core host)  | Value                                        |
| ---------------------------------------------- | -------------------------------------------- |
| load average before eight workers              | ~6                                           |
| load average with eight gates building at once | **39.5**                                     |
| same gate, quiet box / under that contention   | **62 s** / **145 s**                         |
| same gate on a CI runner                       | 50–71 s (one build at a time, no contention) |

The gate never got slower. The box got saturated: `next build` is 34 routes and
about 90 % of the gate's wall time, and eight of them at once is a queue, not
parallelism. So this is two changes, not one — **pay for the depth you need**,
and **cap the one step that saturates the box**.

## The layers

| Layer                   | Paths                                                                                                                 | Gate depth                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Config / AI tooling** | `.github/**`, `scripts/**`, `AGENTS.md`, `biome.jsonc`, `tsconfig*.json`, `package.json`, `next.config.mjs`, `.nvmrc` | meta: `bash -n` every script, `pnpm install --frozen-lockfile`, biome over the tree; plus the content depth (see deviations) |
| **Content + media**     | `content/**` (schema + invariants), `data/**` (fixtures), `public/**` (media)                                         | `tsc -p tsconfig.datacheck.json` + `node --test .datacheck/**` + `data-check.js` + `pnpm typecheck` — **no Next build**      |
| **Code / dev / deploy** | `app/**`, `components/**`, `lib/**`, `hooks/**`                                                                       | full gate incl. `next build`                                                                                                 |
| **Documentation**       | `docs/**`, `*.md`                                                                                                     | `git diff --check` + relative-link existence only                                                                            |

The layers are **read-only facts about the tree** — no import moved, no path
rewritten, no file relocated. That is deliberate: seven cards were in flight
against this tree while the lanes landed, and a change of that kind is a
conflict factory that buys nothing here.

## How a lane is picked

`scripts/gate-lanes.sh` (sourced by `scripts/verify.sh`) classifies every path
in the diff and keeps the **highest** lane present:

```
code (3)  >  config (2)  >  content (1)  >  docs (0)
```

- a PR touching `content/**` **and** `components/**` is a **code** PR, no
  exceptions — a cheaper lane may only drop steps that cannot see the file that
  changed;
- an unrecognised path resolves to **code**, so a new top-level directory
  cannot buy a shortcut;
- `AGENTS.md` is prose but it is **config**: it changes what every future card
  runs;
- an empty diff, or no `origin/main` to diff against, resolves to **code** —
  no evidence about what changed means no shortcut.

The diff is `git diff --name-only $GATE_REF...HEAD` plus the working tree and
untracked files, so the pre-push hook (which gates the working tree, not just
the commit) classifies what it is about to push. `GATE_REF` defaults to
`origin/main`.

## What each lane runs

`verify.sh` prints the lane before it runs anything, and the reason:

```
 lane=content content/**, data/**, public/** (2 changed file(s) vs origin/main)
```

| Step                 | docs | content | config | code |
| -------------------- | ---- | ------- | ------ | ---- |
| `deps`               | ✓    | ✓       | ✓      | ✓    |
| `bash -n` scripts    |      |         | ✓      |      |
| `whitespace`         | ✓    |         |        |      |
| `links`              | ✓    |         |        |      |
| `typecheck`          |      | ✓       | ✓      | ✓    |
| `lint` (biome)       | ✓    | ✓       | ✓      | ✓    |
| `format:check`       | ✓    | ✓       | ✓      | ✓    |
| `data:check`         |      | ✓       | ✓      | ✓    |
| `test`               |      | ✓       | ✓      | ✓    |
| `build` (next build) |      |         |        | ✓    |

Two deviations from the layer table, both in the same direction — a lane may be
**deeper** than its row, never shallower:

- **biome runs in every lane**, including docs. Biome formats Markdown, so a
  hand-wrapped doc fails `lint`; a docs lane that skipped it would hand the
  developer a green local gate and a red CI run, which is the exact loop this
  repo is deleting. It costs ~0.5 s.
- **biome reads the tree, not the diff.** `biome check` has no changed-file mode
  here, and building one (a `git diff --name-only` → argv list) would miss
  nothing that matters: 328 files cost 0.6 s + 0.2 s for `format:check`. The
  lane decides whether the _build_ runs, and biome is two orders of magnitude
  cheaper than that.
- **config runs `typecheck` and `data:check`.** The card's config row is
  "meta" only, but `tsconfig.json`, `package.json` and `scripts/data-check.ts`
  are precisely the files typecheck exists to catch — the cheap lane there
  would be a 4 s saving against a red push.

## The escape hatch

```bash
GATE_LANE=auto bash scripts/verify.sh   # default: classify the diff
GATE_LANE=full bash scripts/verify.sh   # force the code lane
```

`auto` is what CI and `scripts/git-hooks/pre-push` pass (they pass nothing —
`auto` is the default). `full` is for the cases the classifier cannot see: a
dependency bump that only touches `package.json`, a `tsconfig` change whose
blast radius is the whole tree, or any diff you do not trust. The gate shouts
at you when that is probably the case:

```
! dependency/config manifest changed — a bump wants the full gate: GATE_LANE=full bash scripts/verify.sh
```

Anything else (`GATE_LANE=docs`, a typo) is an error, not a silent `auto`.

## One CI job, four internal depths

`ci.yml` still has exactly one job named **`typecheck / lint / build`**. It is
not split into a docs job and a code job, and it will not be:

- the repository ruleset requires that exact context. A **skipped** job never
  reports a context, so a `paths:`-filtered docs job would leave every docs PR
  waiting on a check that never arrives — a permanent red;
- a matrix (`.github/workflows` `strategy:`) has the same problem: the required
  context is the job name, and one job name per lane means renaming the
  requirement;
- CI has no contention to relieve. The lanes exist to stop eight local workers
  from compiling in parallel; a GitHub runner is already one build at a time.

On CI `auto` therefore resolves to **code**: `actions/checkout` fetches a
single commit, `origin/main` does not exist in that clone, and no diff base
means the full gate. That is the conservative, intended behaviour — the required
check keeps meaning what it always meant.

## The build semaphore

`next build` runs inside one of `QUIZHUB_BUILD_SLOTS` (default **2**) `flock`
slots under `~/.cache/quizhub/`, and prints which one it holds and whether it
waited:

```
  build lock: slot 2/2 free, building now (/home/you/.cache/quizhub/build.lock.2)
  build lock: all 2 slot(s) busy — waiting (this is the queue, not a failure)
  build lock: waited, now holds slot 1/2 (waited lock)
```

Why a lock _family_ (`build.lock.1`, `build.lock.2`) instead of one
`build.lock`: `flock` on a single file has exactly one holder — a single
lockfile can express "serialize", never "at most two". Two slot files is the
whole mechanism; slot 1 is not more privileged than slot 2.

Why 2 and not 8: at eight concurrent compiles the box spent its time in
scheduler and memory pressure (load 39.5) and each build ran _slower_ than a
serial one. Two keeps a pair of builds overlapping — the CPU stays busy — while
the rest of the fleet runs the cheap lanes and waits its turn.

| Knob                      | Default            | Use                                                 |
| ------------------------- | ------------------ | --------------------------------------------------- |
| `QUIZHUB_BUILD_SLOTS`     | `2`                | `1` on a box that is already loaded                 |
| `QUIZHUB_BUILD_LOCK_DIR`  | `~/.cache/quizhub` | leave it: the lock must be shared, not per-worktree |
| `QUIZHUB_BUILD_LOCK_WAIT` | `1800` s           | a slot that never frees is a failure, not a hang    |

The lock is a **CPU budget, not a `.next/` mutex**. Two builds in the _same_
worktree still corrupt `.next/` — workers each have their own worktree, and a
single shell must not run two gates at once (same rule as "stop `pnpm dev`
before `pnpm build`"). `QUIZHUB_BUILD_SLOTS=1` makes even that safe.

## Proving it

```bash
# what lane would this diff get, without running anything:
GATE_REF=origin/main bash -c 'source scripts/gate-lanes.sh; resolve_lane; echo "$LANE"'

# the classifier, per path:
bash -c 'source scripts/gate-lanes.sh; lane_of_path components/x.tsx'   # code

# two gates at once, one worktree each; watch the build step:
ps -eo pid,etimes,args | grep 'next build' | grep -v grep
```

Measured lane costs and how to re-measure them are in `docs/GATE.md`.

## What this does not fix

- **Stacked PRs over-classify.** A child branch based on a parent carries the
  parent's commits, so `origin/main...HEAD` can contain an `app/` change the
  child never made and the child pays the code lane. Always safe, sometimes
  slower; set `GATE_REF=<parent-tip>` when it matters.
- **CI does not use the lanes.** By design, see above: CI is the last gate and
  it runs everything.
- **The build is still 90 % of the code lane.** Lanes decide whether you pay
  for it; nothing here makes `next build` faster.
