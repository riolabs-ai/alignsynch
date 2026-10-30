# The demo — one branch, one base, one reset, one bundle (#185)

The demo is a **Neon branch** named `demo` whose parent is **`demo-base`**: a schema-only branch
holding the migrations' schema, the `schema_migrations` ledger and no rows — no app deployment, no
data. It runs the same code as everything else and holds the same six content tables; what makes it
a demo is that it is disposable, and the thing that makes it disposable is a command.

The base is why production data never reaches the demo. The reset restores `demo` from its parent,
so the parent is the demo's entire supply of data: while that parent was `production`, every
nightly reset copied the live branch's runtime rows and real auth accounts onto the branch a public
URL serves, for as long as the emptying took. With a schema-only parent the restore lands on an
empty branch, so the copy cannot happen at all — the exposure is removed by topology, not by a
faster `DELETE`.

```bash
pnpm demo:reset        # migrate `demo-base`, restore `demo` from it, reseed from the bundle
```

Three demo accounts (`initiator@`, `counterparty@`, `admin@demo.alignsynch.test`) are created by
that reseed, through the demo branch's own sign-up endpoint — see
[DEMO-AUTH.md](DEMO-AUTH.md) for the credentials' shape and how the role field works.

## What a reset is

Three operations, in this order, and nothing else:

1. **Migrate the source (`demo-base`).** `node scripts/db-migrate.mjs` against the base's own
   unpooled connection string, run from inside the reset script with `DATABASE_URL_UNPOOLED` set to
   the parent's URI. The base is schema-only, and a schema-only branch still drifts: every migration
   written after the base was cut is a table or a column the demo would silently lack, because the
   restore copies the schema the base happens to have at that moment. `db:migrate` is idempotent and
   ledgered (`schema_migrations`), so this is one connection and a printed ledger when there is
   something to apply, and a no-op when there is not. **That is why the base cannot drift: the reset
   migrates it before every restore, in the same run.** `--skip-migrate` is the manual/offline
   opt-out, and the step is skipped entirely on `--skip-reset`.

2. **Restore the branch from its parent.** One call — `POST /projects/<id>/branches/<branch>/restore`
   with `source_branch_id` = `demo-base`, which is what `neon branches reset <branch> --parent` (or
   `restore ^parent`) runs. It is atomic: there is no window in which half the data is gone. A script
   of `DELETE`s would have as many half-finished states as it has statements, and one of them always
   looks like a valid demo until you read it.

   The parent holds no rows, so the branch now holds the schema and nothing else — that is the
   property the base exists for. Production data cannot enter the demo, and a demo re-parented onto
   the project's default branch is refused before anything is written
   (`scripts/demo-parent-guard.mjs`, used by `assertResettable()`): the source is a topology, not a
   flag someone can pass.

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

`demo-base` must never hold rows or an app deployment. It is a schema, not an environment: nothing
reads it directly, so a row written there is invisible until a restore copies it into the demo, and
a deployment pointed at it would serve an empty database with no auth users.

The reset is the **only** bound on the demo. There is no session expiry and no TTL, by decision on
#185: a visitor's state does not decay, and the next nightly reset is what ends every session.

## What it prints

Row counts before the reset, after the reset and after the reseed; then the six counts the bundle
itself declares, compared against the branch; then a verdict. The middle column is the evidence
part 2 checks: it reads **zeros**, because the schema-only source carries no rows. A non-zero there
means the source is holding data, which is the case the parent refusal exists to make impossible.

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
- **A demo whose parent is the default branch.** The parent is the demo's whole supply of data, so
  a parent of `production` would copy live rows and real accounts onto the branch a public URL
  serves. That is a refusal before the first write, not a warning — the source is the schema-only
  base, and re-parenting the demo is the only way to change it.
- **A branch with no parent.** A root branch _is_ a default branch; there is nothing to reset it
  from.
- **A source with no read-write compute.** The migrate step writes to `demo-base`, so a base
  without an endpoint is named and refused before the restore, not half-run.
- **A missing branch.** Creating infrastructure is a decision, not a retry; the message says how to
  create it and exits.
- **A connection string from the environment.** Both the write URL and the auth host are derived
  from the branch id through the API. A shell that exported production's `DATABASE_URL` or
  `NEON_AUTH_BASE_URL` cannot aim this script at production: the values are overwritten, not
  inherited, and the URL must address the branch's own compute host or the run stops before
  writing. The same holds for the migrate step, which sets `DATABASE_URL_UNPOOLED` to the parent's
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

The secret is set on this repository, so the job really runs. The migration is a step inside the
script — there is no extra job for it — and the first thing the job would do with a re-parented demo
is refuse: a parent that is the project's default branch is a red run and an untouched branch, not a
copy of live data. The after-reset block in the log is what proves the source carried no rows; the
`db-seed` refusal to delete rows it does not author is what protects production, and the demo no
longer depends on it for that.

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
