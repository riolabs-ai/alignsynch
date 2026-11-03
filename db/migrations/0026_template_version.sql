-- 0026_template_version.sql — a template is published as an immutable version (#502b).
--
-- `502a` made a draft authorable and refused to edit a published one, because an in-place edit
-- drifts every relationship already played on it (`db:verify` V4 / `data:check` E31 compare a
-- copy to its template). This file is the mechanism that makes editing a published template safe:
--
--   template_version   one immutable row per publish: the whole validated template, as JSONB
--   relationship.template_version_id
--                      the version a relationship was created from. A relationship reads its
--                      template **through this column**, so publishing N+1 cannot reach a
--                      relationship that started on N — not its title, not its summary, not its
--                      Aspects.
--
-- **Why the payload is the whole record and not a diff.** A version is what a reader needs to
-- draw a relationship's template: `zAssessment`'s own object, parsed back through the schema by
-- `lib/db/rows.ts`. A column-per-field table would be a second copy of the model that could
-- disagree with it; a JSONB column is the model, and the parse is the check. `strict()` means a
-- payload with an extra key is refused, so this is not a junk drawer.
--
-- **Why `superseded_at` is the only mutable column.** "Immutable" is a claim about the content:
-- the words, the Aspects, the numbering and who published them never change. One fact *about* a
-- version does change — a later version exists — and it is recorded once, from NULL to an
-- instant, by the trigger below. Nothing else on the row may be rewritten, and `DELETE` is left
-- to the demo reset (`scripts/demo-reset.mjs`), which wipes the branch rather than mutating a
-- published version.
--
-- **What the status is.** `record.status` stays the *live* state (`draft` = not offered,
-- `published` = offered, `archived` = the member's archive) and the version's own `payload.status`
-- is a snapshot of the instant it was published. Unpublish is therefore a status write on the
-- record: it offers nothing and it touches no version row, so both v1 and v2 remain queryable and
-- every relationship bound to either keeps drawing what it was created from.
--
-- **The backfill binds the rows that already exist.** Every relationship created before this file
-- is bound to its template's current version, authored from the rows as they stand. The version is
-- numbered 1, `published_at` is the template record's own `date` (the instant the record went
-- live — there is no publish instant to recover, and `now()` would claim a publish nobody made),
-- and `published_by` is NULL: "before publishing was recorded", the same absence
-- `record.author_user_id` uses for the platform. `scripts/db-seed.mjs` carries the same statement
-- for a database seeded after this migration, and `db:verify` V23 proves every relationship is
-- bound either way.
--
-- No `gap` column, no `instance` in a table or column name: this file adds one table and one
-- column, and neither names an old noun.
--
-- Idempotent on purpose, like 0001–0025: `db:migrate` ledgers each file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.

-- The version row. `payload` is `zAssessment`'s own object; `version` starts at 1 and is dense per
-- template (the publish path writes `max + 1`), which is what makes "the live version" the highest
-- number rather than a flag somebody has to remember to move.
CREATE TABLE IF NOT EXISTS template_version (
  id                 TEXT        PRIMARY KEY,
  template_record_id TEXT        NOT NULL REFERENCES record (id),
  version            INT         NOT NULL CHECK (version >= 1),
  payload            JSONB       NOT NULL,
  published_at       TIMESTAMPTZ NOT NULL,
  -- **NULL is "before publishing was recorded"**: the backfill's rows and every version a
  -- fixture seeded. An instant is a Neon Auth user id, which is the actor the audit row names.
  published_by       TEXT,
  -- Set once, when a later version is published. NULL is "this is the live version".
  superseded_at      TIMESTAMPTZ,
  CONSTRAINT template_version_number_is_unique UNIQUE (template_record_id, version),
  CONSTRAINT template_version_superseded_after_publish CHECK (
    superseded_at IS NULL OR superseded_at >= published_at
  )
);

-- The live-version read (`ORDER BY version DESC LIMIT 1`) and the "what has been published for
-- this template" list are the same index: one template's versions, newest first.
CREATE INDEX IF NOT EXISTS template_version_record_version_idx
  ON template_version (template_record_id, version DESC);

-- The immutability guard. A `BEFORE UPDATE` trigger rather than a convention, because the claim
-- "editing a template never mutates version N" is only true if the database refuses it: the
-- publish path sets `superseded_at`, and every other column is frozen.
--
-- The comparison is column by column (not `NEW <> OLD`), because the message has to name what
-- moved — an operator reading a failed publish needs the column, not "row changed".
CREATE OR REPLACE FUNCTION template_version_is_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.template_record_id IS DISTINCT FROM OLD.template_record_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.published_by IS DISTINCT FROM OLD.published_by THEN
    RAISE EXCEPTION
      'template_version % is immutable: only superseded_at may be written (a published version is never edited — publish N+1)',
      OLD.id;
  END IF;
  IF OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    RAISE EXCEPTION
      'template_version % was already superseded at % — superseded_at is written once',
      OLD.id, OLD.superseded_at;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS template_version_immutable_guard ON template_version;
CREATE TRIGGER template_version_immutable_guard
  BEFORE UPDATE ON template_version
  FOR EACH ROW EXECUTE FUNCTION template_version_is_immutable();

-- The binding. Added nullable first so the backfill below can fill it, then pinned NOT NULL once
-- every row has one: a relationship with no version would have to fall back to the template's
-- working copy, and that fallback is exactly the bug this card exists to delete.
ALTER TABLE relationship ADD COLUMN IF NOT EXISTS template_version_id TEXT;
ALTER TABLE relationship DROP CONSTRAINT IF EXISTS relationship_template_version_id_fkey;
ALTER TABLE relationship
  ADD CONSTRAINT relationship_template_version_id_fkey
  FOREIGN KEY (template_version_id) REFERENCES template_version (id);

-- The backfill, first half: one version 1 per template a relationship already names. The payload
-- is assembled in the model's own field names — no `record_type`, no `author_user_id` when it is
-- NULL — so `zAssessment.safeParse` accepts it and `lib/db/rows.ts` reads it like any other row.
--
-- `ON CONFLICT (template_record_id, version)` keeps a re-run a no-op without a `WHERE` that could
-- drift from the constraint.
INSERT INTO template_version
  (id, template_record_id, version, payload, published_at, published_by, superseded_at)
SELECT 'template-version-' || r.id || '-v1',
       r.id,
       1,
       jsonb_build_object(
         'id', r.id,
         'slug', r.slug,
         'type', r.record_type,
         'status', r.status,
         'date', r.date,
         'title', r.title,
         'summary', r.summary
       ) || CASE
              WHEN r.author_user_id IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('authorUserId', r.author_user_id)
            END
         || jsonb_build_object(
              'items', COALESCE(
                (SELECT jsonb_agg(
                          jsonb_build_object(
                            'id', i.item_id,
                            'prompt', i.prompt,
                            'scale', jsonb_build_object(
                                       'kind', 'score',
                                       'min', 1,
                                       'max', 5
                                     ),
                            'leftValue', i.left_value,
                            'rightValue', i.right_value
                          ) ORDER BY i.position)
                   FROM item i WHERE i.record_id = r.id),
                '[]'::jsonb)
            ),
       r.date,
       NULL,
       NULL
  FROM record r
 WHERE r.record_type = 'assessment'
   -- A template is a record with no session row; an instance is not a template and gets no
   -- version of its own (its relationship names the template it was copied from).
   AND NOT EXISTS (SELECT 1 FROM session s WHERE s.record_id = r.id)
   AND EXISTS (SELECT 1 FROM relationship rel WHERE rel.template_id = r.id)
ON CONFLICT (template_record_id, version) DO NOTHING;

-- The backfill, second half: bind every relationship to its template's current (highest) version.
-- `DISTINCT ON … ORDER BY version DESC` is "the current version" as the publish path defines it,
-- and `IS NULL` keeps a re-run from moving a binding that already exists.
UPDATE relationship rel
   SET template_version_id = current_version.id
  FROM (
    SELECT DISTINCT ON (template_record_id) template_record_id, id
      FROM template_version
     ORDER BY template_record_id, version DESC
  ) AS current_version
 WHERE current_version.template_record_id = rel.template_id
   AND rel.template_version_id IS NULL;

-- Loudly, if anything is still unbound. That is a relationship whose `template_id` names a record
-- that is not a template (it has a `session` row of its own, or is not an assessment at all) —
-- there is no version to invent, and a NOT NULL column would fail on the next line with a message
-- that names no row.
DO $$
DECLARE
  unbound    INT;
  offenders  TEXT;
BEGIN
  SELECT count(*) INTO unbound FROM relationship WHERE template_version_id IS NULL;
  IF unbound > 0 THEN
    SELECT string_agg(id, ', ') INTO offenders
      FROM (SELECT id FROM relationship WHERE template_version_id IS NULL ORDER BY id LIMIT 5) AS sample;
    RAISE EXCEPTION
      '0026: % relationship(s) name a template with no record version to bind (first: %). A relationship is created from a published template; bind or retire the row before migrating.',
      unbound, offenders;
  END IF;
END $$;

ALTER TABLE relationship ALTER COLUMN template_version_id SET NOT NULL;
