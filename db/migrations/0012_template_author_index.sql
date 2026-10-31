-- 0012_template_author_index.sql — the index the library's read needs (#console 5/5).
--
-- `0011_console_columns.sql` added `record.author_user_id` and deliberately added no index with
-- it, on the grounds that nothing selected the column yet: "the index belongs with the query that
-- needs it". This is that query. `/assessment/templates` reads
--
--   WHERE record_type = 'assessment'
--     AND NOT EXISTS (… an assessment_instance row …)
--     AND (author_user_id IS NULL OR author_user_id = $1)
--
-- and so does the catalogue at `/assessment`, and so does `createInstanceFromTemplate`'s author
-- check — three reads on one column, per request, each a sequential scan without this.
--
-- **Partial, on the same predicate the read filters on.** A built-in is `NULL` and matches no
-- equality test, so indexing the NULLs would be indexing rows no index can help with: the
-- partial predicate makes the index exactly "the authored templates", which is the small half of
-- a table that grows with every template a person writes.
--
-- Nothing else: no column, no constraint, no backfill, no `gap` column. A row written before this
-- file still reads `author_user_id IS NULL`, which is the fact "the platform wrote it".
--
-- Idempotent on purpose, like 0001–0011: `db:migrate` ledgers each file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.

CREATE INDEX IF NOT EXISTS record_author_user_id_idx
  ON record (author_user_id)
  WHERE author_user_id IS NOT NULL;
