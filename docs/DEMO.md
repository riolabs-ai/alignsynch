# The demo — one branch, one reset, one bundle (#185)

The demo is a **Neon branch** named `demo` whose parent is the project's default branch
(`production`). It runs the same code as everything else and holds the same six content tables;
what makes it a demo is that it is disposable, and the thing that makes it disposable is a
command.

```bash
pnpm demo:reset        # reset `demo` from its parent, then reseed it from the bundle
```

Three demo accounts (`initiator@`, `counterparty@`, `admin@demo.alignsynch.test`) are created by
that reseed, through the demo branch's own sign-up endpoint — see
[DEMO-AUTH.md](DEMO-AUTH.md) for the credentials' shape and how the role field works.

## What a reset is

Two operations, in this order, and nothing else:

1. **Reset the branch from its parent.** One call — `POST /projects/<id>/branches/<branch>/restore`
   with `source_branch_id` = the branch's parent, which is what `neon branches reset <branch>
   --parent` (or `restore ^parent`) runs. It is atomic: there is no window in which half the data is
   gone. A script of `DELETE`s would have as many half-finished states as it has statements, and
   one of them always looks like a valid demo until you read it.

2. **Reseed from `data/bundles/demo-dataset.alignsynch.json`.** `scripts/db-seed.mjs` with
   `DEMO_AUTH=1`, pointed at _that branch's_ connection string and _that branch's_ auth host. The
   seed reads the bundle through the importer's own reader, asserts it is still the canonical export
   of `data/assessments.ts` (E32's rule, at the point of use), writes the six content tables and
   creates the three accounts. None of that logic lives in the reset script: a second writer would
   be a second definition of "seeded".

The reset is the **only** bound on the demo. There is no session expiry and no TTL, by decision on
#185: a visitor's state does not decay, and the next nightly reset is what ends every session.

## What it prints

Row counts before the reset, after the reset, and after the reseed; then the six counts the bundle
itself declares, compared against the branch; then a verdict. Measured on the real demo branch:

```
▶ before                                  ▶ after the reseed
  record                       8            record                       8
  item                         40           item                         40
  response_option              0            response_option              0
  assessment_instance          4            assessment_instance          4
  party                        8            party                        8
  opinion                      40           opinion                      40
  demo_account                 3            demo_account                 3

▶ the seeded rows against data/bundles/demo-dataset.alignsynch.json
  record                       8      bundle says 8
  …
  row-set     matches the bundle
```

## Running it

```bash
NEON_API_KEY=napi_… node scripts/demo-reset.mjs               # reset + reseed `demo`
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --dry-run     # resolve and print, change nothing
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --skip-reset  # reseed only
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --branch demo-scratch   # another branch
```

The key is a project-scoped **Neon API key** (console → Project settings → API keys). It is read
from the environment and nowhere else — not from `.env.local`, not from a file in the tree — and it
is never printed. Exit codes: `0` reset and seeded · `1` a step failed (the branch's state is
reported) · `2` usage, or a refused target · `3` no `NEON_API_KEY`.

`NEON_PROJECT_ID` names the project; without it the script uses the only project the key can see.

### What it refuses

- **The project's default branch** (`production`), by id and by name. The demo reset never touches
  it, and the check is the API's own `default` flag rather than a string, so a renamed default is
  still refused.
- **A branch with no parent.** A root branch _is_ a default branch; there is nothing to reset it
  from.
- **A missing branch.** Creating infrastructure is a decision, not a retry; the message says how to
  create it and exits.
- **A connection string from the environment.** Both the write URL and the auth host are derived
  from the branch id through the API. A shell that exported production's `DATABASE_URL` or
  `NEON_AUTH_BASE_URL` cannot aim this script at production: the values are overwritten, not
  inherited, and the URL must address the branch's own compute host or the run stops before
  writing.

### When it fails

A failed reset leaves a branch that still serves, and the script says what it holds:

- **The reset itself fails** (bad key, API error, a refused target): nothing was written. The
  branch is exactly as it was.
- **The reset lands and the reseed fails** (a bad origin, an auth endpoint that is down, a bundle
  that drifted): the branch holds its parent's data with no demo accounts — valid, not half-wiped —
  and the next run rebuilds it. `pnpm db:verify` against the branch is green in that state
  (measured: `4 instance(s) checked, 4 template(s) resolved, no Gap column, no drift`).

## In CI

`.github/workflows/demo-reset.yml` runs the same script on a nightly cron and on every `v*` tag, and
can be dispatched by hand after a bundle is promoted.

**A missing `NEON_API_KEY` skips the job, green.** The key is a credential a human supplies, so
until it exists every scheduled run would be red, and a permanently red workflow is noise people
learn to ignore. The first step decides, the rest is skipped with a notice and a summary, and the
run concludes successfully. Add the secret under **Settings → Secrets and variables → Actions** to
turn the reset on; the project id and branch name are passed by the workflow and are not secrets.

## Promoting a bundle

The demo's rows are the **committed bundle**, so promoting a dataset is a reviewed change to a file:

```bash
pnpm bundles export --dataset --fix   # rewrite data/bundles/demo-dataset.alignsynch.json from data/assessments.ts
pnpm data:check                       # E32: the committed bundle is the canonical export again
pnpm demo:reset                       # or let the nightly run, or dispatch the workflow
```

A dataset edited anywhere else (a branch's database, a console `UPDATE`) is not a promotion: the
next reset discards it. That is the point — the file is the source, the branch is the mirror, and
`db-seed` refuses an assessment row the bundle does not author rather than deleting something
someone meant.

## What this is not

- **Not a deployment.** There is no Vercel project or environment here; pointing a host at the demo
  branch is a separate, outside-the-repo step.
- **Not session management.** No expiry, no TTL, no "reset on first visit" — the cron is the bound.
- **Not production tooling.** Every path in the script and the workflow is scoped to the demo
  branch; the default branch is a refusal, not a default.
