-- 0017_step.sql — the Steps for Improving the Relationship, one row per derived Step (#R2).
--
-- `content/steps.ts` has carried the primitive since R1: `deriveSteps`, `closeSteps`, `stepsToAdd`,
-- the deterministic `stepIdOf(relationshipId, aspectId)` and the `zStep` schema. Its header says
-- the table and its migration are "deliberately NOT in this batch" — the prototype kept the rows in
-- the browser store. This is the table, and it is the first write in the app that turns a report
-- into a plan.
--
-- **`derived_from` holds the Gap KIND(S), never their values.** A stored Gap could only drift from
-- the two Opinions it was subtracted from — the same ban every other migration carries, and the
-- reason V2 fails on any `%gap%` column name. The kind is stable (it names *which* distance
-- produced the Step); the number is not, and it is recomputed from the rows on every read.
--
-- **The CHECK is `zStep`'s `superRefine`, in SQL.** A Step either names a kind and keeps the
-- suggestion that explains it, or it was authored by a party from nothing — no kind, no
-- suggestion. `(derived_from = '{}') = (suggested_text IS NULL)` is that biconditional, so a
-- derived row cannot lose its provenance and an authored row cannot claim one.
--
-- **One derived Step per (relationship, aspect) is structural.** The partial unique index follows
-- `stepIdOf`'s rule: the id is a function of the relationship and the Aspect, so a second
-- completion that re-derives the same Aspect collides instead of growing a second row. Authored
-- Steps (`derived_from = '{}'`) sit outside the index, because a party may add as many of their
-- own Steps to an Aspect as they like.
--
-- **Nothing is deleted and nothing is rewritten except `status`.** A `closed` row is history: its
-- Gap fell to 0 in a later session, so it is kept, badged, and never counted as outstanding.
-- `closeStepRows()` is the only write that moves a row into `closed`, and `stepsToAdd()` never
-- resurrects one as `open`. `text` carries the words the parties are working to and
-- `suggested_text` keeps the sentence the product proposed, which is what makes a reworded Step
-- explainable after the fact.
CREATE TABLE IF NOT EXISTS step (
  id              TEXT        PRIMARY KEY,
  relationship_id TEXT        NOT NULL REFERENCES relationship (id) ON DELETE CASCADE,
  aspect_id       TEXT        NOT NULL,
  derived_from    TEXT[]      NOT NULL DEFAULT '{}',
  suggested_text  TEXT,
  text            TEXT        NOT NULL CHECK (length(btrim(text)) > 0),
  status          TEXT        NOT NULL CHECK (status IN ('open', 'done', 'closed')),
  created_at      TIMESTAMPTZ NOT NULL,
  CONSTRAINT step_provenance_matches_suggestion CHECK (
    (derived_from = '{}') = (suggested_text IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS step_relationship_idx ON step (relationship_id);

CREATE UNIQUE INDEX IF NOT EXISTS step_derived_aspect_key
  ON step (relationship_id, aspect_id)
  WHERE derived_from <> '{}';
