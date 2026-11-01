# Deploying

`alignsynch.com` is a Vercel project (`alignsynch`, team `riolabs-ai`) that builds this repository
on every push to `main`. Two things about that are easy to get wrong, and both have already cost a
day: **which pushes are allowed to build**, and **whether what is serving is what merged**.

Neither is visible to `bash scripts/verify.sh`. The gate is network-free by contract — it "never
opens a connection" ([`AGENTS.md`](../AGENTS.md)) — so it cannot see a deployment, and a green gate
is not a claim about production. It is a claim about the tree.

## 1. Which pushes build: production, plus one branch named in the file

The rule lives in [`vercel.json`](../vercel.json), in one `ignoreCommand`:

```json
"ignoreCommand": "if [ \"${VERCEL_ENV:-}\" = production ] || [ \"${VERCEL_GIT_COMMIT_REF:-}\" = demo ]; then exit 1; fi; exit 0"
```

Read it as four rules, in the order they are checked:

- **`production` builds.** A push to `main` carries `VERCEL_ENV=production`, the first test passes
  and the command exits `1` — Vercel's "build" answer.
- **The branch named `demo` builds, in any environment.** The second test,
  `[ "${VERCEL_GIT_COMMIT_REF:-}" = demo ]`, is joined to the first by `||`, so it is consulted for
  previews too: a push to the branch `demo` exits `1` even when `VERCEL_ENV=preview`. The match is
  exact and case-sensitive — `Demo`, `demo/fix` and `demo-x` all miss it, fall through and cancel.
- **`preview` cancels everywhere else.** Every other ref reaches the end of the line and exits `0`,
  Vercel's "ignore this build" answer, and the deployment is recorded as `CANCELED`. Nothing else is
  consulted: not the commit message, not the diff, not a branch prefix. There is no marker or label
  opt-in to lose — the one exception is the branch literal `demo` in the string above.
- **An unset or unrecognised `VERCEL_ENV` cancels — unless the ref is `demo`.** `${VERCEL_ENV:-}`
  substitutes the empty string when the variable is missing, and `""` is not `production`, so an
  unset value, a typo, or any environment Vercel does not spell exactly `production` gets `0`. The
  branch test is not gated on the environment, so a `demo` ref with `VERCEL_ENV` unset still exits
  `1`; every other ref gets `0`. The command fails **closed** on the environment: when it cannot
  tell which environment it is looking at, it does not build. That covers everything that does not
  come through the Git integration as a production build — a deploy hook, a CLI deploy, a client
  that sends no environment at all — which is the case that used to build.

That is the reading of the shipped string and not of the prose — here it is run five times, with the
string read out of `vercel.json` rather than retyped:

```bash
RULE=$(node -p "require('./vercel.json').ignoreCommand")
env VERCEL_ENV=production sh -c "$RULE"; echo "production rc=$?"                              # 1 — builds
env VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=demo sh -c "$RULE"; echo "ref=demo rc=$?"        # 1 — builds
env VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=feature/x sh -c "$RULE"; echo "feature/x rc=$?"  # 0 — cancelled
env -u VERCEL_ENV -u VERCEL_GIT_COMMIT_REF sh -c "$RULE"; echo "both unset rc=$?"             # 0 — cancelled
env -u VERCEL_ENV VERCEL_GIT_COMMIT_REF=demo sh -c "$RULE"; echo "unset+demo rc=$?"           # 1 — builds
```

| Input                                 | Exit | Vercel    |
| ------------------------------------- | ---- | --------- |
| `VERCEL_ENV=production`               | `1`  | builds    |
| `VERCEL_ENV=preview`, ref `demo`      | `1`  | builds    |
| `VERCEL_ENV=preview`, ref `feature/x` | `0`  | cancelled |
| neither variable set                  | `0`  | cancelled |
| `VERCEL_ENV` unset, ref `demo`        | `1`  | builds    |

The last two rows have the same environment and different answers, which is why "unset cancels" has
to be written as "unset cancels for everything except `demo`": the two tests are joined by `||`, so
either one alone is enough to build.

**It is not a quota saving.** A canceled build is still a deployment: Vercel creates the record,
sets it to `CANCELED` when the command exits `0`, and an ignored build counts against the Hobby
allowance of 100 deployments per rolling 24 h exactly as a built one does — §2's `deploys:` line
counts those records, "including one whose build was skipped". What changed is _where_ builds
happen — production and the `demo` branch on Vercel, everything else on the machine that pushed the
branch — not how much of the day a merge spends. Do not read this page as "we now spend less".

**Why `ignoreCommand` and not `git.deploymentEnabled`.** Both are current, documented `vercel.json`
properties, and the two now partly overlap: `git.deploymentEnabled` could turn deployments off for
every branch but `main` and `demo`, which is the same branch answer. What it cannot express is the
`environment` one, and that is the half that carries the policy — a preview cancels because it is a
_preview_, wherever it was pushed from, and a deployment that arrives from outside the Git
integration (a deploy hook, a CLI deploy) has no branch to key on but still gets `VERCEL_ENV`. So
the branch list stays one named exception inside a rule whose main test is the environment.
`ignoreCommand` also overrides the dashboard's Ignored Build Step, which is what keeps the
repository the source of truth rather than a setting that disappears if the project is transferred —
the `demo` exemption is a literal in the file, so no dashboard edit can lose it, and no dashboard
edit can widen it either. (The dashboard still carries an older command from before this rule;
`vercel.json` overrides it, which is why the line above is the one that runs.)

**Where a preview lives instead: the machine that wrote the branch** — for every branch except
`demo`. A branch is reviewed by reading its diff and by running it — `BRAND=alignsynch pnpm dev` for
the AlignSynch record, `BRAND=quizhub pnpm dev` for the QuizHub one, both on
<http://localhost:3000>, one at a time: a second `next dev` in the same checkout stops with
`Unable to acquire lock at .next/dev/lock`, so the second brand is a second checkout or a second
run, not a second port in this one.

`demo` is the one branch that does not live on the machine that wrote it, because it is not there
for review: it exists so a public demo of the product can be served from a Vercel deployment, at
`demo.alignsynch.com`. The exemption is one branch name and nothing else — it does not make previews
a general lever, and pushing any other branch still produces no build to share. The deployment it
enables is not serving anything yet (see the last paragraph of this section): the branch does not
exist on `origin`, the domain is not attached, and creation is still disabled upstream.

The trade-off is real and it is nearly all this rule costs: **there is no shareable preview URL for
someone who is not on this machine**, with that one exception. If a shareable preview is ever needed
for a _branch under review_ — a review with someone outside the team, a bug that only reproduces on
Vercel's edge — it comes back as a deliberate opt-in argued on a card, not as a default that spends
a deployment on every push.

The Vercel schema caps `ignoreCommand` at 256 characters; this rule is 105, measured from the file
(109 as written in the JSON, where each `"` inside the command is escaped). The branch test is the
43 characters that were added to the 62-character production-only rule.

Before this file existed the rule lived only in the Vercel dashboard. Sixty-six deployments in the
last 24 h, every one of them a production deployment and not one a preview, said the rule was
working — and nothing in the repository said how, so no review could see it and a project transfer
would have lost it silently.

**Measured again on 2026-11-01: creation, not just the build, is still disabled upstream.** The
2026-10-31 probe was a branch pushed twice — once with no marker, once with `[preview]` in the
message — and **neither produced a deployment record at all**. Today the first page of
`vercel ls alignsynch` is 20 records, every one `Production` and none `CANCELED`, and the project
itself reports `previewDeploymentsDisabled: true` with
`gitProviderOptions.createDeployments: "disabled"`. The nine preview deployments the API still
returns on feature branches are all from 2026-10-30 between 18:29Z and 19:02Z — before creation was
switched off — so nothing has been created since.

So the project's Git settings still suppress a preview before a deployment exists, and this
`ignoreCommand` never gets the chance to answer a branch push — including the push to `demo` the
second rule above is written for. That is why the rule here is the **policy of record** rather than
the working switch: it is the reviewable statement of what may build, it costs nothing, and it
becomes the effective gate the moment preview creation is allowed again or the project is
transferred.

Turning previews on takes two changes that have to agree, and only one of them is in this
repository:

- **allow creation at the project level** — `previewDeploymentsDisabled` and
  `gitProviderOptions.createDeployments` are dashboard switches, and neither is touched by this
  rule. While both stand, a branch push creates no deployment record and `ignoreCommand` is never
  consulted, so the `demo` exemption is inert;
- **name the branch in this file** — done, for `demo` and for nothing else.

"Production only" is still the deliberate position: widening it was a card, argued and measured, not
a default that drifted. Exactly one branch is exempt, and because that exemption is a literal in
`vercel.json` rather than a dashboard setting, no project edit can lose it and none can quietly
widen it — a second exempt branch has to appear in this string, in a review.

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
