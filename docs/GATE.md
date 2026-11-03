# The gate — one script, two callers

Issue: [#30](https://github.com/riolabs-ai/alignsynch/issues/30) (ORD 0).

Before this change the gate existed only as four `run:` lines in
`.github/workflows/ci.yml`. Every local check was optional, so the first time anyone learned
that `lint` or `format:check` failed was after the push. CI was 55 s a job then (144 s a run
on 2026-11-02 — the current numbers, dates and method are in [Baseline](#baseline-one-measured-block-and-how-to-re-derive-it));
the loop around it was 30–40 minutes. The cost was never CI speed, it was discovering the
failure in the wrong place.

## What exists now

| File                         | Role                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/verify.sh`          | the gate: `deps → glossary → typecheck → lint → format:check → data:check → test → build`, depth by lane, stops at the first failure and names it      |
| `.github/workflows/ci.yml`   | sets up pnpm + Node from `.nvmrc`, regenerates `docs/glossary.md` and fails on a diff (#138), then runs `bash scripts/verify.sh`. No other check steps |
| `scripts/git-hooks/pre-push` | execs `scripts/verify.sh`; no checks of its own                                                                                                        |
| `scripts/install-hooks.sh`   | `git config core.hooksPath scripts/git-hooks` — versioned hooks, no stale copies                                                                       |

`data:check` and `test` are conditional on `package.json` having that script. On `main`
today neither exists (they arrive with the content-model stack), so the gate prints
`○ data:check — skipped` rather than inventing a step. That is why the same script is
correct before and after those branches land: no edit to the gate as the stack merges.

Runtime parity: `.nvmrc` (`24`) and `pnpm 12.16.1` are enforced by the script's preflight,
not by documentation. A wrong runtime exits 1 before any step runs.

Markdown is formatter-gated too: Biome 2 formats `.md`, so a hand-wrapped doc can fail
`lint` before any code is touched. After editing `AGENTS.md` or `docs/`, run
`pnpm format --write` (or `pnpm exec biome format --write <file>`) before the gate.

## Lanes: the gate costs what the change costs

`scripts/verify.sh` classifies the diff against `origin/main` and prints
`lane=docs|content|config|code`. The lane picks **depth**, never the check context: a
docs-only change runs `git diff --check` + relative links + biome (~2 s), a `content/**`
change runs typecheck + `data:check` and **skips `next build`**, and only
`app|components|lib|hooks` pays for the build. `GATE_LANE=full bash scripts/verify.sh`
forces the full gate. CI still runs one job named `typecheck / lint / build`, and it
classifies in that job: `ci.yml` checks out full history and fetches `origin/main`, so
`GATE_REF` resolves there too. Without that ref the gate falls back to `lane=code` — which
is what every CI run did until `.github/workflows/ci.yml` was fixed, because
`actions/checkout`'s default depth-1 clone contains no `origin/main`.

`next build` is capped at `QUIZHUB_BUILD_SLOTS` (default 2) concurrent builds by `flock`
under `~/.cache/quizhub/`: eight workers compiling at once took load from ~6 to 39.5 and
stretched this gate to 145 s. The layer table, the classifier rules and the lock are in
**`docs/REPO-LAYERS.md`**.

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
here quoted 2026-10-29 as if it were current until this was fixed on 2026-11-03. That block is
not deleted: it is [Baseline history](#baseline-history), where it belongs.

### CI, measured 2026-11-03 over the 2026-11-02 window

```bash
python3 docs/gate-baseline.py --window 2026-11-02     # needs `gh` auth, nothing else
```

The script applies the window server-side —
`gh api repos/riolabs-ai/alignsynch/actions/workflows/ci.yml/runs?created=2026-11-02T00:00:00Z..2026-11-03T00:00:00Z`,
paged, with no `--limit` — then fetches `…/actions/runs/<id>/jobs` for every run it found.
`2026-11-02` is the last complete UTC day at measure time; `--since/--until` takes a longer one,
and no argument means yesterday. Verbatim output:

```
window: ci.yml runs created=2026-11-02T00:00:00Z..2026-11-03T00:00:00Z
runs: 190   head SHAs: 190
first-run conclusions: {'success': 185, 'cancelled': 4, 'failure': 1}
first-pass yield: 185/190 = 97.4%
  excluding cancelled: 185/186 = 99.5%
CI run incl. queue: p50 144s  p95 176s  (n=190)
CI job wall, per leg:
  typecheck / lint / build                     p50 3s  p95 11s  n=190
  typecheck / lint / build (alignsynch)        p50 124s  p95 149s  n=190
  typecheck / lint / build (quizhub)           p50 121s  p95 148s  n=190
runs per branch: 2.84 (190 runs / 67 branches)
```

Reading, in three parts, because the move from 55 s / 81.8 % to 144 s / 97.4 % is not one
event:

1. **The unit changed, so 144 s and 55 s are not the same measurement.** 55 s was one job on a
   one-job workflow. #171/#182 (2026-10-30) made CI run the gate once per brand as a matrix plus
   a `gate` aggregator that publishes the required context, so a run is now the slower of two
   legs plus ~20 s of queue. The comparable figure per leg is 121–124 s, not 144 s.
2. **The gate itself got slower, and the step table says where.** The quizhub leg of run
   `41504961129` (2026-11-02) spent 92.7 s inside `scripts/verify.sh`: `build` 38.6 s, `test`
   16.8 s, `typecheck` 16.5 s, `data:check` 8.4 s, `parity` 7.1 s. `test`, `data:check` and
   `parity` were skipped or did not exist on 2026-10-29, when the whole local gate was 44.8 s.
3. **`pnpm check:fast` (`3a9cd58`, 2026-11-02) cannot explain the duration move.** It adds a
   local script (`scripts/check-fast.mjs` + a `package.json` entry); no CI step calls it, so no
   CI number can depend on it. It is a plausible contributor to the _yield_ half, but the window
   either side of it is 97.1 % (137 runs before) → 98.1 % (53 runs after), which is one extra
   green run — not a signal at that sample size. The yield trend is 81.8 % (2026-10-29) →
   95.3 % (2026-11-01) → 97.4 % (2026-11-02): say "it moved across three days", not "one commit
   moved it".

### Local, measured 2026-11-03 (n=2)

`env -i HOME PATH CI=1 GATE_LANE=full bash scripts/verify.sh`, on this tree, Node 24.22.0 /
pnpm 12.16.1, 8-core host, `node_modules` cold on run 1 and warm on run 2. Both exit 0.

| Step                                       | run 1 (load 0.7) | run 2 (load 6.6) |
| ------------------------------------------ | ---------------- | ---------------- |
| deps (`pnpm install --frozen-lockfile`)    | 0.5 s            | 0.2 s            |
| glossary / ui-registry / release:check     | 0.8 s            | 0.8 s            |
| typecheck (`next typegen && tsc --noEmit`) | 29.0 s           | 6.2 s            |
| lint (`biome check` + brand classes)       | 2.4 s            | 3.3 s            |
| format:check                               | 0.4 s            | 0.4 s            |
| data:check                                 | 11.6 s           | 18.3 s           |
| demo:verify                                | 0.2 s            | 0.3 s            |
| test                                       | 21.2 s           | 18.4 s           |
| parity (both brands)                       | 21.2 s           | 14.7 s           |
| build (`next build`, flock slot)           | 63.8 s           | 74.4 s           |
| **total**                                  | **151.7 s**      | **137.6 s**      |

Two runs are not a p50 and are not reported as one. The load average belongs to the
measurement: the same gate was recorded at 145 s under eight-way contention
(`docs/REPO-LAYERS.md`, 2026-10-29) and at 176 s in `docs/ITERATION.md` (2026-11-02), so expect
±30 s before reading anything into a single run.

Budget: **CI < 4 min holds** (p95 176 s). **Local p50 < 90 s no longer does** — 138–152 s
measured above, `build` 64–74 s of it — and that ceiling was written for a 45 s gate
(2026-10-29, history below). The two honest ceilings are the ones `docs/ITERATION.md` states:
`pnpm check:fast` for the inner loop and the full gate as the boundary, at ≤ 3 min. Do not make
a step optional to buy time.

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

The 2026-10-29 rows are the gate's first day, and they are why the old yield read 81.8 %: 4 of
22 pushes needed a second look, and the failures were toolchain/docs branches — the cheapest
kind to catch locally. Every one of them was a check that CI ran and the developer's shell did
not.

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

This is the table that makes the current one readable: the same steps, 3–15× slower each,
because `test`, `data:check` and `parity` are now real work and `typecheck` compiles a much
larger tree.

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
python3 docs/gate-baseline.py --window 2026-11-02   # CI: p50/p95, yield, per-leg, from one window
python3 docs/gate-baseline.py --since 2026-11-01 --until 2026-11-03   # or a multi-day window
bash scripts/verify.sh                              # local; time it, and note the load average
```

None of these are gate steps: `gate-baseline.py` needs `gh` auth and network, and a gate step
that can fail for lack of either is not a gate.

Definitions the script implements, so a reader can re-derive any row by hand:

| Term             | Definition                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| run incl. queue  | `updated_at − created_at` per run — what a person waits for                                                                                         |
| job wall         | `started_at → completed_at` per job; the two brand legs are the work, the third job is the aggregator the ruleset requires                          |
| first-pass yield | head SHAs whose **first** run (earliest `created_at`) concluded `success` ÷ head SHAs that ran; `cancelled` is not green, and is reported both ways |
| p50 / p95        | nearest rank on the sorted sample, index ⌈q·n⌉ − 1                                                                                                  |

Rules that keep this file honest:

- A yield, p50 or p95 is written with **its measurement date and its window**, in that order.
  If a number cannot carry both, it is not written here.
- The local figure states **n** and the load average. One run is a run, not a p50.
- If first-pass yield drops below 70 %, the local gate is missing a step CI has, or the
  runtimes differ — check the parity preflight first, never add a CI step.
