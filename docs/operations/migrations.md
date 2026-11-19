# Migrations — one number, one step

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Migrations · prev [Iteration rhythm](iteration.md) · next [Orchestration rules](orchestration.md)

<!-- docs-nav:end -->

`db/migrations/*.sql` is the schema's only source, and `schema_migrations` is its ledger. The
runner (`scripts/db-migrate.mjs`) sorts the files **by filename** and keys the ledger by **full
filename**, which is what makes two rules load-bearing: the sort order is the apply order, and a
file's name is its permanent identity.

## The naming rule

```text
db/migrations/<number>_<slug>.sql        0042_billing_plan_prices.sql
```

- **A number identifies exactly one step.** Two files sharing a number is a defect, not a style
  nit: the pair reads as out-of-order in review, a number stops naming a step, and a third file
  joining it looks like a reordering.
- **Never renumber a file that is already applied.** Its name is its ledger key, so renaming an
  applied migration makes the ledger treat it as a new file and apply it a **second time**. The
  repair for a collision is a new number, at merge time, on the branch that has not shipped yet.
- **A file with no numeric prefix is refused too** — it cannot be ordered against the others.

## Where the rule is checked, and why not in the gate

The check runs as the **first thing `db:migrate` does**, before `loadEnv()`, before a connection
and before the first statement, and it refuses the whole run:

```bash
pnpm db:migrate --check-prefixes    # the check alone — no env, no connection, nothing written
```

It is deliberately **not** a `scripts/verify.sh` step. The gate never opens a connection, so a
`db:*` script in it would either need a database or prove nothing; the cost of a naming mistake
belongs on the run that would write it. `scripts/demo-reset.mjs` inherits the check because it
spawns the same runner.

A refused run prints both filenames and exits 1:

```text
✗ db:migrate failed: db/migrations — a migration number identifies one step (#1249):
  · 0043 is shared by 0043_first.sql and 0043_second.sql
  Give the new file the next free number. Never renumber a file that is already applied:
  renaming one changes its `schema_migrations` key, so the ledger applies it a second time.
```

## The four grandfathered pairs

Four numbers are shared on `main`. Each is **frozen by name** in
`scripts/migration-prefixes-rules.ts::LEGACY_DUPLICATE_PREFIXES`, with the reason, because both
files are applied and neither can be renamed. Every one is the same mechanism: two branches open at
once, each taking the next free number, merged the same day.

| number | files                                                             | added      |
| ------ | ----------------------------------------------------------------- | ---------- |
| `0008` | `0008_alignment_setting.sql`, `0008_initiator_email.sql`          | 2026-10-31 |
| `0026` | `0026_billing_control.sql`, `0026_template_version.sql`           | 2026-11-03 |
| `0028` | `0028_broadcast.sql`, `0028_support_inbox.sql`                    | 2026-11-03 |
| `0042` | `0042_billing_plan_prices.sql`, `0042_email_template_version.sql` | 2026-11-17 |

The freeze is per **pair**, not per number: a third file joining `0042` is refused, because the
allowlist row names the exact files that share it. Adding a row to that list is how the rule would
be defeated — a duplicate is a red preflight instead.

## The ledger

- `db:migrate` is idempotent: a file already in `schema_migrations` is skipped and says so, and
  each file runs inside its own transaction with its ledger row, so a failure leaves neither
  half-applied DDL nor a false "applied" marker.
- `pnpm db:verify` holds the ledger against the code (V34): a migration file with no ledger row is
  a column the branch does not have, and it names the file and the command that fixes it.
- `pnpm db:schema` lists the unapplied files without writing anything.

## Adding a migration

1. Take the next free number **from `origin/main` as you merge**, not as you branch — that is the
   whole failure mode above.
2. Name it `<number>_<slug>.sql`, one step.
3. Run `pnpm db:migrate` (the preflight runs first) and commit the file with the change that reads
   it.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Migrations · prev [Iteration rhythm](iteration.md) · next [Orchestration rules](orchestration.md)

<!-- docs-nav:end -->
