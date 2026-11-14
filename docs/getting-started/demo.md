# The demo — one branch, one base, one reset, one bundle (#185)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Start here** › The demo · prev [Demo auth](demo-auth.md) · next [Request → release](workflow.md)

<!-- docs-nav:end -->

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
[DEMO-AUTH.md](demo-auth.md) for the credentials' shape, how the role field works, and `/demo`,
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

   **A branch with children needs `preserve_under_name`.** The API answers `422 — Branch has
   children, preserve_under_name is required` to a restore of a branch that has any branch cut from
   it, which is how the nightly job failed every night for as long as the demo had one. The body is
   built by `scripts/demo-restore-plan.mjs` (pure, proved by `tests/demo-restore-plan.test.ts`):
   with no children it sends `source_branch_id` alone, and with children it also sends the branch's
   state to be preserved as `<branch>-preserved-<UTC stamp>`. The API moves every child under that
   preserved branch, so the demo comes out of the restore with none and the next run needs nothing
   different — the repair is once per child, not once per night. A preserved branch is a real
   branch: one against the project's branch limit, the storage its rows occupy, no compute. It is a
   recovery point, so the newest one per branch is kept — but it is not kept forever: the reset's
   pre-flight (`scripts/demo-branch-prune.mjs`, proved by `tests/demo-branch-prune.test.ts`) retires
   a preserved branch that is not the newest for its parent, and any older than
   `DEMO_PRESERVED_MAX_AGE_DAYS` (7). See [the branch ceiling](#the-branch-ceiling) for why that
   bound exists and what it never touches.

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
landed on an empty branch. Since #865 `db-seed` has exactly one bundle-scoped exception, described
below: it sweeps `relationship` rows the bundle does not describe. A `record` row is still refused,
never deleted.

### A drifted branch converges instead of refusing (#865)

The demo branch is shared fleet-wide, so it collects rows no seed authored — a killed `flow:e2e`
used to leave its `relationship` row behind, because `DELETE FROM record` never took it: a
relationship is keyed by the template, not by the instance. `pnpm db:seed` then aborted on them
(`relationship: expected 4 row(s) … found 38`) _after_ phase 1 had removed the demo accounts, which
is how the branch lost its only admin identity. Now phase 1 sweeps them:

- **The predicate is the bundle, and nothing else.** Every `relationship` whose id is not
  `relationship-<instance id>` for an instance in the source goes, children first —
  `relationship_payment`, `relationship_member`, `coach_invite`, then `opinion`, `party`,
  `session_invite`, `session`, then the `relationship` itself, because `0036` declares that FK with
  no cascade. It is never a delete by email, by id prefix or by "looks like a test row".
- **The exact-count assertion is unchanged.** Convergence is what makes it affordable; weakening it
  is what would make the next drift invisible.
- **`record` rows are still refused, not deleted.** A record this seed did not author is content
  somebody may have meant: the seed names it and rolls back, and the sweep never touches `record`.
- **`pnpm db:seed:check`** (or `node scripts/db-seed.mjs --check`) prints what the sweep _would_
  remove and exits **1** on any drift — read-only, no advisory lock, no write, no auth call. It is
  the safe question to ask about a branch every card shares, and it answers 0 when every
  relationship row is the bundle's.

`scripts/flow-e2e.mjs` also cleans up after itself — the relationship, its payment and membership
rows, and the account it signed up — in a `finally` and on `SIGINT`/`SIGTERM`. The sweep is the net
for a `kill -9`, not the plan.

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
\#185: a visitor's state does not decay, and the next nightly reset is what ends every session.

## What it prints

Row counts before the reset, after the reset and after the reseed; then the six counts the bundle
itself declares, compared against the branch; then a verdict. The middle column is the evidence
part 2 checks: it reads **zeros**, because the schema-only source carries no rows. A non-zero there
means the source is holding data, which is the case the source refusal exists to make impossible.

```text
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

- **A project with no free branch slot.** A restore spends one, so at the ceiling the run stops
  before it writes anything, in words that name the branches holding the slots — never with the
  API's raw `422 — branches limit exceeded`. See [the branch ceiling](#the-branch-ceiling).
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

### The branch ceiling

Neon's plan gives this project ten branches, and a **restore spends one** — even a restore that
preserves nothing. On 2026-11-12 the nightly reset failed twice on `422 — branches limit exceeded`
while the project held ten of ten and the restore body carried no `preserve_under_name` at all (run
43263203497's log: `children none — the body carries no preserve_under_name`). The slots had been
taken by the reset's own recovery points, and nothing was watching the ceiling.

So the reset checks capacity **before** it writes anything (`scripts/demo-branch-prune.mjs`):

1. It reads the project's branches and applies the preserved-branch policy. A branch is a candidate
   only when its name parses as `<branch>-preserved-<YYYYMMDD-HHMMSS>`; the newest per parent and
   anything younger than `DEMO_PRESERVED_MAX_AGE_DAYS` (7) are kept, and the rest are deleted
   (`DELETE /projects/{id}/branches/{id}`). The clock is the **stamp in the name**, not
   `created_at` — a preserved branch reports its parent's creation date, which for
   `demo-preserved-20261106-111855` is the day `demo-base` was cut.
2. It re-reads the list and, if the project is still at or over its limit, **refuses by name**: the
   count, the ceiling, every branch that holds a slot and why it was kept. The raw 422 is never
   surfaced; if the API answers one anyway (a slot filled between the two reads) the error is
   translated into the same sentence.

What it never deletes, whatever the name looks like: `production`, `demo`, `demo-base`, the
project's default branch by its own flag, anything in `DEMO_KEEP_BRANCHES`, and the experiment
branches `coach-card`, `rel-schema-533-p1`, `initiator-crud-533-p2`, `lapse-533-p3`. Those four are
the owner's work in progress: they are named in the code so that a later reader who notices they
occupy four of the ten slots does not "fix" the problem by deleting them. Anything whose name is not
a preserved branch is kept too — the policy prunes what the reset created, never what a person made.

`--dry-run` prints the same plan and the count it would delete (`would prune N`), deletes nothing,
and decides capacity as if the deletions had happened — so it answers "is tomorrow's run wedged?"
without touching the project.

Tuning is by environment: `DEMO_BRANCH_LIMIT` (default 10), `DEMO_PRESERVED_MAX_AGE_DAYS` (default
7) and `DEMO_KEEP_BRANCHES` (comma- or space-separated names). The gate and `pnpm test` never make a
live Neon call: the policy is a pure function of the branch list and a clock, and
`tests/demo-branch-prune.test.ts` drives it over a fake API.

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

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Start here** › The demo · prev [Demo auth](demo-auth.md) · next [Request → release](workflow.md)

<!-- docs-nav:end -->
