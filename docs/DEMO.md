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
[DEMO-AUTH.md](DEMO-AUTH.md) for the credentials' shape, how the role field works, and `/demo`,
the PIN-gated panel that signs a browser in as one of them (`DEMO_AUTH=1` plus a `DEMO_PIN`;
refused in production without `DEMO_ALLOW_PRODUCTION=1` as well).

## What a reset is

Three operations, in this order, and nothing else:

1. **Reset the branch from its parent.** One call — `POST /projects/<id>/branches/<branch>/restore`
   with `source_branch_id` = the branch's parent, which is what `neon branches reset <branch>
   --parent` (or `restore ^parent`) runs. It is atomic: there is no window in which half the data is
   gone. A script of `DELETE`s would have as many half-finished states as it has statements, and
   one of them always looks like a valid demo until you read it.

   The reset brings the parent's **data** with it, and the parent is the live branch: it holds the
   assessment rows the app creates at runtime (two people starting one is enough) and the accounts
   that created them. Neither belongs in a public demo, so:

2. **Empty the branch's content, in one transaction.** The six content tables, `user_profile`,
   `demo_account` and `neon_auth`'s users go, in dependency order, inside one `BEGIN … COMMIT` on a
   branch that is already valid. This is not the reset — the reset already happened, atomically —
   and it is deliberately here rather than in `db-seed`, whose refusal to delete a row it did not
   author is the right rule on **production** and the wrong one on a demo. A failure here rolls the
   transaction back and leaves the parent's copy, which also serves.

3. **Reseed from `data/bundles/demo-dataset.alignsynch.json`.** `scripts/db-seed.mjs` with
   `DEMO_AUTH=1`, pointed at _that branch's_ connection string and _that branch's_ auth host. The
   seed reads the bundle through the importer's own reader, asserts it is still the canonical export
   of `data/assessments.ts` (E32's rule, at the point of use), writes the six content tables and
   creates the three accounts. None of that logic lives in the reset script: a second writer would
   be a second definition of "seeded".

The reset is the **only** bound on the demo. There is no session expiry and no TTL, by decision on
#185: a visitor's state does not decay, and the next nightly reset is what ends every session.

## What it prints

Row counts before the reset, after the reset, after the emptying and after the reseed; then the six
counts the bundle itself declares, compared against the branch; then a verdict. Measured on the real
demo branch — its parent's copy carried 10 records (two of them created at runtime) and three real
accounts, none of which survive:

```
▶ before                    ▶ after the emptying        ▶ after the reseed
  record                 10   record                  0   record                 8
  item                   50   item                    0   item                  40
  opinion                60   opinion                 0   opinion               40
  party                  12   party                   0   party                  8
  demo_account            0   demo_account            0   demo_account           3
  neon_auth user          3   neon_auth user          0   neon_auth user         3

▶ the seeded rows against data/bundles/demo-dataset.alignsynch.json
  record                       8      bundle says 8
  …
  row-set     matches the bundle
  accounts    3 demo account(s), one profile and one auth user each
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
- **The emptying fails** (a lock, a connection dropped): the transaction rolls back, so the branch
  is still the parent's copy — valid, just not yet the demo.
- **The emptying lands and the reseed fails** (a bad origin, an auth endpoint that is down, a
  bundle that drifted): the branch holds the schema and no rows — an empty demo, not a half-wiped
  one — and the next run rebuilds it. `pnpm db:verify` against that state is green (measured on the
  emptied branch: `0 instance(s) checked, 0 template(s) resolved, no Gap column, no drift`), and
  green again on a branch holding the parent's copy (`4 instance(s) checked, 4 template(s)
  resolved`).

## In CI

`.github/workflows/demo-reset.yml` runs the same script on a nightly cron and on every `v*` tag, and
can be dispatched by hand after a bundle is promoted.

**A missing `NEON_API_KEY` skips the job, green.** The key is a credential a human supplies, so
until it exists every scheduled run would be red, and a permanently red workflow is noise people
learn to ignore. The first step decides, the rest is skipped with a notice and a summary, and the
run concludes successfully. Add the secret under **Settings → Secrets and variables → Actions** to
turn the reset on; the project id and branch name are passed by the workflow and are not secrets.

The secret is set on this repository, so the job really runs. Its first run is what found the
emptying step: the parent's head carried two assessment records the app had created at runtime and
three real accounts, and `db-seed` refused the rows — correctly, because that refusal protects
production. The demo's answer is step 2 above, not a looser seed.

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
