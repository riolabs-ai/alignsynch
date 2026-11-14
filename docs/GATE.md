# The gate — one script, two callers

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Start here** › The gate · prev [Release-train card template](templates/RELEASE-TRAIN.md)

<!-- docs-nav:end -->

Issue: [#30](https://github.com/riolabs-ai/alignsynch/issues/30) (ORD 0).

Before this change the gate existed only as four `run:` lines in
`.github/workflows/ci.yml`. Every local check was optional, so the first time anyone learned
that `lint` or `format:check` failed was after the push. CI was 55 s a job then (a run on
2026-11-04 is 138 s a leg and 156 s end to end — the current numbers, dates and method are in
[Baseline](#baseline-one-measured-block-and-how-to-re-derive-it));
the loop around it was 30–40 minutes. The cost was never CI speed, it was discovering the
failure in the wrong place.

## What exists now

| File                         | Role                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/verify.sh`          | the gate: `deps → glossary → typecheck → lint → format:check → data:check → test → build`, depth by lane, stops at the first failure and names it      |
| `.github/workflows/ci.yml`   | sets up pnpm + Node from `.nvmrc`, regenerates `docs/glossary.md` and fails on a diff (#138), then runs `bash scripts/verify.sh`. No other check steps |
| `scripts/git-hooks/pre-push` | execs `scripts/verify.sh`; no checks of its own                                                                                                        |
| `scripts/install-hooks.sh`   | `git config core.hooksPath scripts/git-hooks` — versioned hooks, no stale copies                                                                       |

`data:check` and `test` are conditional on `package.json` having that script. Both exist on
`main` today, so the gate runs both (`data:check` 11.6–13.6 s, `test` 15.7–18.3 s locally on
2026-11-05); the condition is what kept the same script correct on the tree that predated them —
it printed `○ data:check — skipped` rather than inventing a step, so no edit to the gate was
needed as the content-model stack merged.

Runtime parity: `.nvmrc` (`24`) and `pnpm 12.16.1` are enforced by the script's preflight,
not by documentation. A wrong runtime exits 1 before any step runs.

Markdown is formatter-gated too: Biome 2 formats `.md`, so a hand-wrapped doc can fail
`lint` before any code is touched. After editing `AGENTS.md` or `docs/`, run
`pnpm format --write` (or `pnpm exec biome format --write <file>`) before the gate.

## Lanes: the gate costs what the change costs

`scripts/verify.sh` classifies the diff against `origin/main` and prints
`lane=docs|content|config|code`. The lane picks **depth**, never the check context: a
docs-only change runs `git diff --check` + biome (~2 s), a `content/**`
change runs typecheck + `data:check` and **skips `next build`**, and only
`app|components|lib|hooks` pays for the build. `GATE_LANE=full bash scripts/verify.sh`
forces the full gate. CI still runs one job named `typecheck / lint / build`, and it
classifies in that job: `ci.yml` checks out full history and fetches `origin/main`, so
`GATE_REF` resolves there too. Without that ref the gate falls back to `lane=code` — which
is what every CI run did until `.github/workflows/ci.yml` was fixed, because
`actions/checkout`'s default depth-1 clone contains no `origin/main`.

A worktree pays the same way, so the base is now **resolved by the gate itself** before it
classifies: the local ref, else one bounded `git fetch --no-tags origin main` (no checkout, no
pull, no branch, 10 s timeout, skipped when there is no usable `origin` or the git dir is
read-only), else the full gate. The lane line names the sha and how it was resolved —
`base origin/main@2742e2d (local ref)` / `(fetched in 0.4s)` — and a fetch or a fallback prints
its own line, so the conservative gate is never silent. A failed fetch is a reason to run more
gate, never a reason to fail it. Mechanics and the shallow-repository rule (a `--depth=1` fetch
into a full clone would truncate the shared history _and_ destroy the merge base the diff needs):
`docs/REPO-LAYERS.md`; the cases are pinned in `tests/gate-lanes-base.test.ts`.

`next build` is capped at `QUIZHUB_GATE_SLOTS` (default 3) concurrent gate runs by `flock`
under `~/.cache/quizhub/`, and that slot now covers the whole heavy section — typecheck,
lint, `format:check`, the `data:check` compile, `parity` and the build — not the build alone:
eight workers compiling at once took load from ~6 to 39.5 and stretched this gate to 145 s.
The layer table, the classifier rules and the slot are in **`docs/REPO-LAYERS.md`**.

## Lanes in CI, measured 2026-10-30

A lane is a diff, and a diff needs a base ref. CI had none: `actions/checkout` fetches one
commit by default, so `origin/main` did not exist in the clone, `GATE_REF` never resolved,
and **every** run — docs or code — logged the conservative fallback:

```
 lane=code (app/**, components/**, lib/**, hooks/** (and anything unclassified) — no origin/main to diff against — full gate (conservative))
```

`ci.yml` now checks out with `fetch-depth: 0` and fetches `refs/heads/main` before the gate
(the mechanism is in `docs/REPO-LAYERS.md`), so the same job classifies the same way it does
locally. Measured job wall time, GitHub `ubuntu-24.04` runner, pnpm cache warm:

| PR head                   | lane                    | job wall |
| ------------------------- | ----------------------- | -------- |
| `wt/fix-metadata-title`   | code (fallback, no ref) | 73 s     |
| `wt/fix-ci-lane-classif…` | config                  | 33 s     |
| `probe/lane-code`         | code                    | 59 s     |
| `docs/ci-lane-evidence`   | docs                    | 19 s     |

Reading: the same one-job workflow spends 59 s on a code PR (build 25.7 s of it) and 19 s on
a docs-only PR, where the build is skipped outright. The first row is the old behaviour for
comparison — every run paid it, because the base ref was never there.

The fallback is still the floor, not a shortcut. A `push` to `main` proves it: `HEAD` _is_
`origin/main` there, so the diff is empty and the post-merge run logs

```
 lane=code (app/**, components/**, lib/**, hooks/** (and anything unclassified) — no changed files vs origin/main — full gate)
```

and pays the full gate (~70 s). A missing ref or an uncomputable diff lands in the same place.

## Baseline: one measured block, and how to re-derive it

Every number in this section carries **the date it was measured and the window it covers**.
A yield, a p50 or a p95 without both is a memory, not a baseline — the block that used to sit
here quoted 2026-10-29 as if it were current until that was fixed on 2026-11-03, and the block
that replaced it quoted 2026-11-02 until this was re-measured on **2026-11-05 over the
2026-11-04 window**. Neither is deleted: both are rows in
[Baseline history](#baseline-history), and the method for every figure below is the command
printed above it.

### CI, measured 2026-11-05 over the 2026-11-04 window

```bash
python3 docs/gate-baseline.py --window 2026-11-04     # needs `gh` auth, nothing else
```

The script applies the window server-side —
`gh api repos/riolabs-ai/alignsynch/actions/workflows/ci.yml/runs?created=2026-11-04T00:00:00Z..2026-11-05T00:00:00Z`,
paged, with no `--limit` — then fetches `…/actions/runs/<id>/jobs` for every run it found.
`2026-11-04` is the last complete UTC day at measure time; `--since/--until` takes a longer one,
and no argument means yesterday. Verbatim output:

```
window: ci.yml runs created=2026-11-04T00:00:00Z..2026-11-05T00:00:00Z
runs: 50   head SHAs: 50
first-run conclusions: {'success': 50}
first-pass yield: 50/50 = 100.0%
  excluding cancelled: 50/50 = 100.0%
CI run incl. queue: p50 156s  p95 1440s  (n=50)
CI job wall, per leg:
  typecheck / lint / build                     p50 3s  p95 5s  n=50
  typecheck / lint / build (alignsynch)        p50 138s  p95 160s  n=50
  typecheck / lint / build (quizhub)           p50 137s  p95 159s  n=50
runs per branch: 2.27 (50 runs / 22 branches)
```

**`updated_at` is not always the wait, and on this window it is not.** That p95 of 1440 s is a
real field value, not a gate time: 6 of the 50 runs finish every job they have inside three
minutes and then carry an `updated_at` 12–26 min later, and
`…/actions/runs/<id>/jobs` reports `total_count: 3` for each of them — there is no fourth job
behind the tail. Measuring the same 50 runs to their **last job** instead:

```bash
# run to last job = max(jobs[].completed_at) - run created_at, nearest rank (ceil(q*n))
gh api -X GET repos/riolabs-ai/alignsynch/actions/workflows/ci.yml/runs \
  -f created=2026-11-04T00:00:00Z..2026-11-05T00:00:00Z -f per_page=100 \
  --jq '.workflow_runs[] | [.id, .created_at] | @tsv' |
  while IFS=$'\t' read -r id created; do
    epoch="$(date -u -d "$created" +%s)"
    gh api -X GET "repos/riolabs-ai/alignsynch/actions/runs/$id/jobs" -f per_page=100 \
      --jq "([.jobs[].completed_at | fromdateiso8601] | max) - $epoch | floor"
  done | sort -n | awk '{a[NR]=$1} END {
    n=NR
    i5=int(0.5*n); if (i5 < 0.5*n) i5++
    i95=int(0.95*n); if (i95 < 0.95*n) i95++
    printf "n=%d  p50=%ds  p95=%ds  max=%ds\n", n, a[i5], a[i95], a[n]
  }'
```

```
n=50  p50=154s  p95=176s  max=178s
```

Reading, in four parts:

1. **A run is 138 s a leg, and 156 s end to end.** The two brand legs are the work — alignsynch
   p50 138 s, quizhub p50 137 s — and the `typecheck / lint / build` job the ruleset matches on
   is the aggregator at p50 3 s. The 55 s figure in history is one job on a one-job workflow;
   the comparable number today is the leg, not the run.
2. **Inside the leg, the runner is ~13–19 s and `scripts/verify.sh` is 96–127 s.** On run
   `41857429894` (2026-11-04) the quizhub leg was 98 s (verify 81 s) and the alignsynch leg
   144 s (verify 125 s) on the same commit — the two legs differ by runner variance, not by
   brand cost. `gh api …/actions/runs/<id>/jobs` carries that per-step split.
3. **The tail is bookkeeping, not queue.** Runner queue (`started_at − created_at`) is p50 3 s,
   p95 4 s, max 6 s across the window, and no run carries an unlisted job; the 12–26 min tail
   lives in `updated_at` only. Read 176 s as the wait, and 1440 s as the field.
4. **100 % is 50 runs on a quiet day, not a new normal.** All 50 are attempt 1 over 22 branches —
   a far smaller sample than 2026-11-02's 190 runs on a release day. The yield trend is 81.8 %
   (2026-10-29) → 95.3 % (2026-11-01) → 97.4 % (2026-11-02) → 100.0 % (2026-11-04): say "it moved
   across four days", not "one commit moved it".

### Local, measured 2026-11-05 (n=2)

`env -i HOME PATH CI=1 GATE_LANE=full bash scripts/verify.sh`, on this worktree, Node 24.22.0 /
pnpm 12.16.1, 8-core host, `node_modules` and `.next` warm. Both exit 0. The load average is read
immediately before each run and belongs to the measurement — this host also runs other agents'
builds.

| Step                                       | run 1 (load 3.05) | run 2 (load 5.11) |
| ------------------------------------------ | ----------------- | ----------------- |
| deps (`pnpm install --frozen-lockfile`)    | 0.0 s             | 0.1 s             |
| glossary / ui-registry / release:check     | 0.6 s             | 0.6 s             |
| typecheck (`next typegen && tsc --noEmit`) | 4.4 s             | 4.8 s             |
| lint (`biome check` + brand classes)       | 1.9 s             | 2.2 s             |
| format:check                               | 0.4 s             | 0.4 s             |
| data:check                                 | 11.6 s            | 13.6 s            |
| demo:verify                                | 0.1 s             | 0.1 s             |
| test                                       | 15.7 s            | 18.3 s            |
| parity (both brands)                       | 9.2 s             | 11.6 s            |
| build (`next build`, flock slot)           | 51.2 s            | 72.4 s            |
| **total**                                  | **95.7 s**        | **124.7 s**       |

Two runs are not a p50 and are not reported as one. Almost all of the 29 s spread is `build`
(51.2 → 72.4 s): both runs took a free build slot immediately, so that is host contention —
load 3.05 → 5.11 — not the `flock` wait. Expect ±30 s before reading anything into a single run;
the same gate has been recorded at 145 s under eight-way contention (`docs/REPO-LAYERS.md`,
2026-10-29) and at 176 s in `docs/ITERATION.md` (2026-11-02).

### Lanes, measured 2026-11-05 (n=2 each)

A lane is a diff, so measuring one means handing the classifier one file to see. An untracked
file is enough (`git ls-files --others` is part of the diff it reads); it is removed right after
the run, and the lane the gate prints in its banner and its summary is the lane under test.

```bash
: > content/__lane_probe__.ts     # or docs/.lane-probe, or scripts/.lane-probe
bash scripts/verify.sh            # banner: lane content · summary: the steps that lane runs
rm content/__lane_probe__.ts
```

| Lane      | Probe                       | Gate total, run 1 / run 2 | `build`       | Skips                                      |
| --------- | --------------------------- | ------------------------- | ------------- | ------------------------------------------ |
| `docs`    | `docs/.lane-probe`          | 3.3 s / 3.3 s             | —             | typecheck, data:check, test, parity, build |
| `content` | `content/__lane_probe__.ts` | 70.7 s / 45.9 s           | —             | build                                      |
| `config`  | `scripts/.lane-probe`       | 44.3 s / 46.0 s           | —             | build                                      |
| `code`    | `GATE_LANE=full`            | 95.7 s / 124.7 s          | 51.2 / 72.4 s | nothing — `build` is 54 % and 58 % of it   |

Two readings:

- **The docs lane is 3.3 s because it runs almost nothing.** One skip and nine executed steps:
  `lint` 2.1 s is two-thirds of the total, and `format:check`, `whitespace` and the shared drift
  checks that run in every lane (`glossary`, `ui-registry`, `release:check`, `changelog:check`,
  `docs:check`) make up the rest. No compiler, no browser, no build. `docs:check` sits where the old
  `links` step sat, in the same lane and every other one: it resolves every relative link and image
  in the checkout instead of only the markdown the branch happened to touch, and it costs 0.17 s.
- **`content` is no longer cheaper than `config`.** Both pay `typecheck`, `data:check`, `test` and
  `parity`; only the build differs, and neither runs it. The 70.7 s first `content` run is a cold
  Next typegen cache (`typecheck` 25.5 s vs 5.1 s warm), not a lane difference.

The budget rows in `scripts/verify.sh`'s header (`docs` 1–2 s, `content` 16–30 s, `config` 20–31 s,
`code` 65–82 s) were measured before `test`, `parity` and `demo:verify` joined the gate and now
understate all four. They are left as they are here: this change is `docs/` only, and a stale
comment is a smaller defect than an untested edit to the gate.

### The shared build cache, measured 2026-11-12

`.next` is per-worktree, so `next build`'s Turbopack cache — `<distDir>/cache/turbopack/<version>`,
the path `next/dist/lib/turbopack-cache-seed.js` names — was per-worktree as well, and every worktree
started cold: 70 worktrees held 64 separate `.next` caches totalling 27 GB. `tsconfig.json` is
`incremental`, but the buildinfo it writes is per-tree too, so `tsc --noEmit` was cold on every card.

`scripts/build-cache.mjs` keeps both under `~/.cache/quizhub/`, keyed by a hash of the `next`
version, the `typescript` version, the Node major and the `pnpm-lock.yaml` digest, so a bump lands on
a different directory and misses rather than half-hitting. `link` points `.next/cache` at the shared
directory while the build slot is held, and `unlink` puts an empty real directory back afterwards, so
a dev server never opens the store a gate build holds. Every directory carries a `.cache-key`
sentinel, and a directory whose sentinel does not match is deleted, never read.

```bash
node scripts/build-cache.mjs status          # key, paths, sizes
time GATE_LANE=full bash scripts/verify.sh   # cold, then the same command again warm
```

| Same head, 8-core host under fleet load (2026-11-12) | cold        | warm       |
| ---------------------------------------------------- | ----------- | ---------- |
| `typecheck` (`next typegen` + the shared buildinfo)  | 29.7 s      | 5.6 s      |
| `build` (`next build`, flock slot)                   | 54.0 s      | 12.9 s     |
| **gate total**                                       | **146.9 s** | **84.1 s** |

The cold run is a **deliberate full miss**: the shared directory's `.cache-key` was overwritten with
`corrupted-key-do-not-trust` and one 100 MB RocksDB `.sst` was replaced with text. The step printed
`build cache: slot 1 · key … · poisoned, wiped`, rebuilt everything and went green — an untrustworthy
cache costs one build, never a verdict. Two further probes, in a second worktree that had never built
(`git worktree add --detach`, `pnpm install --frozen-lockfile`):

- that tree built in **31.8 s** (`Compiled successfully in 11.1 s`) off the directory the first tree
  filled, and `du -sh ~/.cache/quizhub/next/<key>/` stayed **one** directory — 274 MB for both
  trees, against 232 MB per tree when each kept its own;
- editing a component after a warm build changed the compiled output (the marker appeared in 136
  server chunks and then disappeared when it moved), and a deliberate `TS2322` in `lib/utils.ts`
  failed both `pnpm typecheck` and `pnpm build`. A warm cache hides neither an edit nor a type error.

Slot 1 uses the key's own directory and the other slots use siblings (`<key>/slot-N/`), because the
store is a single-writer RocksDB: a second concurrent opener fails rather than merges. The slot number
comes from the gate slot the run is holding (`QUIZHUB_GATE_SLOTS`, legacy `QUIZHUB_BUILD_SLOTS`
honoured), so the cache grows with the slot count, not with the number of worktrees.

### The three type-check passes, measured 2026-11-13

A code-lane diff was type-checked twice and type-generated in front of both: `pnpm typecheck`
(`next typegen && tsc --noEmit`) and the check `next build` runs itself
(`next/dist/lib/typescript/runTypeCheck.js`, one `Running TypeScript ...` line). The question was
whether one of the two can go. Measured on one head (`fab204aa`, node 24.22.0, pnpm 12.16.1,
worktree `t_885ce160`) while this host ran the fleet's other gates, so the load average is recorded
beside each row and **user CPU is the figure to compare** — wall clock moves with the neighbours:

| Pass                                                                 | user CPU | sys    | wall    | load |
| -------------------------------------------------------------------- | -------- | ------ | ------- | ---- |
| `next typegen` alone, cold `.next/types`                             | 1.3 s    | 0.2 s  | 2.1 s   | 18.4 |
| `tsc --noEmit` alone, cold buildinfo                                 | 74.2 s   | 1.9 s  | 65.4 s  | 14.7 |
| `tsc --noEmit` alone, "warm" buildinfo in `~/.cache/quizhub/tsc/`    | 81.2 s   | 2.1 s  | 151.6 s | 19.5 |
| `next build`, type check **on**, cold Turbopack cache                | 201.6 s  | 10.3 s | 131.8 s | 14.7 |
| `next build`, `typescript.ignoreBuildErrors` (throwaway config only) | 127.4 s  | 8.3 s  | 53.1 s  | 20.0 |

Five readings:

- **`next typegen` is not a compile pass.** It writes the route types under `.next/types` in ~2 s and
  `tsc` needs them, so it is not a candidate for removal.
- **Both checks are total.** Three errors were planted at once — in `lib/utils.ts` (imported by the
  whole app), in a file nothing imports, and in a `*.test.ts` file that `runTypeCheck`'s own
  test-file diagnostic filter might have been expected to swallow. `pnpm typecheck` exited 2 and
  `next build` exited 1 with `Failed to type check.`, and **both named all three**, each with its own
  `error TS2322`. The probes were reverted (`git status` clean) and nothing was committed.
- **The build's own check costs ~74 s of user CPU** (201.6 s against 127.4 s with the check off), the
  same order as the standalone pass — the duplication is real, not a rounding error.
- **Neither pass can be dropped without buying the time with something this repo refuses.** Dropping
  `pnpm typecheck` takes the only type verdict away from the `content` and `config` lanes, which skip
  the build; dropping the build's check needs `typescript.ignoreBuildErrors: true` committed in
  `next.config.mjs`. And they are not identical: the build filters `.next/dev/types` out of its
  program while `tsconfig.json` includes them, so the standalone pass is the superset — the one that
  would have to stay.
- **The private `tsc` buildinfo buys nothing.** A warm `~/.cache/quizhub/tsc/<key>/` run measured
  81.2 s user against 74.2 s cold. `next typegen` rewrites the route types ahead of every `pnpm
  typecheck`, so the program the previous run recorded no longer matches. That is a real finding
  about the old cache, and it is why the next paragraph matters.

**So the build was made to resume from the pass the gate already runs, instead of repeating it.** The
standalone `tsc` now writes its buildinfo where `next build` reads its own — `<distDir>/cache/.tsbuildinfo`
— which `scripts/build-cache.mjs` names as `layout().buildTypeCheckArg`, and `scripts/verify.sh` links
`.next/cache` at the held slot around the typecheck so that path lands in the shared store. Nothing is
skipped: the build still runs its own check, on its own file list, and still fails on anything new.
Measured on a warm Turbopack cache and one unchanged tree:

| `next build` …                                              | user CPU | wall   |
| ----------------------------------------------------------- | -------- | ------ |
| with no buildinfo at all                                    | 92.6 s   | 64.0 s |
| right after `pnpm typecheck` wrote the build's buildinfo    | 32.3 s   | 16.1 s |
| the same, through `pnpm typecheck` (the gate's own command) | 33.4 s   | 20.5 s |
| with a new `TS2322` planted after that buildinfo was warm   | 75.0 s   | 69.5 s |

The last row is the one that matters: a warm buildinfo written by the typecheck **does not hide a new
error** — the build failed, named `lib/utils.ts(9,14): error TS2322` and printed `Failed to type
check.` The savings come from the incremental program, not from a skipped check.

One trap worth recording, because it cost an afternoon: the buildinfo records its file list relative
to **the path it was written at**, so `--tsBuildInfoFile` must be the relative
`.next/cache/.tsbuildinfo` resolved from the repo root. Handing `tsc` the resolved cache directory
writes the same program to a 851,686-byte file that `next build` rejects — 76.3 s, a full re-check,
with no error and nothing in the log to say why. Through `.next/cache` the file is 738,846 bytes and
the build accepts it. If a future change to `next` moves that path, the symptom is the build quietly
going back to its old self, never a wrong verdict.

### Budget

**CI < 4 min holds** (p95 176 s to the last job; the 1440 s `updated_at` p95 is explained above).
**Local p50 < 90 s no longer does** — 96–125 s measured above, `build` 51–72 s of it — and that
ceiling was written for a 45 s gate (2026-10-29, history below). The two honest ceilings are the
ones `docs/ITERATION.md` states: `pnpm check:fast` for the inner loop and the full gate as the
boundary, at ≤ 3 min. Do not make a step optional to buy time.

**The shared build cache puts the local gate back inside 90 s** — 84.1 s warm, one measurement
(2026-11-12, section above) — and it buys that without dropping a check: the same steps, the same
flags, the same lanes. CI is unaffected, because a runner starts with an empty `~/.cache`.

## Baseline history

Kept because it is what the gate cost when it was smaller, and because "55 s / 81.8 %" is
still quoted in older notes. **Nothing here is current.**

| Date measured | What                                                                    | Value                                                                  |
| ------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 2026-10-29    | CI job p50 / p95 — one-job workflow, 22 runs, 22 head SHAs, 15 branches | 55 s / 64 s (n=10)                                                     |
| 2026-10-29    | First-pass yield, same runs                                             | 18/22 = 81.8 % (18/21 = 85.7 % excluding the one cancelled)            |
| 2026-10-29    | Retries                                                                 | 0.47 (22 runs over 15 branches)                                        |
| 2026-10-29    | Failures                                                                | 3 red, 1 cancelled — all on `toolchain/` and `feat/b01-quiz-promotion` |
| 2026-10-29    | Local gate, n=3, 7-core host                                            | 44.8 s total (37.5 / 44.8 / 49.6), `build` 40.5 s                      |
| 2026-10-30    | CI job wall, one job, measured before the brand matrix landed that day  | 59 s code / 19 s docs                                                  |
| 2026-11-01    | CI run incl. queue, window 2026-11-01, n=106                            | p50 125 s / p95 138 s                                                  |
| 2026-11-01    | First-pass yield, same window                                           | 101/106 = 95.3 % (101/103 = 98.1 % excluding cancelled)                |
| 2026-11-02    | CI run incl. queue, window 2026-11-02, n=190                            | p50 144 s / p95 176 s                                                  |
| 2026-11-02    | CI job wall per leg, same window                                        | alignsynch p50 124 s / quizhub p50 121 s, aggregator p50 3 s           |
| 2026-11-02    | First-pass yield, same window                                           | 185/190 = 97.4 % (185/186 = 99.5 % excluding cancelled)                |
| 2026-11-02    | Retries, same window                                                    | 2.84 (190 runs over 67 branches)                                       |
| 2026-11-02    | Local full gate, n=2, 8-core host                                       | 151.7 s / 137.6 s, `build` 63.8 / 74.4                                 |
| 2026-11-12    | Local full gate, cold / warm **shared** Turbopack + `tsc` cache         | 146.9 s / 84.1 s, `build` 54.0 / 12.9                                  |

The 2026-10-29 rows are the gate's first day, and they are why the old yield read 81.8 %: 4 of
22 pushes needed a second look, and the failures were toolchain/docs branches — the cheapest
kind to catch locally. Every one of them was a check that CI ran and the developer's shell did
not.

### 2026-11-02: why 144 s / 97.4 % was not one event (measured 2026-11-03, n=190)

1. **The unit changed, so 144 s and 55 s are not the same measurement.** 55 s was one job on a
   one-job workflow. #171/#182 (2026-10-30) made CI run the gate once per brand as a matrix plus
   a `gate` aggregator that publishes the required context, so a run became the slower of two
   legs plus queue. The comparable figure per leg was 121–124 s, not 144 s.
2. **The gate itself got slower, and the step table says where.** The quizhub leg of run
   `41504961129` (2026-11-02) spent 92.7 s inside `scripts/verify.sh`: `build` 38.6 s, `test`
   16.8 s, `typecheck` 16.5 s, `data:check` 8.4 s, `parity` 7.1 s. `test`, `data:check` and
   `parity` were skipped or did not exist on 2026-10-29, when the whole local gate was 44.8 s.
3. **`pnpm check:fast` (`3a9cd58`, 2026-11-02) cannot explain the duration move.** It adds a
   local script (`scripts/check-fast.mjs` + a `package.json` entry); no CI step calls it, so no
   CI number can depend on it. It is a plausible contributor to the _yield_ half, but the window
   either side of it is 97.1 % (137 runs before) → 98.1 % (53 runs after), which is one extra
   green run — not a signal at that sample size.

### 2026-10-29, the local gate before the matrix (n=3)

Node 24.22.0 / pnpm 12.16.1, 7-core host, warm `node_modules` and warm Next cache:

| Step                                       | p50               |
| ------------------------------------------ | ----------------- |
| deps (`pnpm install --frozen-lockfile`)    | 0.0 s             |
| typecheck (`next typegen && tsc --noEmit`) | 3.8 s             |
| lint (`biome check`)                       | 0.4 s             |
| format:check                               | 0.2 s             |
| data:check                                 | skipped on `main` |
| test                                       | skipped on `main` |
| build (`next build`)                       | 40.5 s            |
| **gate total**                             | **44.8 s**        |

A cold clone (fresh `git clone`, no `node_modules`, no Next cache) ran the same gate green in
**43 s** — the install was 0.7 s off the shared pnpm store.

The `lint` row is the biome-only step. Since #187 stage 4 the step is
`pnpm lint` = `biome check && node scripts/lint-brand-classes.mjs`, which bans the
indigo/purple/violet palette steps and `bg-gradient-*` utilities under `components/` and `app/`
(no allowlist; `scripts/brand-classes.mjs` is the rule, `--self-test` runs in every invocation)
and measured **1.6–2.6 s** for the pair across three `lane=code` gate runs on 2026-10-30.

CI on that tree: the first post-change run was **1 m 0 s** end to end, of which the script
itself was **43.6 s** (`data:check` and `test` skipped there too). The extra ~17 s was runner
setup.

This is the table that makes the current one readable: `data:check`, `test` and `parity` went from
skipped-or-absent to 8.4 s / 16.8 s / 7.1 s in CI (11.6–18.3 / 15.7–18.3 / 9.2–14.7 s locally
across the 2026-11-02 and 2026-11-05 runs), `typecheck` went 3.8 s → 4.4 s warm and 25.5–29.0 s
cold, and `build` 40.5 s → 51–74 s.

## Negative controls (each run against this tree, then reverted)

| Probe                                        | Result                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `const __gateProbe: number = "not a number"` | stopped at `typecheck`, exit 2, step named                                                                                                 |
| deliberately misformatted file               | stopped at `lint`, exit 1 — `biome check` includes the formatter, so `format:check` is an explicit backstop that `lint` normally pre-empts |
| `.nvmrc` flipped to `20` while on Node 24    | preflight exit 1, `✗ runtime parity`, zero steps run                                                                                       |

## Required checks: enforced by a ruleset, and the 404 that hid it

`main` **is** protected and the check **is** required — but not by classic branch protection.
The endpoint everyone reaches for answers 404, which reads as "nothing configured":

```
gh api repos/riolabs-ai/alignsynch/branches/main/protection   -> 404 Not Found
```

The rules live in a repository **ruleset** (`target: branch`, `conditions: ~DEFAULT_BRANCH`,
`enforcement: active`), which that endpoint does not report at all:

```bash
gh api repos/riolabs-ai/alignsynch/rules/branches/main
#   required_status_checks -> context "typecheck / lint / build", integration_id 15368,
#                             strict_required_status_checks_policy: true
#   plus deletion and non_fast_forward (no force-push, no branch delete)
```

`integration_id 15368` is the GitHub Actions app, which is the app that emits this job's
check-run — the context alone would not be enough if an unrelated app ever published a check
with the same name. Strict policy means the branch must also be up to date with `main` before
merging, so a stale branch re-runs the gate instead of merging on an old head.

Two consequences worth keeping:

- **The job name is load-bearing.** Required checks match on `typecheck / lint / build`, so
  renaming the job silently drops the requirement while everything still looks green. That is
  why the job keeps its old name even though the step list now lives in `scripts/verify.sh`.
- **Proven, not assumed.** PR #19 (`opstest/required-check-probe`) was a deliberate red probe:
  broken type, `typecheck / lint / build` → `failure` (app 15368), closed unmerged. A rule that
  has never rejected anything is a rumour; this one has.

Re-verify enforcement (needs a repo admin to _change_, but anyone can read it):

```bash
gh api repos/riolabs-ai/alignsynch/rules/branches/main \
  --jq '.[] | select(.type=="required_status_checks") | .parameters.required_status_checks'
gh api repos/riolabs-ai/alignsynch/rulesets/26115314 --jq '{name,enforcement,conditions}'
```

## Re-measuring

```bash
python3 docs/gate-baseline.py --window 2026-11-04   # CI: p50/p95, yield, per-leg, from one window
python3 docs/gate-baseline.py --since 2026-11-01 --until 2026-11-05   # or a multi-day window
bash scripts/verify.sh                              # local; time it, and note the load average
: > content/__lane_probe__.ts && bash scripts/verify.sh; rm content/__lane_probe__.ts   # one lane
```

The run-to-last-job variant of the CI figures (the `updated_at` caveat in the current block) is the
`gh api` loop printed under it; it is not a script in this repo, because a number that needs `gh`
auth can never be a gate step.

None of these are gate steps: `gate-baseline.py` needs `gh` auth and network, and a gate step
that can fail for lack of either is not a gate.

Definitions the script implements, so a reader can re-derive any row by hand:

| Term             | Definition                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| run incl. queue  | `updated_at − created_at` per run — what a person waits for, except when `updated_at` carries a bookkeeping tail (2026-11-04: 6 of 50 runs, 12–26 min) |
| run to last job  | `max(jobs[].completed_at) − created_at` per run — the same wait, with the bookkeeping tail removed; the lower bound when the two disagree              |
| job wall         | `started_at → completed_at` per job; the two brand legs are the work, the third job is the aggregator the ruleset requires                             |
| runner queue     | `started_at − created_at` per job — seconds before a runner picked the job up; excludes the run's own dispatch                                         |
| first-pass yield | head SHAs whose **first** run (earliest `created_at`) concluded `success` ÷ head SHAs that ran; `cancelled` is not green, and is reported both ways    |
| p50 / p95        | nearest rank on the sorted sample, index ⌈q·n⌉ − 1                                                                                                     |

Rules that keep this file honest:

- A yield, p50 or p95 is written with **its measurement date and its window**, in that order.
  If a number cannot carry both, it is not written here.
- The local figure states **n** and the load average. One run is a run, not a p50.
- When `updated_at − created_at` and run-to-last-job disagree by more than a minute on a window,
  report both and say which is which. A field is not a wait.
- If first-pass yield drops below 70 %, the local gate is missing a step CI has, or the
  runtimes differ — check the parity preflight first, never add a CI step.

## Related

- [REPO-LAYERS.md](REPO-LAYERS.md) — which of the four lanes a diff lands in, and why the gate costs what it costs.
- [ITERATION.md](ITERATION.md) — the inner loop and the cohort boundary this gate sits at.

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Start here** › The gate · prev [Release-train card template](templates/RELEASE-TRAIN.md)

<!-- docs-nav:end -->
