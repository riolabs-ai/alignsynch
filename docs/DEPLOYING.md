# Deploying

`alignsynch.com` is a Vercel project (`alignsynch`, team `riolabs-ai`) that builds this repository
on every push to `main`. Two things about that are easy to get wrong, and both have already cost a
day: **which pushes are allowed to build**, and **whether what is serving is what merged**.

Neither is visible to `bash scripts/verify.sh`. The gate is network-free by contract — it "never
opens a connection" ([`AGENTS.md`](../AGENTS.md)) — so it cannot see a deployment, and a green gate
is not a claim about production. It is a claim about the tree.

## 1. Which pushes build: production only, previews are local

The rule lives in [`vercel.json`](../vercel.json), in one `ignoreCommand`:

```json
"ignoreCommand": "if [ \"${VERCEL_ENV:-}\" = production ]; then exit 1; fi; exit 0"
```

Read it as three rules, in the order they are checked:

- **`production` builds.** A push to `main` carries `VERCEL_ENV=production`, the test passes and the
  command exits `1` — Vercel's "build" answer.
- **`preview` cancels.** Every other named environment reaches the end of the line and exits `0`,
  Vercel's "ignore this build" answer, and the deployment is recorded as `CANCELED`. Nothing else is
  consulted: not the branch, not the commit message, not the diff. There is no opt-in to lose — a
  preview cannot be asked for with a marker, a label or a branch prefix.
- **An unset or unrecognised `VERCEL_ENV` cancels too.** `${VERCEL_ENV:-}` substitutes the empty
  string when the variable is missing, and `""` is not `production`, so an unset value, a typo, or
  any environment Vercel does not spell exactly `production` gets `0`. The command fails **closed**:
  when it cannot tell which environment it is looking at, it does not build. That covers everything
  that does not come through the Git integration as a production build — a deploy hook, a CLI
  deploy, a client that sends no environment at all — which is the case that used to build.

That is the reading of the shipped string and not of the prose — here it is run three times, with
the value unescaped from the JSON:

```bash
RULE='if [ "${VERCEL_ENV:-}" = production ]; then exit 1; fi; exit 0'
VERCEL_ENV=production sh -c "$RULE"; echo "production rc=$?"   # 1 — builds
VERCEL_ENV=preview    sh -c "$RULE"; echo "preview    rc=$?"   # 0 — cancelled
env -u VERCEL_ENV     sh -c "$RULE"; echo "unset      rc=$?"   # 0 — cancelled
```

**It is not a quota saving.** A canceled build is still a deployment: Vercel creates the record,
sets it to `CANCELED` when the command exits `0`, and an ignored build counts against the Hobby
allowance of 100 deployments per rolling 24 h exactly as a built one does — §2's `deploys:` line
counts those records, "including one whose build was skipped". What changed is _where_ builds
happen, production on Vercel and everything else on the machine that pushed the branch, not how much
of the day a merge spends. Do not read this page as "we now spend less".

**Why `ignoreCommand` and not `git.deploymentEnabled`.** Both are current, documented `vercel.json`
properties. `git.deploymentEnabled: { "*": false, "main": true }` would suppress the branches, but
it answers a _branch_ question, and this switch has to answer an _environment_ one — a preview
cancels because it is a preview, wherever it was pushed from. `ignoreCommand` also overrides the
dashboard's Ignored Build Step, which is what keeps the repository the source of truth rather than a
setting that disappears if the project is transferred. (The dashboard still carries an older command
from before this rule; `vercel.json` overrides it, which is why the line above is the one that
runs.)

**Where a preview lives instead: the machine that wrote the branch.** A branch is reviewed by
reading its diff and by running it — `BRAND=alignsynch pnpm dev` for the AlignSynch record,
`BRAND=quizhub pnpm dev` for the QuizHub one, both on <http://localhost:3000>, one at a time: a
second `next dev` in the same checkout stops with `Unable to acquire lock at .next/dev/lock`, so the
second brand is a second checkout or a second run, not a second port in this one.

The trade-off is real and it is the only thing this rule costs: **there is no shareable preview URL
for someone who is not on this machine.** If that is ever needed again — a review with someone
outside the team, a bug that only reproduces on Vercel's edge — it comes back as a deliberate opt-in
argued on a card, not as a default that spends a deployment on every push.

The Vercel schema caps `ignoreCommand` at 256 characters; this rule is 62, measured from the file.

Before this file existed the rule lived only in the Vercel dashboard. Sixty-six deployments in the
last 24 h, every one of them a production deployment and not one a preview, said the rule was
working — and nothing in the repository said how, so no review could see it and a project transfer
would have lost it silently.

**Measured again on 2026-11-01: creation, not just the build, is still disabled upstream.** The
2026-10-31 probe was a branch pushed twice — once with no marker, once with `[preview]` in the
message — and **neither produced a deployment record at all**. Today `vercel ls alignsynch` lists 20
records, every one `Production`, none `Preview` and none `CANCELED`, the newest two minutes old and
the oldest twenty-one hours old, and the project itself reports `previewDeploymentsDisabled: true`.
So the project's Git settings still suppress a preview before a deployment exists, and this
`ignoreCommand` never gets the chance to answer a branch push. That is why the rule here is the
**policy of record** rather than the working switch: it is the reviewable statement of what may
build, it costs nothing, and it becomes the effective gate the moment preview creation is allowed
again or the project is transferred. Turning previews on takes two changes that have to agree —
allow creation at the project level, then widen this rule on a card, because "production only" is
now the deliberate position and not an accident.

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
