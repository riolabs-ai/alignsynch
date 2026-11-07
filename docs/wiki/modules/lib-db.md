# Module: `lib/db`

25 modules — the only place a Postgres statement is written. `pg` is the only driver; there is no ORM,
no Prisma, no Drizzle, and `pg` + `@types/pg` are the only dependencies this layer adds.

## Responsibilities

- Own the pool: one lazily-created `pg.Pool`, with the timeouts and single retry measured against the
  Neon branch ([`client.ts`](../../../lib/db/client.ts)).
- Map rows back into the content model — `lib/db/rows.ts` `safeParse`s through the `content/` schemas,
  so the model stays the single source of truth.
- Answer the reads and writes the two-party flow, the member surface and the operator console need.

## Key files

- [`client.ts`](../../../lib/db/client.ts) — the pool. Server-only because it reads `DATABASE_URL`,
  which is in no `next.config.mjs` `env` block. A missing URL is an error at **query** time, never at
  import time, so `pnpm build` needs no connection string.
- [`rows.ts`](../../../lib/db/rows.ts) — the mappers: `assessmentTemplateFromRows`,
  `assessmentInstanceFromRows`, `templateCandidateOf`, `orderedItems`, `isoInstantOf`, `parseOrThrow`.
  Pure, so a mapper can be tested without a database and reused by the `db:*` scripts.
- [`assessments.ts`](../../../lib/db/assessments.ts) — the reads that back `/assessment/[slug]`, the
  instance screen and the relationship cards/detail.
- [`relationship-payment.ts`](../../../lib/db/relationship-payment.ts) — `openPaymentObligations()`,
  `recordChargeResult()`, `markReminderSent()`, `markExpired()`. Every write is guarded
  (`charged_at IS NULL`, `expired_at IS NULL`), which is what makes the cron idempotent.
- [`admin-audit.ts`](../../../lib/db/admin-audit.ts), [`billing.ts`](../../../lib/db/billing.ts),
  [`user-profiles.ts`](../../../lib/db/user-profiles.ts) — the console's and the account's reads.

## Public API

Each module exports reader/writer functions that take plain arguments and return model objects. Two
shapes recur and are worth knowing before adding one:

- a **read** returns `undefined` for "not there" and throws for "the database did not answer" — the
  page then chooses between `notFound()` and an honest failure screen;
- a **write** that must be atomic takes a `client` (or an `ActSql`) so the caller owns the
  transaction. `poolPaymentSql` is the adapter that lets `lib/member/payment-job-run.ts` run against
  either.

## Internal structure

`db/migrations/*.sql` is the schema — 39 plain SQL files applied in order by `schema_migrations`
(`pnpm db:migrate`). The six tables of the content model (`record`, `item`, `response_option`,
`assessment_instance`, `party`, `opinion`) come from `0001_content_model.sql`;
`0013_relationship_sessions.sql` then renames two of them — `assessment_instance` → `session`,
`instance_invite` → `session_invite`, which are the names every current read uses. Later migrations
add the relationship, membership, payment, acceptance, audit and ops tables the app now needs. Neon's
Managed Auth lives in its own `neon_auth` schema and is never migrated here.

## Dependencies

- **Used by:** [`lib/flow`](lib-flow.md), [`lib/member`](lib-member.md),
  [`lib/admin`](lib-admin.md), `lib/billing`, `lib/auth`, and the one route that renders from rows.
- **Uses:** `pg`, [`content/`](content.md) for the schemas it parses through.

## Notable patterns / gotchas

- **No build-time database.** `/assessment/[slug]` is `force-dynamic` with no `generateStaticParams()`,
  and the gate runs with `DATABASE_URL` unset. A page that needs rows at build time breaks CI.
- **The Gap is a function, not a column.** A migration adding `gap`, a gap table or a generated column
  is a defect, and both `db:migrate` and `db:verify` fail on the name.
- **A client component may not value-import this layer.** It compiles and `next build` stays green,
  then every route behind the shell answers 500 at request time. `data:check` E34 catches the crossing;
  `import type` is the correct way through.
- **Secrets stay server-side.** `DATABASE_URL` and friends live in `.env.local` (gitignored) and are
  never inlined into the client bundle.
