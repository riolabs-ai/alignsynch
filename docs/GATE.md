# The gate — one script, two callers

Issue: [#30](https://github.com/riolabs-ai/alignsynch/issues/30) (ORD 0).

Before this change the gate existed only as four `run:` lines in
`.github/workflows/ci.yml`. Every local check was optional, so the first time anyone learned
that `lint` or `format:check` failed was after the push. CI is ~55 s; the loop around it was
30–40 minutes. The cost was never CI speed, it was discovering the failure in the wrong place.

## What exists now

| File                         | Role                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `scripts/verify.sh`          | the whole gate: `deps → typecheck → lint → format:check → data:check → test → build`, stops at the first failure and names it |
| `.github/workflows/ci.yml`   | sets up pnpm + Node from `.nvmrc`, then runs `bash scripts/verify.sh`. No check steps of its own                              |
| `scripts/git-hooks/pre-push` | execs `scripts/verify.sh`; no checks of its own                                                                               |
| `scripts/install-hooks.sh`   | `git config core.hooksPath scripts/git-hooks` — versioned hooks, no stale copies                                              |

`data:check` and `test` are conditional on `package.json` having that script. On `main`
today neither exists (they arrive with the content-model stack), so the gate prints
`○ data:check — skipped` rather than inventing a step. That is why the same script is
correct before and after those branches land: no edit to the gate as the stack merges.

Runtime parity: `.nvmrc` (`24`) and `pnpm 12.16.1` are enforced by the script's preflight,
not by documentation. A wrong runtime exits 1 before any step runs.

Markdown is formatter-gated too: Biome 2 formats `.md`, so a hand-wrapped doc can fail
`lint` before any code is touched. After editing `AGENTS.md` or `docs/`, run
`pnpm format --write` (or `pnpm exec biome format --write <file>`) before the gate.

## Baseline, measured 2026-10-29 (before the gate)

Source: `gh run list --workflow=ci.yml --limit 100` → 22 runs, 22 distinct head SHAs,
15 branches. Reproduce with `python3 docs/gate-baseline.py` (needs `gh` auth).

| Metric                                                   | Value                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| CI job `typecheck / lint / build`, p50 / p95             | **55 s / 64 s** (n=10)                                                |
| CI run incl. queue, p50 / p95                            | 55 s / 72 s                                                           |
| First-pass yield (green on the first run for a head SHA) | **18/22 = 81.8 %** (85.7 % excluding the one cancelled run)           |
| Retries per PR                                           | 0.47 (22 runs over 15 branches)                                       |
| Failures                                                 | 3 red, 1 cancelled, all on `toolchain/` and `feat/b01-quiz-promotion` |

Reading: 4 of 22 pushes needed a second look, and the failures were toolchain/docs branches —
the cheapest kind to catch locally. Every one of them was a check that CI ran and the
developer's shell did not.

## Baseline, measured 2026-10-29 (after the gate)

Local, Node 24.22.0 / pnpm 12.16.1, 7-core host, warm `node_modules` and warm Next cache:

| Step                                       | p50                                  |
| ------------------------------------------ | ------------------------------------ |
| deps (`pnpm install --frozen-lockfile`)    | 0.0 s                                |
| typecheck (`next typegen && tsc --noEmit`) | 3.8 s                                |
| lint (`biome check`)                       | 0.4 s                                |
| format:check                               | 0.2 s                                |
| data:check                                 | skipped on `main`                    |
| test                                       | skipped on `main`                    |
| build (`next build`)                       | 40.5 s                               |
| **gate total**                             | **44.8 s** (n=3: 37.5 / 44.8 / 49.6) |

A cold clone (fresh `git clone`, no `node_modules`, no Next cache) runs the same gate green
in **43 s** — the install is 0.7 s off the shared pnpm store, so "works on my machine" is not
carrying the result.

CI, same tree: the first post-change run is **1 m 0 s** end to end, of which the script itself
is **43.6 s** (`data:check` and `test` skipped there too). The extra ~17 s is runner setup; the
pre-change p50 was 55 s, so the gate bought the parity preflight and the two skip-aware steps
for about the cost of the runner's checkout.

Budget: local p50 < 90 s, CI < 4 min. Both hold; the build is 90 % of the gate, so if it
ever needs splitting the fast lane is `typecheck+lint+format` (~4.4 s, and it is the lane
that catches real mistakes) and the slow lane is `build`. Do not make a step optional to buy
time. The 90 s ceiling is met on a 7-core host; a slower machine is the case to watch.

## Negative controls (each run against this tree, then reverted)

| Probe                                        | Result                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `const __gateProbe: number = "not a number"` | stopped at `typecheck`, exit 2, step named                                                                                                 |
| deliberately misformatted file               | stopped at `lint`, exit 1 — `biome check` includes the formatter, so `format:check` is an explicit backstop that `lint` normally pre-empts |
| `.nvmrc` flipped to `20` while on Node 24    | preflight exit 1, `✗ runtime parity`, zero steps run                                                                                       |

## Not done: branch protection (needs a repo admin)

There is **no** branch protection on `main` today:

```
gh api repos/riolabs-ai/alignsynch/branches/main/protection   -> 404 (not configured)
gh api repos/riolabs-ai/alignsynch --jq .permissions
  -> {"admin":false,"maintain":false,"pull":true,"push":true,"triage":true}
```

The account that built this gate can push but cannot configure protection, so
"required status checks" cannot be enabled from here, and a deliberate red probe PR cannot
prove enforcement — an unprotected branch merges red happily. What _is_ proven is that the
check itself fails when the tree is broken (negative controls above) and that CI's only
step is that check.

An admin should run, once:

```bash
gh api -X PUT repos/riolabs-ai/alignsynch/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=typecheck / lint / build' \
  -F enforce_admins=false \
  -F required_pull_request_reviews= \
  -F restrictions=
```

`typecheck / lint / build` is the existing job name and is kept stable on purpose: required
checks match on that string, so renaming the job silently drops the requirement. Prove the
requirement with a deliberately failing probe PR against `main` and close it unmerged — a
protection rule that has never rejected anything is a rumour.

## Re-measuring

```bash
bash scripts/verify.sh                       # local gate; time it three times, take the median
gh run list --workflow=ci.yml --limit 100 --json conclusion,headSha,createdAt,updatedAt
```

First-pass yield = head SHAs whose **first** run was green ÷ head SHAs that ran. If it drops
below 70 %, the local gate is missing a step CI has, or the runtimes differ — check the
parity preflight first, never add a CI step.
