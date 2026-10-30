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

| Layer                   | Paths                                                                                                                 | Gate depth                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Config / AI tooling** | `.github/**`, `scripts/**`, `AGENTS.md`, `biome.jsonc`, `tsconfig*.json`, `package.json`, `next.config.mjs`, `.nvmrc` | meta: `bash -n` every script, `pnpm install --frozen-lockfile`, biome over the tree; plus the content depth (see deviations)                                       |
| **Content + media**     | `content/**` (schema + invariants), `data/**` (fixtures), `public/**` (media)                                         | `tsc -p tsconfig.datacheck.json` + `node --test .datacheck/**` + `data-check.js` + `pnpm typecheck` — **no Next build**                                            |
| **Code / dev / deploy** | `app/**`, `components/**`, `lib/**`, `hooks/**`                                                                       | full gate incl. `next build`                                                                                                                                       |
| **Database**            | `db/**` (plain-SQL migrations) — `lib/db/**` is already inside `lib/**`                                               | classifies as **code** (no shortcut for a path the classifier does not know); the `db:*` scripts are **not** gate steps, so no lane ever needs a connection string |
| **Documentation**       | `docs/**`, `*.md`                                                                                                     | `git diff --check` + relative-link existence only                                                                                                                  |

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
| `glossary`           | ✓    | ✓       | ✓      | ✓    |
| `bash -n` scripts    |      |         | ✓      |      |
| `whitespace`         | ✓    |         |        |      |
| `links`              | ✓    |         |        |      |
| `typecheck`          |      | ✓       | ✓      | ✓    |
| `lint` (biome)       | ✓    | ✓       | ✓      | ✓    |
| `format:check`       | ✓    | ✓       | ✓      | ✓    |
| `data:check`         |      | ✓       | ✓      | ✓    |
| `test`               |      | ✓       | ✓      | ✓    |
| `parity`             |      | ✓       | ✓      | ✓    |
| `build` (next build) |      |         |        | ✓    |

`test` is `pnpm test` — `vitest run` over `tests/**/*.test.ts`, the app-side units
(card projection, promotion window, search index, media registry). It is a **second
runner** on purpose (#8): `data:check` keeps its `node --test` suite, because those
cases are compiled by `tsconfig.datacheck.json` _with the content model_ and prove the
fixtures that model describes, while vitest imports `lib/` and `data/` through the `@/`
alias with no build step and asserts what the pages actually render. ~1.3 s for 4 files
/ 36 cases, so it rides in every lane that already pays for `data:check` and never in
docs.

`parity` is `pnpm parity` — the seven routes in `tests/parity/routes.ts` rendered under
**both** brands and compared to committed snapshots (#171). It is a second process per
brand (`data/brand.ts` resolves `BRAND` at import, which is what makes a brand a build
constant), so the step is ~15 s. It rides in the same lanes as `test` for the same reason:
a `content/` or `data/` edit changes rendered text exactly as a component edit does, and a
lane that dropped it would hand a green local gate to a red CI run. The docs lane skips it
— no rendered output depends on prose. Updating a snapshot is `pnpm parity:update` and a
stated reason in the PR: [`tests/parity/README.md`](../tests/parity/README.md).

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
- **`glossary` runs in every lane.** `docs/glossary.md` is generated from the schema
  comments (#138), and the three things it reads classify into three different lanes —
  the page is `docs/`, the comments are `content/`, the generator is `scripts/`. A lane
  that dropped it would hand a green local gate to a stale page in CI, which is the loop
  this file exists to delete. It costs ~0.1 s, so it runs before the lane branch.
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

`ci.yml` runs the gate as **one job per brand** — `typecheck / lint / build (quizhub)` and
`typecheck / lint / build (alignsynch)` — and the required context is collected by a third job
named exactly **`typecheck / lint / build`**. Inside each brand's job the four lanes are still
internal depths of one script, not separate jobs:

- the repository ruleset requires that exact context. A **skipped** job never
  reports a context, so a `paths:`-filtered docs job would leave every docs PR
  waiting on a check that never arrives — a permanent red;
- a matrix leg has the same problem, which is why the matrix was not added until the
  aggregator existed: GitHub suffixes a leg's check-run name with its matrix values, so
  neither leg reports `typecheck / lint / build`. The `gate` job does — `needs: [verify]`
  with `if: always()` — and it runs no checks of its own. Renaming it, or giving it a
  step, breaks branch protection or duplicates the gate; neither is a rename;
- CI has no contention to relieve. The lanes were built because eight local
  workers compiling at once saturated this box; on a GitHub runner the win is
  the required check's wall time (19 s docs vs 59 s code, measured in
  `docs/GATE.md`), not throughput — which is another reason it belongs inside
  the job rather than in a second one.

**Why two brands (#171).** The repo ships two products from one tree and CI compiled one of
them, so "QuizHub is unchanged" was a convention nobody enforced. The matrix is one dimension
on the existing job — `BRAND` is the only thing that differs, exactly like a lane — and both
legs run `bash scripts/verify.sh` unchanged. `fail-fast: false` because a red lane is only
informative next to the other one. Wall time is one build's, not two: the legs run in
parallel. The cost is runner minutes, and the alternative is a brand that breaks silently.


On CI `auto` could not classify at all until the `ci.yml` checkout was fixed,
and that failure mode is worth keeping in view: `actions/checkout` fetches a
single commit by default, so `origin/main` did not exist in the clone, `GATE_REF`
never resolved, and every run logged

```
 lane=code (app/**, components/**, lib/**, hooks/** (and anything unclassified) — no origin/main to diff against — full gate (conservative))
```

`ci.yml` now checks out with `fetch-depth: 0` and explicitly fetches
`+refs/heads/main:refs/remotes/origin/main` before setting up pnpm, so the
three-dot diff has both the ref and a merge base. The fallback is unchanged and
is the reason the old behaviour was safe rather than silent: no ref, no
computable diff, or an empty diff still means `lane=code` and the full gate. A
`push` to `main` lands exactly there — `HEAD` _is_ `origin/main`, so the diff is
empty and the post-merge run pays for everything. That is deliberate: the PR
run is where the flake-free lane evidence exists, and the merge head is not a
place to buy speed.

The fetch step is not fatal if it fails: it prints a `::warning` and the gate
falls back to the full gate. A red run on a network hiccup would be a worse
trade than the 60 s of build it saves.

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
- **CI classifies against `origin/main`, not against the PR's base branch.** A
  stacked PR therefore over-classifies in CI exactly the way it does locally,
  and a `push` to `main` has an empty diff, so the post-merge run still pays for
  the full gate.
- **The build is still 90 % of the code lane.** Lanes decide whether you pay
  for it; nothing here makes `next build` faster.
