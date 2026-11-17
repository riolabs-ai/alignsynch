-- 0042_email_template_version.sql — an admin's override of a transactional mail, as a version
-- (#1138).
--
-- **Why a version table and not `UPDATE email_template SET body = …`.** #1138 requirement 7 says
-- every save, publish and reset stores the body, the actor and the time, and requirement 6 says a
-- reset is *itself a version*. A single mutable row per template cannot answer "what did the last
-- send say, and who changed it" — which is the question an operator asks the moment a member
-- quotes a mail back at them. So the row is the version, and no row is ever edited in place except
-- to be retired once (the same shape `0026_template_version.sql` installs for assessment
-- templates, and for the same reason).
--
-- **The register stays the source of truth.** There is no `default_subject` / `default_body`
-- column here: the default is `lib/email/templates/index.ts` plus `content/email-bodies.md`, and a
-- copy of it in Postgres would be a second answer to "what does this mail say today". **No row for
-- a template means the default**, which is also why this table can be absent on a deployment that
-- has not migrated: the render path reads it, and a read that fails falls back to the default
-- (requirement: "a missing override table falls back to the default").
--
-- **`template_id` is the register's own id**, never a row id — `counterparty-invitation`,
-- `trial-ending`. A template that has two bodies per seat keeps them in one entry (the register
-- splits the body inside `relationship-expired`'s `document()`), so no role suffix is needed here
-- today; the column is free text so a future register that does split one carries
-- `trial-ended-paused.initiator` without a migration.
--
-- **One row per state, enforced by the database.**
--
--   * a template has at most one `draft`   — the editor has one working copy
--   * a template has at most one `published` — the send path resolves exactly one override
--   * every other row is `retired`, and `retired` is terminal
--
-- Two partial unique indexes rather than a status column somebody has to keep clean: a second
-- publish is a constraint violation inside `act()`'s transaction, not a duplicate the render path
-- has to break a tie for.
--
-- **The state machine is `draft → published → retired` and `draft → retired`.** A publish writes a
-- *new* `published` row carrying the draft's words (so the published row's `created_at` is when it
-- went live and its `editor_user_id` is who published it), and retires the draft and any previous
-- published row in the same statement. A save retires the previous draft and writes a new one.
-- Nothing ever moves backwards, so the history is the table in `version DESC` order.
--
-- **No `gap` column, no `instance` noun.** `db:verify` V2/V16 fail on either name; this file adds
-- one table that names neither.
--
-- Idempotent on purpose, like 0001–0041: `db:migrate` ledgers each file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.

CREATE TABLE IF NOT EXISTS email_template_version (
  -- `<template_id>-v<version>` — derived by `lib/db/email-templates.ts::emailTemplateVersionIdOf()`,
  -- and spelled here as the shape the reader can recognise in a log. TEXT like every other id in
  -- this schema (`record.id`, `template_version.id`): these are register names, not uuids.
  id             TEXT        PRIMARY KEY,
  -- The register's id (`lib/email/templates/index.ts`). Deliberately **not** a foreign key: the
  -- register is code, not a table, and a template deleted from the register must leave its history
  -- readable rather than cascading it away. `lib/admin/email-templates.ts` lists the intersection,
  -- so a row for a template the tree no longer carries is invisible to the page and never rendered.
  template_id    TEXT        NOT NULL,
  -- Dense per template, `max + 1` on write — the same numbering `template_version` uses, so "the
  -- newest row" is an ORDER BY and not a flag somebody has to remember to move.
  version        INT         NOT NULL CHECK (version >= 1),
  status         TEXT        NOT NULL CHECK (status IN ('draft', 'published', 'retired')),
  -- All three editable fields are NOT NULL and non-blank. #1138 requirement 2 refuses an empty
  -- subject or body at the boundary; the CHECK is what makes "an override with an empty body" a
  -- refusal at the row rather than a mail with no words in it.
  subject        TEXT        NOT NULL CHECK (length(btrim(subject)) > 0),
  preheader      TEXT        NOT NULL,
  body           TEXT        NOT NULL CHECK (length(btrim(body)) > 0),
  -- `user_profile.user_id` of whoever saved it — the actor `act()` already read the role of. No FK,
  -- for 0003's reason: the app does not constrain the managed auth schema, and a deleted account
  -- must not delete the history of what it published.
  editor_user_id TEXT        NOT NULL,
  -- When this row was written (a save, a publish, or the retirement of a reset is written by the
  -- statement that retires it, never as a row of its own).
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set once, by the statement that retires the row. NULL is "still draft or still published".
  retired_at     TIMESTAMPTZ,
  CONSTRAINT email_template_version_number_is_unique UNIQUE (template_id, version),
  -- A retired row always says when; a live one never does.
  CONSTRAINT email_template_version_retired_is_dated CHECK (
    (status = 'retired' AND retired_at IS NOT NULL) OR
    (status <> 'retired' AND retired_at IS NULL)
  )
);

-- At most one draft per template. The editor edits one working copy; a second draft would be a
-- second answer to "what will the next publish say".
CREATE UNIQUE INDEX IF NOT EXISTS email_template_version_one_draft
  ON email_template_version (template_id)
  WHERE status = 'draft';

-- At most one published override per template. This is the index the send path relies on: its read
-- is `WHERE template_id = $1 AND status = 'published'` with no ORDER BY and no tie-break.
CREATE UNIQUE INDEX IF NOT EXISTS email_template_version_one_published
  ON email_template_version (template_id)
  WHERE status = 'published';

-- The history read (`ORDER BY version DESC`) and the "what is this template's state" read share
-- this index: one template's versions, newest first.
CREATE INDEX IF NOT EXISTS email_template_version_template_version_idx
  ON email_template_version (template_id, version DESC);

-- The immutability guard. A `BEFORE UPDATE` trigger rather than a convention, because "a published
-- version is never edited" is only true if the database refuses it: the retire path writes `status`
-- and `retired_at` once, and every other column is frozen. Retiring a retired row is refused too —
-- `retired` is terminal, so a double reset cannot silently re-date the moment a mail stopped
-- being the published one.
CREATE OR REPLACE FUNCTION email_template_version_is_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.template_id IS DISTINCT FROM OLD.template_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.preheader IS DISTINCT FROM OLD.preheader
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.editor_user_id IS DISTINCT FROM OLD.editor_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'email_template_version % is immutable: only status and retired_at may be written (a version is never edited — save a new one)',
      OLD.id;
  END IF;
  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION
      'email_template_version % was retired at % — retired is terminal',
      OLD.id, OLD.retired_at;
  END IF;
  -- The only transition a row may make: draft|published -> retired, exactly once.
  IF NEW.status IS DISTINCT FROM 'retired' THEN
    RAISE EXCEPTION
      'email_template_version % may only move to retired (was %); a new state is a new row',
      OLD.id, OLD.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS email_template_version_immutable_guard ON email_template_version;
CREATE TRIGGER email_template_version_immutable_guard
  BEFORE UPDATE ON email_template_version
  FOR EACH ROW EXECUTE FUNCTION email_template_version_is_immutable();
