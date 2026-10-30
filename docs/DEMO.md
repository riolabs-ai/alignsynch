# The demo — one branch, one base, one reset, one bundle (#185)

The demo is a **Neon branch** named `demo`, restored from the **schema-only base** `demo-base`: a
branch holding the migrations' schema, the `schema_migrations` ledger, the auth configuration and
no rows — no app deployment, no data, no users. It runs the same code as everything else and holds
the same six content tables; what makes it a demo is that it is disposable, and the thing that
makes it disposable is a command.

The base is why production data never reaches the demo. The reset restores `demo` from a **source
branch**, so the source is the demo's entire supply of data: while that source was `production`,
every nightly reset copied the live branch's runtime rows and real auth accounts onto the branch a
public URL serves, for as long as the emptying took. With a schema-only source the restore lands
on an empty branch, so the copy cannot happen at all — the exposure is removed by topology, not by
a faster `DELETE`.

The source is named explicitly, `DEMO_SOURCE_BRANCH=demo-base`, and not inferred from the branch's
parent. Neon does not let a branch be re-parented through the API (`PATCH …/branches/{id}` answers
`nothing to update` for `parent_id`), so when the base was cut the `demo` branch kept `production`
for a parent it never chose. Naming the source is what lets that branch restore from the base
anyway. The rest of this document describes the source, because the source is the rule.

```bash
pnpm demo:reset        # migrate `demo-base`, restore `demo` from it, reseed from the bundle
```

Three demo accounts (`initiator@`, `counterparty@`, `admin@demo.alignsynch.test`) are created by
that reseed, through the demo branch's own sign-up endpoint — see
[DEMO-AUTH.md](DEMO-AUTH.md) for the credentials' shape, how the role field works, and `/demo`,
the PIN-gated panel that signs a browser in as one of them (`DEMO_AUTH=1` plus a `DEMO_PIN`;
refused in production without `DEMO_ALLOW_PRODUCTION=1` as well).

## What a reset is

Three operations, in this order, and nothing else:

1. **Migrate the source (`demo-base`).** `node scripts/db-migrate.mjs` against the base's own
   unpooled connection string, run from inside the reset script with `DATABASE_URL_UNPOOLED` set to
   the source's URI. The base is schema-only, and a schema-only branch still drifts: every migration
   written after the base was cut is a table or a column the demo would silently lack, because the
   restore copies the schema the base happens to have at that moment. `db:migrate` is idempotent and
   ledgered (`schema_migrations`), so this is one connection and a printed ledger when there is
   something to apply, and a no-op when there is not. **That is why the base cannot drift: the reset
   migrates it before every restore, in the same run.** `--skip-migrate` is the manual/offline
   opt-out, and the step is skipped entirely on `--skip-reset`.

2. **Restore the branch from the source.** One call —
   `POST /projects/<id>/branches/<branch>/restore` with `source_branch_id` = `demo-base`. It is
   atomic: there is no window in which half the data is gone. A script of `DELETE`s would have as
   many half-finished states as it has statements, and one of them always looks like a valid demo
   until you read it.

   The source holds no rows, so the branch now holds the schema and nothing else — that is the
   property the base exists for. Production data cannot enter the demo, and a source that is the
   project's default branch is refused before anything is written
   (`scripts/demo-source-guard.mjs`, used by `assertSourceResettable()`). The check is on the
   **source**, not on the target's parent: the parent of a branch cut before the base existed is a
   historical accident, and a rule that refused it would refuse every scheduled run.

3. **Reseed from `data/bundles/demo-dataset.alignsynch.json`.** `scripts/db-seed.mjs` with
   `DEMO_AUTH=1`, pointed at _that branch's_ connection string and _that branch's_ auth host. The
   seed reads the bundle through the importer's own reader, asserts it is still the canonical export
   of `data/assessments.ts` (E32's rule, at the point of use), writes the six content tables and
   creates the three accounts. None of that logic lives in the reset script: a second writer would
   be a second definition of "seeded".

A `--skip-reset` run (reseed only) is the one path that still empties the branch first, because it
never restores and would otherwise reseed on top of whatever the last run left. There the six
content tables, `user_profile`, `demo_account` and `neon_auth`'s users go, in dependency order,
inside one `BEGIN … COMMIT` on a branch that is already valid. It is deliberately in the reset
script rather than in `db-seed`, whose refusal to delete a row it did not author is the right rule
on **production** and the wrong one on a demo. The normal path empties nothing: the restore already
landed on an empty branch.

`demo-base` must never hold content rows, auth users or an app deployment. It is a schema, not an
environment: nothing reads it directly, so a row written there is invisible until a restore copies
it into the demo, and a deployment pointed at it would serve an empty database. It **must** hold
the `neon_auth` configuration, though — `project_config` and `jwks` — because the restore copies
the auth schema along with everything else and the demo's auth server cannot start without those
two rows. Emptying the base by deleting every `neon_auth` row is what turns a reset into an empty
demo whose sign-up answers `Project config not found`; `assertSourceSuppliesAuth()` refuses that
source before the restore, and the recipe for repairing it is: restore the base from `production`
(`POST …/branches/demo-base/restore`, `preserve_under_name` if it has children), delete the content
tables and `neon_auth.user`/`session`/`account`, keep `project_config` and `jwks`.

The reset is the **only** bound on the demo. There is no session expiry and no TTL, by decision on
#185: a visitor's state does not decay, and the next nightly reset is what ends every session.

## What it prints

Row counts before the reset, after the reset and after the reseed; then the six counts the bundle
itself declares, compared against the branch; then a verdict. The middle column is the evidence
part 2 checks: it reads **zeros**, because the schema-only source carries no rows. A non-zero there
means the source is holding data, which is the case the source refusal exists to make impossible.

```
▶ before                    ▶ after the reset           ▶ after the reseed
  record                   8   record                  0   record                 8
  item                    40   item                    0   item                  40
  opinion                 40   opinion                 0   opinion               40
  party                    8   party                   0   party                  8
  demo_account             3   demo_account            0   demo_account           3
  neon_auth user           3   neon_auth user          0   neon_auth user         3

▶ the seeded rows against data/bundles/demo-dataset.alignsynch.json
  record                       8      bundle says 8
  …
  row-set     matches the bundle
  accounts    3 demo account(s), one profile and one auth user each
```

(The bundle's own numbers: 8 records — 4 templates and 4 instances — 40 items, 8 parties, 40
opinions. `before` is whatever the previous run left, which is the bundle and the three accounts.)

## Running it

```bash
NEON_API_KEY=napi_… node scripts/demo-reset.mjs               # migrate + reset + reseed `demo`
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --dry-run     # resolve and print, change nothing
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --skip-migrate  # trust the base's ledger
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --skip-reset  # reseed only (empties first)
NEON_API_KEY=napi_… node scripts/demo-reset.mjs --branch demo-scratch   # another branch
DEMO_SOURCE_BRANCH=demo-base node scripts/demo-reset.mjs      # name the source explicitly
```

The source is `DEMO_SOURCE_BRANCH` (or `--source <name>`) when it is set, and the branch's own
parent otherwise. Set it in CI and for any manual run: without it, a `demo` branch whose parent is
still `production` refuses, because a parent that is the default branch is exactly the case the
rule exists for.

The key is a project-scoped **Neon API key** (console → Project settings → API keys). It is read
from the environment and nowhere else — not from `.env.local`, not from a file in the tree — and it
is never printed. Exit codes: `0` reset and seeded · `1` a step failed (the branch's state is
reported) · `2` usage, or a refused target · `3` no `NEON_API_KEY`.

`NEON_PROJECT_ID` names the project; without it the script uses the only project the key can see.

### What it refuses

- **The project's default branch** (`production`), by id and by name. The demo reset never touches
  it, and the check is the API's own `default` flag rather than a string, so a renamed default is
  still refused.
- **A source that is the default branch.** The source is the demo's whole supply of data, so a
  source of `production` would copy live rows and real accounts onto the branch a public URL
  serves. That is a refusal before the first write, not a warning — the source is the schema-only
  base, and `DEMO_SOURCE_BRANCH` is how it is named.
- **A named source that does not exist.** It is resolved by name before anything is written; an
  unknown name lists the branches the project does have. There is no silent fall back to the parent.
- **A source that cannot supply a working demo.** The restore copies the source's `neon_auth`
  schema, and the demo's auth server reads its configuration from `neon_auth.project_config` and its
  key from `neon_auth.jwks`. A source missing either restores a demo whose sign-up answers
  `Project config not found` — a reset that lands on an empty branch and cannot reseed it. Refused
  before the restore, because after it the demo is already empty.
- **A branch with no parent, and no `DEMO_SOURCE_BRANCH`.** A root branch _is_ a default branch;
  there is nothing to reset it from.
- **A source with no read-write compute.** The migrate step writes to `demo-base`, so a source
  without an endpoint is named and refused before the restore, not half-run.
- **A missing branch.** Creating infrastructure is a decision, not a retry; the message says how to
  create it and exits.
- **A connection string from the environment.** Both the write URL and the auth host are derived
  from the branch id through the API. A shell that exported production's `DATABASE_URL` or
  `NEON_AUTH_BASE_URL` cannot aim this script at production: the values are overwritten, not
  inherited, and the URL must address the branch's own compute host or the run stops before
  writing. The same holds for the migrate step, which sets `DATABASE_URL_UNPOOLED` to the source's
  URI for the child process — `scripts/load-env.mjs` does not override a variable that is already
  set.

### When it fails

A failed reset leaves a branch that still serves, and the script says what it holds:

- **The migration fails** (a bad URI, a migration that errors, a base with no endpoint): the restore
  has not run yet, so the demo is exactly as it was — still serving the previous dataset, not an
  empty branch. Fix the migration and re-run; the ledger in the log says which file failed.
- **The restore fails** (bad key, API error, a refused target): nothing was written. The branch is
  exactly as it was.
- **The emptying fails** (reseed-only path: a lock, a connection dropped): the transaction rolls
  back, so the branch keeps the last reseed's rows — valid, just not empty.
- **The reseed fails** (a bad origin, an auth endpoint that is down, a bundle that drifted): the
  branch holds the schema and no rows — an empty demo, not a half-wiped one — and the next run
  rebuilds it. `pnpm db:verify` against that state is green (measured on an emptied branch:
  `0 instance(s) checked, 0 template(s) resolved, no Gap column, no drift`).

## In CI

`.github/workflows/demo-reset.yml` runs the same script on a nightly cron and on every `v*` tag, and
can be dispatched by hand after a bundle is promoted.

**A missing `NEON_API_KEY` skips the job, green.** The key is a credential a human supplies, so
until it exists every scheduled run would be red, and a permanently red workflow is noise people
learn to ignore. The first step decides, the rest is skipped with a notice and a summary, and the
run concludes successfully. Add the secret under **Settings → Secrets and variables → Actions** to
turn the reset on; the project id and branch name are passed by the workflow and are not secrets.

The secret is set on this repository, so the job really runs. The workflow passes
`DEMO_SOURCE_BRANCH=demo-base` — the demo branch's own parent is a historical accident, and the
source is what decides where the rows come from. The migration is a step inside the script — there
is no extra job for it — and the first thing the job does with a mis-pointed source is refuse
before the restore: a red run and an untouched branch, not a copy of live data and not an empty
one. The after-reset block in the log is what proves the source carried no rows; `db-seed`'s
refusal to delete rows it does not author is what protects production, and the demo no longer
depends on it for that.

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
