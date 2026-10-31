-- 0011_console_columns.sql — the three columns the signed-in console needs (#289 follow-up).
--
-- The console IA (`console-ia.md` §6) lists every fact a signed-in surface would want and sorts
-- them into "already computable" and "needs a column". This file adds the three that are rows and
-- not derivations, and nothing else. Each is **nullable, with no default and no backfill**: a
-- migrated database is byte-for-byte the data it was, plus three columns every existing row reads
-- as "not said".
--
--   1. record.author_user_id            who authored a template, when a person did.
--   2. assessment_instance.name         a relationship's own name, when it has one.
--   3. party.submitted_at               when a seat answered.
--
-- **1. `record.author_user_id` — the template's author.** "My Templates" is a `record` list
-- filtered by author, and until this column the model had no author: `templates/route.ts` writes
-- none deliberately ("the content model has none"), so four seeded templates and one a person
-- writes are the same kind of row. NULL is the whole of "the platform wrote this" — every seeded
-- template, and every record written before this column. That is why it is **not** backfilled
-- with a sentinel: a sentinel would be a fake author, and the distinction the console needs is
-- precisely "a person or nobody". No index is needed to *read* the list; `record` is small and the
-- list is `WHERE author_user_id = $1` over a table of dozens.
--
-- **2. `assessment_instance.name` — the relationship's own name.** Every list today renders the
-- *template's* title, so two instances of "Parent & Child" are two identical rows. NULL means
-- **unnamed**, and every surface falls back to the template title (`instanceNameOf()` in
-- `content/assessment.ts`) — so existing rows render exactly what they render now, with no
-- generated name stored to make them look authored. A backfilled copy of the template title would
-- be a second authored copy of a fact the template already holds: it would stop tracking the title
-- it was copied from, and no later read could tell a generated name from one a person chose.
--
-- **3. `party.submitted_at` — when a seat answered.** Tier 2 in the spec: support triage ("stuck
-- at Connected since when"), no UI this card. It is a real fact and not a stored status: a pair of
-- `opinion` rows says the seat *answered*, never *when*, and the instance's status stays derived
-- from the rows (`instanceStatusOf()`, `0002_two_party_flow.sql`). Every existing row reads NULL —
-- seeded parties answered and nobody recorded the instant, which is "we do not know", and the
-- honest answer to a question asked of history rather than a value invented for it.
--
-- **No `gap` column, no `stage` column.** Nothing here is a measure or a derived stage: the Gap is
-- `gapOf()` over two scores and a stage is `relationshipStage()` over the rows that already exist
-- (`content/stages.ts`). `db:verify` V2 fails on any column whose name mentions a gap; V15 fails
-- when these three columns are missing, when any of them is NOT NULL, when any carries a DEFAULT,
-- or when a party is marked submitted without having answered every Aspect.
--
-- Idempotent on purpose, like 0001–0010: `db:migrate` ledgers each file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.

ALTER TABLE record ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE assessment_instance ADD COLUMN IF NOT EXISTS name TEXT NULL;
ALTER TABLE party ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

-- The SQL twin of `zUserId`: Neon Auth's identifier, not a kebab id this repo authors, so its
-- *shape* is not constrained — only that a stored value is a value (no empty string, no padded
-- whitespace) and not longer than the schema accepts. NULL is "nobody", never "an empty author".
ALTER TABLE record DROP CONSTRAINT IF EXISTS record_author_user_id_shape;
ALTER TABLE record
  ADD CONSTRAINT record_author_user_id_shape CHECK (
    author_user_id IS NULL
    OR (
      author_user_id = btrim(author_user_id)
      AND length(author_user_id) BETWEEN 1 AND 128
    )
  );

-- `name` is a label a person writes, so NULL and "" are different facts: NULL is unnamed (the
-- surface falls back to the template title), and a blank string is a band nobody chose. 120 is the
-- schema's own authored limit (`zAssessmentInstance.name`), restated here so the database cannot
-- hold a name the model would reject.
ALTER TABLE assessment_instance DROP CONSTRAINT IF EXISTS assessment_instance_name_shape;
ALTER TABLE assessment_instance
  ADD CONSTRAINT assessment_instance_name_shape CHECK (
    name IS NULL
    OR (
      name = btrim(name)
      AND length(name) BETWEEN 1 AND 120
    )
  );

-- No CHECK on `submitted_at`: "marked submitted" and "answered every Aspect" are a row pair, not
-- a row, and Postgres cannot express that in a constraint without a trigger this repo does not
-- write. The invariant lives in `db:verify` V15 instead, where the other cross-row rules live
-- (V5's party roles, V6's unanswered Aspects).
