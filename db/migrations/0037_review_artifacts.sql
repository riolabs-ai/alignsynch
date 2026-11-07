-- 0037_review_artifacts.sql — the store behind `/admin/review` (#667, page #665).
--
-- The page can ship read-only from a fixture. What cannot is the two things the owner asked for
-- in their own words: *"each notice is a review artifact todo list and feedback issue list like
-- GH issues/pr lists"*. A TODO list you cannot tick and an issue list you cannot raise are
-- decoration, so this file is the write half — four tables, all additive, all keyed to an
-- artifact.
--
--   review_artifact        one row per prototype / diagram / report. The authored catalogue is
--                          `data/review-artifacts.ts` and `pnpm db:seed` mirrors it here, the way
--                          `billing_plan` is mirrored from `data/billing-plans.ts`. `path` is a
--                          **relative** path under `docs/review/`, refused absolute and refused
--                          with `..` by 0037's own CHECK: a stored path is rendered in the viewer,
--                          and a row in a client database must not be able to become a file read.
--   review_todo            a checklist item. `done_at` is the fact and the checkbox is a view of
--                          it — a `done BOOLEAN` would have to be paired with a date to age the
--                          list, and the pair is the column.
--   review_issue           feedback, in GitHub's vocabulary: a `number` per artifact, a title, a
--                          body, a state, labels, an author and the two instants. `#12 open` is
--                          the shape the owner named, and it is the reason this is a table.
--   review_issue_comment   the thread under an issue. One row per comment; nothing here is edited
--                          after it is written, which is what makes the thread an order.
--
-- **The number is per artifact and monotonic, and SQL is what makes that true.** `number` is NOT
-- a sequence: two artifacts both have an issue `#1`, so the counter is `max(number) + 1` scoped to
-- one artifact, which is a read-then-write and therefore a race under READ COMMITTED — two people
-- raising issue 12 at the same moment is exactly the bug that makes the list untrustworthy. Three
-- things hold it:
--
--   1. `UNIQUE (artifact_id, number)` — the database refuses the second `12` whatever the writer
--      believed. This is the constraint, not the convention.
--   2. the insert takes `SELECT … FROM review_artifact WHERE id = $1 FOR UPDATE` **first**, so two
--      raisers in the same artifact serialise on that row and the second one reads the first one's
--      number. `lib/db/review-artifacts.ts::nextIssueNumber()` says so in one comment.
--   3. the writer retries once on `23505`, because a lock is a plan and the constraint is the
--      guarantee — the retry is what turns a lost race into the next number instead of an error.
--
-- **`closed_at` is paired with `state`, not derived from it.** `state` is what a person did,
-- `closed_at` is when; `closed` with no instant is a row that cannot be aged and `open` with one is
-- a row that was reopened and forgot. `review_issue_state_pair` is the CHECK, `zReviewIssue`'s
-- refinement is the model's copy of the same rule, and `V29` in `scripts/db-verify.mjs` names a
-- row that has it anyway (a database where the constraint was dropped by hand is still a database
-- somebody will read). Reopening clears the instant in the same statement — `open` is not
-- "closed once".
--
-- **No foreign key to `neon_auth`.** `author_user_id` is text with no reference, for `0003`'s
-- reason: `public` holds no FK into the managed schema, so a deleted account leaves an author id
-- that no longer resolves, which is honest history rather than a broken constraint. The artifact
-- FKs are real — `ON DELETE CASCADE`, because a checklist item about a deleted artifact is a row
-- about nothing.
--
-- **No derived column anywhere.** The list surface draws `3 / 7 done` and `5 open · 2 closed`;
-- both are counts over these rows (`content/review.ts::reviewArtifactProgressOf`) and neither is
-- stored, the same rule the Gap has. A stored count is a second copy that disagrees the first
-- time a write forgets it.
--
-- Idempotent on purpose, like 0001–0036: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of this file alone must still be a no-op.
--
-- **Demo first, production after the owner's word.** `db/migrations/` is the one class of change
-- that reaches a client database, and this file was applied to the demo branch only (#667). The
-- production window is stated in the PR; it is not this file's decision to make.

CREATE TABLE IF NOT EXISTS review_artifact (
  -- A kebab id the fixture authors (`review-relationship-lifecycle-v4`), not a UUID: the id is
  -- quoted in a URL and in an audit row, and the catalogue is a file people edit by hand.
  id           TEXT        PRIMARY KEY,
  slug         TEXT        NOT NULL UNIQUE,
  title        TEXT        NOT NULL,
  kind         TEXT        NOT NULL,
  version      TEXT        NOT NULL,
  path         TEXT        NOT NULL,
  -- When the capture was taken — a fact about the file, not about this row.
  captured_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_artifact_kind_vocabulary CHECK (kind IN ('prototype', 'diagram', 'report')),
  CONSTRAINT review_artifact_title_present CHECK (length(btrim(title)) > 0),
  CONSTRAINT review_artifact_version_present CHECK (length(btrim(version)) > 0),
  -- The traversal rule, at the store: relative, under `docs/review/`, `.html`. `/etc/passwd`,
  -- `../data/assessments.ts` and `https://…` are all refused by this one line.
  CONSTRAINT review_artifact_path_relative CHECK (
    path ~ '^docs/review/[a-z0-9][a-z0-9/._-]*\.html$'
    AND path NOT LIKE '%..%'
  )
);

CREATE TABLE IF NOT EXISTS review_todo (
  -- `review-todo-<uuid>`: kebab-case, so it parses through `zId` like every other id in this
  -- model, and unique without a sequence.
  id              TEXT        PRIMARY KEY,
  artifact_id     TEXT        NOT NULL REFERENCES review_artifact (id) ON DELETE CASCADE,
  body            TEXT        NOT NULL,
  -- NULL is "not done". There is no `done` column: the instant is the state, and pairing the two
  -- would be a second copy that disagrees the first time an UPDATE forgets one.
  done_at         TIMESTAMPTZ NULL,
  author_user_id  TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_todo_body_present CHECK (length(btrim(body)) > 0),
  CONSTRAINT review_todo_author_present CHECK (length(btrim(author_user_id)) > 0)
);

CREATE TABLE IF NOT EXISTS review_issue (
  id             TEXT        PRIMARY KEY,
  artifact_id    TEXT        NOT NULL REFERENCES review_artifact (id) ON DELETE CASCADE,
  number         INTEGER     NOT NULL,
  title          TEXT        NOT NULL,
  -- Empty is allowed and means "the title is the whole report"; the model bounds the length.
  body           TEXT        NOT NULL DEFAULT '',
  state          TEXT        NOT NULL DEFAULT 'open',
  labels         TEXT[]      NOT NULL DEFAULT '{}',
  author_user_id TEXT        NOT NULL,
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ NULL,
  -- The constraint that makes the number trustworthy under concurrent inserts.
  CONSTRAINT review_issue_number_per_artifact UNIQUE (artifact_id, number),
  CONSTRAINT review_issue_number_positive CHECK (number > 0),
  CONSTRAINT review_issue_title_present CHECK (length(btrim(title)) > 0),
  CONSTRAINT review_issue_state_vocabulary CHECK (state IN ('open', 'closed')),
  -- The impossible state, refused here as well as in `zReviewIssue` and in `V29`.
  CONSTRAINT review_issue_state_pair CHECK ((state = 'closed') = (closed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS review_issue_comment (
  id             TEXT        PRIMARY KEY,
  issue_id       TEXT        NOT NULL REFERENCES review_issue (id) ON DELETE CASCADE,
  body           TEXT        NOT NULL,
  author_user_id TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_issue_comment_body_present CHECK (length(btrim(body)) > 0),
  CONSTRAINT review_issue_comment_author_present CHECK (length(btrim(author_user_id)) > 0)
);

-- The list surface reads one artifact's todos and issues by artifact, newest first; the viewer's
-- thread reads one issue's comments in order. Three reads, three indexes.
CREATE INDEX IF NOT EXISTS review_todo_artifact_idx
  ON review_todo (artifact_id, created_at, id);

CREATE INDEX IF NOT EXISTS review_issue_artifact_state_idx
  ON review_issue (artifact_id, state, number DESC);

CREATE INDEX IF NOT EXISTS review_issue_comment_issue_idx
  ON review_issue_comment (issue_id, created_at, id);
