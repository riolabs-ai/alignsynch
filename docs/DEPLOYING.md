# Deploying

`alignsynch.com` is a Vercel project (`alignsynch`, team `riolabs-ai`) that builds this repository
on every push to `main`. Two things about that are easy to get wrong, and both have already cost a
day: **which pushes are allowed to build**, and **whether what is serving is what merged**.

Neither is visible to `bash scripts/verify.sh`. The gate is network-free by contract — it "never
opens a connection" ([`AGENTS.md`](../AGENTS.md)) — so it cannot see a deployment, and a green gate
is not a claim about production. It is a claim about the tree.

## 1. Which pushes build: previews are opt-in

The rule lives in [`vercel.json`](../vercel.json), in one `ignoreCommand`:

```json
"ignoreCommand": "if [ \"${VERCEL_ENV:-}\" = preview ] && [ -n \"${VERCEL_GIT_COMMIT_REF:-}\" ] && [ \"$VERCEL_GIT_COMMIT_REF\" != main ]; then case \"$VERCEL_GIT_COMMIT_MESSAGE\" in *\"[preview]\"*) exit 1 ;; esac; exit 0; fi; exit 1"
```

Read it as three rules, in the order they are checked:

- **`main` always builds.** A production push has `VERCEL_ENV=production`, the first test fails and
  the command exits `1` — Vercel's "build" answer.
- **Every other branch does not build, unless its commit opts in.** A preview with a git ref that
  is not `main` reaches the `case`; exit `0` ("ignore this build") unless the commit message
  contains `[preview]`.
- **Anything it cannot classify builds.** A deploy hook, a CLI deploy with no git metadata, or a
  push no branch can be named for exits `1`. The command fails **open**: spending a deployment is
  recoverable, a silently stale production is not.

**Why `ignoreCommand` and not `git.deploymentEnabled`.** Both are current, documented
`vercel.json` properties. `git.deploymentEnabled: { "*": false, "main": true }` is the tidier
declarative form, but it disables the deployment before it is created, so there is nothing left for
an opt-in to reach — a branch would never get its `[preview]` build. `ignoreCommand` is the only
mechanism that runs _before_ the build, which is the only place a rule can both suppress a build and
still allow one on request. It also overrides the dashboard's Ignored Build Step, so the repository
is the source of truth rather than a setting that disappears if the project is transferred.

**Why the commit marker and not a branch prefix.** A prefix (`preview/*`) forces a branch rename
that rewrites the PR's head; a marker in the commit message travels with the commit you are asking
about. The trade-off is real and deliberate: **a preview deployment is now something you ask for, not
something you get.** `git commit --allow-empty -m "probe: eyeball the band [preview]"` on the branch
is the ask; everything else ships without a deployment, which is what keeps a day of twenty PRs
inside the Hobby allowance.

The Vercel schema caps `ignoreCommand` at 256 characters; the rule is 206, so a fourth condition
means shortening this one rather than appending to it.

Before this file existed the rule lived only in the Vercel dashboard. Sixty-six deployments in the
last 24 h, every one of them a production deployment and not one a preview, said the rule was
working — and nothing in the repository said how, so no review could see it and a project transfer
would have lost it silently.

**Measured on 2026-10-31: creation, not just the build, is currently disabled upstream.** A branch
was pushed twice — `probe/preview-suppression`, once with no marker and once with `[preview]` in the
message — and **neither produced a deployment record at all**: `vercel ls` showed 15 records, every
one `target=production`, on refs `main` or none. So the project's Git settings suppress a preview
before a deployment exists, and this `ignoreCommand` never gets the chance to answer. That is why the
rule here is the **policy of record** rather than the working switch: it is the reviewable statement
of what may build, it costs nothing, and it becomes the effective gate the moment preview creation is
allowed again or the project is transferred. Turning previews on takes both switches, and they have
to agree — allow creation at the project level, then opt in per commit with `[preview]`.

## 2. Is production serving what merged?

```bash
node scripts/deploy-check.mjs                          # https://alignsynch.com vs HEAD
node scripts/deploy-check.mjs --expect "$(git rev-parse origin/main)"
node scripts/deploy-check.mjs --project-dir ../alignsynch   # where `vercel link` was run
```

Two lines, two answers:

```
production: OK (expected b8fdf53a424, serving b8fdf53a424)
deploys:    66 / 100 in the last 24h — 34 remaining
```

- `OK` — production reports exactly that commit. Exit `0`.
- `STALE` — production reports a different commit: the deploy is behind (or ahead of) the commit you
  asked about. Exit `1`. This is the failure that froze production for hours with a green log.
- `UNKNOWN` — it cannot be determined, and the reason is printed after the dash. Exit `2`. A
  redirect, a non-JSON answer, a `commit` that is not a SHA, an expected SHA that was never
  given, or a build that predates `/api/version` all land here. **`UNKNOWN` is never reported as
  `OK`**: a check that guesses is worse than no check, because the one reading that says "fine"
  while production is three merges behind is the reading that costs a day.

The served commit comes from `GET <url>/api/version`
([`app/api/version/route.ts`](../app/api/version/route.ts)), which answers with the `APP_VERSION`
and `APP_COMMIT` values `next.config.mjs` bakes in at build time. It needs no token, so the check
runs anywhere; the endpoint is public and carries nothing that the public repository does not.

`deploys:` is the early warning, printed whatever the verdict. Vercel's Hobby allowance is **100
deployments per rolling 86,400 s** (`api-deployments-free-per-day`), so the count is taken over a
rolling window, not a calendar day. The number comes from `vercel ls` — which needs the CLI and a
checkout that `vercel link` was run in, and no token from this repository. Where it cannot be
counted the line reads `deploys: UNKNOWN (reason)`, **never `0 / 100`**: a false zero is the one
reading that says everything is fine when the allowance is about to run out.

Counting stops when a page reaches a deployment older than the window, so the number is complete.
Every deployment record counts, including one whose build was skipped, which makes it an upper
bound on what was spent — the safe direction to be wrong in.

Neither this script nor `/api/version` is in `scripts/verify.sh` or `.github/workflows/ci.yml`, and
neither should be. The gate stays offline; CI stays one script. This is an out-of-band check: run it
after a merge, or from a scheduled job.

## When the check says `STALE`

1. Read the deployment list (`vercel ls`) for the newest production deployment and the commit it
   was built from.
2. If it is `● Blocked`, the allowance is exhausted — the `deploys:` line tells you how much of it
   is spent, and the oldest deployments drop out of the rolling window on their own. Nothing else
   spends it.
3. If it `ERROR`ed, read the build log and fix the tree; the next merge to `main` deploys again.
4. If it is `READY` and `STALE` persists, the alias is pointing at an older deployment — promote
   the newest one in the dashboard rather than re-deploying.
