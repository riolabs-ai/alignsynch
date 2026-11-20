-- 0044_activity_event.sql — the activity feed's table (demo reset, card t_6cc2b56a).
--
-- **Why this table exists.** The relationship detail page promises a timeline — who created the
-- relationship, when the invitation went out, who joined, who filled their sheet in, when the report
-- was published — and until this file the only thing that could draw one was a render-time guess
-- over `party`, `opinion` and `relationship`, which cannot say *who did what*: an `opinion` row is a
-- score, not an act, and a lifecycle word is one fact, not a sequence. So the feed is a table of
-- events, and a writer supplies them.
--
-- **`source` is `('seed','simulate')` and there is deliberately no `'cron'`.** Measured on the tree
-- this card was written against: `vercel.json` carries no `crons` block and no route in the app is
-- scheduled, and a Vercel cron entry runs on **production deployments only** — `demo.alignsynch.com`
-- is a branch deployment on the `demo` ref, so declaring one would fire it against production. The
-- two writers that exist are therefore a seed (`scripts/db-seed.mjs`, through
-- `lib/db/activity-events.ts`) and an explicit simulate action (`pnpm demo:simulate-activity`).
-- A source word that claims a scheduler the tree does not have is a lie the repo then lives with, and
-- a reader sorting the feed by "what the machine did" would be sorting a fiction. `db:verify` **V35**
-- reads this CHECK's own definition and fails on a `'cron'` in it.
--
-- **`idempotency_key` is the row's identity, and unique.** Both writers are re-runnable — the seed
-- runs on every `db:verify` on the demo branch, the simulate action on every press — and neither may
-- duplicate a row. The key is derived, never random: `<source>/<relationship>/<kind>/<actor>` (see
-- `lib/activity/events.ts::activityIdempotencyKey`). The UNIQUE constraint is what makes "a re-run
-- does not duplicate" a property of the table rather than of the one INSERT that happens to pass
-- through it; the writer is `INSERT … ON CONFLICT (idempotency_key) DO NOTHING`, in the same
-- transaction as the rest of the seed's phase 2.
--
-- **A seed-owned row is replaced, never accumulated.** The seed deletes `source = 'seed'` inside its
-- own transaction before writing this run's rows (`replaceSourceActivity`), so a relationship the
-- dataset stops describing does not leave a stale event behind, and a rollback puts the previous
-- rows back. `source = 'simulate'` is replaced by the simulate action for the same reason: the
-- timeline it plays is a *set*, not an append-only log.
--
-- **`occurred_at` is the event's instant, `created_at` is the row's.** The seed derives the first
-- from the session's own fixture date (`seededLifecycleOf`, no wall-clock read), the simulate action
-- from the instant it was pressed — which is exactly why `pnpm demo:verify` asserts a **bounded
-- band** for the simulate source and an exact count only for the seed's.
--
-- **The party reference is a real foreign key, not a convention.** A feed row usually names the seat
-- that did the thing: `(session_record_id, party_role)` references `party (session_record_id, role)`,
-- which is that table's own primary key, so an event whose actor is not a seat on the session cannot
-- be written. Both columns are nullable **as a pair** (the CHECK) because two of the kinds are not
-- anybody's act — a relationship closed by support and one that lapsed on its timetable are facts
-- about the relationship, and inventing a seat to satisfy a NOT NULL would be the fiction this file
-- exists to avoid. MATCH SIMPLE means a NULL pair is not enforced; V35 names every non-null pair
-- that does not resolve, and every row whose seat belongs to a *different* relationship than the one
-- it names.
--
-- **`kind` is a closed vocabulary, and it is the feed's nouns.** The five acts the product actually
-- performs plus the two closures: a new word here is a migration, because a feed that renders a
-- string nobody wrote copy for is an orphan in the UI rather than a row.
--
-- No Gap column and no `instance` noun: this file adds one table, and neither naming rule (V2/V16)
-- is widened by it.
--
-- Idempotent on purpose, like 0001–0043: `db:migrate` ledgers this file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.

CREATE TABLE IF NOT EXISTS activity_event (
  id                BIGSERIAL    PRIMARY KEY,
  -- 'seed' (the dataset's own timeline) or 'simulate' (an explicit action played it just now).
  source            TEXT         NOT NULL,
  -- What happened, from the closed vocabulary below.
  kind              TEXT         NOT NULL,
  -- Every event is about one relationship. `ON DELETE CASCADE` because a feed row without its
  -- relationship is a row nothing can render: the demo reset and the seed's stray sweep remove
  -- relationships, and their events go with them.
  relationship_id   TEXT         NOT NULL REFERENCES relationship (id) ON DELETE CASCADE,
  -- The seat that did it — both columns or neither (the CHECK below), and a real FK to `party`.
  session_record_id TEXT,
  party_role        TEXT,
  -- The sentence the feed shows. A stored string and not a template: the event is *what happened*,
  -- and a render that re-derives the wording from the kind would have to re-derive the names too.
  summary           TEXT         NOT NULL,
  occurred_at       TIMESTAMPTZ  NOT NULL,
  -- `<source>/<relationship>/<kind>/<actor>` — derived, so a re-run collides instead of duplicating.
  idempotency_key   TEXT         NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT activity_event_source_vocabulary
    CHECK (source IN ('seed', 'simulate')),
  CONSTRAINT activity_event_kind_vocabulary
    CHECK (
      kind IN (
        'relationship.created',
        'invite.sent',
        'invite.claimed',
        'answers.submitted',
        'report.published',
        'relationship.closed'
      )
    ),
  CONSTRAINT activity_event_party_role_vocabulary
    CHECK (party_role IS NULL OR party_role IN ('initiator', 'counterparty')),
  -- Both halves of the seat reference, or neither: a session with no role cannot name an actor, and
  -- a role with no session cannot be resolved to one.
  CONSTRAINT activity_event_party_is_a_pair
    CHECK ((session_record_id IS NULL) = (party_role IS NULL)),
  CONSTRAINT activity_event_party_is_a_seat
    FOREIGN KEY (session_record_id, party_role)
    REFERENCES party (session_record_id, role) ON DELETE CASCADE,
  CONSTRAINT activity_event_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT activity_event_summary_is_written CHECK (length(btrim(summary)) > 0),
  CONSTRAINT activity_event_occurred_at_is_an_instant CHECK (occurred_at > '2020-01-01')
);

-- The feed's own read: one relationship's timeline, newest first.
CREATE INDEX IF NOT EXISTS activity_event_relationship_occurred_idx
  ON activity_event (relationship_id, occurred_at DESC);

-- The census `db:verify` V35 prints and `demo:verify` bounds: the rows one source wrote.
CREATE INDEX IF NOT EXISTS activity_event_source_occurred_idx
  ON activity_event (source, occurred_at DESC);
