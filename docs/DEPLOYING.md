# Deploying

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Operations** › Deploying · next [Releasing](RELEASING.md)

<!-- docs-nav:end -->

`alignsynch.com` is a Vercel project (`alignsynch`, team `riolabs-ai`) that builds this repository.
Whether a **push** produces that build is a setting on the project, not a property of this tree: on
2026-11-01 the project reported deployment creation switched off; on 2026-11-03 two merges to `main`
were serving within about two minutes each. So this page documents both the policy of record (the
`ignoreCommand` below) and the deliberate promotion path
([`RELEASING.md`](RELEASING.md#main--production-promoting-a-release)), and "did that merge deploy?"
is answered by `scripts/deploy-check.mjs`, never by assumption. Two things about deployment are easy
to get wrong, and both have already cost a day: **what a deployment is allowed to build**, and
**whether what is serving is what merged**.

Neither is visible to `bash scripts/verify.sh`. The gate is network-free by contract — it "never
opens a connection" ([`AGENTS.md`](../AGENTS.md)) — so it cannot see a deployment, and a green gate
is not a claim about production. It is a claim about the tree.

## The runtime: Node 24, in four places

**Production, CI and every `pnpm` command in this tree run Node 24.** That is one decision recorded in
four places, and a change that touches one has to touch all four:

| Place                                        | States                                   | Read by                                                                                                                           |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`.nvmrc`](../.nvmrc)                        | `24`                                     | `scripts/verify.sh` (runtime parity: it refuses to gate a shell on another major) and `actions/setup-node` in all three workflows |
| `package.json` → `engines.node`              | `24.x`                                   | Vercel's build image, `pnpm install`, and anyone asking what the tree supports                                                    |
| [`.github/workflows/`](../.github/workflows) | `node-version-file: .nvmrc` — no literal | GitHub Actions; three workflows set Node up and each reads the file                                                               |
| the Vercel project `alignsynch`              | `nodeVersion: "24.x"`                    | every deployment of this repository                                                                                               |

Until #682 the last row said **26.x** while the other three said 24, so a green check and a green gate
were evidence about a runtime production did not use: a dependency could pass CI and fail in
production, and nothing in the record said which runtime ran. The build log named the mechanism:

```
Warning: Detected "engines": { "node": ">=20.9.0" } in your `package.json` that will
automatically upgrade when a new major Node.js Version is released.
```

An open-ended range is an invitation, not a floor: Vercel read it, took the newest major it offered and
moved production to 26 with no commit behind the change. `24.x` is a pin, so adopting the next major
is now a card with a gate run on it rather than something the platform does to the deploy.

The two halves are verified differently, and the difference is the point:

- **the three files are a unit test.** [`tests/runtime-pin.test.ts`](../tests/runtime-pin.test.ts) fails
  when `.nvmrc`, `engines.node` and the workflows stop agreeing, so the invariant is enforced by the
  gate instead of by this paragraph.
- **the project setting is not in the repository**, so nothing offline can read it. It is `nodeVersion`
  on the project record — `GET https://api.vercel.com/v9/projects/alignsynch` with the team id from
  `~/.local/share/com.vercel.cli/config.json` — and the CLI does not print it. Read it there before
  believing any claim about the runtime, and read it again after a project transfer.

**A setting change does not rebuild what is serving.** The deployment production runs keeps the
runtime it was built with; a new `nodeVersion` applies to the next build. So the proof is the
deployment that follows the change — and Vercel prints it, because the first build after it cannot
reuse a cache made by another runtime:

```
Skipping build cache since Node.js version changed from "26.x" to "24.x"
```

Measured on 2026-11-08 on the first deployment after the project moved from `26.x` to `24.x`
(preview `alignsynch-i38xd7umh`), which also no longer carries the `engines` warning above. That log
line is the only self-describing record a deployment makes of its runtime — `/api/version` reports the
commit, not the runtime — so a later deployment that prints nothing about the cache is reusing a cache
built by 24 and agrees with it.

## 1. What a deployment is allowed to build: production, plus one branch named in the file

The rule lives in [`vercel.json`](../vercel.json), in one `ignoreCommand`:

```json
"ignoreCommand": "if [ \"${VERCEL_ENV:-}\" = production ] || [ \"${VERCEL_GIT_COMMIT_REF:-}\" = demo ]; then exit 1; fi; exit 0"
```

Read it as four rules, in the order they are checked:

- **`production` builds.** A deployment created for `main` carries `VERCEL_ENV=production`, the first test passes
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

The trade-off is real and it is nearly all this rule costs: **a push produces no shareable preview
URL**, with that one exception — so a branch is normally reviewed by reading it and running it. When
a shareable preview _is_ needed for a branch under review — feedback on a screen from someone who is
not at this checkout, a bug that only reproduces on Vercel's edge — it is a deliberate opt-in argued
on a card and taken by hand, never a default that spends a deployment on every push. Since #664 that
opt-in is one command: [`scripts/preview.mjs`](#a-preview-for-review-one-command-and-the-toolbar-with-it).

### A preview for review: one command, and the toolbar comes with it

The project's own Ignored Build Step string already ended with the answer, before this script
existed: _"Run `vercel deploy` by hand if you need a preview."_ [`scripts/preview.mjs`](../scripts/preview.mjs)
is that sentence with the parts a hand-run gets wrong made mechanical — it links the checkout when
`.vercel/project.json` is missing, deploys with `--yes`, takes the URL out of the CLI's own output,
and refuses `--prod` outright so a preview can never become a production deployment:

```bash
node scripts/preview.mjs            # → preview:  https://alignsynch-<hash>-riolabs-ais-projects.vercel.app
node scripts/preview.mjs --json     # the same facts as one object, for a PR body or a script
```

Measured on 2026-11-07, against the deployment that command created:

| Fact                             | Measurement                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| it spends one deployment         | the script prints the counter from `scripts/deploy-check.mjs` (`N / 100 in the last 24h — M remaining`), never a zero                                                                          |
| it shows the **tree**, not a SHA | a CLI deployment carries no git metadata, so the preview's `GET /api/version` answers `{"version":"1.6.0","commit":"unknown"}`; the script prints the tree's own `HEAD` beside the URL instead |
| a cold build is ~40 s            | `● Ready` in 40 s, environment `Preview`                                                                                                                                                       |
| the toolbar is on it             | `enablePreviewFeedback: true` on the project (API), and `vercel.live/_next-live/feedback/feedback.js` in the preview's rendered DOM                                                            |

**The toolbar is already Vercel's, and `@vercel/toolbar` is deliberately not a dependency.** Vercel
injects the Toolbar into every preview deployment by default; the npm package is the _production and
localhost_ path, where nothing is injected. Mounting it in this tree would ship toolbar code into the
production bundle to duplicate a preview behaviour that already exists, so #664 changed no product
code and added no dependency — this page and the one script are the whole change.

**The issue's acceptance grep measures the wrong surface.** `curl -s <url> | grep -c vercel-toolbar`
answers `0` on production **and** on a preview, because the injection is client-side: the server HTML
carries nothing on either, and the loader is added when the document runs. The honest instrument is a
rendered DOM:

```bash
google-chrome --headless=new --dump-dom <preview-url>   | grep -c 'vercel.live'   # 1 — the toolbar
google-chrome --headless=new --dump-dom https://alignsynch.com | grep -c 'vercel.live'   # 0 — production
```

Both were measured on 2026-11-07 against a preview this script created and against the live
production alias. The two server HTMLs are identical in this respect, so no `curl` can tell them
apart; a rendered DOM can.

**Comments need a person, and one dashboard setting.** The toolbar asks you to sign in to Vercel, so
a comment thread belongs to a team member with access to that deployment, and the Toolbar's Preview
visibility is a project setting — _Settings → General → Vercel Toolbar_ on the project, or the same
row team-wide — which this project already reports as `On` (`enablePreviewFeedback: true`). A
preview under a **custom alias domain** (`demo.alignsynch.com` is one) needs the Toolbar opted in
explicitly in project settings; a `*.vercel.app` preview URL does not. None of that is a commit,
which is why a card that lands a preview workflow names the click instead of claiming it done.

**A preview of an ordinary branch has no environment.** Preview variables are scoped per branch
(§3: `--target preview --branch demo`) and every variable this project holds on Preview is scoped to
`demo`. So a preview of any other branch renders what needs no secrets and redirects or refuses what
does — measured on the same 2026-11-07 preview:

| Route          | Answer                      |
| -------------- | --------------------------- |
| `/`            | `200`                       |
| `/login`       | `200`                       |
| `/dashboard`   | `307` → `/login`            |
| `/api/version` | `200`, `"commit":"unknown"` |

Feedback on a public or marketing screen therefore works on any branch's preview; a signed-in screen
needs a preview that carries the demo environment, which is the `demo` branch and the second rule in
§1 above.

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

**Re-measured on 2026-11-03: production deployments are being created again.** Two squash merges to
`main` entered the cut for `v1.3.0` and both were serving within about two minutes of the merge —
`GET /api/version` answered `940700893181…` after `perf(db)` (#479) and `f3b765815b16…` after
`chore(release): 1.3.0`, with no promotion call made from this machine and no deploy hook in the
tree. What the 2026-11-01 paragraph describes is therefore a dashboard state that has already
changed once, which is exactly why the promotion procedure in
[`RELEASING.md`](RELEASING.md#main--production-promoting-a-release) begins by measuring what
production serves rather than trusting either reading. The `ignoreCommand` below is the effective
gate in this state: it is what decides whether the deployment a push created builds at all.

Previews are still suppressed before a deployment exists — the deployments above are `production`,
not a preview — so this `ignoreCommand` never gets the chance to answer a _branch_ push, including
the push to `demo` the second rule above is written for. For those refs the rule is the **policy of
record** rather than the working switch: it is the reviewable statement of what may build, it costs
nothing, and it becomes the effective gate the moment preview creation is allowed again or the
project is transferred.

**Re-measured on 2026-11-07: still off, and now said out loud in the dashboard.** The project API
answers `previewDeploymentsDisabled: true` with `gitProviderOptions.createDeployments: "disabled"`,
and the dashboard's Ignored Build Step — the one `vercel.json` overrides, §1 above — has been
rewritten to state the decision instead of hiding it: _"Preview deployments are disabled; only main
builds. Run `vercel deploy` by hand if you need a preview."_ That last sentence is the route
[below](#a-preview-for-review-one-command-and-the-toolbar-with-it) automates.

A branch push on that date produced **no record at all**, not a `CANCELED` one: `vercel ls` was
identical before and after pushing `alignsynch/t_34d47fd0-…` and waiting three minutes, so the
`ignoreCommand` was never consulted. Disabled creation is upstream of the rule, which is why a
preview has to be asked for.

Turning previews on takes two changes that have to agree, and only one of them is in this
repository:

- **allow creation at the project level** — `previewDeploymentsDisabled` and
  `gitProviderOptions.createDeployments` are dashboard switches, and neither is touched by this
  rule. While both stand, a branch push creates no deployment record and `ignoreCommand` is never
  consulted, so the `demo` exemption is inert;
- **name the branch in this file** — done, for `demo` and for nothing else.

Those two are the price of an **automatic** preview per push, and both are still refused. A preview
on demand costs neither, which is why it is the route this page documents: `vercel deploy` — and
`scripts/preview.mjs`, which is the same thing with the footguns removed — builds a preview from any
branch with no dashboard change, no per-branch literal, and no record created for the pushes nobody
asked about. Measured 2026-11-07: `● Ready` in 40 s, environment `Preview`. The one thing it cannot
do is carry `demo`'s environment, because preview variables are branch-scoped — see
[A preview for review](#a-preview-for-review-one-command-and-the-toolbar-with-it).

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

## 3. Environment variables: the file is the source of truth, `pnpm env:sync` pushes it

Vercel's environment is written from a local env file by
[`scripts/env-sync.mjs`](../scripts/env-sync.mjs) (`pnpm env:sync`), not by hand in the dashboard.
The file is the source of truth and `.env*` is gitignored, so the script is the only thing that
talks to Vercel and the only way to say what a target holds. It prints **key names only** — never a
value, never a prefix of one — on every path, including errors, so its output can be pasted into a
ticket or a card without a redaction pass.

```bash
pnpm env:sync --from .env.demo --target preview --branch demo                       # dry run: the default
pnpm env:sync --from .env.demo --target preview --branch demo --diff               # drift, writes nothing
pnpm env:sync --from .env.demo --target preview --branch demo --apply              # create missing keys
pnpm env:sync --from .env.production --target production --diff
pnpm env:sync --from .env.production --target production --apply --confirm-production
```

Each run prints one decision per key — `create`, `replace`, `keep`, `drop`, `extra` — and the flags
exist because each of them is a mistake with a cheap guard:

- **Nothing is written without `--apply`.** The write is a second, explicit invocation; a dry run
  ends with `re-run with --apply to write these` and exits 0.
- **`--apply --target production` is refused without `--confirm-production`.** Rewriting the live
  project's environment is the one mistake a typo can make expensive, and the flag is checked
  before the token is even read, so a refusal cannot half-run. The refusal prints
  `add --confirm-production to mean it` and exits 1.
- **`--target preview` is refused without `--branch`.** The branch is what scopes a preview
  variable to one preview; with no branch the key would land on every preview of the project.
  There is no default branch, deliberately — the guard used to be unreachable behind one.
- **`--force` overwrites keys that already exist.** Without it an existing key is `keep`, so the
  file never silently rewrites a value somebody set on purpose.
- **`--diff` reports drift and never writes.** It is the audit, not the sync: it lists keys in the
  file that the target does not hold (`missing`, what `--apply` would create) and keys the target
  holds that the file does not (`extra`, which `--apply` leaves alone). **Presence and type only** —
  Vercel stores values encrypted or sensitive and never returns one, so a value that changed
  underneath is invisible here. The output says exactly that rather than implying a comparison. A
  type row appears only where the file and the target both hold the key, and it is informational:
  `--apply` sends a value, not a type. It also refuses `--apply` and `--force`, so the mode is never
  ambiguous about whether something is being written.

The two policy lists in the script are release policy, which is why the script is versioned here
rather than living in an operator's home directory. `NEVER_PREVIEW` names the keys that must never
reach a demo target (`ADMIN_EMAILS`: the console operator allowlist, which a demo login must not
inherit); `NEVER_AT_ALL` names the keys that are not app configuration at any target
(`VERCEL_OIDC_TOKEN`, `BWS_ACCESS_TOKEN`, `STRIPE_TEST_WEBHOOK_URL`, and the `client_id` /
`client_secret` / `scope` / `grant_type` fields a pasted curl leaves behind). The reason for each key
sits beside the rule and is printed with the decision.

The token is the Vercel CLI's own — `~/.local/share/com.vercel.cli/auth.json`, written by
`vercel login`. The script holds no secret of its own and takes no `--token`.

This is not a gate step. `scripts/env-sync.mjs` is a `scripts/**` change, so `pnpm lint`,
`pnpm format:check` and `pnpm typecheck` keep it honest, but `scripts/verify.sh` and CI never run
it: the gate is network-free and has no credentials, by contract. A write is also not a deploy —
the run ends with `a new deployment is required on <target> for these to take effect`.

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Operations** › Deploying · next [Releasing](RELEASING.md)

<!-- docs-nav:end -->
