-- 0001_content_model.sql — the six content tables (#145).
--
-- The rows are the mirror of `content/record.ts` and `content/assessment.ts`, and nothing
-- here is invented: every column exists because one of those two schemas defines it, and
-- the read path (`lib/db/rows.ts`) `safeParse`s rows back through the same schemas, so the
-- database inherits the model's invariants instead of re-encoding them.
--
--   record               the post — `zRecord`
--   item                 a row inside a record — `zItem`, and `zAspect`'s two extra fields
--   response_option      an option scale's named responses — `zResponseOption`
--   assessment_instance  the row that makes a record an instance — `zAssessmentInstance.templateId`
--   party                one initiator and one counterparty — `zParty`
--   opinion              one party's scores on one Aspect — `zOpinions`
--
-- There is no `gap` column, table, view or generated column anywhere, and adding one is a
-- defect: the Gap is `gapOf()` over two scores (`content/record.ts`), so a stored copy could
-- only ever drift from the pair it was computed from and no schema could compare the two.
--
-- No `min`/`max` columns either: the score scale's ends are the literals 1 and 5 in the
-- schema, and a column would be a second authored copy of a constant.
--
-- Idempotent on purpose — `db:migrate` records each file in `schema_migrations` and skips
-- what it has already applied, but a re-run of this file alone must still be a no-op.
--
-- `neon_auth` (users, sessions, accounts, verifications) is Neon's managed Better Auth
-- schema. Nothing in this file touches it and the app never migrates it.

-- The post. `record_type` is the model's `type` under the name `content/record.ts`
-- blesses: "a database column may be `record_type`, and the model is not renamed to hide that."
CREATE TABLE IF NOT EXISTS record (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  record_type TEXT NOT NULL CHECK (record_type IN ('quiz', 'assessment', 'article')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  date        TIMESTAMPTZ NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL
);

-- A row inside a record: a question, an Aspect. `zAspect = zItem.extend({ scale: zScoreScale,
-- leftValue, rightValue })` is the SQL twin of the last three columns: they exist only on a
-- `score` item, and the CHECK below says so in one expression instead of a convention.
-- `position` is the record's own order, which E31's copy check compares.
CREATE TABLE IF NOT EXISTS item (
  record_id   TEXT NOT NULL REFERENCES record (id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  position    INT NOT NULL,
  prompt      TEXT NOT NULL,
  scale_kind  TEXT NOT NULL CHECK (scale_kind IN ('options', 'score')),
  left_value  TEXT,
  right_value TEXT,
  PRIMARY KEY (record_id, item_id),
  CONSTRAINT item_score_needs_both_values CHECK (
    (scale_kind = 'score') = (left_value IS NOT NULL AND right_value IS NOT NULL)
  )
);

-- The option scale's named responses (`zResponseOption`), for `scale_kind = 'options'`
-- items. An assessment has none today; a quiz would, and the table is the shared record's
-- half of the model rather than this template's.
CREATE TABLE IF NOT EXISTS response_option (
  record_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  option_id TEXT NOT NULL,
  position  INT NOT NULL,
  text      TEXT NOT NULL,
  PRIMARY KEY (record_id, item_id, option_id),
  FOREIGN KEY (record_id, item_id) REFERENCES item (record_id, item_id) ON DELETE CASCADE
);

-- The row that makes a record an instance. A template is simply a record with
-- `record_type = 'assessment'` and no row here — that is the whole difference between
-- a template and an instance, exactly as `strict()` makes it in the schema.
CREATE TABLE IF NOT EXISTS assessment_instance (
  record_id          TEXT PRIMARY KEY REFERENCES record (id) ON DELETE CASCADE,
  template_record_id TEXT NOT NULL REFERENCES record (id)
);

-- One Initiator and one Counterparty, structurally: the primary key IS the schema's
-- "distinct roles" refinement. Coach is v2.0 and is not a value.
CREATE TABLE IF NOT EXISTS party (
  instance_record_id TEXT NOT NULL REFERENCES assessment_instance (record_id) ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('initiator', 'counterparty')),
  name               TEXT NOT NULL,
  PRIMARY KEY (instance_record_id, role)
);

-- One party's scores on one Aspect. NOT NULL feel/wish is "Basic Mode is the floor";
-- the think/guess CHECK is "Think and Guess come together".
CREATE TABLE IF NOT EXISTS opinion (
  instance_record_id TEXT NOT NULL,
  role               TEXT NOT NULL,
  item_id            TEXT NOT NULL,
  feel               INT NOT NULL CHECK (feel BETWEEN 1 AND 5),
  wish               INT NOT NULL CHECK (wish BETWEEN 1 AND 5),
  think              INT CHECK (think BETWEEN 1 AND 5),
  guess              INT CHECK (guess BETWEEN 1 AND 5),
  PRIMARY KEY (instance_record_id, role, item_id),
  FOREIGN KEY (instance_record_id, role) REFERENCES party (instance_record_id, role) ON DELETE CASCADE,
  FOREIGN KEY (instance_record_id, item_id) REFERENCES item (record_id, item_id) ON DELETE CASCADE,
  CONSTRAINT opinion_think_comes_with_guess CHECK ((think IS NULL) = (guess IS NULL))
);
